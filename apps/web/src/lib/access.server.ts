/**
 * Who may use the app: only accounts with a paid, current subscription.
 *
 * Checked from POST handlers only (`/api/*` actions), like the session itself.
 */
import { json } from '@/lib/api.server';
import { hasPaidSubscription } from '@/lib/billing.server';
import { getDb } from '@/lib/db.server';

export type Access = {
	status: 'active' | 'expired';
};

/**
 * E-mails that always have access without paying (owner, partners, testers),
 * from `FREE_ACCESS_EMAILS`, comma-separated. Matching is case-insensitive.
 */
async function hasFreeAccess(userId: string): Promise<boolean> {
	const allowed = (process.env.FREE_ACCESS_EMAILS ?? '')
		.split(',')
		.map((email) => email.trim().toLowerCase())
		.filter(Boolean);
	if (allowed.length === 0) return false;
	const db = await getDb();
	const [row] = await db.all<{ email: string }>('SELECT `email` FROM `users` WHERE `id` = ?', [userId]);
	return !!row && allowed.includes(String(row.email).toLowerCase());
}

export async function getAccess(userId: string): Promise<Access> {
	const allowed = (await hasFreeAccess(userId)) || (await hasPaidSubscription(userId));
	return { status: allowed ? 'active' : 'expired' };
}

/** Throws a 402 response (passed through by `withApi`) when the account has no active subscription. */
export async function requireAccess(userId: string): Promise<Access> {
	const access = await getAccess(userId);
	if (access.status === 'expired') {
		throw json(
			{ error: 'Assine um plano para usar o Aula Flow.', code: 'subscription_required' },
			{ status: 402 },
		);
	}
	return access;
}
