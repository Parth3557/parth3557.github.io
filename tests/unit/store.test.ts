import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { beforeEach, describe, expect, test } from 'vitest';
import { SCHEMA } from '../../src/lib/server/schema.mjs';
import { memoryLimiter, overLimit } from '../../src/lib/server/rate-limit';
import { credentialCount, issueSetupToken, saveChallenge, setupTokenValid, takeChallenge, useSetupToken } from '../../src/lib/server/enrollment';
import { createSession, endAllSessions, endSession, readSession, ABSOLUTE_TTL_MS, FRESH_MS, IDLE_TTL_MS } from '../../src/lib/server/sessions';
import { clientKey, dayKey, readStats, recordVisit, visitCapReached } from '../../src/lib/server/visits';

const NOW = Date.UTC(2026, 10, 5, 12, 0, 0);
const DAY = 86_400_000;
let db: Client;

beforeEach(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pj-store-'));
  db = createClient({ url: `file:${join(dir, 'test.db').replaceAll('\\', '/')}` });
  await db.batch(SCHEMA, 'write');
});

const visit = (over: object = {}) => ({ path: '/', referrer: null, country: 'IN', device: 'desktop', ip: '203.0.113.7', userAgent: 'Mozilla/5.0 Test', ...over });

describe('recordVisit and readStats', () => {
  test('counts every view but each visitor once a day', async () => {
    await recordVisit(db, visit(), NOW);
    await recordVisit(db, visit({ path: '/projects' }), NOW);
    await recordVisit(db, visit({ ip: '203.0.113.8' }), NOW);
    const stats = await readStats(db, 7, NOW);
    expect(stats.today).toEqual({ views: 3, visitors: 2 });
    expect(stats.totals).toEqual({ views: 3, visitors: 2 });
  });

  test('the series has one entry per day, with gaps filled by zero, oldest first', async () => {
    await recordVisit(db, visit(), NOW - 2 * DAY);
    await recordVisit(db, visit(), NOW);
    const { series } = await readStats(db, 7, NOW);
    expect(series).toHaveLength(7);
    expect(series.at(-1)).toMatchObject({ day: dayKey(NOW), views: 1, visitors: 1 });
    expect(series.at(-2)).toMatchObject({ views: 0, visitors: 0 });
    expect(series.at(-3)).toMatchObject({ views: 1, visitors: 1 });
  });

  test('ranks pages, referrers, countries and devices', async () => {
    await recordVisit(db, visit({ path: '/projects', referrer: 'linkedin.com' }), NOW);
    await recordVisit(db, visit({ path: '/projects', referrer: 'linkedin.com', device: 'mobile' }), NOW);
    await recordVisit(db, visit({ path: '/', referrer: 'github.com', country: 'US' }), NOW);
    const stats = await readStats(db, 7, NOW);
    expect(stats.pages[0]).toEqual({ name: '/projects', views: 2 });
    expect(stats.referrers[0]).toEqual({ name: 'linkedin.com', views: 2 });
    expect(stats.countries[0]).toEqual({ name: 'IN', views: 2 });
    expect(stats.devices[0]).toEqual({ name: 'desktop', views: 2 });
  });

  test('a visit with no referrer is direct and not listed as a host', async () => {
    await recordVisit(db, visit(), NOW);
    expect((await readStats(db, 7, NOW)).referrers).toEqual([]);
  });

  test('neither the IP address nor the user agent is stored anywhere', async () => {
    await recordVisit(db, visit(), NOW);
    const tables = await db.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
    for (const row of tables.rows) {
      const contents = JSON.stringify((await db.execute(`SELECT * FROM "${row.name}"`)).rows);
      expect(contents).not.toContain('203.0.113.7');
      expect(contents).not.toContain('Mozilla');
    }
  });

  test('the next day, yesterday-minus-one salts and hashes are gone, so visitors cannot be linked', async () => {
    await recordVisit(db, visit(), NOW);
    await recordVisit(db, visit(), NOW + 2 * DAY);
    const salts = await db.execute('SELECT day FROM daily_salts');
    const hashes = await db.execute('SELECT day FROM visitors_today');
    expect(salts.rows.map((r) => r.day)).toEqual([dayKey(NOW + 2 * DAY)]);
    expect(hashes.rows.map((r) => r.day)).toEqual([dayKey(NOW + 2 * DAY)]);
  });

  test('the same person counts as a new visitor on a new day', async () => {
    await recordVisit(db, visit(), NOW);
    await recordVisit(db, visit(), NOW + 2 * DAY);
    const { series } = await readStats(db, 7, NOW + 2 * DAY);
    expect(series.at(-1)?.visitors).toBe(1);
    expect(series.at(-3)?.visitors).toBe(1);
  });

  test('SQL in a value is stored as plain text and breaks nothing', async () => {
    const hostile = "x'); DROP TABLE stats_daily; --";
    await recordVisit(db, visit({ referrer: hostile }), NOW);
    const stats = await readStats(db, 7, NOW);
    expect(stats.referrers[0].name).toBe(hostile);
    expect(stats.today.views).toBe(1);
  });

  test('new referrer hosts stop being added after the daily cap, but views still count', async () => {
    for (let i = 0; i < 205; i++) await recordVisit(db, visit({ referrer: `spam${i}.example` }), NOW);
    const rows = await db.execute('SELECT COUNT(*) AS n FROM stats_referrers');
    expect(Number(rows.rows[0].n)).toBe(200);
    expect((await readStats(db, 7, NOW)).today.views).toBe(205);
  });
});

describe('recordVisit limits what a flood of made-up paths can do', () => {
  test('new page paths stop being added after the daily cap, but views still count', async () => {
    for (let i = 0; i < 55; i++) await recordVisit(db, visit({ path: `/projects/fake-${i}` }), NOW);
    const rows = await db.execute('SELECT COUNT(*) AS n FROM stats_pages');
    expect(Number(rows.rows[0].n)).toBe(50);
    expect((await readStats(db, 7, NOW)).today.views).toBe(55);
  });

  test('a page already listed keeps counting past the cap', async () => {
    for (let i = 0; i < 50; i++) await recordVisit(db, visit({ path: `/projects/fake-${i}` }), NOW);
    await recordVisit(db, visit({ path: '/projects/fake-0' }), NOW);
    const { rows } = await db.execute({ sql: 'SELECT views FROM stats_pages WHERE page = ?', args: ['/projects/fake-0'] });
    expect(Number(rows[0].views)).toBe(2);
  });
});

describe('visitCapReached', () => {
  test('is false until the daily ceiling, then true', async () => {
    expect(await visitCapReached(db, 2, NOW)).toBe(false);
    await recordVisit(db, visit(), NOW);
    expect(await visitCapReached(db, 2, NOW)).toBe(false);
    await recordVisit(db, visit(), NOW);
    expect(await visitCapReached(db, 2, NOW)).toBe(true);
  });
});

describe('clientKey', () => {
  test('is stable within a day and differs between clients', async () => {
    expect(await clientKey(db, '203.0.113.7', NOW)).toBe(await clientKey(db, '203.0.113.7', NOW));
    expect(await clientKey(db, '203.0.113.7', NOW)).not.toBe(await clientKey(db, '203.0.113.8', NOW));
  });

  test('never contains the address, and changes the next day', async () => {
    const today = await clientKey(db, '203.0.113.7', NOW);
    expect(today).not.toContain('203.0.113.7');
    await recordVisit(db, visit(), NOW + 2 * DAY);
    expect(await clientKey(db, '203.0.113.7', NOW + 2 * DAY)).not.toBe(today);
  });
});

describe('memoryLimiter', () => {
  test('refuses past the limit without touching the database, then resets', () => {
    const limited = memoryLimiter(2, 1000);
    expect([limited('a', 0), limited('a', 1), limited('a', 2)]).toEqual([false, false, true]);
    expect(limited('b', 2)).toBe(false);
    expect(limited('a', 1001)).toBe(false);
  });

  test('forgets old keys so it cannot grow without limit', () => {
    const limited = memoryLimiter(1, 1000, 3);
    for (const key of ['a', 'b', 'c', 'd']) limited(key, 0);
    expect(limited.size()).toBeLessThanOrEqual(3);
  });
});

describe('overLimit', () => {
  test('allows up to the limit, then refuses', async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await overLimit(db, 'k', 3, 60, NOW));
    expect(results).toEqual([false, false, false, true]);
  });

  test('keys are independent', async () => {
    await overLimit(db, 'a', 1, 60, NOW);
    expect(await overLimit(db, 'b', 1, 60, NOW)).toBe(false);
  });

  test('a new window starts fresh and old rows are removed', async () => {
    await overLimit(db, 'k', 1, 60, NOW);
    await overLimit(db, 'k', 1, 60, NOW);
    expect(await overLimit(db, 'k', 1, 60, NOW + 61_000)).toBe(false);
    const rows = await db.execute('SELECT COUNT(*) AS n FROM rate_limits');
    expect(Number(rows.rows[0].n)).toBe(1);
  });
});

describe('sessions', () => {
  test('a new session can be read back and is fresh', async () => {
    const token = await createSession(db, 'desktop', NOW);
    const session = await readSession(db, token, NOW + 1000);
    expect(session?.fresh).toBe(true);
  });

  test('only a hash of the token is stored', async () => {
    const token = await createSession(db, 'desktop', NOW);
    const rows = JSON.stringify((await db.execute('SELECT * FROM sessions')).rows);
    expect(rows).not.toContain(token);
  });

  test('tokens are long and unique', async () => {
    const a = await createSession(db, 'desktop', NOW);
    const b = await createSession(db, 'desktop', NOW);
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
  });

  test('an unknown token gets nothing', async () => {
    expect(await readSession(db, 'guess', NOW)).toBeNull();
    expect(await readSession(db, '', NOW)).toBeNull();
  });

  test('expires after the idle limit', async () => {
    const token = await createSession(db, 'desktop', NOW);
    expect(await readSession(db, token, NOW + IDLE_TTL_MS + 1)).toBeNull();
  });

  test('activity extends the idle limit but never past the absolute limit', async () => {
    const token = await createSession(db, 'desktop', NOW);
    let t = NOW;
    while (t + IDLE_TTL_MS / 2 < NOW + ABSOLUTE_TTL_MS) {
      t += IDLE_TTL_MS / 2;
      expect(await readSession(db, token, t)).not.toBeNull();
    }
    expect(await readSession(db, token, NOW + ABSOLUTE_TTL_MS + 1)).toBeNull();
  });

  test('stops being fresh after the sensitive-action window', async () => {
    const token = await createSession(db, 'desktop', NOW);
    expect((await readSession(db, token, NOW + FRESH_MS + 1))?.fresh).toBe(false);
  });

  test('signing out ends that session only', async () => {
    const a = await createSession(db, 'desktop', NOW);
    const b = await createSession(db, 'desktop', NOW);
    await endSession(db, a);
    expect(await readSession(db, a, NOW)).toBeNull();
    expect(await readSession(db, b, NOW)).not.toBeNull();
  });

  test('sign out everywhere ends them all', async () => {
    const a = await createSession(db, 'desktop', NOW);
    const b = await createSession(db, 'desktop', NOW);
    await endAllSessions(db);
    expect(await readSession(db, a, NOW)).toBeNull();
    expect(await readSession(db, b, NOW)).toBeNull();
  });
});

describe('setup tokens', () => {
  test('a token works once', async () => {
    const token = await issueSetupToken(db, NOW);
    expect(await setupTokenValid(db, token, NOW)).toBe(true);
    expect(await useSetupToken(db, token, NOW)).toBe(true);
    expect(await useSetupToken(db, token, NOW)).toBe(false);
    expect(await setupTokenValid(db, token, NOW)).toBe(false);
  });

  test('a token expires after 15 minutes', async () => {
    const token = await issueSetupToken(db, NOW);
    expect(await setupTokenValid(db, token, NOW + 15 * 60_000 + 1)).toBe(false);
    expect(await useSetupToken(db, token, NOW + 15 * 60_000 + 1)).toBe(false);
  });

  test('only a hash is stored, and guesses fail', async () => {
    const token = await issueSetupToken(db, NOW);
    expect(JSON.stringify((await db.execute('SELECT * FROM setup_tokens')).rows)).not.toContain(token);
    expect(await setupTokenValid(db, 'guess', NOW)).toBe(false);
    expect(await setupTokenValid(db, '', NOW)).toBe(false);
  });
});

describe('challenges', () => {
  test('can be taken once, by the right purpose', async () => {
    const id = await saveChallenge(db, 'abc', 'login', NOW);
    expect(await takeChallenge(db, id, 'register', NOW)).toBeNull();
    expect(await takeChallenge(db, id, 'login', NOW)).toBe('abc');
    expect(await takeChallenge(db, id, 'login', NOW)).toBeNull();
  });

  test('expire after 5 minutes', async () => {
    const id = await saveChallenge(db, 'abc', 'login', NOW);
    expect(await takeChallenge(db, id, 'login', NOW + 5 * 60_000 + 1)).toBeNull();
  });
});

describe('credentialCount', () => {
  test('starts at zero', async () => {
    expect(await credentialCount(db)).toBe(0);
  });
});
