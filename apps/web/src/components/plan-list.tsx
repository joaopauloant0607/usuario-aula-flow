import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/hooks/use-auth';
import type { ProductListItem, ProductVariant } from '@/api/ecommerce-api';
import { activeSubscription, clearSubscriptionPending, getUserSubscriptions, getManageSubscriptionUrl, startSubscriptionCheckout } from '@/api/ecommerce-subscriptions-api';
import { SubscriptionApiError } from '@/api/ecommerce-subscriptions-api';
import type { EcommerceSubscription } from '@/api/ecommerce-subscriptions-api';

/**
 * Displayed prices, in cents. What the buyer is actually charged comes from the
 * store variant, so keep these in sync with the products in the Hostinger store.
 */
const MONTHLY = 3990;
const ANNUAL_PER_MONTH = 2990;
const ANNUAL_TOTAL = ANNUAL_PER_MONTH * 12;
const SAVINGS = MONTHLY * 12 - ANNUAL_TOTAL;
const SAVINGS_PERCENT = Math.round((SAVINGS / (MONTHLY * 12)) * 100);

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type Period = 'monthly' | 'annual';
type Offer = { period: Period; product: ProductListItem; variant: ProductVariant };

const PERIOD_PATTERN: Record<Period, RegExp> = { monthly: /mens|m[eê]s|month/i, annual: /anual|ano|year|annual/i };

/** Finds the store variant to check out for a billing period, by product or variant title. */
function findOffer(plans: ProductListItem[], period: Period): Offer | null {
	for (const product of plans) {
		for (const variant of product.variants) {
			if (PERIOD_PATTERN[period].test(variant.title) || (product.variants.length === 1 && PERIOD_PATTERN[period].test(product.title))) {
				return { period, product, variant };
			}
		}
	}
	return null;
}

const FEATURES = ['Alunos e informações em um lugar', 'Organização da agenda de aulas', 'Controle dos recebimentos', 'Área pessoal com acesso seguro'];

export function PlanList({ plans }: { plans: ProductListItem[] }) {
	const { isAuthed, isLoading } = useAuth();
	const navigate = useNavigate();
	const [subscriptions, setSubscriptions] = useState<EcommerceSubscription[]>([]);
	const [busy, setBusy] = useState<Period | ''>('');
	const [error, setError] = useState('');
	const [checking, setChecking] = useState(true);
	useEffect(() => {
		clearSubscriptionPending();
		if (isLoading) return;
		if (!isAuthed) { setSubscriptions([]); setChecking(false); return; }
		setChecking(true);
		getUserSubscriptions()
			.then(data => setSubscriptions(data.subscriptions))
			.catch(() => setError('Não foi possível verificar sua assinatura. Atualize antes de continuar.'))
			.finally(() => setChecking(false));
	}, [isAuthed, isLoading]);
	const active = activeSubscription(subscriptions);

	async function subscribe(offer: Offer | null, period: Period) {
		if (!isAuthed) { navigate('/login'); return; }
		if (!offer) { setError('A assinatura está indisponível no momento. Tente novamente em instantes.'); return; }
		setBusy(period);
		setError('');
		try {
			if (active) {
				const { url } = await getManageSubscriptionUrl({ subscriptionId: active.id, returnUrl: window.location.href });
				window.location.href = url;
			} else await startSubscriptionCheckout({ variantId: offer.variant.id });
		} catch (err) {
			if (err instanceof SubscriptionApiError && err.code === 'ALREADY_SUBSCRIBED') { navigate('/subscriptions'); return; }
			if (err instanceof SubscriptionApiError && err.code === 'STRIPE_NOT_CONFIGURED') {
				setError('O portal de cobrança não está disponível porque a loja ainda não tem um método de pagamento real conectado (ou esta assinatura foi paga em modo de teste). Conecte um provedor de pagamento, como o Stripe, nas configurações da sua loja online para habilitar o gerenciamento de planos.');
				return;
			}
			try {
				const data = await getUserSubscriptions();
				if (activeSubscription(data.subscriptions)) { navigate('/subscriptions'); return; }
			} catch { /* Display the actionable notice below. */ }
			setError('Não foi possível abrir a cobrança. Verifique sua conexão ou tente novamente em instantes.');
		} finally {
			setBusy('');
		}
	}

	const cards: { period: Period; name: string; featured: boolean }[] = [
		{ period: 'monthly', name: 'Mensal', featured: false },
		{ period: 'annual', name: 'Anual', featured: true },
	];

	return <>
		<div className="plan-grid">
			{cards.map(({ period, name, featured }) => {
				const offer = findOffer(plans, period);
				const current = !!active && !!offer && active.product_title === offer.product.title;
				const label = checking ? 'Verificando…' : busy === period ? 'Abrindo…' : current ? 'Gerenciar assinatura' : active ? 'Mudar para o plano ' + name : 'Assinar plano ' + name;
				return <article className={featured ? 'plan-panel featured' : 'plan-panel'} key={period}>
					{featured && <span className="plan-badge">Melhor custo-benefício · economize {SAVINGS_PERCENT}%</span>}
					<h2>{name}</h2>
					{current && <span className="notice">Seu plano atual</span>}
					<div className="price">
						{period === 'annual' && <del>{brl(MONTHLY)}</del>}
						{brl(period === 'annual' ? ANNUAL_PER_MONTH : MONTHLY)}<small>/mês</small>
					</div>
					<p className="price-note">
						{period === 'annual'
							? <>Cobrado {brl(ANNUAL_TOTAL)} uma vez por ano.<br /><b>Você economiza {brl(SAVINGS)} por ano.</b></>
							: <>Cobrado {brl(MONTHLY)} todo mês.<br />Ideal para começar sem compromisso anual.</>}
					</p>
					<ul>{FEATURES.map(f => <li key={f}>✓ {f}</li>)}</ul>
					<button className={featured ? 'button' : 'button secondary'} type="button" disabled={checking || isLoading || !!busy || (!!offer && !offer.product.purchasable)} onClick={() => subscribe(offer, period)}>{label}</button>
				</article>;
			})}
		</div>
		<p className="plan-footnote">Todos os recursos estão incluídos nos dois planos. Preços em reais.</p>
		{error && <p role="alert" className="notice">{error}</p>}
	</>;
}
