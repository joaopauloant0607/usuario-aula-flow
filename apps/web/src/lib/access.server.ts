/**
 * Who may use the app: only accounts with a paid, current subscription.
 *
 * Checked from POST handlers only (`/api/*` actions), like the session itself.
 */
import { json } from '@/lib/api.server';
import { hasPaidSubscription } from '@/lib/billing.server';

export type Access = {
	status: 'active' | 'expired';
};

export async function getAccess(userId: string): Promise<Access> {
	return { status: (await hasPaidSubscription(userId)) ? 'active' : 'expired' };
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
