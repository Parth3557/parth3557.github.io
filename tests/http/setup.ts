import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

export const PORT = 4398;
export const ORIGIN = `http://localhost:${PORT}`;
export const DB_FILE = '.data/test-http.db';

/** Starts the built server against a throwaway database, on its own port. */
export default async function setup() {
  for (const suffix of ['', '-wal', '-shm', '-journal', '-info']) rmSync(`${DB_FILE}${suffix}`, { force: true });

  const server = spawn(process.execPath, ['scripts/start-local.mjs'], {
    env: { ...process.env, PORT: String(PORT), SITE_ORIGIN: ORIGIN, TURSO_DATABASE_URL: `file:${DB_FILE}` },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The server did not start. Did you run npm run build?')), 20_000);
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes('Server listening')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on('exit', (code) => reject(new Error(`The server exited with code ${code}`)));
  });
  return () => {
    server.removeAllListeners('exit');
    server.kill();
  };
}
