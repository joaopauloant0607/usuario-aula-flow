import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '@/hooks/use-auth';
import { getAccess, getCheckoutLinks } from '@/lib/session';
import type { Access } from '@/lib/session';

const date = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

export function SubscriptionAccount() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();
	const [access, setAccess] = useState<Access | null>(null);
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	useEffect(() => {
		getAccess().then(setAccess).catch(() => setError('Não foi possível carregar sua assinatura. Atualize a página para tentar novamente.'));
	}, []);

	async function openPortal() {
		setBusy(true);
		setError('');
		try {
			const { portal } = await getCheckoutLinks();
			if (!portal) { setError('O portal de assinatura ainda não está disponível. Fale com o suporte para alterar ou cancelar.'); return; }
			window.location.href = portal;
		} catch {
			setError('Não foi possível abrir o portal. Verifique sua conexão e tente novamente.');
		} finally {
			setBusy(false);
		}
	}

	return <>
		<span className="eyebrow">ÁREA DO ASSINANTE</span>
		<h1>Olá, {String(user?.name || 'professor')}.</h1>
		<p>Seu espaço para acompanhar e gerenciar sua assinatura.</p>
		{!access && !error && <p className="skeleton">Carregando assinatura…</p>}
		{access?.status === 'active' && <section className="plan-panel">
			<span className="eyebrow">ASSINATURA ATIVA</span>
			<h2>Aula Flow</h2>
			<p>Seu acesso está liberado. Para alterar o plano, atualizar o pagamento ou cancelar, use o portal de cobrança.</p>
			<button className="button" disabled={busy} type="button" onClick={openPortal}>{busy ? 'Abrindo…' : 'Gerenciar assinatura'}</button>
		</section>}
		{access?.status === 'trial' && <section className="plan-panel">
			<span className="eyebrow">TESTE GRÁTIS</span>
			<h2>Você está no período de teste</h2>
			<p>Seu acesso completo vai até {date(access.trial_ends_at)}. Assine antes disso para continuar sem interrupção.</p>
			<Link className="button" to="/plans">Conhecer os planos</Link>
		</section>}
		{access?.status === 'expired' && <section className="plan-panel">
			<span className="eyebrow">TESTE ENCERRADO</span>
			<h2>Assine para continuar</h2>
			<p>Seu teste grátis terminou em {date(access.trial_ends_at)}. Seus dados continuam salvos e voltam assim que você assinar.</p>
			<Link className="button" to="/plans">Ver planos</Link>
		</section>}
		{error && <p role="alert" className="notice">{error}</p>}
		<div className="account-links">
			<Link to="/app">Ir para o meu espaço</Link>
			<Link to="/">Voltar ao início</Link>
			<button className="link-button" onClick={() => { logout(); navigate('/login'); }}>Sair da conta</button>
		</div>
	</>;
}
