/**
 * POST /api/ecommerce/subscriptions — the signed-in visitor's subscriptions.
 *
 * Call it from the browser through `getUserSubscriptions()` in
 * `@/api/ecommerce-subscriptions-api`; the session cookie identifies the visitor.
 * Register this route in `src/routes.ts` or it answers 404.
 *
 * POST, not GET, even though it only reads: published sites edge-cache GET
 * responses by URL — including error responses — so one anonymous 401 on a
 * GET here would be cached and served to every signed-in subscriber for up
 * to a week. POST responses are never cached.
 */
import { apiError, json, withApi } from '@/lib/api.server';
import { getUserSubscriptions } from '@/lib/ecommerce-subscriptions.server';

export const action = withApi(async ({ request }) => {
	if (request.method !== 'POST') {
		return apiError(405, 'Method not allowed');
	}

	return json({ subscriptions: await getUserSubscriptions({ request }) });
});
