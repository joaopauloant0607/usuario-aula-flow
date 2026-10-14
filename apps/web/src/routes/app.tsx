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

export default function AppRoute({ loaderData }: Route.ComponentProps) {
	if (loaderData.access.status !== 'active') {
		return (
			<main className="page-shell">
				<section className="plan-panel paywall">
					<span className="eyebrow">ASSINATURA NECESSÁRIA</span>
					<h2>Assine para organizar suas aulas.</h2>
					<p>
						Escolha um plano para liberar seus alunos, sua agenda e seus recebimentos. Se você já assinou, o
						acesso é liberado em poucos instantes: atualize a página.
					</p>
					<Link className="button" to="/plans">Ver planos a partir de R$ 29,90/mês</Link>
				</section>
			</main>
		);
	}

	return <Dashboard />;
}
