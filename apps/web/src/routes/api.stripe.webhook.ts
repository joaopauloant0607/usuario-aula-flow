/**
 * POST /api/stripe/webhook — Stripe tells the app about payments and
 * subscription changes. Authenticated by its signature, not by a session.
 *
 * Point the Stripe webhook endpoint at https://<your-domain>/api/stripe/webhook
 * and subscribe it to: checkout.session.completed,
 * customer.subscription.created, customer.subscription.updated and
 * customer.subscription.deleted.
 */
import { apiError, json, readRawBody, withApi } from '@/lib/api.server';
import { applyStripeEvent, verifyStripeSignature } from '@/lib/billing.server';

export const action = withApi(
	async ({ request }) => {
		if (request.method !== 'POST') return apiError(405, 'Method not allowed');

		const rawBody = await readRawBody(request);
		if (!verifyStripeSignature(rawBody, request.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET)) {
			return apiError(400, 'Invalid signature');
		}

		let event;
		try {
			event = JSON.parse(rawBody);
		} catch {
			return apiError(400, 'Invalid JSON body');
		}
		if (typeof event?.type !== 'string' || !event.data?.object) return apiError(400, 'Invalid event');

		// A thrown error becomes a 500, which makes Stripe retry the delivery.
		await applyStripeEvent(event);
		return json({ received: true });
	},
	// Stripe sends from a few shared addresses; the signature is the protection here.
	{ rateLimit: false },
);

export const loader = withApi(async () => apiError(405, 'Method not allowed'));
