/**
 * The app's database: MySQL/MariaDB in production (the database included in
 * the Hostinger plan), or a local SQLite file for `npm run dev`.
 *
 * - `DB_HOST` set: MySQL, with `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
 * - Otherwise: SQLite at `DB_FILE`, or `.data/aulaflow.db` outside production.
 *
 * Queries are plain SQL with `?` placeholders and backtick-quoted names, which
 * both databases understand. The tables are created on first use by the
 * migrations at the bottom of this file.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Pool, PoolConnection } from 'mysql2/promise';
import logger from '@/lib/logger.server';

type Param = string | number | null;
type Row = Record<string, unknown>;

export interface Executor {
	all<T = Row>(sql: string, params?: Param[]): Promise<T[]>;
	run(sql: string, params?: Param[]): Promise<{ changes: number }>;
}

export interface Db extends Executor {
	dialect: 'mysql' | 'sqlite';
	/** Runs `fn` in one transaction: everything it writes is kept, or nothing. */
	transaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T>;
}

// ---- MySQL / MariaDB ----

const mysqlExecutor = (conn: Pool | PoolConnection): Executor => ({
	async all<T>(sql: string, params: Param[] = []) {
		const [rows] = await conn.query(sql, params);
		return rows as T[];
	},
	async run(sql: string, params: Param[] = []) {
		const [result] = await conn.query(sql, params);
		return { changes: (result as { affectedRows?: number }).affectedRows ?? 0 };
	},
});

async function openMysql(): Promise<Db> {
	const mysql = await import('mysql2/promise');
	const pool = mysql.createPool({
		host: process.env.DB_HOST,
		port: Number(process.env.DB_PORT) || 3306,
		user: process.env.DB_USER,
		password: process.env.DB_PASSWORD,
		database: process.env.DB_NAME,
		charset: 'utf8mb4',
		connectionLimit: 5,
		enableKeepAlive: true,
	});

	return {
		dialect: 'mysql',
		...mysqlExecutor(pool),
		async transaction(fn) {
			const conn = await pool.getConnection();
			try {
				await conn.beginTransaction();
				const result = await fn(mysqlExecutor(conn));
				await conn.commit();
				return result;
			} catch (error) {
				await conn.rollback().catch(() => undefined);
				throw error;
			} finally {
				conn.release();
			}
		},
	};
}

// ---- SQLite (local development) ----

interface SqliteStatement {
	all(...params: Param[]): Row[];
	run(...params: Param[]): { changes: number | bigint };
}
interface SqliteDatabase {
	exec(sql: string): void;
	prepare(sql: string): SqliteStatement;
}
interface SqliteModule {
	DatabaseSync: new (file: string) => SqliteDatabase;
}

function loadSqlite(): SqliteModule {
	try {
		const getBuiltin = (process as unknown as { getBuiltinModule: (id: string) => unknown }).getBuiltinModule;
		const sqlite = getBuiltin?.('node:sqlite') as SqliteModule | undefined;
		if (sqlite) return sqlite;
	} catch {
		// Older Node.js; explained below
	}
	throw new Error(
		'O banco local precisa do Node.js 22.13 ou mais novo. Atualize o Node.js ou defina DB_HOST para usar o MySQL.',
	);
}

function openSqlite(file: string): Db {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const db = new (loadSqlite().DatabaseSync)(file);
	db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');

	const executor: Executor = {
		async all<T>(sql: string, params: Param[] = []) {
			return db.prepare(sql).all(...params) as T[];
		},
		async run(sql: string, params: Param[] = []) {
			return { changes: Number(db.prepare(sql).run(...params).changes) };
		},
	};

	// One connection, so transactions take turns.
	let queue: Promise<unknown> = Promise.resolve();

	return {
		dialect: 'sqlite',
		...executor,
		transaction<T>(fn: (tx: Executor) => Promise<T>) {
			const next = queue.then(async () => {
				db.exec('BEGIN');
				try {
					const result = await fn(executor);
					db.exec('COMMIT');
					return result;
				} catch (error) {
					db.exec('ROLLBACK');
					throw error;
				}
			});
			queue = next.catch(() => undefined);
			return next;
		},
	};
}

// ---- schema ----

/**
 * Each migration runs once, in order. Never edit one that has shipped: add a
 * new one instead. Statements must be safe to re-run, because two server
 * processes may start at the same time.
 */
const MIGRATIONS: { id: string; statements: string[] }[] = [
	{
		id: '001_initial',
		statements: [
			`CREATE TABLE IF NOT EXISTS \`users\` (
				\`id\` VARCHAR(15) NOT NULL PRIMARY KEY,
				\`email\` VARCHAR(255) NOT NULL,
				\`name\` VARCHAR(200) NOT NULL,
				\`password_hash\` VARCHAR(255) NOT NULL,
				\`created\` VARCHAR(24) NOT NULL,
				\`updated\` VARCHAR(24) NOT NULL
			)`,
			'CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`)',
			`CREATE TABLE IF NOT EXISTS \`sessions\` (
				\`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
				\`user\` VARCHAR(15) NOT NULL,
				\`expires_at\` BIGINT NOT NULL
			)`,
			'CREATE INDEX `idx_sessions_user` ON `sessions` (`user`)',
			`CREATE TABLE IF NOT EXISTS \`password_resets\` (
				\`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
				\`user\` VARCHAR(15) NOT NULL,
				\`expires_at\` BIGINT NOT NULL
			)`,
			'CREATE INDEX `idx_password_resets_user` ON `password_resets` (`user`)',
			`CREATE TABLE IF NOT EXISTS \`students\` (
				\`id\` VARCHAR(15) NOT NULL PRIMARY KEY,
				\`owner\` VARCHAR(15) NOT NULL,
				\`name\` VARCHAR(200) NOT NULL,
				\`email\` VARCHAR(255) NOT NULL,
				\`phone\` VARCHAR(40) NOT NULL,
				\`subject\` VARCHAR(120) NOT NULL,
				\`notes\` TEXT NOT NULL,
				\`status\` VARCHAR(10) NOT NULL,
				\`monthly_fee\` DOUBLE PRECISION NOT NULL,
				\`classes_per_week\` INTEGER NOT NULL,
				\`due_day\` INTEGER NOT NULL,
				\`created\` VARCHAR(24) NOT NULL,
				\`updated\` VARCHAR(24) NOT NULL
			)`,
			'CREATE INDEX `idx_students_owner` ON `students` (`owner`)',
			`CREATE TABLE IF NOT EXISTS \`classes\` (
				\`id\` VARCHAR(15) NOT NULL PRIMARY KEY,
				\`owner\` VARCHAR(15) NOT NULL,
				\`student\` VARCHAR(15) NOT NULL,
				\`subject\` VARCHAR(120) NOT NULL,
				\`weekday\` VARCHAR(60) NOT NULL,
				\`start_time\` VARCHAR(5) NOT NULL,
				\`duration_minutes\` INTEGER NOT NULL,
				\`location\` VARCHAR(200) NOT NULL,
				\`notes\` VARCHAR(500) NOT NULL,
				\`created\` VARCHAR(24) NOT NULL,
				\`updated\` VARCHAR(24) NOT NULL
			)`,
			'CREATE INDEX `idx_classes_owner` ON `classes` (`owner`)',
			'CREATE INDEX `idx_classes_student` ON `classes` (`student`)',
			`CREATE TABLE IF NOT EXISTS \`payments\` (
				\`id\` VARCHAR(15) NOT NULL PRIMARY KEY,
				\`owner\` VARCHAR(15) NOT NULL,
				\`student\` VARCHAR(15) NOT NULL,
				\`description\` VARCHAR(200) NOT NULL,
				\`amount\` DOUBLE PRECISION NOT NULL,
				\`due_date\` VARCHAR(24) NOT NULL,
				\`paid_date\` VARCHAR(24) NOT NULL,
				\`status\` VARCHAR(10) NOT NULL,
				\`created\` VARCHAR(24) NOT NULL,
				\`updated\` VARCHAR(24) NOT NULL
			)`,
			'CREATE INDEX `idx_payments_owner` ON `payments` (`owner`)',
			'CREATE INDEX `idx_payments_student` ON `payments` (`student`)',
			`CREATE TABLE IF NOT EXISTS \`class_sessions\` (
				\`id\` VARCHAR(15) NOT NULL PRIMARY KEY,
				\`owner\` VARCHAR(15) NOT NULL,
				\`class\` VARCHAR(15) NOT NULL,
				\`date\` VARCHAR(10) NOT NULL,
				\`status\` VARCHAR(10) NOT NULL,
				\`makeup_date\` VARCHAR(10) NOT NULL,
				\`makeup_time\` VARCHAR(5) NOT NULL,
				\`created\` VARCHAR(24) NOT NULL,
				\`updated\` VARCHAR(24) NOT NULL
			)`,
			'CREATE UNIQUE INDEX `idx_class_sessions_class_date` ON `class_sessions` (`class`, `date`)',
			'CREATE INDEX `idx_class_sessions_owner` ON `class_sessions` (`owner`)',
		],
	},
];

const MYSQL_DUPLICATE_INDEX = 1061;

async function migrate(db: Db) {
	const tableSuffix = db.dialect === 'mysql' ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';
	await db.run(
		`CREATE TABLE IF NOT EXISTS \`migrations\` (\`id\` VARCHAR(100) NOT NULL PRIMARY KEY, \`applied\` VARCHAR(24) NOT NULL)${tableSuffix}`,
	);
	const applied = new Set((await db.all<{ id: string }>('SELECT `id` FROM `migrations`')).map((r) => r.id));

	for (const migration of MIGRATIONS) {
		if (applied.has(migration.id)) continue;
		for (const statement of migration.statements) {
			if (statement.startsWith('CREATE TABLE')) {
				await db.run(statement + tableSuffix);
			} else if (db.dialect === 'sqlite') {
				await db.run(statement.replace(/^CREATE (UNIQUE )?INDEX/, 'CREATE $1INDEX IF NOT EXISTS'));
			} else {
				// MySQL has no CREATE INDEX IF NOT EXISTS
				await db.run(statement).catch((error: { errno?: number }) => {
					if (error?.errno !== MYSQL_DUPLICATE_INDEX) throw error;
				});
			}
		}
		await db.run(
			db.dialect === 'mysql'
				? 'INSERT IGNORE INTO `migrations` (`id`, `applied`) VALUES (?, ?)'
				: 'INSERT OR IGNORE INTO `migrations` (`id`, `applied`) VALUES (?, ?)',
			[migration.id, new Date().toISOString()],
		);
		logger.info(`Database migration ${migration.id} applied`);
	}
}

// ---- connection ----

async function open(): Promise<Db> {
	let db: Db;
	if (process.env.DB_HOST) {
		db = await openMysql();
	} else if (process.env.DB_FILE || process.env.NODE_ENV !== 'production') {
		db = openSqlite(path.resolve(process.env.DB_FILE || '.data/aulaflow.db'));
	} else {
		throw new Error('Banco de dados não configurado: defina DB_HOST, DB_USER, DB_PASSWORD e DB_NAME.');
	}
	await migrate(db);
	return db;
}

let ready: Promise<Db> | null = null;

/** The shared connection, opened (and migrated) on first use. A failed attempt is retried on the next call. */
export function getDb(): Promise<Db> {
	if (!ready) {
		ready = open().catch((error) => {
			ready = null;
			throw error;
		});
	}
	return ready;
}

/** True when a write failed because of a unique index. */
export function isUniqueViolation(error: unknown) {
	const e = error as { code?: string; errno?: number; message?: string };
	return e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062 || /UNIQUE constraint failed/.test(e?.message ?? '');
}

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** 15-character random id, the same shape PocketBase used. */
export function newId(): string {
	let id = '';
	while (id.length < 15) {
		for (const b of crypto.getRandomValues(new Uint8Array(15))) {
			// 252 is the largest multiple of 36 below 256, so every character is equally likely
			if (b < 252 && id.length < 15) id += ID_ALPHABET[b % 36];
		}
	}
	return id;
}

/** Current time as `YYYY-MM-DD HH:MM:SS.sssZ`, the format the app's dates use. */
export const nowStamp = () => new Date().toISOString().replace('T', ' ');
