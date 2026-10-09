import { redirect } from 'react-router';
import { loadSession } from '@/lib/session';

/**
 * Guard a protected route. The session is checked from the browser, so this
 * belongs in `clientLoader` — never in a server `loader`: the CDN in front of
 * the site may cache server GET responses (HTML, `.data`) by URL for ALL
 * visitors, so server-rendered output must never depend on who is asking. Put
 * the guard on a layout route to cover a whole section at once:
 *
 *   export const clientLoader = async () => ({ user: await requireAuth() });
 *   clientLoader.hydrate = true as const;
 *   export function HydrateFallback() { return <div />; }
 *
 * `hydrate` is what makes the check run on a hard page load, and
 * `HydrateFallback` keeps the protected UI from rendering for a frame before
 * the redirect.
 */
export async function requireAuth(redirectTo = '/login') {
	const user = await loadSession();

	if (!user) {
		throw redirect(redirectTo);
	}

	return user;
}

export default requireAuth;
