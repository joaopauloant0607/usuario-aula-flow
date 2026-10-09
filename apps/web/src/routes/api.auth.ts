/**
 * POST /api/auth — sign up, sign in, sign out, the current user, and password
 * resets. Called from the browser through `@/lib/session`.
 *
 * POST only: the CDN in front of the site may cache GET responses by URL for
 * every visitor, and these answers depend on who is asking.
 */
import { apiError, json, readJsonBody, withApi } from '@/lib/api.server';
import {
	checkPassword,
	clearedSessionCookie,
	createAccount,
	endSession,
	getSession,
	resetPassword,
	sendPasswordReset,
	startSession,
} from '@/lib/auth.server';
import { clientIdentifier, createRateLimiter } from '@/lib/rate-limit.server';
import { siteOrigin } from '@/lib/site-origin.server';

type AuthRequest = {
	action?: string;
	email?: unknown;
	password?: unknown;
	name?: unknown;
	token?: unknown;
};

// Per caller (and per e-mail where there is one), on top of the general /api limit.
const loginLimit = createRateLimiter({ maxRequests: 10, windowSeconds: 15 * 60 });
const signupLimit = createRateLimiter({ maxRequests: 10, windowSeconds: 60 * 60 });
const resetLimit = createRateLimiter({ maxRequests: 5, windowSeconds: 15 * 60 });

const tooMany = () => apiError(429, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
const withCookie = (body: unknown, cookie: string) => json(body, { headers: { 'Set-Cookie': cookie } });

export const action = withApi(async ({ request }) => {
	if (request.method !== 'POST') return apiError(405, 'Method not allowed');
	// A cross-site form cannot send JSON, so this also blocks forged requests.
	if (!request.headers.get('content-type')?.startsWith('application/json')) {
		return apiError(415, 'Expected application/json');
	}

	const body = (await readJsonBody<AuthRequest | null>(request)) ?? {};
	const caller = clientIdentifier(request);
	const emailKey = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

	switch (body.action) {
		case 'me': {
			const session = await getSession(request);
			if (!session) return json({ user: null });
			return session.renewCookie ? withCookie({ user: session.user }, session.renewCookie) : json({ user: session.user });
		}
		case 'signup': {
			if (!(await signupLimit(caller))) return tooMany();
			const user = await createAccount(body);
			return withCookie({ user }, await startSession(user.id));
		}
		case 'login': {
			if (!(await loginLimit(`${caller}:${emailKey}`))) return tooMany();
			const user = await checkPassword(body.email, body.password);
			if (!user) return apiError(400, 'E-mail ou senha incorretos.');
			return withCookie({ user }, await startSession(user.id));
		}
		case 'logout': {
			await endSession(request);
			return withCookie({ ok: true }, clearedSessionCookie());
		}
		case 'request-reset': {
			if (!(await resetLimit(`${caller}:${emailKey}`))) return tooMany();
			await sendPasswordReset(body.email, (process.env.APP_URL || siteOrigin(request)).replace(/\/+$/, ''));
			return json({ ok: true });
		}
		case 'confirm-reset': {
			if (!(await resetLimit(caller))) return tooMany();
			const user = await resetPassword(body.token, body.password);
			return withCookie({ user }, await startSession(user.id));
		}
		default:
			return apiError(400, 'Unknown action');
	}
});

export const loader = withApi(async () => apiError(405, 'Method not allowed'));
