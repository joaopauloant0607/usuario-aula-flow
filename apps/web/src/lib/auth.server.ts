/**
 * Accounts and sign-in sessions, stored in the app's own database.
 *
 * Passwords are hashed with scrypt. A session is a random token in an
 * httpOnly cookie; the database keeps only its SHA-256, so a leaked table
 * cannot be used to sign in.
 *
 * Only read the session from POST handlers (`/api/*` actions). Page HTML and
 * GET responses may be cached by the CDN in front of the site and shown to
 * every visitor, so they must never depend on who is asking.
 */
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { apiError, json } from '@/lib/api.server';
import { getDb, isUniqueViolation, newId, nowStamp } from '@/lib/db.server';
import { sendMail } from '@/lib/mail.server';

export type SessionUser = { id: string; email: string; name: string };

const COOKIE_NAME = 'aulaflow_session';
const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_DAYS = 30;
const RESET_TTL_MS = 60 * 60 * 1000;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

// ---- passwords ----

const scryptAsync = (password: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number }) =>
	new Promise<Buffer>((resolve, reject) => {
		scrypt(password, salt, keylen, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key)));
	});

async function hashPassword(password: string) {
	const salt = randomBytes(16);
	const key = await scryptAsync(password, salt, SCRYPT.keylen, SCRYPT);
	return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

async function verifyPassword(password: string, stored: string) {
	const [scheme, N, r, p, salt, hash] = stored.split('$');
	if (scheme !== 'scrypt' || !salt || !hash) return false;
	const expected = Buffer.from(hash, 'base64');
	const key = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, {
		N: Number(N),
		r: Number(r),
		p: Number(p),
	});
	return timingSafeEqual(key, expected);
}

/** Hashed once, so a login for an unknown e-mail takes as long as a wrong password. */
let dummyHash: Promise<string> | null = null;

// ---- validation ----

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanEmail(value: unknown) {
	const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
	if (!EMAIL_RE.test(email) || email.length > 255) throw apiError(400, 'E-mail inválido.');
	return email;
}

function cleanPassword(value: unknown) {
	if (typeof value !== 'string' || value.length < 8 || value.length > 200) {
		throw apiError(400, 'A senha precisa ter pelo menos 8 caracteres.');
	}
	return value;
}

// ---- sessions ----

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

function readCookie(request: Request, name: string) {
	for (const part of (request.headers.get('cookie') ?? '').split(';')) {
		const [key, ...rest] = part.trim().split('=');
		if (key === name) return decodeURIComponent(rest.join('='));
	}
	return '';
}

function sessionCookie(token: string, maxAgeSeconds: number) {
	const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
	return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export const clearedSessionCookie = () => sessionCookie('', 0);

/** Starts a session for the user and returns the Set-Cookie header value. */
export async function startSession(userId: string) {
	const db = await getDb();
	const token = randomBytes(32).toString('base64url');
	const now = Date.now();
	await db.run('DELETE FROM `sessions` WHERE `expires_at` < ?', [now]);
	await db.run('INSERT INTO `sessions` (`id`, `user`, `expires_at`) VALUES (?, ?, ?)', [
		sha256(token),
		userId,
		now + SESSION_DAYS * DAY_MS,
	]);
	return sessionCookie(token, SESSION_DAYS * 24 * 60 * 60);
}

/**
 * The signed-in user, or null. `renewCookie` is set when the session was
 * extended and the browser should receive the cookie again.
 */
export async function getSession(request: Request): Promise<{ user: SessionUser; renewCookie?: string } | null> {
	const token = readCookie(request, COOKIE_NAME);
	if (!token) return null;
	const db = await getDb();
	const [row] = await db.all<SessionUser & { expires_at: number }>(
		'SELECT u.`id`, u.`email`, u.`name`, s.`expires_at` FROM `sessions` s JOIN `users` u ON u.`id` = s.`user` WHERE s.`id` = ?',
		[sha256(token)],
	);
	const now = Date.now();
	if (!row || Number(row.expires_at) < now) return null;

	const user = { id: row.id, email: row.email, name: row.name };
	// Keep active users signed in: push the expiry forward at most once a day.
	if (Number(row.expires_at) - now < (SESSION_DAYS - 1) * DAY_MS) {
		await db.run('UPDATE `sessions` SET `expires_at` = ? WHERE `id` = ?', [now + SESSION_DAYS * DAY_MS, sha256(token)]);
		return { user, renewCookie: sessionCookie(token, SESSION_DAYS * 24 * 60 * 60) };
	}
	return { user };
}

/** The signed-in user, or a 401 response (which `withApi` passes through). */
export async function requireUser(request: Request): Promise<SessionUser> {
	const session = await getSession(request);
	if (!session) throw apiError(401, 'Unauthorized');
	return session.user;
}

export async function endSession(request: Request) {
	const token = readCookie(request, COOKIE_NAME);
	if (token) await (await getDb()).run('DELETE FROM `sessions` WHERE `id` = ?', [sha256(token)]);
}

// ---- accounts ----

export async function createAccount(input: { email?: unknown; password?: unknown; name?: unknown }): Promise<SessionUser> {
	const email = cleanEmail(input.email);
	const password = cleanPassword(input.password);
	const name = typeof input.name === 'string' ? input.name.trim().slice(0, 200) : '';
	const db = await getDb();

	const emailTaken = () => json({ error: 'Este e-mail já tem uma conta.', code: 'email_taken' }, { status: 400 });
	const [taken] = await db.all('SELECT `id` FROM `users` WHERE `email` = ?', [email]);
	if (taken) throw emailTaken();

	const user = { id: newId(), email, name };
	const now = nowStamp();
	await db
		.run('INSERT INTO `users` (`id`, `email`, `name`, `password_hash`, `created`, `updated`) VALUES (?, ?, ?, ?, ?, ?)', [
			user.id,
			email,
			name,
			await hashPassword(password),
			now,
			now,
		])
		.catch((error) => {
			throw isUniqueViolation(error) ? emailTaken() : error;
		});
	return user;
}

/** The user for these credentials, or null when the e-mail or the password is wrong. */
export async function checkPassword(emailInput: unknown, password: unknown): Promise<SessionUser | null> {
	const email = typeof emailInput === 'string' ? emailInput.trim().toLowerCase() : '';
	const db = await getDb();
	const [row] = await db.all<SessionUser & { password_hash: string }>(
		'SELECT `id`, `email`, `name`, `password_hash` FROM `users` WHERE `email` = ?',
		[email],
	);
	if (typeof password !== 'string' || !row) {
		dummyHash ??= hashPassword('not a real password');
		await verifyPassword(String(password), await dummyHash);
		return null;
	}
	if (!(await verifyPassword(password, row.password_hash))) return null;
	return { id: row.id, email: row.email, name: row.name };
}

/** E-mails a reset link when the account exists. Says nothing either way, so e-mails cannot be probed. */
export async function sendPasswordReset(emailInput: unknown, appUrl: string) {
	const email = cleanEmail(emailInput);
	const db = await getDb();
	const [user] = await db.all<{ id: string }>('SELECT `id` FROM `users` WHERE `email` = ?', [email]);
	if (!user) return;

	const token = randomBytes(32).toString('base64url');
	await db.run('DELETE FROM `password_resets` WHERE `user` = ? OR `expires_at` < ?', [user.id, Date.now()]);
	await db.run('INSERT INTO `password_resets` (`id`, `user`, `expires_at`) VALUES (?, ?, ?)', [
		sha256(token),
		user.id,
		Date.now() + RESET_TTL_MS,
	]);

	const link = `${appUrl}/redefinir-senha?token=${token}`;
	await sendMail({
		to: email,
		subject: 'Redefinir sua senha do Aula Flow',
		text: [
			'Olá!',
			'',
			'Recebemos um pedido para redefinir a senha da sua conta no Aula Flow.',
			'Para criar uma senha nova, abra o link abaixo. Ele vale por 1 hora.',
			'',
			link,
			'',
			'Se não foi você, ignore este e-mail. Sua senha continua a mesma.',
		].join('\n'),
	});
}

/** Sets a new password from a reset link and signs the user out everywhere else. */
export async function resetPassword(tokenInput: unknown, passwordInput: unknown): Promise<SessionUser> {
	const password = cleanPassword(passwordInput);
	const token = typeof tokenInput === 'string' ? tokenInput : '';
	const db = await getDb();
	const [row] = await db.all<SessionUser & { expires_at: number }>(
		'SELECT u.`id`, u.`email`, u.`name`, r.`expires_at` FROM `password_resets` r JOIN `users` u ON u.`id` = r.`user` WHERE r.`id` = ?',
		[sha256(token)],
	);
	if (!token || !row || Number(row.expires_at) < Date.now()) {
		throw json({ error: 'Este link expirou ou já foi usado.', code: 'invalid_token' }, { status: 400 });
	}

	const hash = await hashPassword(password);
	await db.transaction(async (tx) => {
		await tx.run('UPDATE `users` SET `password_hash` = ?, `updated` = ? WHERE `id` = ?', [hash, nowStamp(), row.id]);
		await tx.run('DELETE FROM `password_resets` WHERE `user` = ?', [row.id]);
		await tx.run('DELETE FROM `sessions` WHERE `user` = ?', [row.id]);
	});
	return { id: row.id, email: row.email, name: row.name };
}
