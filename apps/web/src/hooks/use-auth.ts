import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
	SERVER_SESSION_STATE,
	getSessionState,
	loadSession,
	login,
	logout,
	signup,
	subscribeSession,
} from '@/lib/session';

/**
 * Session state for the signed-in user: user, isAuthed, isLoading, login,
 * signup, logout. No provider to mount — every caller reads the same store in
 * `@/lib/session`.
 *
 * The server never renders who is signed in (pages may be cached for every
 * visitor), so the session is filled in after hydration. Render on
 * `isLoading` (a spinner, a skeleton) instead of the signed-out state, or a
 * signed-in visitor sees a "Sign in" button flash on every page load.
 */
export function useAuth() {
	const { user, loaded } = useSyncExternalStore(subscribeSession, getSessionState, () => SERVER_SESSION_STATE);

	useEffect(() => {
		void loadSession();
	}, []);

	return useMemo(
		() => ({
			user,
			isAuthed: Boolean(user),
			isLoading: !loaded,
			login,
			signup,
			logout,
		}),
		[user, loaded],
	);
}

export default useAuth;
