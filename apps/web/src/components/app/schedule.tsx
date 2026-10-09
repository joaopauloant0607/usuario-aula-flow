import { useEffect, useState } from 'react';
import {
	Plus,
	Pencil,
	Trash2,
	X,
	MapPin,
	Check,
	ChevronLeft,
	ChevronRight,
	MessageCircle,
	CalendarClock,
	UserX,
	Undo2,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import {
	listClasses,
	createClass,
	updateClass,
	deleteClass,
	listStudents,
	WEEKDAYS,
	WEEKDAYS_SHORT,
	listSessions,
	createSession,
	updateSession,
	deleteSession,
	isoDate,
	weekStart,
	fmtDay,
	whatsappLink,
	currentUserId,
	weeklyDaysByStudent,
	roundDuration,
	type ClassItem,
	type ClassSession,
	type Student,
} from '@/lib/teaching';

const EMPTY = {
	student: '',
	subject: '',
	weekday: [] as string[],
	start_time: '09:00',
	duration_minutes: 60,
	location: '',
	notes: '',
};

export function Schedule() {
	const { user } = useAuth();
	const [items, setItems] = useState<ClassItem[]>([]);
	const [students, setStudents] = useState<Student[]>([]);
	const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
	const [showForm, setShowForm] = useState(false);
	const [editing, setEditing] = useState<ClassItem | null>(null);
	const [form, setForm] = useState({ ...EMPTY });
	const [saving, setSaving] = useState(false);
	const [err, setErr] = useState('');
	const [version, setVersion] = useState(0);

	async function load() {
		try {
			const [c, s] = await Promise.all([listClasses(), listStudents()]);
			setVersion((v) => v + 1);
			setItems(c);
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
		if (students.length === 0) {
			alert('Cadastre um aluno antes de agendar uma aula.');
			return;
		}
		setEditing(null);
		setForm({ ...EMPTY });
		setShowForm(true);
		setErr('');
	}
	function openEdit(c: ClassItem) {
		setEditing(c);
		setForm({
			student: c.student,
			subject: c.subject,
			weekday: Array.isArray(c.weekday) ? [...c.weekday] : [c.weekday],
			start_time: c.start_time,
			duration_minutes: c.duration_minutes || 60,
			location: c.location || '',
			notes: c.notes,
		});
		setShowForm(true);
		setErr('');
	}

	// Weekly limit from the student's record (0 = not informed, no limit)
	const student = students.find((s) => s.id === form.student);
	const perWeek = student?.classes_per_week || 0;
	const usedElsewhere = form.student ? weeklyDaysByStudent(items, editing?.id)[form.student] || 0 : 0;
	const allowed = perWeek ? Math.max(0, perWeek - usedElsewhere) : 7;

	function toggleDay(day: string) {
		setForm((prev) => {
			if (prev.weekday.includes(day)) return { ...prev, weekday: prev.weekday.filter((d) => d !== day) };
			if (prev.weekday.length >= allowed) return prev;
			return { ...prev, weekday: [...prev.weekday, day] };
		});
	}

	async function save(e: React.FormEvent) {
		e.preventDefault();
		if (!form.student) {
			setErr('Selecione um aluno.');
			return;
		}
		if (form.weekday.length === 0) {
			setErr('Selecione ao menos um dia da semana.');
			return;
		}
		if (form.weekday.length > allowed) {
			setErr(
				`${student?.name} tem ${perWeek} aula${perWeek > 1 ? 's' : ''} por semana. Desmarque ${form.weekday.length - allowed} dia${form.weekday.length - allowed > 1 ? 's' : ''} ou altere o cadastro do aluno.`,
			);
			return;
		}
		setSaving(true);
		setErr('');
		try {
			const data = { ...form, duration_minutes: roundDuration(Number(form.duration_minutes)) };
			if (editing) await updateClass(editing.id, data);
			else await createClass(user!.id, data);
			setShowForm(false);
			await load();
		} catch {
			setErr('Não foi possível salvar. Tente novamente.');
		} finally {
			setSaving(false);
		}
	}

	async function remove(id: string) {
		if (!confirm('Remover esta aula da agenda? Ela sai de todas as semanas.')) return;
		try {
			await deleteClass(id);
			await load();
		} catch {
			alert('Não foi possível remover.');
		}
	}

	return (
		<>
			<div className="dash-head">
				<div>
					<span className="eyebrow">AGENDA</span>
					<h1>Sua semana</h1>
					<p>Organize horários e confirme a presença. Aula não confirmada fica para repor.</p>
				</div>
				<button type="button" className="button small" onClick={openNew}>
					<Plus size={15} /> Nova aula
				</button>
			</div>

			{state === 'loading' && <p className="skeleton">Carregando agenda…</p>}
			{state === 'error' && (
				<p className="notice">Não foi possível carregar sua agenda. Tente novamente.</p>
			)}
			{state === 'ready' &&
				(items.length === 0 ? (
					<div className="panel">
						<p className="empty">Sua agenda está vazia. Adicione sua primeira aula para começar.</p>
					</div>
				) : (
					<Attendance version={version} onEdit={openEdit} onRemove={(c) => remove(c.id)} />
				))}

			{showForm && (
				<div className="modal-overlay" onClick={() => setShowForm(false)}>
					<form
						className="modal-panel"
						onClick={(e) => e.stopPropagation()}
						onSubmit={save}
					>
						<div className="modal-head">
							<h2>{editing ? 'Editar aula' : 'Nova aula'}</h2>
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
								<label>Aluno *</label>
								<select
									value={form.student}
									onChange={(e) => setForm({ ...form, student: e.target.value })}
								>
									<option value="">Selecione…</option>
									{students.map((s) => (
										<option key={s.id} value={s.id}>
											{s.name}
										</option>
									))}
								</select>
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
								<label>Hora de início</label>
								<input
									type="time"
									value={form.start_time}
									onChange={(e) => setForm({ ...form, start_time: e.target.value })}
								/>
							</div>
							<div className="field">
								<label>Duração (min)</label>
								<input
									type="number"
									min={15}
									max={480}
									step={5}
									value={form.duration_minutes}
									onChange={(e) =>
										setForm({ ...form, duration_minutes: Number(e.target.value) })
									}
									onBlur={() =>
										setForm({ ...form, duration_minutes: roundDuration(Number(form.duration_minutes)) })
									}
								/>
							</div>
							<div className="field full">
								<label>Dias da semana *</label>
								<div className="day-toggle">
									{WEEKDAYS.map((d, i) => {
										const on = form.weekday.includes(String(i));
										const blocked = !on && form.weekday.length >= allowed;
										return (
											<button
												type="button"
												key={i}
												className={'day-chip' + (on ? ' on' : '')}
												onClick={() => toggleDay(String(i))}
												disabled={blocked}
												style={blocked ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
												aria-pressed={on}
												title={d}
											>
												{WEEKDAYS_SHORT[i]}
											</button>
										);
									})}
								</div>
								{student && (
									<small className="meta" style={{ display: 'block', marginTop: 8, fontSize: 12, color: 'var(--quiet)' }}>
										{perWeek && allowed === 0 && form.weekday.length === 0
											? `As ${perWeek} aula${perWeek > 1 ? 's' : ''} por semana de ${student.name} já estão na agenda. Edite a outra aula ou altere o cadastro do aluno.`
											: perWeek
											? `${student.name} tem ${perWeek} aula${perWeek > 1 ? 's' : ''} por semana` +
												(usedElsewhere ? ` (${usedElsewhere} já na agenda em outra aula)` : '') +
												`: ${form.weekday.length} de ${allowed} dia${allowed === 1 ? '' : 's'} marcado${allowed === 1 ? '' : 's'}.`
											: 'Informe as aulas por semana no cadastro do aluno para limitar os dias.'}
									</small>
								)}
							</div>
							<div className="field full">
								<label>Local da aula</label>
								<div className="input-with-icon">
									<MapPin size={15} />
									<input
										value={form.location}
										onChange={(e) => setForm({ ...form, location: e.target.value })}
										placeholder="Academia, parque, online, endereço…"
									/>
								</div>
							</div>
							<div className="field full">
								<label>Observações</label>
								<input
									value={form.notes}
									onChange={(e) => setForm({ ...form, notes: e.target.value })}
									placeholder="Material, observações"
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

// ---------------------------------------------------------------------------
// Presença: confirm this week's classes; unconfirmed ones become make-ups.
// ---------------------------------------------------------------------------

interface Occurrence {
	cls: ClassItem;
	date: string; // YYYY-MM-DD
	ends: Date;
	session?: ClassSession;
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const shortDay = (iso: string) => fmtDay(iso).slice(0, 5);

/** Every occurrence of the weekly classes between monday and sunday of a week. */
function occurrencesOfWeek(classes: ClassItem[], monday: Date, sessions: ClassSession[]) {
	const out: Occurrence[] = [];
	for (let i = 0; i < 7; i++) {
		const day = addDays(monday, i);
		const date = isoDate(day);
		for (const c of classes) {
			const days = Array.isArray(c.weekday) ? c.weekday : [c.weekday];
			if (!days.includes(String(day.getDay()))) continue;
			const [h, m] = (c.start_time || '00:00').split(':').map(Number);
			const ends = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
			ends.setMinutes(ends.getMinutes() + (c.duration_minutes || 60));
			// Ignore occurrences that ended before the class was added to the schedule
			if (c.created && ends < new Date(c.created.replace(' ', 'T'))) continue;
			out.push({
				cls: c,
				date,
				ends,
				session: sessions.find((s) => s.class === c.id && s.date === date),
			});
		}
	}
	return out.sort((a, b) =>
		(a.date + a.cls.start_time).localeCompare(b.date + b.cls.start_time),
	);
}

/** Short, readable reason from an API error, to help diagnose setup problems. */
function describeError(e: unknown) {
	const err = e as { status?: number; message?: string; response?: { message?: string; data?: Record<string, { message?: string }> } };
	const fields = Object.entries(err?.response?.data || {})
		.map(([k, v]) => `${k}: ${v?.message || ''}`)
		.join('; ');
	return [err?.status ? `HTTP ${err.status}` : '', err?.response?.message || err?.message || '', fields]
		.filter(Boolean)
		.join(' · ');
}

const firstName = (s?: Student) => (s?.name || '').trim().split(/\s+/)[0];

function confirmLink(o: Occurrence) {
	const st = o.cls.expand?.student;
	const day = WEEKDAYS[new Date(o.date + 'T12:00').getDay()].toLowerCase();
	const what = o.cls.subject ? `aula de ${o.cls.subject}` : 'aula';
	return whatsappLink(
		st?.phone,
		`Olá, ${firstName(st)}! Confirmando nossa ${what} ${day} (${shortDay(o.date)}) às ${o.cls.start_time}. Você confirma presença?`,
	);
}

function makeupLink(s: ClassSession) {
	const c = s.expand?.class;
	const st = c?.expand?.student;
	return whatsappLink(
		st?.phone,
		`Olá, ${firstName(st)}! Ficamos com a aula do dia ${shortDay(s.date)} para repor. Qual dia e horário ficam bons para você esta semana?`,
	);
}

const STATUS_BADGE: Record<string, { label: string; className: string; style?: React.CSSProperties }> = {
	confirmed: { label: 'Confirmada', className: 'badge paid' },
	waiting: { label: 'Aguardando', className: 'badge inactive' },
	makeup: { label: 'A repor', className: 'badge pending' },
	done: { label: 'Reposta', className: 'badge active' },
};

function WaButton({ link, title }: { link: string | null; title: string }) {
	if (!link)
		return (
			<button
				type="button"
				className="icon-btn"
				disabled
				style={{ opacity: 0.35 }}
				title="Cadastre o telefone do aluno para usar o WhatsApp"
				aria-label={title}
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
			title={title}
			aria-label={title}
			style={{ color: '#1f9e55' }}
		>
			<MessageCircle size={15} />
		</a>
	);
}

function Attendance({
	version,
	onEdit,
	onRemove,
}: {
	version: number;
	onEdit: (c: ClassItem) => void;
	onRemove: (c: ClassItem) => void;
}) {
	const { user } = useAuth();
	const [classes, setClasses] = useState<ClassItem[]>([]);
	const [sessions, setSessions] = useState<ClassSession[]>([]);
	const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
	const [offset, setOffset] = useState(0); // weeks from the current one
	const [busy, setBusy] = useState('');
	const [scheduling, setScheduling] = useState<ClassSession | null>(null);
	const [mk, setMk] = useState({ date: '', time: '' });
	const [errDetail, setErrDetail] = useState('');

	const thisMonday = weekStart(new Date());
	const monday = addDays(thisMonday, offset * 7);

	async function load() {
		try {
			const prevMonday = addDays(thisMonday, -7);
			const from = isoDate(offset < -1 ? monday : prevMonday);
			const [c, s] = await Promise.all([listClasses(), listSessions(from)]);
			// Classes from this week and last week that ended without confirmation become make-ups
			const now = new Date();
			const missed = [
				...occurrencesOfWeek(c, prevMonday, s),
				...occurrencesOfWeek(c, thisMonday, s),
			].filter((o) => !o.session && o.ends < now);
			if (missed.length) {
				for (const o of missed)
					await createSession(currentUserId(), {
						class: o.cls.id,
						date: o.date,
						status: 'makeup',
					}).catch(() => null); // already created by another tab
				setSessions(await listSessions(from));
			} else setSessions(s);
			setClasses(c);
			setState('ready');
		} catch (e) {
			setErrDetail(describeError(e));
			setState('error');
		}
	}
	useEffect(() => {
		void load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [offset, version]);

	async function run(key: string, fn: () => Promise<unknown>) {
		setBusy(key);
		try {
			await fn();
			await load();
		} catch {
			alert('Não foi possível salvar. Tente novamente.');
		} finally {
			setBusy('');
		}
	}

	const setStatus = (o: Occurrence, status: 'confirmed' | 'makeup') =>
		run(o.cls.id + o.date, () =>
			o.session
				? updateSession(o.session.id, { status })
				: createSession(user!.id, { class: o.cls.id, date: o.date, status }),
		);
	const undo = (o: Occurrence) =>
		run(o.cls.id + o.date, () => deleteSession(o.session!.id));

	async function saveMakeup(e: React.FormEvent) {
		e.preventDefault();
		if (!scheduling) return;
		const s = scheduling;
		setScheduling(null);
		await run(s.id, () => updateSession(s.id, { makeup_date: mk.date, makeup_time: mk.time }));
	}

	if (state === 'loading') return <p className="skeleton">Carregando presença…</p>;
	if (state === 'error')
		return (
			<p className="notice">
				Não foi possível carregar as confirmações. Atualize a página para tentar de novo.
				{errDetail && (
					<>
						<br />
						<small>Detalhe técnico: {errDetail}</small>
					</>
				)}
			</p>
		);

	const occ = occurrencesOfWeek(classes, monday, sessions);
	const pending = sessions
		.filter((s) => s.status === 'makeup')
		.sort((a, b) => a.date.localeCompare(b.date));
	const now = new Date();
	const days = Array.from({ length: 7 }, (_, i) => isoDate(addDays(monday, i)))
		.map((date) => ({ date, items: occ.filter((o) => o.date === date) }))
		.filter((d) => d.items.length > 0);
	const confirmedCount = occ.filter((o) => o.session?.status === 'confirmed').length;
	// Classes per student this week, compared with the weekly amount in the student's record
	const perStudent = Object.values(
		occ.reduce<Record<string, { student?: Student; total: number; confirmed: number }>>((acc, o) => {
			const id = o.cls.student;
			acc[id] ||= { student: o.cls.expand?.student, total: 0, confirmed: 0 };
			acc[id].total++;
			if (o.session?.status === 'confirmed') acc[id].confirmed++;
			return acc;
		}, {}),
	).sort((a, b) => (a.student?.name || '').localeCompare(b.student?.name || ''));
	const waitingCount = occ.filter((o) => !o.session && o.ends >= now).length;

	return (
		<>
			<div className="metric-grid">
				<div className="metric-card">
					<div className="label">Confirmadas na semana</div>
					<div className="value">{confirmedCount}</div>
					<div className="sub">de {occ.length} aulas</div>
				</div>
				<div className="metric-card">
					<div className="label">Aguardando confirmação</div>
					<div className="value">{waitingCount}</div>
				</div>
				<div className="metric-card">
					<div className="label">Reposições pendentes</div>
					<div className="value" style={pending.length ? { color: '#a62e20' } : undefined}>
						{pending.length}
					</div>
				</div>
			</div>

			{perStudent.length > 0 && (
				<div className="panel">
					<div className="panel-head">
						<h2>Aulas por aluno nesta semana</h2>
						<span className="meta">
							{perStudent.length} aluno{perStudent.length > 1 ? 's' : ''}
						</span>
					</div>
					<div className="panel-body">
						{perStudent.map(({ student, total, confirmed }) => {
							const plan = student?.classes_per_week || 0;
							const over = plan > 0 && total > plan;
							return (
								<div className="row" key={student?.id || total}>
									<div className="grow">
										<div className="name">{student?.name || 'Aluno'}</div>
										<div className="meta">
											{confirmed} confirmada{confirmed === 1 ? '' : 's'}
											{plan ? ` · plano de ${plan}x por semana` : ' · aulas por semana não informadas'}
										</div>
									</div>
									<span
										className={'badge ' + (over ? 'pending' : plan && total === plan ? 'active' : 'inactive')}
										title={over ? 'Mais aulas na agenda do que o plano do aluno' : undefined}
									>
										{plan ? `${total} de ${plan}` : `${total} aula${total > 1 ? 's' : ''}`}
									</span>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{pending.length > 0 && (
				<div className="panel">
					<div className="panel-head">
						<h2>Para repor</h2>
						<span className="meta">
							{pending.length} aula{pending.length > 1 ? 's' : ''}
						</span>
					</div>
					<div className="panel-body">
						{pending.map((s) => {
							const c = s.expand?.class;
							return (
								<div className="row" key={s.id}>
									<span className="lesson-time">{shortDay(s.date)}</span>
									<div className="grow">
										<div className="name">
											{c?.expand?.student?.name || 'Aluno'}
											{c?.subject ? ` · ${c.subject}` : ''}
										</div>
										<div className="meta">
											Aula de {shortDay(s.date)} às {c?.start_time}
											{s.makeup_date
												? ` · reposição marcada ${shortDay(s.makeup_date)}${s.makeup_time ? ` às ${s.makeup_time}` : ''}`
												: ' · reposição não marcada'}
										</div>
									</div>
									<WaButton link={makeupLink(s)} title="Combinar reposição no WhatsApp" />
									<button
										type="button"
										className="icon-btn"
										title="Marcar data da reposição"
										aria-label="Marcar data da reposição"
										onClick={() => {
											setMk({ date: s.makeup_date || isoDate(new Date()), time: s.makeup_time || c?.start_time || '' });
											setScheduling(s);
										}}
									>
										<CalendarClock size={15} />
									</button>
									<button
										type="button"
										className="icon-btn"
										disabled={busy === s.id}
										onClick={() => run(s.id, () => updateSession(s.id, { status: 'done' }))}
										title="Reposição feita"
										aria-label="Reposição feita"
									>
										<Check size={15} />
									</button>
								</div>
							);
						})}
					</div>
				</div>
			)}

			<div className="panel">
				<div className="panel-head">
					<button
						type="button"
						className="icon-btn"
						onClick={() => setOffset(offset - 1)}
						aria-label="Semana anterior"
					>
						<ChevronLeft size={16} />
					</button>
					<h2 style={{ flex: 1, textAlign: 'center' }}>
						{offset === 0 ? 'Esta semana' : offset === 1 ? 'Próxima semana' : 'Semana'} ·{' '}
						{shortDay(isoDate(monday))} a {shortDay(isoDate(addDays(monday, 6)))}
					</h2>
					<button
						type="button"
						className="icon-btn"
						onClick={() => setOffset(offset + 1)}
						aria-label="Próxima semana"
					>
						<ChevronRight size={16} />
					</button>
				</div>
			</div>

			{days.length === 0 && (
				<div className="panel">
					<p className="empty">Nenhuma aula nesta semana.</p>
				</div>
			)}

			{days.map((d) => (
				<div className="panel" key={d.date}>
					<div className="panel-head">
						<h2>
							{WEEKDAYS[new Date(d.date + 'T12:00').getDay()]} · {shortDay(d.date)}
						</h2>
						<span className="meta">
							{d.items.length} aula{d.items.length > 1 ? 's' : ''}
						</span>
					</div>
					<div className="panel-body">
						{d.items.map((o) => {
							const key = o.cls.id + o.date;
							const status = o.session?.status || (o.ends < now ? 'makeup' : 'waiting');
							const badge = STATUS_BADGE[status];
							return (
								<div className="row" key={key}>
									<span className="lesson-time">{o.cls.start_time}</span>
									<div className="grow">
										<div className="name">
											{o.cls.expand?.student?.name || 'Aluno'}
											{o.cls.subject ? ` · ${o.cls.subject}` : ''}
										</div>
										<div className="meta">
											{o.cls.duration_minutes ? `${o.cls.duration_minutes} min` : ''}
											{o.cls.location ? ` · ${o.cls.location}` : ''}
											{o.session?.status === 'done' && o.session.makeup_date
												? ` · reposta em ${shortDay(o.session.makeup_date)}`
												: ''}
										</div>
									</div>
									<span className={badge.className}>{badge.label}</span>
									{status === 'waiting' && (
										<WaButton link={confirmLink(o)} title="Pedir confirmação no WhatsApp" />
									)}
									{status !== 'confirmed' && status !== 'done' && (
										<button
											type="button"
											className="icon-btn"
											disabled={busy === key}
											onClick={() => setStatus(o, 'confirmed')}
											title="Aluno confirmou"
											aria-label="Aluno confirmou"
										>
											<Check size={15} />
										</button>
									)}
									{status === 'waiting' || status === 'confirmed' ? (
										<button
											type="button"
											className="icon-btn"
											disabled={busy === key}
											onClick={() => setStatus(o, 'makeup')}
											title="Não vem, fica para repor"
											aria-label="Não vem, fica para repor"
										>
											<UserX size={15} />
										</button>
									) : null}
									{o.session && o.ends >= now && (
										<button
											type="button"
											className="icon-btn"
											disabled={busy === key}
											onClick={() => undo(o)}
											title="Desfazer"
											aria-label="Desfazer"
										>
											<Undo2 size={15} />
										</button>
									)}
									<button
										type="button"
										className="icon-btn"
										onClick={() => onEdit(o.cls)}
										title="Editar aula"
										aria-label="Editar aula"
									>
										<Pencil size={15} />
									</button>
									<button
										type="button"
										className="icon-btn"
										onClick={() => onRemove(o.cls)}
										title="Excluir aula da agenda"
										aria-label="Excluir aula da agenda"
									>
										<Trash2 size={15} />
									</button>
								</div>
							);
						})}
					</div>
				</div>
			))}

			{scheduling && (
				<div className="modal-overlay" onClick={() => setScheduling(null)}>
					<form
						className="modal-panel"
						onClick={(e) => e.stopPropagation()}
						onSubmit={saveMakeup}
					>
						<div className="modal-head">
							<h2>Marcar reposição</h2>
							<button
								type="button"
								className="icon-btn"
								onClick={() => setScheduling(null)}
								aria-label="Fechar"
							>
								<X size={18} />
							</button>
						</div>
						<div className="form-grid">
							<div className="field">
								<label>Dia</label>
								<input
									type="date"
									required
									value={mk.date}
									onChange={(e) => setMk({ ...mk, date: e.target.value })}
								/>
							</div>
							<div className="field">
								<label>Horário</label>
								<input
									type="time"
									value={mk.time}
									onChange={(e) => setMk({ ...mk, time: e.target.value })}
								/>
							</div>
						</div>
						<div className="form-actions">
							<button type="button" className="btn-ghost" onClick={() => setScheduling(null)}>
								Cancelar
							</button>
							<button type="submit" className="button small">
								Salvar
							</button>
						</div>
					</form>
				</div>
			)}
		</>
	);
}
