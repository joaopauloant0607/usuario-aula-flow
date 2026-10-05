import pb from '@/lib/pocketbase-client';

export interface Student {
	id: string;
	name: string;
	email: string;
	phone: string;
	subject: string;
	notes: string;
	status: 'active' | 'inactive';
	monthly_fee: number;
	classes_per_week: number;
	due_day: number;
	created: string;
}

export interface ClassItem {
	id: string;
	student: string;
	subject: string;
	weekday: string[];
	start_time: string;
	duration_minutes: number | null;
	location: string;
	notes: string;
	created: string;
	expand?: { student?: Student };
}

export interface Payment {
	id: string;
	student: string;
	description: string;
	amount: number;
	due_date: string;
	paid_date: string;
	status: 'pending' | 'paid';
	created: string;
	expand?: { student?: Student };
}

export const WEEKDAYS = [
	'Domingo',
	'Segunda',
	'Terça',
	'Quarta',
	'Quinta',
	'Sexta',
	'Sábado',
];
export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ---- students ----
export async function listStudents() {
	return pb.collection('students').getFullList<Student>({ sort: 'name' });
}
export async function createStudent(owner: string, data: Partial<Student>) {
	return pb.collection('students').create<Student>({
		owner,
		status: 'active',
		...data,
	});
}
export async function updateStudent(id: string, data: Partial<Student>) {
	return pb.collection('students').update<Student>(id, data);
}
export async function deleteStudent(id: string) {
	return pb.collection('students').delete(id);
}

// ---- classes ----
export async function listClasses() {
	return pb
		.collection('classes')
		.getFullList<ClassItem>({ expand: 'student', sort: 'weekday,start_time' });
}
export async function createClass(owner: string, data: Partial<ClassItem>) {
	return pb.collection('classes').create<ClassItem>({
		owner,
		duration_minutes: 60,
		weekday: [],
		location: '',
		...data,
	});
}
export async function updateClass(id: string, data: Partial<ClassItem>) {
	return pb.collection('classes').update<ClassItem>(id, data);
}
export async function deleteClass(id: string) {
	return pb.collection('classes').delete(id);
}

/** Weekly class days per student, counting every scheduled class (optionally skipping one). */
export function weeklyDaysByStudent(classes: ClassItem[], skipClassId?: string) {
	const out: Record<string, number> = {};
	for (const c of classes) {
		if (c.id === skipClassId) continue;
		const days = Array.isArray(c.weekday) ? c.weekday : [c.weekday];
		out[c.student] = (out[c.student] || 0) + days.length;
	}
	return out;
}

/** Rounds a lesson length to the nearest 5 minutes, between 15 minutes and 8 hours. */
export const roundDuration = (n: number) => Math.min(480, Math.max(15, Math.round((n || 60) / 5) * 5));

// ---- payments ----
export async function listPayments() {
	return pb
		.collection('payments')
		.getFullList<Payment>({ expand: 'student', sort: '-due_date' });
}
export type PaymentInput = Partial<
	Omit<Payment, 'student' | 'due_date' | 'paid_date'>
> & {
	student?: string | null;
	due_date?: string | null;
	paid_date?: string | null;
};
export async function createPayment(owner: string, data: PaymentInput) {
	return pb.collection('payments').create<Payment>({
		owner,
		status: 'pending',
		...data,
	});
}
export async function updatePayment(id: string, data: PaymentInput) {
	return pb.collection('payments').update<Payment>(id, data);
}
export async function deletePayment(id: string) {
	return pb.collection('payments').delete(id);
}

// ---- billing helpers ----
const pad = (n: number) => String(n).padStart(2, '0');

/** Today's date as YYYY-MM-DD in the user's local time. */
export function todayISO() {
	const d = new Date();
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Formats a stored date as dd/mm/aaaa without timezone shifts. */
export function fmtDay(s: string) {
	const [y, m, d] = s.slice(0, 10).split('-');
	return `${d}/${m}/${y}`;
}

export function isOverdue(p: Payment) {
	return p.status === 'pending' && !!p.due_date && p.due_date.slice(0, 10) < todayISO();
}

export const DEFAULT_DUE_DAY = 10;

export interface PlannedCharge {
	student: Student;
	amount: number;
	due_date: string; // YYYY-MM-DD
	description: string;
}

/**
 * Lists the monthly charges to create for a month (month is 0-11).
 * Skips inactive students, students without a monthly fee and students
 * who already have a "Mensalidade" due in that month.
 */
export function planMonthlyCharges(
	students: Student[],
	payments: Payment[],
	year: number,
	month: number,
): PlannedCharge[] {
	const ym = `${year}-${pad(month + 1)}`;
	const lastDay = new Date(year, month + 1, 0).getDate();
	return students
		.filter((s) => s.status === 'active' && s.monthly_fee > 0)
		.filter(
			(s) =>
				!payments.some(
					(p) =>
						p.student === s.id &&
						(p.due_date || '').startsWith(ym) &&
						(p.description || '').toLowerCase().startsWith('mensalidade'),
				),
		)
		.map((s) => {
			const day = Math.min(s.due_day || DEFAULT_DUE_DAY, lastDay);
			return {
				student: s,
				amount: s.monthly_fee,
				due_date: `${ym}-${pad(day)}`,
				description: `Mensalidade ${pad(month + 1)}/${year}`,
			};
		});
}

export async function createPlannedCharges(owner: string, charges: PlannedCharge[]) {
	for (const c of charges) {
		await createPayment(owner, {
			student: c.student.id,
			description: c.description,
			amount: c.amount,
			// noon UTC keeps the same calendar day in every Brazilian timezone
			due_date: `${c.due_date} 12:00:00.000Z`,
			paid_date: null,
		});
	}
}

/** wa.me link for a Brazilian phone, or null when the phone is missing or too short. */
export function whatsappLink(phone: string | undefined, text: string) {
	let digits = (phone || '').replace(/\D/g, '');
	if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
	if (digits.length < 12) return null;
	return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** wa.me link with a ready-made charge message, or null when the student has no valid phone. */
export function whatsappChargeLink(p: Payment) {
	const s = p.expand?.student;
	const first = (s?.name || '').trim().split(/\s+/)[0];
	const value = p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
	const what = p.description ? `"${p.description}"` : 'o pagamento';
	const due = p.due_date ? fmtDay(p.due_date) : '';
	const text = isOverdue(p)
		? `Olá, ${first}! Tudo bem? Notei que ${what}, no valor de ${value}, venceu em ${due} e ainda está em aberto. Consegue verificar pra mim? Obrigado!`
		: `Olá, ${first}! Passando para lembrar ${what === 'o pagamento' ? 'do pagamento' : `de ${what}`}, no valor de ${value}${due ? `, com vencimento em ${due}` : ''}. Qualquer dúvida, estou à disposição!`;
	return whatsappLink(s?.phone, text);
}

// ---- class confirmations (one record per class occurrence the professional acted on) ----
export type SessionStatus = 'confirmed' | 'makeup' | 'done';

export interface ClassSession {
	id: string;
	class: string;
	date: string; // YYYY-MM-DD of the original occurrence
	status: SessionStatus;
	makeup_date: string; // YYYY-MM-DD, optional
	makeup_time: string; // HH:MM, optional
	created: string;
	expand?: { class?: ClassItem & { expand?: { student?: Student } } };
}

/** Id of the signed-in professional (also available before useAuth hydrates). */
export const currentUserId = () => pb.authStore.record?.id as string;

/** Local date as YYYY-MM-DD. */
export function isoDate(d: Date) {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Monday of the week containing d (local time, 00:00). */
export function weekStart(d: Date) {
	const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
	r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
	return r;
}

/** Sessions from a date on, plus every pending make-up regardless of date. */
export async function listSessions(fromDate: string) {
	return pb.collection('class_sessions').getFullList<ClassSession>({
		filter: pb.filter('date >= {:from} || status = "makeup"', { from: fromDate }),
		expand: 'class.student',
		sort: 'date',
		requestKey: null,
	});
}
export async function createSession(
	owner: string,
	data: { class: string; date: string; status: SessionStatus },
) {
	return pb
		.collection('class_sessions')
		.create<ClassSession>({ owner, makeup_date: '', makeup_time: '', ...data });
}
export async function updateSession(id: string, data: Partial<ClassSession>) {
	return pb.collection('class_sessions').update<ClassSession>(id, data);
}
export async function deleteSession(id: string) {
	return pb.collection('class_sessions').delete(id);
}
