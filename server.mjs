// Production server for hosts that start the app with `node server.mjs`
// (Hostinger Node.js apps, Express preset). Serves the React Router build
// from dist/apps/web, the same way react-router-serve does on Horizons.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Set before React loads: it picks its development or production build on import.
process.env.NODE_ENV ||= 'production';

const { createRequestHandler } = await import('@react-router/express');
const { default: compression } = await import('compression');
const { default: express } = await import('express');

const root = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(root, 'dist/apps/web/client');
const build = await import(pathToFileURL(path.join(root, 'dist/apps/web/server/index.js')).href);
const port = Number(process.env.PORT) || 3000;

const app = express();
app.disable('x-powered-by');
app.use(compression());
app.use('/assets', express.static(path.join(clientDir, 'assets'), { immutable: true, maxAge: '1y' }));
app.use(express.static(clientDir, { maxAge: '1h' }));
app.all('/{*splat}', createRequestHandler({ build, mode: process.env.NODE_ENV }));

const server = app.listen(port, () => console.log(`Aula Flow on port ${port}`));

for (const signal of ['SIGTERM', 'SIGINT']) {
	process.once(signal, () => server.close());
}
