import type { Client } from '@libsql/client';
import { randomToken, sha256 } from './setup-token.mjs';

export const IDLE_TTL_MS = 60 * 60_000;
export const ABSOLUTE_TTL_MS = 12 * 60 * 60_000;
/** Adding or removing a passkey needs a sign-in this recent, so a stolen session can't add a backdoor. */
export const FRESH_MS = 10 * 60_000;
const TOUCH_EVERY_MS = 60_000;

export type Session = { idHash: string; device: string; createdAt: number; fresh: boolean };

/** Returns the cookie token. The database keeps only its hash, so a database leak can't be replayed. */
export async function createSession(db: Client, device: string, now = Date.now()): Promise<string> {
  const token = randomToken();
  await db.batch([
    { sql: 'DELETE FROM sessions WHERE expires_at <= ? OR last_seen_at <= ?', args: [now, now - IDLE_TTL_MS] },
    {
      sql: 'INSERT INTO sessions (id_hash, device, created_at, last_seen_at, fresh_until, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [sha256(token), device, now, now, now + FRESH_MS, now + ABSOLUTE_TTL_MS],
    },
  ], 'write');
  return token;
}

export async function readSession(db: Client, token: string | undefined, now = Date.now()): Promise<Session | null> {
  if (!token) return null;
  const idHash = sha256(token);
  const { rows } = await db.execute({ sql: 'SELECT * FROM sessions WHERE id_hash = ?', args: [idHash] });
  const row = rows[0];
  if (!row) return null;
  const lastSeen = Number(row.last_seen_at);
  if (now > Number(row.expires_at) || now > lastSeen + IDLE_TTL_MS) {
    await db.execute({ sql: 'DELETE FROM sessions WHERE id_hash = ?', args: [idHash] });
    return null;
  }
  if (now - lastSeen >= TOUCH_EVERY_MS) {
    await db.execute({ sql: 'UPDATE sessions SET last_seen_at = ? WHERE id_hash = ?', args: [now, idHash] });
  }
  return { idHash, device: String(row.device), createdAt: Number(row.created_at), fresh: now <= Number(row.fresh_until) };
}

export async function endSession(db: Client, token: string | undefined): Promise<void> {
  if (token) await db.execute({ sql: 'DELETE FROM sessions WHERE id_hash = ?', args: [sha256(token)] });
}

export async function endAllSessions(db: Client): Promise<void> {
  await db.execute('DELETE FROM sessions');
}

export async function listSessions(db: Client, now = Date.now()) {
  const { rows } = await db.execute({
    sql: 'SELECT id_hash, device, created_at, last_seen_at FROM sessions WHERE expires_at > ? AND last_seen_at > ? ORDER BY last_seen_at DESC',
    args: [now, now - IDLE_TTL_MS],
  });
  return rows.map((row) => ({ idHash: String(row.id_hash), device: String(row.device), createdAt: Number(row.created_at), lastSeenAt: Number(row.last_seen_at) }));
}
