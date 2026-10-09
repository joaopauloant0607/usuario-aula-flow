import { json, withApi } from '@/lib/api.server';
import { getDb } from '@/lib/db.server';
import logger from '@/lib/logger.server';

/** Short, secret-free reason a database connection failed (an error code such as ER_ACCESS_DENIED_ERROR). */
function dbProblem(error: unknown) {
	const e = error as { code?: unknown; message?: unknown };
	if (String(e?.message ?? '').startsWith('Banco de dados não configurado')) return 'not_configured';
	return typeof e?.code === 'string' && /^[A-Z0-9_]+$/.test(e.code) ? e.code : 'error';
}

/**
 * GET /api/health — the server is up. With `?db=1` it also opens the database
 * (creating the tables on first use) and reports whether that worked, so a
 * deploy can be checked from outside. Always 200, so the answer is readable.
 */
export const loader = withApi(async ({ request }) => {
	if (!new URL(request.url).searchParams.has('db')) return json({ ok: true });
	try {
		const db = await getDb();
		await db.all('SELECT 1');
		return json({ ok: true, db: 'ok', dialect: db.dialect });
	} catch (error) {
		logger.error('Database check failed', error instanceof Error ? error.stack : error);
		return json({ ok: false, db: dbProblem(error) });
	}
});
