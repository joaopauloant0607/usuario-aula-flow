/**
 * The professional's records (students, classes, payments, class sessions):
 * validation, owner checks, related records and cascading deletes.
 *
 * Every query is scoped to the signed-in owner, so nobody can read or change
 * another account's data by guessing an id. Records keep the shape the app
 * used with PocketBase: string ids, `created`/`updated` stamps, related
 * records under `expand`.
 */
import { apiError } from '@/lib/api.server';
import { type Executor, getDb, isUniqueViolation, newId, nowStamp } from '@/lib/db.server';

type Param = string | number | null;
type Row = Record<string, unknown>;
type Validator = (value: unknown, field: string) => Param;

const bad = (message: string) => apiError(400, message);
const isEmpty = (v: unknown) => v === undefined || v === null || v === '';

// ---- field types ----

const text =
	(max: number, required = false): Validator =>
	(v, field) => {
		const s = isEmpty(v) ? '' : typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null;
		if (s === null) throw bad(`${field}: valor inválido.`);
		if (s.length > max) throw bad(`${field}: no máximo ${max} caracteres.`);
		if (required && !s.trim()) throw bad(`${field}: campo obrigatório.`);
		return s;
	};

const email: Validator = (v, field) => {
	const s = text(255)(v, field) as string;
	if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw bad(`${field}: e-mail inválido.`);
	return s;
};

const select =
	(values: string[]): Validator =>
	(v, field) => {
		if (typeof v !== 'string' || !values.includes(v)) throw bad(`${field}: valor inválido.`);
		return v;
	};

/** Empty means 0, like PocketBase number fields; `required` rejects 0. */
const number =
	({ min, max, int = false, required = false }: { min?: number; max?: number; int?: boolean; required?: boolean }): Validator =>
	(v, field) => {
		const n = isEmpty(v) ? 0 : typeof v === 'number' || typeof v === 'string' ? Number(v) : NaN;
		if (!Number.isFinite(n) || (int && !Number.isInteger(n))) throw bad(`${field}: número inválido.`);
		if (n === 0) {
			if (required) throw bad(`${field}: campo obrigatório.`);
			return 0;
		}
		if ((min !== undefined && n < min) || (max !== undefined && n > max)) throw bad(`${field}: fora do intervalo permitido.`);
		return n;
	};

/** Stored as `YYYY-MM-DD HH:MM:SS.sssZ`; accepts a plain date or any ISO date-time. */
const date: Validator = (v, field) => {
	if (isEmpty(v)) return '';
	const d = typeof v === 'string' ? new Date(v.trim().replace(' ', 'T')) : null;
	if (!d || Number.isNaN(d.getTime())) throw bad(`${field}: data inválida.`);
	return d.toISOString().replace('T', ' ');
};

/** One or more weekdays, '0' (Sunday) to '6', stored as a JSON list. */
const weekdays: Validator = (v, field) => {
	const list = Array.isArray(v) ? v : isEmpty(v) ? [] : [v];
	const days = [...new Set(list.map(String))];
	if (!days.length || days.some((d) => !/^[0-6]$/.test(d))) throw bad(`${field}: escolha ao menos um dia da semana.`);
	return JSON.stringify(days);
};

// ---- collections ----

interface Collection {
	table: string;
	fields: Record<string, Validator>;
	/** Values used on create when the field is missing. Required fields have none. */
	defaults: Row;
	/** Fields that point at another record of the same owner. */
	relations: Record<string, { table: string; required: boolean }>;
}

const COLLECTIONS: Record<string, Collection> = {
	students: {
		table: 'students',
		fields: {
			name: text(200, true),
			email,
			phone: text(40),
			subject: text(120),
			notes: text(2000),
			status: select(['active', 'inactive']),
			monthly_fee: number({ min: 0 }),
			classes_per_week: number({ min: 0, max: 7, int: true }),
			due_day: number({ min: 0, max: 31, int: true }),
		},
		defaults: { email: '', phone: '', subject: '', notes: '', status: 'active', monthly_fee: 0, classes_per_week: 0, due_day: 0 },
		relations: {},
	},
	classes: {
		table: 'classes',
		fields: {
			subject: text(120),
			weekday: weekdays,
			start_time: text(5, true),
			duration_minutes: number({ min: 15, max: 480 }),
			location: text(200),
			notes: text(500),
		},
		defaults: { subject: '', duration_minutes: 0, location: '', notes: '' },
		relations: { student: { table: 'students', required: true } },
	},
	payments: {
		table: 'payments',
		fields: {
			description: text(200),
			amount: number({ min: 0, required: true }),
			due_date: date,
			paid_date: date,
			status: select(['pending', 'paid']),
		},
		defaults: { student: '', description: '', due_date: '', paid_date: '', status: 'pending' },
		relations: { student: { table: 'students', required: false } },
	},
	class_sessions: {
		table: 'class_sessions',
		fields: {
			date: text(10, true),
			status: select(['confirmed', 'makeup', 'done']),
			makeup_date: text(10),
			makeup_time: text(5),
		},
		defaults: { makeup_date: '', makeup_time: '' },
		relations: { class: { table: 'classes', required: true } },
	},
};

function collectionFor(name: unknown) {
	const c = typeof name === 'string' && Object.hasOwn(COLLECTIONS, name) ? COLLECTIONS[name] : null;
	if (!c) throw bad('Coleção desconhecida.');
	return c;
}

/** Database row to the record shape the app expects. */
function toRecord(table: string, row: Row): Row {
	const out: Row = { ...row };
	for (const key of ['monthly_fee', 'classes_per_week', 'due_day', 'duration_minutes', 'amount']) {
		if (key in out) out[key] = Number(out[key]);
	}
	if (table === 'classes') {
		try {
			out.weekday = JSON.parse(String(row.weekday));
		} catch {
			out.weekday = [];
		}
	}
	return out;
}

async function findOwned(db: Executor, table: string, id: unknown, owner: string) {
	if (typeof id !== 'string' || !id) return null;
	const [row] = await db.all<Row>(`SELECT * FROM \`${table}\` WHERE \`id\` = ? AND \`owner\` = ?`, [id, owner]);
	return row ?? null;
}

/** Validates the fields present in `data` (all fields when creating) into column values. */
async function prepare(db: Executor, c: Collection, owner: string, data: unknown, creating: boolean) {
	if (!data || typeof data !== 'object' || Array.isArray(data)) throw bad('Dados inválidos.');
	const input = data as Row;
	const values: Record<string, Param> = {};

	for (const [field, validate] of Object.entries(c.fields)) {
		const value = input[field] !== undefined ? input[field] : creating ? c.defaults[field] : undefined;
		if (value === undefined && !creating) continue;
		values[field] = validate(value, field);
	}

	for (const [field, rel] of Object.entries(c.relations)) {
		const value = input[field] !== undefined ? input[field] : creating ? c.defaults[field] : undefined;
		if (value === undefined && !creating) continue;
		if (isEmpty(value)) {
			if (rel.required) throw bad(`${field}: campo obrigatório.`);
			values[field] = '';
		} else if (await findOwned(db, rel.table, value, owner)) {
			values[field] = value as string;
		} else {
			throw bad(`${field}: registro não encontrado.`);
		}
	}
	return values;
}

const DUPLICATE = () => bad('Já existe um registro para esta aula nesse dia.');

// ---- schedule conflicts ----

const DAY_NAMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const minutesOf = (time: unknown) => {
	const [h, m] = String(time || '0:0').split(':').map(Number);
	return (h || 0) * 60 + (m || 0);
};
const clock = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const overlaps = (aStart: number, aLength: number, bStart: number, bLength: number) =>
	aStart < bStart + bLength && bStart < aStart + aLength;
const daysOf = (value: unknown): string[] => {
	try {
		const days = JSON.parse(String(value));
		return Array.isArray(days) ? days.map(String) : [];
	} catch {
		return [];
	}
};
const lengthOf = (minutes: unknown) => Number(minutes) || 60;

/** Names of the students by id, for conflict messages. */
async function studentNames(db: Executor, owner: string) {
	const rows = await db.all<Row>('SELECT `id`, `name` FROM `students` WHERE `owner` = ?', [owner]);
	return new Map(rows.map((r) => [String(r.id), String(r.name)]));
}

const busy = (when: string, name?: string) =>
	bad(`Horário ocupado: ${when} já tem aula${name ? ` com ${name}` : ''}. Escolha outro horário.`);

/** One teacher cannot give two lessons at the same time: rejects a weekly class that overlaps another. */
async function assertClassFree(db: Executor, owner: string, next: Record<string, Param>, skipId: string | null) {
	const days = daysOf(next.weekday);
	const start = minutesOf(next.start_time);
	const length = lengthOf(next.duration_minutes);
	const rows = await db.all<Row>('SELECT * FROM `classes` WHERE `owner` = ?', [owner]);
	const names = await studentNames(db, owner);
	for (const row of rows) {
		if (skipId && row.id === skipId) continue;
		const day = daysOf(row.weekday).find((d) => days.includes(d));
		if (day === undefined) continue;
		const otherStart = minutesOf(row.start_time);
		const otherLength = lengthOf(row.duration_minutes);
		if (overlaps(start, length, otherStart, otherLength)) {
			throw busy(`${DAY_NAMES[Number(day)]}, ${clock(otherStart)} às ${clock(otherStart + otherLength)}`, names.get(String(row.student)));
		}
	}
}

/** A make-up lesson must not collide with a weekly class or another make-up on that date. */
async function assertMakeupFree(db: Executor, owner: string, next: Row, skipId: string | null) {
	const date = String(next.makeup_date || '');
	const time = String(next.makeup_time || '');
	if (!date || !time) return;
	const [cls] = await db.all<Row>('SELECT * FROM `classes` WHERE `id` = ? AND `owner` = ?', [String(next.class), owner]);
	const start = minutesOf(time);
	const length = lengthOf(cls?.duration_minutes);
	const weekday = String(new Date(`${date}T12:00`).getDay());
	const names = await studentNames(db, owner);

	for (const row of await db.all<Row>('SELECT * FROM `classes` WHERE `owner` = ?', [owner])) {
		if (!daysOf(row.weekday).includes(weekday)) continue;
		const otherStart = minutesOf(row.start_time);
		const otherLength = lengthOf(row.duration_minutes);
		if (overlaps(start, length, otherStart, otherLength)) {
			throw busy(`${DAY_NAMES[Number(weekday)]}, ${clock(otherStart)} às ${clock(otherStart + otherLength)}`, names.get(String(row.student)));
		}
	}
	for (const row of await db.all<Row>("SELECT * FROM `class_sessions` WHERE `owner` = ? AND `makeup_date` = ? AND `makeup_time` <> ''", [owner, date])) {
		if (skipId && row.id === skipId) continue;
		const [other] = await db.all<Row>('SELECT * FROM `classes` WHERE `id` = ?', [String(row.class)]);
		const otherStart = minutesOf(row.makeup_time);
		const otherLength = lengthOf(other?.duration_minutes);
		if (overlaps(start, length, otherStart, otherLength)) {
			throw busy(`${DAY_NAMES[Number(weekday)]}, ${clock(otherStart)} às ${clock(otherStart + otherLength)}`, names.get(String(other?.student)));
		}
	}
}

// ---- operations ----

async function list(c: Collection, owner: string, from: unknown): Promise<Row[]> {
	const db = await getDb();
	const studentsById = async () =>
		new Map(
			(await db.all<Row>('SELECT * FROM `students` WHERE `owner` = ?', [owner])).map((s) => [s.id, toRecord('students', s)]),
		);

	if (c.table === 'students') {
		const rows = (await db.all<Row>('SELECT * FROM `students` WHERE `owner` = ?', [owner])).map((r) => toRecord('students', r));
		return rows.sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR', { sensitivity: 'base' }));
	}

	if (c.table === 'classes' || c.table === 'payments') {
		const order = c.table === 'classes' ? '`weekday`, `start_time`, `created`' : '`due_date` DESC, `created` DESC';
		const rows = await db.all<Row>(`SELECT * FROM \`${c.table}\` WHERE \`owner\` = ? ORDER BY ${order}`, [owner]);
		const students = await studentsById();
		return rows.map((r) => {
			const student = students.get(r.student);
			return { ...toRecord(c.table, r), expand: student ? { student } : {} };
		});
	}

	// class_sessions: from a date on, plus every pending make-up
	if (typeof from !== 'string' || from.length > 10) throw bad('from: data inválida.');
	const rows = await db.all<Row>(
		"SELECT * FROM `class_sessions` WHERE `owner` = ? AND (`date` >= ? OR `status` = 'makeup') ORDER BY `date`, `created`",
		[owner, from],
	);
	const students = await studentsById();
	const classes = new Map(
		(await db.all<Row>('SELECT * FROM `classes` WHERE `owner` = ?', [owner])).map((r) => {
			const student = students.get(r.student);
			return [r.id, { ...toRecord('classes', r), expand: student ? { student } : {} }];
		}),
	);
	return rows.map((r) => {
		const cls = classes.get(r.class);
		return { ...toRecord('class_sessions', r), expand: cls ? { class: cls } : {} };
	});
}

async function create(c: Collection, owner: string, data: unknown) {
	const db = await getDb();
	const values = await prepare(db, c, owner, data, true);
	if (c.table === 'classes') await assertClassFree(db, owner, values, null);
	if (c.table === 'class_sessions') await assertMakeupFree(db, owner, values, null);
	const now = nowStamp();
	const row: Record<string, Param> = { id: newId(), owner, ...values, created: now, updated: now };
	const columns = Object.keys(row);
	await db
		.run(
			`INSERT INTO \`${c.table}\` (${columns.map((k) => `\`${k}\``).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
			Object.values(row),
		)
		.catch((error) => {
			throw isUniqueViolation(error) ? DUPLICATE() : error;
		});
	return toRecord(c.table, row);
}

async function update(c: Collection, owner: string, id: unknown, data: unknown) {
	const db = await getDb();
	const existing = await findOwned(db, c.table, id, owner);
	if (!existing) throw apiError(404, 'Registro não encontrado.');
	const values = { ...(await prepare(db, c, owner, data, false)), updated: nowStamp() };
	// Only re-check when the time itself changed, so editing a note never trips over an old overlap.
	if (c.table === 'classes' && ['weekday', 'start_time', 'duration_minutes'].some((k) => k in values)) {
		await assertClassFree(db, owner, { ...existing, ...values } as Record<string, Param>, existing.id as string);
	}
	if (c.table === 'class_sessions' && ['makeup_date', 'makeup_time'].some((k) => k in values)) {
		await assertMakeupFree(db, owner, { ...existing, ...values }, existing.id as string);
	}
	const columns = Object.keys(values);
	await db
		.run(`UPDATE \`${c.table}\` SET ${columns.map((k) => `\`${k}\` = ?`).join(', ')} WHERE \`id\` = ? AND \`owner\` = ?`, [
			...Object.values(values),
			id as string,
			owner,
		])
		.catch((error) => {
			throw isUniqueViolation(error) ? DUPLICATE() : error;
		});
	return toRecord(c.table, (await findOwned(db, c.table, id, owner)) as Row);
}

/**
 * Deleting a student also deletes their classes and those classes' sessions,
 * and unlinks their payments (which are kept). Deleting a class deletes its sessions.
 */
async function remove(c: Collection, owner: string, id: unknown) {
	const db = await getDb();
	if (!(await findOwned(db, c.table, id, owner))) throw apiError(404, 'Registro não encontrado.');
	const recordId = id as string;

	await db.transaction(async (tx) => {
		if (c.table === 'students') {
			await tx.run(
				'DELETE FROM `class_sessions` WHERE `owner` = ? AND `class` IN (SELECT `id` FROM `classes` WHERE `student` = ? AND `owner` = ?)',
				[owner, recordId, owner],
			);
			await tx.run('DELETE FROM `classes` WHERE `student` = ? AND `owner` = ?', [recordId, owner]);
			await tx.run("UPDATE `payments` SET `student` = '' WHERE `student` = ? AND `owner` = ?", [recordId, owner]);
		}
		if (c.table === 'classes') {
			await tx.run('DELETE FROM `class_sessions` WHERE `class` = ? AND `owner` = ?', [recordId, owner]);
		}
		await tx.run(`DELETE FROM \`${c.table}\` WHERE \`id\` = ? AND \`owner\` = ?`, [recordId, owner]);
	});
}

/** Runs one data request from the app for the signed-in owner. */
export async function handleDataRequest(owner: string, body: Row) {
	const c = collectionFor(body.collection);
	switch (body.action) {
		case 'list':
			return { items: await list(c, owner, body.from) };
		case 'create':
			return { item: await create(c, owner, body.data) };
		case 'update':
			return { item: await update(c, owner, body.id, body.data) };
		case 'delete':
			await remove(c, owner, body.id);
			return { ok: true };
		default:
			throw bad('Ação desconhecida.');
	}
}
