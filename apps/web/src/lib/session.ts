/**
 * Browser-side sign-in state. The session itself is an httpOnly cookie the
 * server sets; this module only remembers who the server said is signed in,
 * so every component shares one answer and the server is asked once per visit.
 */
export type SessionUser = { id: string; email: string; name: string };

type State = { user: SessionUser | null; loaded: boolean };

let state: State = { user: null, loaded: false };
const listeners = new Set<() => void>();
let pending: Promise<SessionUser | null> | null = null;

function setState(next: State) {
	state = next;
	for (const listener of listeners) listener();
}

export const getSessionState = () => state;
export const SERVER_SESSION_STATE: State = { user: null, loaded: false };

export function subscribeSession(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** Error from an `/api/*` call; `code` is set for the cases a screen handles specially. */
export class ApiError extends Error {
	status: number;
	code?: string;

	constructor(message: string, status: number, code?: string) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.code = code;
	}
}

/** POSTs JSON to an `/api/*` route and returns the JSON answer, or throws `ApiError`. */
export async function postJson<T>(path: string, body: unknown): Promise<T> {
	const response = await fetch(path, {
		method: 'POST',
		credentials: 'same-origin',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	const data = (await response.json().catch(() => null)) as { error?: string; message?: string; code?: string } | null;
	if (!response.ok) {
		throw new ApiError(data?.error || data?.message || `HTTP ${response.status}`, response.status, data?.code);
	}
	return data as T;
}

const auth = <T>(body: Record<string, unknown>) => postJson<T>('/api/auth', body);

/** Asks the server who is signed in, once per visit unless `force` is set. */
export function loadSession(force = false): Promise<SessionUser | null> {
	if (state.loaded && !force) return Promise.resolve(state.user);
	pending ??= auth<{ user: SessionUser | null }>({ action: 'me' })
		.then(({ user }) => {
			setState({ user, loaded: true });
			return user;
		})
		.catch(() => {
			setState({ user: null, loaded: true });
			return null;
		})
		.finally(() => {
			pending = null;
		});
	return pending;
}

/** Called when the server answers 401: the session ended (expired, or signed out elsewhere). */
export function sessionEnded() {
	setState({ user: null, loaded: true });
}

export async function login(email: string, password: string) {
	const { user } = await auth<{ user: SessionUser }>({ action: 'login', email, password });
	setState({ user, loaded: true });
	return user;
}

export async function signup(email: string, password: string, extraFields: { name?: string } = {}) {
	const { user } = await auth<{ user: SessionUser }>({ action: 'signup', email, password, ...extraFields });
	setState({ user, loaded: true });
	return user;
}

export async function logout() {
	setState({ user: null, loaded: true });
	await auth({ action: 'logout' }).catch(() => undefined);
}

/** E-mails a reset link if the account exists. Resolves the same either way. */
export async function requestPasswordReset(email: string) {
	await auth({ action: 'request-reset', email });
}

/** Sets a new password from the e-mailed link and signs the user in. */
export async function confirmPasswordReset(token: string, password: string) {
	const { user } = await auth<{ user: SessionUser }>({ action: 'confirm-reset', token, password });
	setState({ user, loaded: true });
	return user;
}
