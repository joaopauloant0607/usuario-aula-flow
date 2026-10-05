import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, MessageCircle, CalendarPlus } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import {
	listPayments,
	createPayment,
	updatePayment,
	deletePayment,
	listStudents,
	isOverdue,
	fmtDay,
	planMonthlyCharges,
	createPlannedCharges,
	whatsappChargeLink,
	type Payment,
	type Student,
} from '@/lib/teaching';

const MONTHS = [
	'janeiro',
	'fevereiro',
	'março',
	'abril',
	'maio',
	'junho',
	'julho',
	'agosto',
	'setembro',
	'outubro',
	'novembro',
	'dezembro',
];

const EMPTY = {
	student: '',
	description: '',
	amount: '',
	due_date: '',
	paid_date: '',
	status: 'pending' as 'pending' | 'paid',
};

const fmt = (n: number) =>
	n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (s: string) =>
	new Date(s).toLocaleDateString('pt-BR', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
	});

export function Finance() {
	const { user } = useAuth();
	const [items, setItems] = useState<Payment[]>([]);
	const [students, setStudents] = useState<Student[]>([]);
	const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
	const [showForm, setShowForm] = useState(false);
	const [editing, setEditing] = useState<Payment | null>(null);
	const [form, setForm] = useState({ ...EMPTY });
	const [saving, setSaving] = useState(false);
	const [err, setErr] = useState('');
	const [genMonth, setGenMonth] = useState<number | null>(null); // 0 = this month, 1 = next
	const [generating, setGenerating] = useState(false);

	async function load() {
		try {
			const [p, s] = await Promise.all([listPayments(), listStudents()]);
			setItems(p);
			setStudents(s);
			setState('ready');
		} catch {
			setState('error');
		}
	}
	useEffect(() => {
		void load();
	}, []);

	function openNew() {
		setEditing(null);
		setForm({ ...EMPTY });
		setShowForm(true);
		setErr('');
	}
	function openEdit(p: Payment) {
		setEditing(p);
		setForm({
			student: p.student,
			description: p.description,
			amount: String(p.amount || ''),
			due_date: p.due_date ? p.due_date.slice(0, 10) : '',
			paid_date: p.paid_date ? p.paid_date.slice(0, 10) : '',
			status: p.status,
		});
		setShowForm(true);
		setErr('');
	}

	async function save(e: React.FormEvent) {
		e.preventDefault();
		const amount = Number(form.amount);
		if (!amount || amount <= 0) {
			setErr('Informe um valor válido.');
			return;
		}
		setSaving(true);
		setErr('');
		try {
			const data = {
				student: form.student || null,
				description: form.description,
				amount,
				due_date: form.due_date || null,
				paid_date:
					form.status === 'paid' ? form.paid_date || new Date().toISOString() : null,
				status: form.status,
			};
			if (editing) await updatePayment(editing.id, data);
			else await createPayment(user!.id, data);
			setShowForm(false);
			await load();
		} catch {
			setErr('Não foi possível salvar. Tente novamente.');
		} finally {
			setSaving(false);
		}
	}

	async function markPaid(p: Payment) {
		try {
			await updatePayment(p.id, { status: 'paid', paid_date: new Date().toISOString() });
			await load();
		} catch {
			alert('Não foi possível atualizar.');
		}
	}

	const today = new Date();
	const genDate =
		genMonth === null ? null : new Date(today.getFullYear(), today.getMonth() + genMonth, 1);
	const planned = genDate
		? planMonthlyCharges(students, items, genDate.getFullYear(), genDate.getMonth())
		: [];
	const noFee = students.filter((s) => s.status === 'active' && !(s.monthly_fee > 0));

	async function generate() {
		setGenerating(true);
		try {
			await createPlannedCharges(user!.id, planned);
			setGenMonth(null);
		} catch {
			alert('Algumas mensalidades não foram criadas. Abra de novo para gerar as que faltaram.');
		} finally {
			setGenerating(false);
			await load();
		}
	}

	async function remove(id: string) {
		if (!confirm('Excluir este registro?')) return;
		try {
			await deletePayment(id);
			await load();
		} catch {
			alert('Não foi possível excluir.');
		}
	}

	const now = new Date();
	const monthIncome = items
		.filter(
			(p) =>
				p.status === 'paid' &&
				p.paid_date &&
				new Date(p.paid_date).getMonth() === now.getMonth() &&
				new Date(p.paid_date).getFullYear() === now.getFullYear(),
		)
		.reduce((a, p) => a + (p.amount || 0), 0);
	const pendingTotal = items
		.filter((p) => p.status === 'pending')
		.reduce((a, p) => a + (p.amount || 0), 0);
	const overdue = items.filter(isOverdue);
	const overdueTotal = overdue.reduce((a, p) => a + (p.amount || 0), 0);

	return (
		<>
			<div className="dash-head">
				<div>
					<span className="eyebrow">FINANCEIRO</span>
					<h1>Seus recebimentos</h1>
					<p>Acompanhe o que foi recebido e o que está pendente.</p>
				</div>
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
					<button
						type="button"
						className="btn-ghost"
						onClick={() => setGenMonth(0)}
						style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
					>
						<CalendarPlus size={15} /> Gerar mensalidades
					</button>
					<button type="button" className="button small" onClick={openNew}>
						<Plus size={15} /> Novo registro
					</button>
				</div>
			</div>

			<div className="metric-grid">
				<div className="metric-card">
					<div className="label">Recebido no mês</div>
					<div className="value">R$ {fmt(monthIncome)}</div>
				</div>
				<div className="metric-card">
					<div className="label">A receber</div>
					<div className="value">R$ {fmt(pendingTotal)}</div>
				</div>
				<div className="metric-card">
					<div className="label">Em atraso</div>
					<div className="value" style={overdueTotal > 0 ? { color: '#a62e20' } : undefined}>
						R$ {fmt(overdueTotal)}
					</div>
					<div className="sub">
						{overdue.length === 0
							? 'Nenhuma cobrança atrasada'
							: `${overdue.length} cobrança${overdue.length > 1 ? 's' : ''} atrasada${overdue.length > 1 ? 's' : ''}`}
					</div>
				</div>
			</div>

			{state === 'loading' && <p className="skeleton">Carregando…</p>}
			{state === 'error' && (
				<p className="notice">
					Não foi possível carregar seus recebimentos. Tente novamente.
				</p>
			)}
			{state === 'ready' && (
				<div className="panel">
					<div className="panel-body">
						{items.length === 0 ? (
							<p className="empty">
								Nenhum registro financeiro ainda. Adicione seu primeiro recebimento.
							</p>
						) : (
							items.map((p) => (
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
											{p.paid_date
												? ` · pago ${fmtDate(p.paid_date)}`
												: ''}
										</div>
									</div>
									<b>R$ {fmt(p.amount)}</b>
									{isOverdue(p) ? (
										<span className="badge pending" style={OVERDUE_BADGE}>
											Atrasado
										</span>
									) : (
										<span className={'badge ' + (p.status === 'paid' ? 'paid' : 'pending')}>
											{p.status === 'paid' ? 'Pago' : 'Pendente'}
										</span>
									)}
									{p.status === 'pending' && (
										<WhatsAppButton payment={p} />
									)}
									{p.status === 'pending' && (
										<button
											type="button"
											className="icon-btn"
											onClick={() => markPaid(p)}
											title="Marcar como pago"
											aria-label="Marcar como pago"
										>
											<Check size={15} />
										</button>
									)}
									<button
										type="button"
										className="icon-btn"
										onClick={() => openEdit(p)}
										aria-label="Editar registro"
									>
										<Pencil size={15} />
									</button>
									<button
										type="button"
										className="icon-btn"
										onClick={() => remove(p.id)}
										aria-label="Excluir registro"
									>
										<Trash2 size={15} />
									</button>
								</div>
							))
						)}
					</div>
				</div>
			)}

			{showForm && (
				<div className="modal-overlay" onClick={() => setShowForm(false)}>
					<form
						className="modal-panel"
						onClick={(e) => e.stopPropagation()}
						onSubmit={save}
					>
						<div className="modal-head">
							<h2>{editing ? 'Editar registro' : 'Novo registro'}</h2>
							<button
								type="button"
								className="icon-btn"
								onClick={() => setShowForm(false)}
								aria-label="Fechar"
							>
								<X size={18} />
							</button>
						</div>
						<div className="form-grid">
							<div className="field full">
								<label>Aluno</label>
								<select
									value={form.student}
									onChange={(e) => setForm({ ...form, student: e.target.value })}
								>
									<option value="">Nenhum / avulso</option>
									{students.map((s) => (
										<option key={s.id} value={s.id}>
											{s.name}
										</option>
									))}
								</select>
							</div>
							<div className="field full">
								<label>Descrição</label>
								<input
									value={form.description}
									onChange={(e) => setForm({ ...form, description: e.target.value })}
									placeholder="Mensalidade, aula avulsa…"
								/>
							</div>
							<div className="field">
								<label>Valor (R$) *</label>
								<input
									type="number"
									min={0}
									step="0.01"
									value={form.amount}
									onChange={(e) => setForm({ ...form, amount: e.target.value })}
									placeholder="120,00"
								/>
							</div>
							<div className="field">
								<label>Status</label>
								<select
									value={form.status}
									onChange={(e) =>
										setForm({ ...form, status: e.target.value as 'pending' | 'paid' })
									}
								>
									<option value="pending">Pendente</option>
									<option value="paid">Pago</option>
								</select>
							</div>
							<div className="field">
								<label>Vencimento</label>
								<input
									type="date"
									value={form.due_date}
									onChange={(e) => setForm({ ...form, due_date: e.target.value })}
								/>
							</div>
							<div className="field">
								<label>Data de pagamento</label>
								<input
									type="date"
									value={form.paid_date}
									onChange={(e) => setForm({ ...form, paid_date: e.target.value })}
								/>
							</div>
						</div>
						{err && <p className="notice modal-notice">{err}</p>}
						<div className="form-actions">
							<button
								type="button"
								className="btn-ghost"
								onClick={() => setShowForm(false)}
							>
								Cancelar
							</button>
							<button type="submit" className="button small" disabled={saving}>
								{saving ? 'Salvando…' : 'Salvar'}
							</button>
						</div>
					</form>
				</div>
			)}

			{genDate && (
				<div className="modal-overlay" onClick={() => setGenMonth(null)}>
					<div className="modal-panel" onClick={(e) => e.stopPropagation()}>
						<div className="modal-head">
							<h2>Gerar mensalidades</h2>
							<button
								type="button"
								className="icon-btn"
								onClick={() => setGenMonth(null)}
								aria-label="Fechar"
							>
								<X size={18} />
							</button>
						</div>
						<div className="form-grid">
							<div className="field full">
								<label>Mês de referência</label>
							<select
								value={genMonth ?? 0}
								onChange={(e) => setGenMonth(Number(e.target.value))}
							>
								{[0, 1].map((n) => {
									const d = new Date(today.getFullYear(), today.getMonth() + n, 1);
									return (
										<option key={n} value={n}>
											{MONTHS[d.getMonth()]} de {d.getFullYear()}
										</option>
									);
								})}
							</select>
							</div>
						</div>
						{planned.length === 0 ? (
							<p className="empty">
								Nenhuma mensalidade a gerar para {MONTHS[genDate.getMonth()]}. Todos os
								alunos ativos com valor mensal já têm cobrança neste mês.
							</p>
						) : (
							<div className="panel-body" style={{ borderTop: '1px solid var(--line)' }}>
								{planned.map((c) => (
									<div className="row" key={c.student.id}>
										<div className="grow">
											<div className="name">{c.student.name}</div>
											<div className="meta">vence {fmtDay(c.due_date)}</div>
										</div>
										<b>R$ {fmt(c.amount)}</b>
									</div>
								))}
							</div>
						)}
						{noFee.length > 0 && (
							<p className="meta" style={{ margin: '4px 20px 16px', fontSize: 12 }}>
								{noFee.length} aluno{noFee.length > 1 ? 's' : ''} ativo
								{noFee.length > 1 ? 's' : ''} sem valor mensal cadastrado (
								{noFee.map((s) => s.name).join(', ')}). Preencha em Alunos para incluir.
							</p>
						)}
						<div className="form-actions">
							<button type="button" className="btn-ghost" onClick={() => setGenMonth(null)}>
								Cancelar
							</button>
							<button
								type="button"
								className="button small"
								disabled={generating || planned.length === 0}
								onClick={generate}
							>
								{generating
									? 'Gerando…'
									: planned.length === 0
										? 'Nada a gerar'
										: `Gerar ${planned.length} cobrança${planned.length === 1 ? '' : 's'} (R$ ${fmt(
											planned.reduce((a, c) => a + c.amount, 0),
										)})`}
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}

const OVERDUE_BADGE = { background: '#a62e20', color: '#fff' };

function WhatsAppButton({ payment }: { payment: Payment }) {
	const link = whatsappChargeLink(payment);
	if (!link)
		return (
			<button
				type="button"
				className="icon-btn"
				disabled
				style={{ opacity: 0.35 }}
				title="Cadastre o telefone do aluno para cobrar pelo WhatsApp"
				aria-label="Cobrar pelo WhatsApp (sem telefone)"
			>
				<MessageCircle size={15} />
			</button>
		);
	return (
		<a
			className="icon-btn"
			href={link}
			target="_blank"
			rel="noopener noreferrer"
			title="Cobrar pelo WhatsApp"
			aria-label="Cobrar pelo WhatsApp"
			style={{ color: '#1f9e55' }}
		>
			<MessageCircle size={15} />
		</a>
	);
}
