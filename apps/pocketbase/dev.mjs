// Starts PocketBase for local development on Windows, macOS or Linux.
// Downloads the PocketBase binary on first run and creates a local admin account.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const version = fs.readFileSync(path.join(dir, '.pocketbase-version'), 'utf8').trim();
const isWindows = process.platform === 'win32';
const binary = path.join(dir, isWindows ? 'pocketbase.exe' : 'pocketbase');

async function download() {
	const platform = { win32: 'windows', darwin: 'darwin', linux: 'linux' }[process.platform];
	const arch = { x64: 'amd64', arm64: 'arm64' }[process.arch];
	if (!platform || !arch) throw new Error(`Sistema não suportado: ${process.platform}/${process.arch}`);

	const name = `pocketbase_${version}_${platform}_${arch}.zip`;
	const url = `https://github.com/pocketbase/pocketbase/releases/download/v${version}/${name}`;
	console.log(`Baixando PocketBase ${version}...`);
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Falha ao baixar ${url} (HTTP ${res.status})`);

	const zip = path.join(os.tmpdir(), name);
	fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
	// Windows 10+ ships bsdtar, which extracts zip files; elsewhere use unzip.
	if (isWindows) execFileSync('tar', ['-xf', zip, '-C', dir, 'pocketbase.exe']);
	else execFileSync('unzip', ['-o', zip, 'pocketbase', '-d', dir]);
	fs.rmSync(zip);
	if (!isWindows) fs.chmodSync(binary, 0o755);
}

if (!fs.existsSync(binary)) await download();

const env = {
	...process.env,
	// Local-only admin account, created on the first run (open http://localhost:8090/_/).
	PB_SUPERUSER_EMAIL: process.env.PB_SUPERUSER_EMAIL || 'admin@aulaflow.local',
	PB_SUPERUSER_PASSWORD: process.env.PB_SUPERUSER_PASSWORD || 'aulaflow-local-123',
};

const child = spawn(
	binary,
	['serve', '--http=127.0.0.1:8090', '--dir=./pb_data', '--migrationsDir=./pb_migrations', '--hooksDir=./pb_hooks', '--hooksWatch=false'],
	{ cwd: dir, env, stdio: 'inherit' },
);
child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
