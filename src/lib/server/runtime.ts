import { mkdirSync } from 'node:fs';
import type { Client } from '@libsql/client';
import { SCHEMA } from './schema.mjs';

/**
 * Secrets are read from process.env at runtime, on the server only. Vite never sees them, so they
 * can't be inlined into a bundle. On Vercel, missing settings stop the app instead of falling back.
 */
export function siteOrigin(): string {
  const value = process.env.SITE_ORIGIN ?? (process.env.VERCEL ? undefined : 'http://localhost:4321');
  if (!value) throw new Error('SITE_ORIGIN is not set');
  return new URL(value).origin;
}

let connection: Promise<Client> | undefined;

async function connect(): Promise<Client> {
  const url = process.env.TURSO_DATABASE_URL ?? (process.env.VERCEL ? undefined : 'file:.data/portfolio.db');
  if (!url) throw new Error('TURSO_DATABASE_URL is not set');
  let client: Client;
  if (url.startsWith('file:')) {
    mkdirSync('.data', { recursive: true });
    const { createClient } = await import('@libsql/client');
    client = createClient({ url });
  } else {
    const { createClient } = await import('@libsql/client/web');
    client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  await client.batch(SCHEMA, 'write');
  return client;
}

export function getDb(): Promise<Client> {
  connection ??= connect().catch((error) => {
    connection = undefined;
    throw error;
  });
  return connection;
}
