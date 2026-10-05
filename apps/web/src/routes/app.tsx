import type { Route } from './+types/app';
import { seo } from '@/lib/seo';
import { requireAuth } from '@/lib/require-auth';
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

export function clientLoader() {
	requireAuth();
	return null;
}
clientLoader.hydrate = true as const;

export function HydrateFallback() {
	return <main className="skeleton">Carregando seu espaço…</main>;
}

export default function AppRoute() {
	return <Dashboard />;
}
