import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/hooks/use-auth';
import { getAccess, getCheckoutLinks } from '@/lib/session';
import type { Access } from '@/lib/session';

/**
 * Displayed prices, in cents. What the buyer is charged is set in Stripe, on
 * the payment links — keep these in sync with the prices of those links.
 */
const MONTHLY = 3990;
const ANNUAL_PER_MONTH = 2990;
const ANNUAL_TOTAL = ANNUAL_PER_MONTH * 12;
const SAVINGS = MONTHLY * 12 - ANNUAL_TOTAL;
const SAVINGS_PERCENT = Math.round((SAVINGS / (MONTHLY * 12)) * 100);

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type Period = 'monthly' | 'annual';

const FEATURES = ['Alunos e informações em um lugar', 'Organização da agenda de aulas', 'Controle dos recebimentos', 'Área pessoal com acesso seguro'];

export function PlanList() {
	const { isAuthed, isLoading } = useAuth();
	const navigate = useNavigate();
	const [access, setAccess] = useState<Access | null>(null);
	const [busy, setBusy] = useState<Period | ''>('');
	const [error, setError] = useState('');
	const [checking, setChecking] = useState(true);
	useEffect(() => {
		if (isLoading) return;
		if (!isAuthed) { setAccess(null); setChecking(false); return; }
		setChecking(true);
		getAccess()
			.then(setAccess)
			.catch(() => setError('Não foi possível verificar sua assinatura. Atualize antes de continuar.'))
			.finally(() => setChecking(false));
	}, [isAuthed, isLoading]);
	const subscribed = access?.status === 'active';

	async function subscribe(period: Period) {
		if (!isAuthed) { navigate('/login?criar=1'); return; }
		setBusy(period);
		setError('');
		try {
			const links = await getCheckoutLinks();
			const url = subscribed ? links.portal : links[period];
			if (!url) {
				setError(subscribed
					? 'O portal de assinatura ainda não está disponível. Fale com o suporte para alterar seu plano.'
					: 'A assinatura está indisponível no momento. Tente novamente em instantes.');
				return;
			}
			window.location.href = url;
		} catch {
			setError('Não foi possível abrir o pagamento. Verifique sua conexão ou tente novamente em instantes.');
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
				const label = checking ? 'Verificando…' : busy === period ? 'Abrindo…' : subscribed ? 'Gerenciar assinatura' : 'Assinar plano ' + name;
				return <article className={featured ? 'plan-panel featured' : 'plan-panel'} key={period}>
					{featured && <span className="plan-badge">Melhor custo-benefício · economize {SAVINGS_PERCENT}%</span>}
					<h2>{name}</h2>
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
					<button className={featured ? 'button' : 'button secondary'} type="button" disabled={checking || isLoading || !!busy} onClick={() => subscribe(period)}>{label}</button>
				</article>;
			})}
		</div>
		<p className="plan-footnote">7 dias grátis para testar, sem cartão. Todos os recursos estão incluídos nos dois planos.</p>
		{error && <p role="alert" className="notice">{error}</p>}
	</>;
}
