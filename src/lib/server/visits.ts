import { createHmac } from 'node:crypto';
import type { Client, InStatement } from '@libsql/client';
import { randomToken } from './setup-token.mjs';

const DAY_MS = 86_400_000;
const MAX_REFERRERS_PER_DAY = 200;
const MAX_PAGES_PER_DAY = 50;
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });

/** Values already listed keep counting. New ones stop at the cap, so made-up values can't fill the table. */
function cappedCount(table: 'stats_pages' | 'stats_referrers', column: 'page' | 'host', day: string, value: string, cap: number): InStatement {
  return {
    sql: `INSERT INTO ${table} (day, ${column}, views)
          SELECT ?, ?, 1 WHERE EXISTS (SELECT 1 FROM ${table} WHERE day = ? AND ${column} = ?)
             OR (SELECT COUNT(*) FROM ${table} WHERE day = ?) < ?
          ON CONFLICT (day, ${column}) DO UPDATE SET views = views + 1`,
    args: [day, value, day, value, day, cap],
  };
}

/** Days follow India time, since that's where the owner reads the dashboard. */
export const dayKey = (now: number) => dayFormat.format(now);

export type Visit = { path: string; referrer: string | null; country: string | null; device: string; ip: string; userAgent: string };

/** Today's random salt. Creating a new one deletes the old salts and hashes for good. */
async function dailySalt(db: Client, day: string): Promise<string> {
  const newDay = await db.execute({ sql: 'INSERT OR IGNORE INTO daily_salts (day, salt) VALUES (?, ?)', args: [day, randomToken()] });
  if (newDay.rowsAffected > 0) {
    await db.batch([
      { sql: 'DELETE FROM daily_salts WHERE day < ?', args: [day] },
      { sql: 'DELETE FROM visitors_today WHERE day < ?', args: [day] },
    ], 'write');
  }
  return String((await db.execute({ sql: 'SELECT salt FROM daily_salts WHERE day = ?', args: [day] })).rows[0].salt);
}

/** Identifies a client for rate limiting without storing its address. */
export async function clientKey(db: Client, ip: string, now = Date.now()): Promise<string> {
  const salt = await dailySalt(db, dayKey(now));
  return createHmac('sha256', salt).update(`client|${ip}`).digest('hex').slice(0, 32);
}

/** A ceiling on counted views per day, so a flood runs out here before it burns the free quota. */
export async function visitCapReached(db: Client, cap: number, now = Date.now()): Promise<boolean> {
  const { rows } = await db.execute({ sql: 'SELECT views FROM stats_daily WHERE day = ?', args: [dayKey(now)] });
  return rows.length > 0 && Number(rows[0].views) >= cap;
}

/**
 * The visitor hash uses a random salt that is deleted the next day. Within a day it counts a person
 * once. After that nothing can link them across days or back to an address. The IP address and user
 * agent are used for the hash and never stored.
 */
export async function recordVisit(db: Client, visit: Visit, now = Date.now()): Promise<void> {
  const day = dayKey(now);
  const salt = await dailySalt(db, day);
  const visitor = createHmac('sha256', salt).update(`${visit.ip}|${visit.userAgent}`).digest('hex');
  const seen = await db.execute({ sql: 'INSERT OR IGNORE INTO visitors_today (day, visitor) VALUES (?, ?)', args: [day, visitor] });

  const writes: InStatement[] = [
    {
      sql: `INSERT INTO stats_daily (day, views, visitors) VALUES (?, 1, ?)
            ON CONFLICT (day) DO UPDATE SET views = views + 1, visitors = visitors + excluded.visitors`,
      args: [day, seen.rowsAffected > 0 ? 1 : 0],
    },
    cappedCount('stats_pages', 'page', day, visit.path, MAX_PAGES_PER_DAY),
    { sql: 'INSERT INTO stats_devices (day, device, views) VALUES (?, ?, 1) ON CONFLICT (day, device) DO UPDATE SET views = views + 1', args: [day, visit.device] },
  ];
  if (visit.country) {
    writes.push({ sql: 'INSERT INTO stats_countries (day, country, views) VALUES (?, ?, 1) ON CONFLICT (day, country) DO UPDATE SET views = views + 1', args: [day, visit.country] });
  }
  if (visit.referrer) writes.push(cappedCount('stats_referrers', 'host', day, visit.referrer, MAX_REFERRERS_PER_DAY));
  await db.batch(writes, 'write');
}

async function top(db: Client, table: string, column: string, from: string) {
  const { rows } = await db.execute({
    sql: `SELECT ${column} AS name, SUM(views) AS views FROM ${table} WHERE day >= ? GROUP BY ${column} ORDER BY views DESC, name LIMIT 8`,
    args: [from],
  });
  return rows.map((row) => ({ name: String(row.name), views: Number(row.views) }));
}

export async function readStats(db: Client, days: number, now = Date.now()) {
  const from = dayKey(now - (days - 1) * DAY_MS);
  const { rows } = await db.execute({ sql: 'SELECT day, views, visitors FROM stats_daily WHERE day >= ?', args: [from] });
  const byDay = new Map(rows.map((row) => [String(row.day), { views: Number(row.views), visitors: Number(row.visitors) }]));
  const series = Array.from({ length: days }, (_, i) => {
    const day = dayKey(now - (days - 1 - i) * DAY_MS);
    return { day, ...(byDay.get(day) ?? { views: 0, visitors: 0 }) };
  });
  const [pages, referrers, countries, devices] = await Promise.all([
    top(db, 'stats_pages', 'page', from),
    top(db, 'stats_referrers', 'host', from),
    top(db, 'stats_countries', 'country', from),
    top(db, 'stats_devices', 'device', from),
  ]);
  const last = series.at(-1)!;
  return {
    today: { views: last.views, visitors: last.visitors },
    totals: {
      views: series.reduce((sum, d) => sum + d.views, 0),
      visitors: series.reduce((sum, d) => sum + d.visitors, 0),
    },
    series,
    pages,
    referrers,
    countries,
    devices,
  };
}
