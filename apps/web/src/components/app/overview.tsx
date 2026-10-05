import { useEffect, useState } from 'react';
import { Users, CalendarDays, Wallet, Plus } from 'lucide-react';
import {
	listStudents,
	listClasses,
	listPayments,
	WEEKDAYS_SHORT,
	isOverdue,
	fmtDay,
	type Student,
	type ClassItem,
	type Payment,
} from '@/lib/teaching';

type Tab = 'overview' | 'students' | 'schedule' | 'finance';

const fmt = (n: number) =>
	n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Overview({ onNavigate }: { onNavigate: (t: Tab) => void }) {
	const [students, setStudents] = useState<Student[]>([]);
	const [classes, setClasses] = useState<ClassItem[]>([]);
	const [payments, setPayments] = useState<Payment[]>([]);
	const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

	useEffect(() => {
		let alive = true;
		(async () => {
			try {
				const [s, c, p] = await Promise.all([
					listStudents(),
					listClasses(),
					listPayments(),
				]);
				if (!alive) return;
				setStudents(s);
				setClasses(c);
				setPayments(p);
				setState('ready');
			} catch {
				if (alive) setState('error');
			}
		})();
		return () => {
			alive = false;
		};
	}, []);

	if (state === 'loading') return <p className="skeleton">Carregando…</p>;
	if (state === 'error')
		return <p className="notice">Não foi possível carregar seus dados. Tente novamente.</p>;

	const activeStudents = students.filter((s) => s.status === 'active').length;
	const now = new Date();
	const monthIncome = payments
		.filter(
			(p) =>
				p.status === 'paid' &&
				p.paid_date &&
				new Date(p.paid_date).getMonth() === now.getMonth() &&
				new Date(p.paid_date).getFullYear() === now.getFullYear(),
		)
		.reduce((a, p) => a + (p.amount || 0), 0);
	const pendingTotal = payments
		.filter((p) => p.status === 'pending')
		.reduce((a, p) => a + (p.amount || 0), 0);
	const todayIdx = String(now.getDay());
	const todayClasses = classes
		.filter((c) => c.weekday.includes(todayIdx))
		.sort((a, b) => a.start_time.localeCompare(b.start_time));
	const pending = payments
		.filter((p) => p.status === 'pending')
		.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));

	return (
		<>
			<div className="dash-head">
				<div>
					<span className="eyebrow">VISÃO GERAL</span>
					<h1>Bem-vindo de volta.</h1>
					<p>Um resumo do seu ensino hoje.</p>
				</div>
				<button
					type="button"
					className="button small"
					onClick={() => onNavigate('students')}
				>
					<Plus size={15} /> Novo aluno
				</button>
			</div>

			<div className="metric-grid">
				<div className="metric-card">
					<div className="label">
						Alunos ativos <Users size={14} />
					</div>
					<div className="value">{activeStudents}</div>
					<div className="sub">{students.length} no total</div>
				</div>
				<div className="metric-card">
					<div className="label">
						Aulas por semana <CalendarDays size={14} />
					</div>
					<div className="value">{classes.length}</div>
					<div className="sub">{todayClasses.length} hoje</div>
				</div>
				<div className="metric-card">
					<div className="label">
						Recebido no mês <Wallet size={14} />
					</div>
					<div className="value">R$ {fmt(monthIncome)}</div>
					<div className="sub">R$ {fmt(pendingTotal)} a receber</div>
				</div>
			</div>

			<div className="panel">
				<div className="panel-head">
					<h2>Aulas de hoje — {WEEKDAYS_SHORT[now.getDay()]}</h2>
					<button
						type="button"
						className="btn-ghost"
						onClick={() => onNavigate('schedule')}
					>
						Ver agenda
					</button>
				</div>
				<div className="panel-body">
					{todayClasses.length === 0 ? (
						<p className="empty">
							Nenhuma aula registrada para hoje. Aproveite para planejar a semana.
						</p>
					) : (
						todayClasses.map((c) => (
							<div className="row" key={c.id}>
								<span className="lesson-time">{c.start_time}</span>
								<div className="grow">
									<div className="name">
										{c.subject || c.expand?.student?.name || 'Aula'}
									</div>
									<div className="meta">
										{c.expand?.student?.name}
										{c.duration_minutes ? ` · ${c.duration_minutes} min` : ''}
									</div>
								</div>
							</div>
						))
					)}
				</div>
			</div>

			<div className="panel">
				<div className="panel-head">
					<h2>Pendências financeiras</h2>
					<button
						type="button"
						className="btn-ghost"
						onClick={() => onNavigate('finance')}
					>
						Ver financeiro
					</button>
				</div>
				<div className="panel-body">
					{pending.length === 0 ? (
						<p className="empty">Tudo em dia. Nenhum recebimento pendente.</p>
					) : (
						pending.slice(0, 5).map((p) => (
							<div className="row" key={p.id}>
								<div className="grow">
									<div className="name">
										{p.description || p.expand?.student?.name || 'Recebimento'}
									</div>
									<div className="meta">
										{p.expand?.student?.name}
										{p.due_date
											? ` · ${isOverdue(p) ? 'venceu' : 'vence'} ${fmtDay(p.due_date)}`
											: ''}
									</div>
								</div>
								<b>R$ {fmt(p.amount)}</b>
								{isOverdue(p) ? (
									<span
										className="badge pending"
										style={{ background: '#a62e20', color: '#fff' }}
									>
										Atrasado
									</span>
								) : (
									<span className="badge pending">Pendente</span>
								)}
							</div>
						))
					)}
				</div>
			</div>
		</>
	);
}
