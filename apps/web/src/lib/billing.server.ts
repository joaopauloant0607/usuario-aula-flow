/**
 * Stripe billing, without the Stripe SDK: payment links start a subscription,
 * a signed webhook tells us what happened, and the `billing` table is what
 * the app trusts when deciding who may use it.
 *
 * Environment:
 *   STRIPE_WEBHOOK_SECRET  signing secret of the webhook endpoint (whsec_...)
 *   STRIPE_LINK_MONTHLY    payment link of the monthly plan
 *   STRIPE_LINK_ANNUAL     payment link of the annual plan
 *   STRIPE_PORTAL_URL      customer portal login link (optional)
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getDb, nowStamp } from '@/lib/db.server';

const DAY_MS = 24 * 60 * 60 * 1000;
/** A paid-up subscriber keeps access this long past the period end, in case a renewal webhook is late. */
const GRACE_MS = 3 * DAY_MS;
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const ENTITLED_STATUSES = ['active', 'trialing'];

// ---- webhook signature ----

/** Checks a `Stripe-Signature` header against the raw body. */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string | undefined): boolean {
	if (!secret || !header) return false;
	const parts = header.split(',').map((part) => part.trim().split('='));
	const timestamp = parts.find(([key]) => key === 't')?.[1];
	const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
	if (!timestamp || signatures.length === 0) return false;
	if (Math.abs(Date.now() / 1000 - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) return false;

	const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest();
	return signatures.some((signature) => {
		const candidate = Buffer.from(signature, 'hex');
		return candidate.length === expected.length && timingSafeEqual(candidate, expected);
	});
}

// ---- events ----

type StripeEvent = { id: string; type: string; data: { object: Record<string, any> } };

async function upsert(customer: string, fields: { user?: string; subscription?: string; status?: string; plan?: string; period_end?: number }) {
	const db = await getDb();
	const [row] = await db.all<{ user: string; subscription: string; status: string; plan: string; period_end: number }>(
		'SELECT `user`, `subscription`, `status`, `plan`, `period_end` FROM `billing` WHERE `customer` = ?',
		[customer],
	);
	// Webhooks can arrive out of order, so a missing field keeps what is already stored.
	const next = {
		user: fields.user || row?.user || '',
		subscription: fields.subscription || row?.subscription || '',
		status: fields.status || row?.status || 'incomplete',
		plan: fields.plan || row?.plan || '',
		period_end: fields.period_end ?? Number(row?.period_end ?? 0),
	};
	if (row) {
		await db.run(
			'UPDATE `billing` SET `user` = ?, `subscription` = ?, `status` = ?, `plan` = ?, `period_end` = ?, `updated` = ? WHERE `customer` = ?',
			[next.user, next.subscription, next.status, next.plan, next.period_end, nowStamp(), customer],
		);
	} else {
		await db.run(
			'INSERT INTO `billing` (`customer`, `user`, `subscription`, `status`, `plan`, `period_end`, `updated`) VALUES (?, ?, ?, ?, ?, ?, ?)',
			[customer, next.user, next.subscription, next.status, next.plan, next.period_end, nowStamp()],
		);
	}
}

/** Reads the end of the current period, which newer API versions move onto the subscription item. */
function periodEndMs(subscription: Record<string, any>): number | undefined {
	const seconds = subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end;
	return typeof seconds === 'number' ? seconds * 1000 : undefined;
}

const planOf = (subscription: Record<string, any>) => {
	const interval = subscription.items?.data?.[0]?.price?.recurring?.interval ?? subscription.plan?.interval;
	return interval === 'year' ? 'annual' : interval === 'month' ? 'monthly' : '';
};

/** Applies one verified Stripe event to the `billing` table. Unknown events are ignored. */
export async function applyStripeEvent(event: StripeEvent) {
	const object = event.data.object;
	switch (event.type) {
		case 'checkout.session.completed': {
			const user = typeof object.client_reference_id === 'string' ? object.client_reference_id : '';
			if (!user || !object.customer || object.mode !== 'subscription') return;
			// Provisional until the subscription event brings the real period; the link only exists once paid.
			const paid = object.payment_status === 'paid' || object.payment_status === 'no_payment_required';
			await upsert(String(object.customer), {
				user,
				subscription: object.subscription ? String(object.subscription) : undefined,
				...(paid && { status: 'active', period_end: Date.now() + 32 * DAY_MS }),
			});
			return;
		}
		case 'customer.subscription.created':
		case 'customer.subscription.updated':
		case 'customer.subscription.deleted': {
			if (!object.customer) return;
			await upsert(String(object.customer), {
				subscription: String(object.id ?? ''),
				status: event.type === 'customer.subscription.deleted' ? 'canceled' : String(object.status ?? ''),
				plan: planOf(object),
				period_end: periodEndMs(object),
			});
			return;
		}
		case 'invoice.payment_failed': {
			// The matching subscription.updated event carries the new status; nothing to do here.
			return;
		}
		default:
			return;
	}
}

// ---- reading ----

/** Whether this user has a paid, current subscription. */
export async function hasPaidSubscription(userId: string): Promise<boolean> {
	const db = await getDb();
	const rows = await db.all<{ status: string; period_end: number }>(
		'SELECT `status`, `period_end` FROM `billing` WHERE `user` = ?',
		[userId],
	);
	const now = Date.now();
	return rows.some((row) => ENTITLED_STATUSES.includes(row.status) && Number(row.period_end) + GRACE_MS > now);
}

// ---- links ----

export type CheckoutLinks = { monthly: string | null; annual: string | null; portal: string | null };

function withParams(base: string | undefined, params: Record<string, string>) {
	if (!base) return null;
	try {
		const url = new URL(base);
		for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
		return url.toString();
	} catch {
		return null;
	}
}

/**
 * Payment links tied to the signed-in user: `client_reference_id` is how the
 * webhook knows which account paid, so a link must never be built from
 * anything the browser sends.
 */
export function checkoutLinks(user: { id: string; email: string }): CheckoutLinks {
	const params = { client_reference_id: user.id, prefilled_email: user.email };
	return {
		monthly: withParams(process.env.STRIPE_LINK_MONTHLY, params),
		annual: withParams(process.env.STRIPE_LINK_ANNUAL, params),
		portal: withParams(process.env.STRIPE_PORTAL_URL, { prefilled_email: user.email }),
	};
}
