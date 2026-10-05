/**
 * Server-only subscription access: reading a visitor's subscriptions, opening
 * the billing portal, and gating by tier.
 *
 * These calls need the store's secret API key, so they can only run here — the
 * `.server.ts` suffix keeps this module out of the browser bundle. Never move
 * this logic into a component, and never send the key to the client.
 *
 * The signed-in visitor is identified by their PocketBase token, which the
 * browser sends in the `Authorization` header. `getUserSubscriptions` and
 * `createManageUserSubscriptionUrl` take the `Request` and verify that token
 * themselves, so no caller can read or manage another visitor's subscriptions.
 * Use `requireUserId` when you gate your own `/api/*` handler by tier — from an
 * `action` (POST) only, never a `loader`: GET responses are edge-cached by URL
 * for all visitors, which would serve one subscriber's paid content to everyone
 * and never re-run these guards. A page `loader` cannot use any of this either,
 * because the session lives in `localStorage` where the server cannot see it.
 */
import { apiError } from '@/lib/api.server';

export type EcommerceBillingInterval = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type EcommerceSubscriptionStatus =
	| 'active'
	| 'trialing'
	| 'past_due'
	| 'canceled'
	| 'unpaid'
	| 'incomplete'
	| 'incomplete_expired'
	| 'paused';

export type EcommerceSubscription = {
	id: string;
	/** Plan product id. Generated at runtime, so match on `product_title` in generated code. */
	product_id: string;
	product_title: string;
	/** Billing period variant, e.g. "Monthly". */
	variant_title: string;
	billing_interval: EcommerceBillingInterval;
	status: EcommerceSubscriptionStatus;
	current_period_start: string;
	current_period_end: string;
	created_at: string;
	updated_at: string;
};

export type EcommerceCustomer = {
	id: string;
	email: string;
	created_at: string;
	updated_at: string;
	subscriptions: EcommerceSubscription[];
};

/** A subscription only grants access in these states. */
const ENTITLED_STATUSES: EcommerceSubscriptionStatus[] = ['active', 'trialing'];

const storeUrl = (path: string) =>
	`${process.env.ECOMMERCE_API_URL}/store/${process.env.ECOMMERCE_STORE_ID}${path}`;

const storeHeaders = () => ({
	'Accept': 'application/json',
	'Content-Type': 'application/json',
	'Authorization': `Bearer ${process.env.ECOMMERCE_API_KEY}`,
	...(process.env.PROXY_ENTRANCE_ID && { 'X-Proxy-Entrance-Id': process.env.PROXY_ENTRANCE_ID }),
});

const pocketbaseUrl = () => process.env.POCKETBASE_URL || 'http://localhost:8090';

const requireNonEmpty = (value: unknown, fieldLabel: string): string => {
	if (typeof value !== 'string' || value.trim() === '') {
		throw apiError(400, `${fieldLabel} is required`);
	}

	return value.trim();
};

/**
 * Verifies the caller's PocketBase token and returns their `users` record id.
 * Throws a 401 response, which `withApi` passes straight through.
 */
export const requireUserId = async (request: Request): Promise<string> => {
	const header = request.headers.get('authorization') ?? '';
	const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';

	if (!token) {
		throw apiError(401, 'Unauthorized');
	}

	const response = await fetch(`${pocketbaseUrl()}/api/collections/users/auth-refresh`, {
		method: 'POST',
		headers: { Authorization: token },
	}).catch(() => {
		throw new Error('Could not reach PocketBase to verify the session — is PocketBase running?');
	});

	if (!response.ok) {
		throw apiError(401, 'Unauthorized');
	}

	const { record } = (await response.json()) as { record?: { id?: string } };

	if (!record?.id) {
		throw apiError(401, 'Unauthorized');
	}

	return record.id;
};

/** The store customer for a PocketBase user, or null before their first checkout. */
const getCustomer = async (userId: string): Promise<EcommerceCustomer | null> => {
	const query = new URLSearchParams({ external_id: requireNonEmpty(userId, 'User ID') });
	const response = await fetch(storeUrl(`/customers?${query.toString()}`), {
		method: 'GET',
		headers: storeHeaders(),
	});

	if (response.status === 404) {
		return null;
	}

	if (!response.ok) {
		throw new Error(`Store customers request failed: ${response.status} ${await response.text()}`);
	}

	return (await response.json()) as EcommerceCustomer;
};

const subscriptionsForUser = async (userId: string): Promise<EcommerceSubscription[]> => {
	const customer = await getCustomer(userId);

	return customer?.subscriptions ?? [];
};

/**
 * Every subscription belonging to the signed-in visitor, in any status. Empty
 * before their first checkout.
 *
 * The visitor is resolved from the request's own token rather than from a
 * caller-supplied id, so this cannot be pointed at somebody else's account.
 */
export const getUserSubscriptions = async ({ request }: { request: Request }): Promise<EcommerceSubscription[]> =>
	subscriptionsForUser(await requireUserId(request));

/**
 * A one-off billing-portal URL where the signed-in visitor can change or cancel
 * a subscription. Redirect them to it; `returnUrl` is where the portal sends
 * them back.
 *
 * The portal is opened for the visitor who owns the request's token — never for
 * an id supplied by the caller, which would hand out someone else's billing
 * portal.
 *
 * Subscriptions bought with test payment methods have no portal — the store
 * answers "No Stripe payment provider configured", which surfaces here as
 * `StripeNotConfiguredError` and should be shown as a message, not a crash.
 */
export const createManageUserSubscriptionUrl = async ({
	request,
	returnUrl,
	subscriptionId,
}: {
	request: Request;
	returnUrl: string;
	subscriptionId: string;
}): Promise<string> => {
	const userId = await requireUserId(request);
	const response = await fetch(storeUrl('/billing/portal-session'), {
		method: 'POST',
		headers: storeHeaders(),
		body: JSON.stringify({
			external_user_id: requireNonEmpty(userId, 'User ID'),
			return_url: requireNonEmpty(returnUrl, 'Return URL'),
			subscription_id: requireNonEmpty(subscriptionId, 'Subscription ID'),
		}),
	});

	if (!response.ok) {
		const details = await response.text();

		if (details.includes('No Stripe payment provider configured')) {
			throw new StripeNotConfiguredError();
		}

		throw new Error(`Store billing portal request failed: ${response.status} ${details}`);
	}

	const { url } = (await response.json()) as { url: string };

	return url;
};

export class StripeNotConfiguredError extends Error {
	code = 'STRIPE_NOT_CONFIGURED';

	constructor() {
		super("Test subscriptions can't be managed. Purchase with a real payment method to enable full access");
		this.name = 'StripeNotConfiguredError';
	}
}

/**
 * The implicit tier every signed-in user has, matching `FREE_TIER_TITLE` in
 * `@/api/ecommerce-subscriptions-api` so browser and server gates agree.
 */
export const FREE_TIER_TITLE = 'Free';

/**
 * Whether the user is entitled to the plan with this exact title.
 *
 * Match on the title, not the product id: the id is created at runtime and is
 * not knowable while writing code. Titles must match exactly — "Creator" is
 * not "Creator Plan". `FREE_TIER_TITLE` holds for any signed-in user.
 */
export const hasTierByTitle = async (userId: string, title: string): Promise<boolean> => {
	if (!userId) {
		return false;
	}

	if (title === FREE_TIER_TITLE) {
		return true;
	}

	const subscriptions = await subscriptionsForUser(userId);

	return subscriptions.some(
		subscription => subscription.product_title === title && ENTITLED_STATUSES.includes(subscription.status),
	);
};

/**
 * Whether any of these titles entitles the user — the server counterpart to
 * `isSubscribedToAny`, for records carrying their own list of allowed tiers.
 */
export const hasAnyTierByTitle = async (userId: string, titles: string[] | null | undefined): Promise<boolean> => {
	if (!userId || !Array.isArray(titles) || titles.length === 0) {
		return false;
	}

	if (titles.includes(FREE_TIER_TITLE)) {
		return true;
	}

	const subscriptions = await subscriptionsForUser(userId);

	return subscriptions.some(
		subscription => titles.includes(subscription.product_title) && ENTITLED_STATUSES.includes(subscription.status),
	);
};

/**
 * Guards a paid `/api/*` handler. Throws a 403 response, which `withApi` passes
 * straight through:
 *
 *   const userId = await requireUserId(request);
 *   await requireTierByTitle(userId, 'Creator');
 */
export const requireTierByTitle = async (userId: string, title: string): Promise<void> => {
	if (!(await hasTierByTitle(userId, title))) {
		throw apiError(403, `${title} subscription required`);
	}
};

/** Product-id counterpart to `hasTierByTitle`, for ids read from a live subscription. */
export const hasTier = async (userId: string, productId: string): Promise<boolean> => {
	if (!userId) {
		return false;
	}

	const subscriptions = await subscriptionsForUser(userId);

	return subscriptions.some(
		subscription => subscription.product_id === productId && ENTITLED_STATUSES.includes(subscription.status),
	);
};
