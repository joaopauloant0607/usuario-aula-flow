import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import {
	listStudents,
	createStudent,
	updateStudent,
	deleteStudent,
	DEFAULT_DUE_DAY,
	type Student,
} from '@/lib/teaching';

const EMPTY = {
	name: '',
	email: '',
	phone: '',
	subject: '',
	notes: '',
	status: 'active' as 'active' | 'inactive',
	monthly_fee: '',
	classes_per_week: '',
	due_day: '',
};

const fmtMoney = (n: number) =>
	n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Currency mask: keeps only digits and treats the last two as cents ("35000" -> "350,00")
function maskMoney(raw: string) {
	const digits = raw.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
	return digits ? fmtMoney(Number(digits) / 100) : '';
}
const parseMoney = (v: string) => Number(v.replace(/\./g, '').replace(',', '.')) || 0;

export function Students() {
	const { user } = useAuth();
	const [items, setItems] = useState<Student[]>([]);
	const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
	const [showForm, setShowForm] = useState(false);
	const [editing, setEditing] = useState<Student | null>(null);
	const [form, setForm] = useState({ ...EMPTY });
	const [saving, setSaving] = useState(false);
	const [err, setErr] = useState('');

	async function load() {
		try {
			setItems(await listStudents());
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
	function openEdit(s: Student) {
		setEditing(s);
		setForm({
			name: s.name,
			email: s.email,
			phone: s.phone,
			subject: s.subject,
			notes: s.notes,
			status: s.status,
			monthly_fee: s.monthly_fee ? fmtMoney(s.monthly_fee) : '',
			classes_per_week: s.classes_per_week ? String(s.classes_per_week) : '',
			due_day: s.due_day ? String(s.due_day) : '',
		});
		setShowForm(true);
		setErr('');
	}

	async function save(e: React.FormEvent) {
		e.preventDefault();
		if (!form.name.trim()) {
			setErr('Informe o nome do aluno.');
			return;
		}
		setSaving(true);
		setErr('');
		const data = {
			...form,
			monthly_fee: parseMoney(form.monthly_fee),
			classes_per_week: Number(form.classes_per_week) || 0,
			due_day: Number(form.due_day) || 0,
		};
		try {
			if (editing) await updateStudent(editing.id, data);
			else await createStudent(user!.id, data);
			setShowForm(false);
			await load();
		} catch {
			setErr('Não foi possível salvar. Tente novamente.');
		} finally {
			setSaving(false);
		}
	}

	async function remove(id: string) {
		if (!confirm('Excluir este aluno? As aulas vinculadas também serão removidas.'))
			return;
		try {
			await deleteStudent(id);
			await load();
		} catch {
			alert('Não foi possível excluir.');
		}
	}

	return (
		<>
			<div className="dash-head">
				<div>
					<span className="eyebrow">ALUNOS</span>
					<h1>Seus alunos</h1>
					<p>Cadastre e acompanhe cada jornada de aprendizado.</p>
				</div>
				<button type="button" className="button small" onClick={openNew}>
					<Plus size={15} /> Novo aluno
				</button>
			</div>

			{state === 'loading' && <p className="skeleton">Carregando alunos…</p>}
			{state === 'error' && (
				<p className="notice">Não foi possível carregar seus alunos. Tente novamente.</p>
			)}
			{state === 'ready' && (
				<div className="panel">
					<div className="panel-body">
						{items.length === 0 ? (
							<p className="empty">
								Você ainda não cadastrou alunos. Comece adicionando o primeiro.
							</p>
						) : (
							items.map((s) => (
								<div className="row" key={s.id}>
									<div className="grow">
										<div className="name">{s.name}</div>
										<div className="meta">
											{[s.subject, s.phone, s.email].filter(Boolean).join(' · ') ||
												'Sem informações'}
										</div>
										{(s.monthly_fee > 0 || s.classes_per_week > 0) && (
											<div className="meta">
												{[
													s.monthly_fee > 0 && `R$ ${fmtMoney(s.monthly_fee)}/mês`,
													s.classes_per_week > 0 && `${s.classes_per_week}x por semana`,
													s.monthly_fee > 0 && s.due_day > 0 && `vence dia ${s.due_day}`,
												]
													.filter(Boolean)
													.join(' · ')}
											</div>
										)}
										{s.notes && <div className="meta">{s.notes}</div>}
									</div>
									<span
										className={
											'badge ' + (s.status === 'active' ? 'active' : 'inactive')
										}
									>
										{s.status === 'active' ? 'Ativo' : 'Inativo'}
									</span>
									<button
										type="button"
										className="icon-btn"
										onClick={() => openEdit(s)}
										aria-label="Editar aluno"
									>
										<Pencil size={15} />
									</button>
									<button
										type="button"
										className="icon-btn"
										onClick={() => remove(s.id)}
										aria-label="Excluir aluno"
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
							<h2>{editing ? 'Editar aluno' : 'Novo aluno'}</h2>
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
								<label>Nome *</label>
								<input
									value={form.name}
									onChange={(e) => setForm({ ...form, name: e.target.value })}
									placeholder="Nome do aluno"
								/>
							</div>
							<div className="field">
								<label>E-mail</label>
								<input
									type="email"
									value={form.email}
									onChange={(e) => setForm({ ...form, email: e.target.value })}
									placeholder="email@exemplo.com"
								/>
							</div>
							<div className="field">
								<label>Telefone</label>
								<input
									value={form.phone}
									onChange={(e) => setForm({ ...form, phone: e.target.value })}
									placeholder="(11) 99999-9999"
								/>
							</div>
							<div className="field">
								<label>Matéria</label>
								<input
									value={form.subject}
									onChange={(e) => setForm({ ...form, subject: e.target.value })}
									placeholder="Inglês, Matemática…"
								/>
							</div>
							<div className="field">
								<label>Status</label>
								<select
									value={form.status}
									onChange={(e) =>
										setForm({ ...form, status: e.target.value as 'active' | 'inactive' })
									}
								>
									<option value="active">Ativo</option>
									<option value="inactive">Inativo</option>
								</select>
							</div>
							<div className="field">
								<label>Valor mensal (R$)</label>
								<input
									inputMode="numeric"
									value={form.monthly_fee}
									onChange={(e) =>
										setForm({ ...form, monthly_fee: maskMoney(e.target.value) })
									}
									placeholder="350,00"
								/>
							</div>
							<div className="field">
								<label>Aulas por semana</label>
								<select
									value={form.classes_per_week}
									onChange={(e) => setForm({ ...form, classes_per_week: e.target.value })}
								>
									<option value="">Não informado</option>
									{[1, 2, 3, 4, 5, 6, 7].map((n) => (
										<option key={n} value={n}>
											{n}x por semana
										</option>
									))}
								</select>
							</div>
							<div className="field">
								<label>Dia de vencimento</label>
								<select
									value={form.due_day}
									onChange={(e) => setForm({ ...form, due_day: e.target.value })}
								>
									<option value="">Não informado (dia {DEFAULT_DUE_DAY})</option>
									{Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
										<option key={n} value={n}>
											Dia {n}
										</option>
									))}
								</select>
							</div>
							<div className="field full">
								<label>Observações</label>
								<textarea
									value={form.notes}
									onChange={(e) => setForm({ ...form, notes: e.target.value })}
									placeholder="Anotações sobre o aluno"
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
		</>
	);
}
