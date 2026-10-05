/**
 * POST /api/ecommerce/subscriptions/manage — billing-portal URL for one of the
 * signed-in visitor's subscriptions.
 *
 * Call it from the browser through `getManageSubscriptionUrl()` in
 * `@/api/ecommerce-subscriptions-api`. Register this route in `src/routes.ts` or
 * it answers 404.
 */
import { apiError, json, readJsonBody, withApi } from '@/lib/api.server';
import {
	StripeNotConfiguredError,
	createManageUserSubscriptionUrl,
} from '@/lib/ecommerce-subscriptions.server';

type ManageRequest = {
	subscriptionId?: string;
	returnUrl?: string;
};

export const action = withApi(async ({ request }) => {
	if (request.method !== 'POST') {
		return apiError(405, 'Method not allowed');
	}

	const { subscriptionId, returnUrl } = await readJsonBody<ManageRequest>(request);

	if (!subscriptionId || !returnUrl) {
		return apiError(400, 'subscriptionId and returnUrl are required');
	}

	try {
		return json({ url: await createManageUserSubscriptionUrl({ request, returnUrl, subscriptionId }) });
	} catch (error) {
		// Test-mode purchases have no portal; the UI shows this as a message.
		if (error instanceof StripeNotConfiguredError) {
			return json({ code: error.code, message: error.message }, { status: 409 });
		}

		throw error;
	}
});
