import { Link } from 'react-router';
import type { Route } from './+types/app';
import { seo } from '@/lib/seo';
import { requireAuth } from '@/lib/require-auth';
import { getAccess } from '@/lib/session';
import { Dashboard } from '@/components/app/dashboard';

export function meta({ matches, location }: Route.MetaArgs) {
	return seo(
		{ matches, location },
		{
			title: 'Meu espaço — Aulaflow',
			description:
				'Gerencie alunos, agenda e recebimentos das suas aulas particulares em um só lugar.',
			noindex: true,
		},
	);
}

export async function clientLoader() {
	await requireAuth();
	return { access: await getAccess() };
}
clientLoader.hydrate = true as const;

export function HydrateFallback() {
	return <main className="skeleton">Carregando seu espaço…</main>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export default function AppRoute({ loaderData }: Route.ComponentProps) {
	const { access } = loaderData;

	if (access.status === 'expired') {
		return (
			<main className="page-shell">
				<section className="plan-panel paywall">
					<span className="eyebrow">TESTE GRÁTIS ENCERRADO</span>
					<h2>Continue organizando suas aulas.</h2>
					<p>
						Seus 7 dias de teste terminaram. Seus alunos, sua agenda e seus recebimentos continuam salvos:
						assine um plano para voltar a usar o Aula Flow.
					</p>
					<Link className="button" to="/plans">Ver planos a partir de R$ 29,90/mês</Link>
				</section>
			</main>
		);
	}

	const daysLeft = Math.max(1, Math.ceil((new Date(access.trial_ends_at).getTime() - Date.now()) / DAY_MS));

	return (
		<>
			{access.status === 'trial' && (
				<div className="trial-banner">
					<span>
						Teste grátis: {daysLeft === 1 ? 'último dia' : `faltam ${daysLeft} dias`}. Aproveite todos os recursos.
					</span>
					<Link to="/plans">Assinar agora</Link>
				</div>
			)}
			<Dashboard />
		</>
	);
}
