/**
 * Prints a one-time link for adding a passkey. Run it yourself, in your own terminal: the link is the
 * key to your dashboard for the next 15 minutes, and it isn't stored or logged anywhere.
 *
 *   npm run dashboard:setup
 *   npm run dashboard:setup -- --reset      Lost your passkeys? This removes them and every session first.
 *
 * Production: set SITE_ORIGIN, TURSO_DATABASE_URL and TURSO_AUTH_TOKEN for this one command.
 */
import { mkdirSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { SCHEMA } from '../src/lib/server/schema.mjs';
import { issueSetupToken } from '../src/lib/server/setup-token.mjs';

const url = process.env.TURSO_DATABASE_URL ?? 'file:.data/portfolio.db';
const origin = new URL(process.env.SITE_ORIGIN ?? 'http://localhost:4321').origin;
if (url.startsWith('file:')) mkdirSync('.data', { recursive: true });

const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
await db.batch(SCHEMA, 'write');

if (process.argv.includes('--reset')) {
  await db.batch(['DELETE FROM credentials', 'DELETE FROM sessions', 'DELETE FROM challenges'], 'write');
  console.log('Removed every passkey and session.\n');
}

const token = await issueSetupToken(db);
console.log('Open this link within 15 minutes. It works once. Don\'t share it or paste it anywhere:\n');
console.log(`  ${origin}/dashboard/setup#token=${token}\n`);
db.close();
