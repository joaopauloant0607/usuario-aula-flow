/**
 * POST /api/data — list, create, update and delete the signed-in
 * professional's students, classes, payments and class sessions. Called from
 * the browser through `@/lib/teaching`.
 *
 * POST only, even for reads: the CDN in front of the site may cache GET
 * responses by URL for every visitor.
 */
import { apiError, readJsonBody, withApi } from '@/lib/api.server';
import { requireUser } from '@/lib/auth.server';
import { createRateLimiter } from '@/lib/rate-limit.server';
import { handleDataRequest } from '@/lib/records.server';

// Per signed-in user instead of per address: screens make several calls each,
// and generating a month of charges makes one per student.
const userLimit = createRateLimiter({ maxRequests: 1000, windowSeconds: 5 * 60 });

export const action = withApi(async ({ request }) => {
	if (request.method !== 'POST') return apiError(405, 'Method not allowed');
	// A cross-site form cannot send JSON, so this also blocks forged requests.
	if (!request.headers.get('content-type')?.startsWith('application/json')) {
		return apiError(415, 'Expected application/json');
	}

	const user = await requireUser(request);
	if (!(await userLimit(user.id))) return apiError(429, 'Too many requests, please try again later');
	return handleDataRequest(user.id, (await readJsonBody<Record<string, unknown> | null>(request)) ?? {});
}, { rateLimit: false });

export const loader = withApi(async () => apiError(405, 'Method not allowed'));
