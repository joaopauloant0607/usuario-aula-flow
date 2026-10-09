import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { Route } from './+types/redefinir-senha';
import { seo } from '@/lib/seo';
import { ApiError, confirmPasswordReset } from '@/lib/session';

export function meta({ matches, location }: Route.MetaArgs) {
	return seo(
		{ matches, location },
		{ title: 'Criar nova senha — Aulaflow', description: 'Crie uma nova senha para sua conta no Aulaflow.', noindex: true },
	);
}

export default function ResetPassword() {
	const [params] = useSearchParams();
	const token = params.get('token') || '';
	const navigate = useNavigate();
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);

	async function submit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const form = new FormData(e.currentTarget);
		const password = String(form.get('password'));
		if (password !== String(form.get('confirm'))) {
			setError('As duas senhas não são iguais.');
			return;
		}
		setBusy(true);
		setError('');
		try {
			await confirmPasswordReset(token, password);
			navigate('/app');
		} catch (err) {
			setError(
				err instanceof ApiError && err.code === 'invalid_token'
					? 'Este link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".'
					: 'Não foi possível salvar a nova senha. Tente novamente.',
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<main className="page-shell">
			<section className="auth-panel">
				<div className="eyebrow">SEU ESPAÇO DE ENSINO</div>
				<h1>Criar nova senha</h1>
				{token ? (
					<>
						<p>Escolha uma senha nova para entrar na sua conta.</p>
						<form onSubmit={submit}>
							<label>
								Nova senha
								<input name="password" type="password" minLength={8} required autoComplete="new-password" placeholder="Pelo menos 8 caracteres" />
							</label>
							<label>
								Repita a nova senha
								<input name="confirm" type="password" minLength={8} required autoComplete="new-password" />
							</label>
							{error && <p className="notice" role="status">{error}</p>}
							<button className="button" disabled={busy}>{busy ? 'Aguarde…' : 'Salvar e entrar'}</button>
						</form>
					</>
				) : (
					<p className="notice">Este link está incompleto. Abra de novo o link do e-mail ou peça outro em "Esqueci minha senha".</p>
				)}
				<Link className="link-button" to="/login">Voltar para entrar</Link>
			</section>
		</main>
	);
}
