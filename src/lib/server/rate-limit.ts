import type { Client } from '@libsql/client';

/**
 * A cheap first line of defense that uses no database writes, so a flood can't burn the free write
 * quota. It's per server instance, so it complements `overLimit` and doesn't replace it.
 */
export function memoryLimiter(limit: number, windowMs: number, maxKeys = 5000) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const limited = (key: string, now = Date.now()): boolean => {
    let entry = hits.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.delete(key);
      hits.set(key, entry);
      if (hits.size > maxKeys) hits.delete(hits.keys().next().value as string);
    }
    entry.count += 1;
    return entry.count > limit;
  };
  limited.size = () => hits.size;
  return limited;
}

/** Fixed-window limit kept in the database, so it holds across serverless instances. True means refuse. */
export async function overLimit(db: Client, key: string, limit: number, windowSeconds: number, now = Date.now()): Promise<boolean> {
  const windowMs = windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const [, result] = await db.batch([
    { sql: 'DELETE FROM rate_limits WHERE expires_at <= ?', args: [now] },
    {
      sql: `INSERT INTO rate_limits (bucket, count, expires_at) VALUES (?, 1, ?)
            ON CONFLICT (bucket) DO UPDATE SET count = count + 1 RETURNING count`,
      args: [`${key}:${windowStart}`, windowStart + windowMs],
    },
  ], 'write');
  return Number(result.rows[0].count) > limit;
}
