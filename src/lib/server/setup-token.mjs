/** One-time setup tokens. Plain JavaScript so the app and the setup script share one implementation. */
import { createHash, randomBytes } from 'node:crypto';

export const SETUP_TOKEN_TTL_MS = 15 * 60_000;

export const randomToken = () => randomBytes(32).toString('base64url');
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

/** Issuing a new token cancels any earlier one, and only its hash is kept. */
export async function issueSetupToken(db, now = Date.now()) {
  const token = randomToken();
  await db.batch([
    'DELETE FROM setup_tokens',
    { sql: 'INSERT INTO setup_tokens (token_hash, expires_at) VALUES (?, ?)', args: [sha256(token), now + SETUP_TOKEN_TTL_MS] },
  ], 'write');
  return token;
}
