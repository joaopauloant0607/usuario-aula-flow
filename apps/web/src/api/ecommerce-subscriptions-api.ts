/**
 * Browser-side subscriptions client: what the signed-in visitor is subscribed
 * to, starting a subscription checkout, and opening the billing portal.
 *
 * Plans themselves are ordinary products — load them with
 * `getProducts({ type: 'subscription' })` from `@/api/ecommerce-api`, ideally in a
 * route `loader` so the pricing page renders server-side. Everything in this
 * file is per-visitor, so it runs in the browser only: call it from an effect, a
 * `clientLoader`, or an event handler, never from a server `loader`.
 *
 * `getUserSubscriptions` and `getManageSubscriptionUrl` are backed by resource
 * routes that must be registered in `src/routes.ts`:
 *
 *   route('api/ecommerce/subscriptions', 'routes/api.ecommerce.subscriptions.ts'),
 *   route('api/ecommerce/subscriptions/manage', 'routes/api.ecommerce.subscriptions.manage.ts'),
 *
 * Without those two lines every call here answers 404.
 */
import pb from '@/lib/pocketbase-client';
import { initializeCheckout } from '@/api/ecommerce-api';

export type EcommerceBillingInterval = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type EcommerceSubscriptionStatus =
	| 'active'
	| 'trialing'
	| 'past_due'
	| 'canceled'
	| 'unpaid'
	| 'incomplete'
	| 'incomplete_expired'
	| 'paused';

export type EcommerceSubscription = {
	id: string;
	/** Plan product id. Created at runtime, so gate on `product_title` instead. */
	product_id: string;
	/** Plan name, e.g. "Creator". This is what tier checks compare. */
	product_title: string;
	/** Billing period variant, e.g. "Monthly". */
	variant_title: string;
	billing_interval: EcommerceBillingInterval;
	status: EcommerceSubscriptionStatus;
	current_period_start: string;
	current_period_end: string;
	created_at: string;
	updated_at: string;
};

/** Only these statuses grant access. Anything else is expired or unpaid. */
const ENTITLED_STATUSES: EcommerceSubscriptionStatus[] = ['active', 'trialing'];

/**
 * The implicit tier every visitor has, signed in or not. Gate free content on
 * this title instead of special-casing "no subscription" everywhere.
 */
export const FREE_TIER_TITLE = 'Free';

/** Set before leaving for checkout so the return page knows to poll. */
export const SUBSCRIPTION_PENDING_KEY = 'subscriptionPending';

const authHeader = (): Record<string, string> => ({ Authorization: `Bearer ${pb.authStore.token}` });

export class SubscriptionApiError extends Error {
	status: number;
	code?: string;

	constructor(message: string, status: number, code?: string) {
		super(message);
		this.name = 'SubscriptionApiError';
		this.status = status;
		this.code = code;
	}
}

/**
 * Whether these subscriptions entitle the visitor to the plan with this exact
 * title. Titles must match what the plan was created with — "Creator" is not
 * "Creator Plan".
 *
 * `FREE_TIER_TITLE` always matches, so free content can be gated the same way as
 * paid content.
 */
export const isSubscribedTo = (subscriptions: EcommerceSubscription[], title: string): boolean =>
	title === FREE_TIER_TITLE
	|| (Array.isArray(subscriptions)
		&& subscriptions.some(
			subscription => subscription.product_title === title && ENTITLED_STATUSES.includes(subscription.status),
		));

/**
 * Whether any of these plan titles entitles the visitor — for content that
 * carries its own list of allowed tiers.
 *
 * @example
 * const canRead = isSubscribedToAny(subscriptions, article.tier_required);
 */
export const isSubscribedToAny = (
	subscriptions: EcommerceSubscription[],
	titles: string[] | null | undefined,
): boolean => Array.isArray(titles) && titles.some(title => isSubscribedTo(subscriptions, title));

/** The subscription currently granting access, if any — the one to manage or display. */
export const activeSubscription = (subscriptions: EcommerceSubscription[]): EcommerceSubscription | null =>
	(Array.isArray(subscriptions)
		? subscriptions.find(subscription => ENTITLED_STATUSES.includes(subscription.status))
		: undefined) ?? null;

/** Titles of every plan the visitor is entitled to, for badges and multi-tier checks. */
export const tierTitles = (subscriptions: EcommerceSubscription[]): string[] =>
	Array.isArray(subscriptions)
		? subscriptions
			.filter(subscription => ENTITLED_STATUSES.includes(subscription.status))
			.map(subscription => subscription.product_title)
		: [];

/**
 * The signed-in visitor's subscriptions, in every status. Empty for a visitor
 * who has never checked out. Requires a signed-in PocketBase user.
 *
 * @example
 * const { subscriptions } = await getUserSubscriptions();
 * const isPro = isSubscribedTo(subscriptions, 'Pro');
 */
export const getUserSubscriptions = async (): Promise<{ subscriptions: EcommerceSubscription[] }> => {
	// POST, not GET: the edge cache stores GET responses (including errors) by
	// URL, so a per-user read must not be a GET. See the resource route.
	const response = await fetch('/api/ecommerce/subscriptions', { method: 'POST', headers: authHeader() });

	if (!response.ok) {
		throw new SubscriptionApiError(`Failed to load subscriptions: ${response.status}`, response.status);
	}

	return (await response.json()) as { subscriptions: EcommerceSubscription[] };
};

/**
 * Sends the visitor to hosted checkout for one plan variant.
 *
 * `customer` is what links the resulting subscription to the PocketBase user, so
 * the visitor must be signed in first — send them to the login page otherwise,
 * or the payment succeeds and nothing is entitled.
 *
 * A customer can hold only one subscription: this rejects with
 * `code: 'ALREADY_SUBSCRIBED'` for someone who already has one, because plan
 * changes go through the billing portal, not a second checkout. Lock the other
 * plans in the UI as well, so nobody reaches this error by clicking Subscribe.
 *
 * @example
 * await startSubscriptionCheckout({ variantId: plan.variants[0].id });
 */
export const startSubscriptionCheckout = async ({
	variantId,
	successPath = '/subscriptions?just_subscribed=1',
	cancelPath = '/plans',
	locale,
}: {
	variantId: string;
	successPath?: string;
	cancelPath?: string;
	locale?: string;
}): Promise<void> => {
	const user = pb.authStore.record;

	if (!pb.authStore.isValid || !user) {
		throw new SubscriptionApiError('Sign in before subscribing', 401);
	}

	const { subscriptions } = await getUserSubscriptions();

	if (activeSubscription(subscriptions)) {
		throw new SubscriptionApiError(
			'You already have a subscription — change plans in the billing portal instead',
			409,
			'ALREADY_SUBSCRIBED',
		);
	}

	const { url } = await initializeCheckout({
		items: [{ variant_id: variantId, quantity: 1 }],
		successUrl: `${window.location.origin}${successPath}`,
		cancelUrl: `${window.location.origin}${cancelPath}`,
		locale,
		customer: { external_id: user.id, email: user.email as string | undefined },
	});

	sessionStorage.setItem(SUBSCRIPTION_PENDING_KEY, '1');
	window.location.href = url;
};

/**
 * A one-off billing-portal URL for changing or cancelling a subscription;
 * redirect the visitor to it. Test-mode purchases have no portal and reject with
 * `code: 'STRIPE_NOT_CONFIGURED'` — show `error.message`, do not treat it as a
 * crash.
 *
 * This is also the only way to move between tiers, so with more than one plan on
 * sale every plan the visitor is not on needs a button that lands here
 * ("Upgrade to Pro", "Switch to Starter") — `startSubscriptionCheckout` would
 * charge them a second time.
 *
 * @example
 * const { url } = await getManageSubscriptionUrl({
 *   subscriptionId: active.id,
 *   returnUrl: window.location.href,
 * });
 * window.location.href = url;
 */
export const getManageSubscriptionUrl = async ({
	subscriptionId,
	returnUrl,
}: {
	subscriptionId: string;
	returnUrl: string;
}): Promise<{ url: string }> => {
	const response = await fetch('/api/ecommerce/subscriptions/manage', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...authHeader() },
		body: JSON.stringify({ subscriptionId, returnUrl }),
	});
	const body = (await response.json().catch(() => null)) as
		| { url?: string; code?: string; message?: string; error?: string }
		| null;

	if (!response.ok || !body?.url) {
		throw new SubscriptionApiError(
			body?.message ?? body?.error ?? `Failed to open the billing portal: ${response.status}`,
			response.status,
			body?.code,
		);
	}

	return { url: body.url };
};

/**
 * Whether the visitor still has a checkout awaiting confirmation. True right
 * after they return from hosted checkout, until `waitForActiveSubscription`
 * settles — show "activating…", never "no subscription", while this holds.
 */
export const isSubscriptionPending = (): boolean => sessionStorage.getItem(SUBSCRIPTION_PENDING_KEY) !== null;

/**
 * Polls until the paid subscription shows up, then clears the pending flag.
 * The store confirms payments out of band, so a subscription is typically a few
 * seconds late and the account page would otherwise look empty to someone who
 * just paid.
 *
 * `isActivated: false` means it is still processing — ask them to refresh in a
 * moment rather than sending them back to the plans page.
 *
 * @example
 * useEffect(() => {
 *   if (!isSubscriptionPending()) return;
 *   waitForActiveSubscription({ onUpdate: setSubscriptions }).then(({ isActivated }) => …);
 * }, []);
 */
export const waitForActiveSubscription = async ({
	onUpdate,
	intervalMs = 2000,
	timeoutMs = 30_000,
}: {
	/** Called after every poll, so the UI can render the subscription the moment it lands. */
	onUpdate?: (subscriptions: EcommerceSubscription[]) => void;
	intervalMs?: number;
	timeoutMs?: number;
} = {}): Promise<{ subscriptions: EcommerceSubscription[]; isActivated: boolean }> => {
	const deadline = Date.now() + timeoutMs;
	let subscriptions: EcommerceSubscription[] = [];

	for (;;) {
		subscriptions = (await getUserSubscriptions().catch(() => ({ subscriptions }))).subscriptions;
		onUpdate?.(subscriptions);

		if (activeSubscription(subscriptions)) {
			sessionStorage.removeItem(SUBSCRIPTION_PENDING_KEY);

			return { subscriptions, isActivated: true };
		}

		if (Date.now() + intervalMs >= deadline) {
			sessionStorage.removeItem(SUBSCRIPTION_PENDING_KEY);

			return { subscriptions, isActivated: false };
		}

		await new Promise((resolve) => {
			setTimeout(resolve, intervalMs);
		});
	}
};

/**
 * Drops the pending flag without polling. Call it on the page the visitor lands
 * on after abandoning checkout, so a later visit to the account page does not
 * wait for a payment that never happened.
 */
export const clearSubscriptionPending = (): void => sessionStorage.removeItem(SUBSCRIPTION_PENDING_KEY);
