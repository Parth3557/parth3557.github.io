import type { Client } from '@libsql/client';
import { issueSetupToken, randomToken, sha256 } from './setup-token.mjs';

export { issueSetupToken };

const CHALLENGE_TTL_MS = 5 * 60_000;

export async function setupTokenValid(db: Client, token: unknown, now = Date.now()): Promise<boolean> {
  if (typeof token !== 'string' || !token) return false;
  const { rows } = await db.execute({ sql: 'SELECT 1 FROM setup_tokens WHERE token_hash = ? AND expires_at >= ?', args: [sha256(token), now] });
  return rows.length > 0;
}

/** Atomic: of two simultaneous attempts, only one can succeed. */
export async function useSetupToken(db: Client, token: unknown, now = Date.now()): Promise<boolean> {
  if (typeof token !== 'string' || !token) return false;
  const { rows } = await db.execute({ sql: 'DELETE FROM setup_tokens WHERE token_hash = ? AND expires_at >= ? RETURNING token_hash', args: [sha256(token), now] });
  return rows.length > 0;
}

export async function saveChallenge(db: Client, challenge: string, purpose: 'login' | 'register', now = Date.now()): Promise<string> {
  const id = randomToken();
  await db.batch([
    { sql: 'DELETE FROM challenges WHERE expires_at < ?', args: [now] },
    { sql: 'INSERT INTO challenges (id, challenge, purpose, expires_at) VALUES (?, ?, ?, ?)', args: [sha256(id), challenge, purpose, now + CHALLENGE_TTL_MS] },
  ], 'write');
  return id;
}

/** Atomic and single-use, so a captured passkey response can't be replayed. */
export async function takeChallenge(db: Client, id: string | undefined, purpose: 'login' | 'register', now = Date.now()): Promise<string | null> {
  if (!id) return null;
  const { rows } = await db.execute({ sql: 'DELETE FROM challenges WHERE id = ? AND purpose = ? AND expires_at >= ? RETURNING challenge', args: [sha256(id), purpose, now] });
  return rows[0] ? String(rows[0].challenge) : null;
}

export async function credentialCount(db: Client): Promise<number> {
  const { rows } = await db.execute('SELECT COUNT(*) AS n FROM credentials');
  return Number(rows[0].n);
}

export type StoredCredential = { id: string; publicKey: Uint8Array<ArrayBuffer>; counter: number; transports: string[]; label: string; createdAt: number; lastUsedAt: number | null };

const toCredential = (row: Record<string, unknown>): StoredCredential => ({
  id: String(row.id),
  publicKey: new Uint8Array(row.public_key as ArrayBuffer),
  counter: Number(row.counter),
  transports: JSON.parse(String(row.transports)),
  label: String(row.label),
  createdAt: Number(row.created_at),
  lastUsedAt: row.last_used_at === null ? null : Number(row.last_used_at),
});

export async function getCredential(db: Client, id: string): Promise<StoredCredential | null> {
  const { rows } = await db.execute({ sql: 'SELECT * FROM credentials WHERE id = ?', args: [id] });
  return rows[0] ? toCredential(rows[0]) : null;
}

export async function listCredentials(db: Client): Promise<StoredCredential[]> {
  const { rows } = await db.execute('SELECT * FROM credentials ORDER BY created_at');
  return rows.map(toCredential);
}

export async function saveCredential(db: Client, credential: { id: string; publicKey: Uint8Array; counter: number; transports: string[]; label: string }, now = Date.now()): Promise<void> {
  await db.execute({
    sql: 'INSERT INTO credentials (id, public_key, counter, transports, label, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [credential.id, credential.publicKey, credential.counter, JSON.stringify(credential.transports), credential.label, now],
  });
}

export async function markCredentialUsed(db: Client, id: string, counter: number, now = Date.now()): Promise<void> {
  await db.execute({ sql: 'UPDATE credentials SET counter = ?, last_used_at = ? WHERE id = ?', args: [counter, now, id] });
}

/** Refuses to remove the last passkey, which would lock the owner out. */
export async function removeCredential(db: Client, id: string): Promise<boolean> {
  const { rows } = await db.execute({
    sql: 'DELETE FROM credentials WHERE id = ? AND (SELECT COUNT(*) FROM credentials) > 1 RETURNING id',
    args: [id],
  });
  return rows.length > 0;
}

export async function audit(db: Client, event: string, device: string, now = Date.now()): Promise<void> {
  await db.batch([
    { sql: 'INSERT INTO audit_log (at, event, device) VALUES (?, ?, ?)', args: [now, event, device] },
    { sql: 'DELETE FROM audit_log WHERE at < ?', args: [now - 90 * 86_400_000] },
  ], 'write');
}

export async function recentAudit(db: Client, limit = 12) {
  const { rows } = await db.execute({ sql: 'SELECT at, event, device FROM audit_log ORDER BY id DESC LIMIT ?', args: [limit] });
  return rows.map((row) => ({ at: Number(row.at), event: String(row.event), device: String(row.device) }));
}
