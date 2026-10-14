/**
 * Who may use the app: every account gets a free trial counted from sign-up,
 * and after it ends only a paying subscriber keeps access.
 *
 * Checked from POST handlers only (`/api/*` actions), like the session itself.
 */
import { json } from '@/lib/api.server';
import { getDb } from '@/lib/db.server';
import { hasPaidSubscription } from '@/lib/billing.server';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Trial length in days. `TRIAL_DAYS` overrides it without a code change. */
const trialDays = () => {
	const days = Number(process.env.TRIAL_DAYS);
	return Number.isFinite(days) && days >= 0 ? days : 7;
};

export type Access = {
	status: 'trial' | 'active' | 'expired';
	/** ISO date the free trial ends (or ended). */
	trial_ends_at: string;
};

/** `created` is stored as "YYYY-MM-DD HH:MM:SS.sssZ" (see `nowStamp`). */
const parseStamp = (stamp: string) => new Date(String(stamp).replace(' ', 'T')).getTime();

export async function getAccess(userId: string): Promise<Access> {
	const db = await getDb();
	const [row] = await db.all<{ created: string }>('SELECT `created` FROM `users` WHERE `id` = ?', [userId]);
	const created = row ? parseStamp(row.created) : NaN;
	const trialEnds = (Number.isFinite(created) ? created : Date.now()) + trialDays() * DAY_MS;
	const trial_ends_at = new Date(trialEnds).toISOString();

	if (await hasPaidSubscription(userId)) return { status: 'active', trial_ends_at };
	if (Date.now() < trialEnds) return { status: 'trial', trial_ends_at };
	return { status: 'expired', trial_ends_at };
}

/** Throws a 402 response (passed through by `withApi`) once the trial is over and nothing is paid. */
export async function requireAccess(userId: string): Promise<Access> {
	const access = await getAccess(userId);
	if (access.status === 'expired') {
		throw json(
			{ error: 'Seu teste grátis terminou. Assine um plano para continuar usando o Aula Flow.', code: 'subscription_required' },
			{ status: 402 },
		);
	}
	return access;
}
