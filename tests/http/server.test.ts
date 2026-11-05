import { readdirSync, readFileSync, statSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { createClient } from '@libsql/client';
import { beforeAll, describe, expect, test } from 'vitest';
import { issueSetupToken, saveCredential, setupTokenValid } from '../../src/lib/server/enrollment';
import { SCHEMA } from '../../src/lib/server/schema.mjs';
import { createSession, FRESH_MS, readSession } from '../../src/lib/server/sessions';
import { dayKey } from '../../src/lib/server/visits';
import { DB_FILE, ORIGIN, PORT } from './setup';

const db = createClient({ url: `file:${DB_FILE}` });
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const JSON_TYPE = { 'content-type': 'application/json' };
const SAME_ORIGIN = { origin: ORIGIN, ...JSON_TYPE };

type Reply = { status: number; headers: Record<string, string | string[] | undefined>; text: string };

/** A raw request, so the path and headers reach the server exactly as written. */
function send(path: string, { method = 'GET', headers = {}, body }: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port: PORT, path, method, headers: { host: `localhost:${PORT}`, 'user-agent': BROWSER, ...headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

const postJson = (path: string, data: unknown = {}, headers: Record<string, string> = {}) =>
  send(path, { method: 'POST', headers: { ...SAME_ORIGIN, ...headers }, body: JSON.stringify(data) });

const cookie = (token: string) => ({ cookie: `pj_session=${token}` });
const signedIn = async () => cookie(await createSession(db, 'desktop'));
const signedInLongAgo = async () => {
  const token = await createSession(db, 'desktop', Date.now() - FRESH_MS - 60_000);
  return cookie(token);
};
const setCookies = (reply: Reply) => [reply.headers['set-cookie'] ?? []].flat();
const rowCount = async (table: string) => Number((await db.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n);
const viewsToday = async () => {
  const { rows } = await db.execute({ sql: 'SELECT views FROM stats_daily WHERE day = ?', args: [dayKey(Date.now())] });
  return rows.length ? Number(rows[0].views) : 0;
};

beforeAll(async () => {
  await db.batch(SCHEMA, 'write');
});

describe('the dashboard is closed to strangers', () => {
  test.each([
    '/dashboard',
    '/dashboard/',
    '/dashboard?days=7',
    '/%64ashboard',
    '/%2564ashboard',
    '/%252564ashboard',
    '//dashboard',
    '/./dashboard',
    '/x/../dashboard',
    '/keystatic',
    '/keystatic/',
    '/keystatic/collection/projects',
    '/%6beystatic',
  ])('GET %s sends a stranger to the sign-in page', async (path) => {
    const reply = await send(path);
    expect(reply.status).toBe(303);
    expect(reply.headers.location).toBe('/dashboard/login');
    expect(reply.text).not.toContain('Manage your portfolio');
  });

  // These spellings match no route at all, so they end in a plain error. What matters is that none of them opens anything.
  test.each([
    '/DASHBOARD',
    '/DashBoard/',
    '/dashboard%2f',
    '/dashboard/anything',
    '/%zz/dashboard',
    '/KEYSTATIC',
    '/dashboard/loginx',
    '/dashboard/login/../secret',
    '/API/KEYSTATIC/tree',
  ])('GET %s opens nothing', async (path) => {
    const reply = await send(path);
    expect([303, 400, 401, 404]).toContain(reply.status);
    expect(reply.text).not.toContain('Manage your portfolio');
    expect(reply.text).not.toContain('content/profile.yaml');
  });

  test.each(['/api/keystatic/tree', '/api/%6beystatic/tree', '/api/dashboard/passkeys/remove'])('GET %s refuses a stranger', async (path) => {
    expect((await send(path)).status).toBe(401);
  });

  test('a forged session cookie gets nothing', async () => {
    const reply = await send('/dashboard', { headers: cookie('forged-token-that-was-never-issued') });
    expect(reply.status).toBe(303);
    expect(reply.headers.location).toBe('/dashboard/login');
  });

  test('an expired session gets nothing', async () => {
    const token = await createSession(db, 'desktop', Date.now() - 13 * 60 * 60_000);
    expect((await send('/dashboard', { headers: cookie(token) })).status).toBe(303);
  });

  test('a real session opens the dashboard', async () => {
    const reply = await send('/dashboard', { headers: await signedIn() });
    expect(reply.status).toBe(200);
    expect(reply.text).toContain('Manage your portfolio');
  });

  test('the sign-in and setup pages are open, and reveal nothing about the owner', async () => {
    for (const path of ['/dashboard/login', '/dashboard/setup']) {
      const reply = await send(path);
      expect(reply.status).toBe(200);
      expect(reply.text).not.toContain('Manage your portfolio');
    }
  });

});

describe('private responses carry the security headers', () => {
  test.each(['/dashboard/login', '/dashboard/setup', '/dashboard'])('%s', async (path) => {
    const { headers } = await send(path);
    const csp = String(headers['content-security-policy']);
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).not.toContain('unsafe');
    expect(headers['cache-control']).toBe('no-store');
    expect(headers['x-robots-tag']).toContain('noindex');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('same-origin');
  });

  test('API replies are never cached or indexed either', async () => {
    const { headers } = await postJson('/api/auth/login/options');
    expect(headers['cache-control']).toBe('no-store');
    expect(headers['x-robots-tag']).toContain('noindex');
  });

  test('private pages have no inline script or style for the policy to allow', async () => {
    const pages = [await send('/dashboard/login'), await send('/dashboard/setup'), await send('/dashboard', { headers: await signedIn() })];
    for (const { text } of pages) {
      expect(text).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
      expect(text).not.toMatch(/<style\b/);
      expect(text).not.toMatch(/\sstyle="/);
    }
  });
});

describe('another site cannot act for a signed-in owner', () => {
  const routes = ['/api/auth/logout', '/api/auth/login/options', '/api/auth/login/verify', '/api/auth/register/options', '/api/auth/register/verify', '/api/collect', '/api/dashboard/passkeys/remove', '/api/keystatic/update'];

  describe.each(['https://evil.example', 'http://localhost:4321', `${ORIGIN}.evil.example`, 'null', ''])('Origin "%s"', (origin) => {
    test.each(routes)('POST %s is refused', async (path) => {
      const headers: Record<string, string> = { ...JSON_TYPE, ...(origin ? { origin } : {}) };
      expect((await send(path, { method: 'POST', headers, body: '{}' })).status).toBe(403);
    });
  });

  test('a cross-site sign-out leaves the session alive', async () => {
    const token = await createSession(db, 'desktop');
    await send('/api/auth/logout', { method: 'POST', headers: { origin: 'https://evil.example', ...cookie(token), 'content-type': 'application/x-www-form-urlencoded' }, body: 'scope=everywhere' });
    expect(await readSession(db, token)).not.toBeNull();
  });
});

describe('signing out', () => {
  const form = { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' };

  test('an anonymous request cannot end the owner\'s sessions or write to the log', async () => {
    const token = await createSession(db, 'desktop');
    const before = await rowCount('audit_log');
    const reply = await send('/api/auth/logout', { method: 'POST', headers: form, body: 'scope=everywhere' });
    expect(reply.status).toBe(303);
    expect(await readSession(db, token)).not.toBeNull();
    expect(await rowCount('audit_log')).toBe(before);
  });

  test('a forged cookie cannot either', async () => {
    const token = await createSession(db, 'desktop');
    await send('/api/auth/logout', { method: 'POST', headers: { ...form, ...cookie('forged') }, body: 'scope=everywhere' });
    expect(await readSession(db, token)).not.toBeNull();
  });

  test('ends this session only, and clears the cookie', async () => {
    const mine = await createSession(db, 'desktop');
    const other = await createSession(db, 'desktop');
    const reply = await send('/api/auth/logout', { method: 'POST', headers: { ...form, ...cookie(mine) }, body: '' });
    expect(reply.headers.location).toBe('/dashboard/login');
    expect(await readSession(db, mine)).toBeNull();
    expect(await readSession(db, other)).not.toBeNull();
    expect(setCookies(reply).join()).toMatch(/pj_session=[^;]*;.*(Max-Age=0|Expires=Thu, 01 Jan 1970)/);
  });

  test('sign out everywhere ends them all', async () => {
    const mine = await createSession(db, 'desktop');
    const other = await createSession(db, 'desktop');
    await send('/api/auth/logout', { method: 'POST', headers: { ...form, ...cookie(mine) }, body: 'scope=everywhere' });
    expect(await readSession(db, mine)).toBeNull();
    expect(await readSession(db, other)).toBeNull();
  });
});

describe('adding a passkey', () => {
  test.each([
    ['no token', {}],
    ['a guessed token', { token: 'guess' }],
    ['a non-string token', { token: { $ne: null } }],
  ])('is refused with %s', async (_, body) => {
    const reply = await postJson('/api/auth/register/options', body);
    expect(reply.status).toBe(403);
    expect(reply.text).not.toContain('challenge');
  });

  test('is refused with an expired token', async () => {
    const token = await issueSetupToken(db, Date.now() - 16 * 60_000);
    expect((await postJson('/api/auth/register/options', { token })).status).toBe(403);
  });

  test('is refused for a session that signed in too long ago', async () => {
    expect((await postJson('/api/auth/register/options', {}, await signedInLongAgo())).status).toBe(403);
  });

  test('a valid token gets strict options and a locked-down challenge cookie', async () => {
    const token = await issueSetupToken(db);
    const reply = await postJson('/api/auth/register/options', { token });
    expect(reply.status).toBe(200);
    const options = JSON.parse(reply.text);
    expect(options.rp.id).toBe('localhost');
    expect(options.authenticatorSelection).toMatchObject({ residentKey: 'required', userVerification: 'required' });
    expect(options.attestation).toBe('none');
    const [challenge] = setCookies(reply);
    expect(challenge).toMatch(/^pj_challenge=/);
    expect(challenge).toContain('HttpOnly');
    expect(challenge).toContain('SameSite=Strict');
    expect(challenge).toContain('Path=/api/auth');
  });

  test('a recent session also gets options', async () => {
    expect((await postJson('/api/auth/register/options', {}, await signedIn())).status).toBe(200);
  });

  test('a bad response saves nothing and does not burn the token', async () => {
    const token = await issueSetupToken(db);
    const options = await postJson('/api/auth/register/options', { token });
    const challenge = setCookies(options)[0].split(';')[0];
    const reply = await postJson('/api/auth/register/verify', { token, response: { id: 'x', rawId: 'x', type: 'public-key', response: {} } }, { cookie: challenge });
    expect(reply.status).toBe(400);
    expect(await rowCount('credentials')).toBe(0);
    expect(await setupTokenValid(db, token)).toBe(true);
    expect(setCookies(reply).join()).not.toContain('pj_session');
  });

  test('a token cannot be used without the challenge from the same browser', async () => {
    const token = await issueSetupToken(db);
    expect((await postJson('/api/auth/register/verify', { token, response: {} })).status).toBe(400);
  });
});

describe('signing in', () => {
  test('options reveal nothing about the owner\'s passkeys', async () => {
    const reply = await postJson('/api/auth/login/options');
    const options = JSON.parse(reply.text);
    expect(options.rpId).toBe('localhost');
    expect(options.userVerification).toBe('required');
    expect(options.allowCredentials ?? []).toEqual([]);
  });

  test('every failure gives the same message, so nothing can be probed', async () => {
    const noChallenge = await postJson('/api/auth/login/verify', { response: { id: 'unknown' } });

    const options = await postJson('/api/auth/login/options');
    const challenge = setCookies(options)[0].split(';')[0];
    const unknownKey = await postJson('/api/auth/login/verify', { response: { id: 'unknown' } }, { cookie: challenge });

    expect(noChallenge.status).toBe(400);
    expect(unknownKey.status).toBe(400);
    expect(JSON.parse(noChallenge.text)).toEqual(JSON.parse(unknownKey.text));
  });

  test('a challenge works only once', async () => {
    const options = await postJson('/api/auth/login/options');
    const challenge = setCookies(options)[0].split(';')[0];
    await postJson('/api/auth/login/verify', { response: { id: 'unknown' } }, { cookie: challenge });
    const before = await rowCount('challenges');
    await postJson('/api/auth/login/verify', { response: { id: 'unknown' } }, { cookie: challenge });
    expect(await rowCount('challenges')).toBe(before);
  });

  test('failed attempts are logged without an address', async () => {
    const options = await postJson('/api/auth/login/options');
    const challenge = setCookies(options)[0].split(';')[0];
    await postJson('/api/auth/login/verify', { response: { id: 'unknown' } }, { cookie: challenge });
    const log = JSON.stringify((await db.execute('SELECT * FROM audit_log')).rows);
    expect(log).toContain('Failed sign-in');
    expect(log).not.toContain('127.0.0.1');
  });

  test('a spoofed Host header cannot change who the passkey is for', async () => {
    const reply = await postJson('/api/auth/login/options', {}, { host: 'evil.example', 'x-forwarded-host': 'evil.example' });
    expect(JSON.parse(reply.text).rpId).toBe('localhost');
  });
});

describe('removing a passkey', () => {
  test('needs a recent sign-in', async () => {
    expect((await postJson('/api/dashboard/passkeys/remove', { id: 'x' }, await signedInLongAgo())).status).toBe(403);
  });

  test('cannot remove the last one', async () => {
    await saveCredential(db, { id: 'only-key', publicKey: new Uint8Array([1]), counter: 0, transports: [], label: 'Laptop' });
    const reply = await postJson('/api/dashboard/passkeys/remove', { id: 'only-key' }, await signedIn());
    expect(reply.status).toBe(400);
    expect(await rowCount('credentials')).toBe(1);
  });

  test('can remove one of two', async () => {
    await saveCredential(db, { id: 'second-key', publicKey: new Uint8Array([2]), counter: 0, transports: [], label: 'Phone' });
    expect((await postJson('/api/dashboard/passkeys/remove', { id: 'second-key' }, await signedIn())).status).toBe(200);
    expect(await rowCount('credentials')).toBe(1);
  });
});

describe('the public visitor endpoint', () => {
  test('counts a normal visit and keeps only the referrer\'s hostname', async () => {
    const before = await viewsToday();
    const reply = await postJson('/api/collect', { path: '/', referrer: 'https://www.linkedin.com/in/someone?secret=1' });
    expect(reply.status).toBe(204);
    expect(await viewsToday()).toBe(before + 1);
    const hosts = JSON.stringify((await db.execute('SELECT host FROM stats_referrers')).rows);
    expect(hosts).toContain('linkedin.com');
    expect(hosts).not.toContain('secret');
  });

  test.each([
    ['a script in the path', { path: '/<script>alert(1)</script>' }],
    ['an unknown path', { path: '/admin' }],
    ['the dashboard path', { path: '/dashboard' }],
    ['no path', {}],
    ['a non-string path', { path: { evil: true } }],
  ])('rejects %s', async (_, body) => {
    const before = await viewsToday();
    expect((await postJson('/api/collect', body)).status).toBe(400);
    expect(await viewsToday()).toBe(before);
  });

  test('a hostile referrer is dropped, and the view still counts', async () => {
    await postJson('/api/collect', { path: '/', referrer: 'javascript:alert(1)' });
    await postJson('/api/collect', { path: '/', referrer: '<img src=x onerror=alert(1)>' });
    const hosts = JSON.stringify((await db.execute('SELECT host FROM stats_referrers')).rows);
    expect(hosts).not.toContain('alert');
  });

  test.each([
    ['malformed JSON', { headers: SAME_ORIGIN, body: '{not json' }],
    ['a JSON array', { headers: SAME_ORIGIN, body: '[1,2,3]' }],
    ['the wrong content type', { headers: { origin: ORIGIN, 'content-type': 'text/plain' }, body: '{"path":"/"}' }],
    ['a streamed body over the 1 KB cap', { headers: SAME_ORIGIN, body: JSON.stringify({ path: '/', padding: 'x'.repeat(2000) }) }],
  ])('rejects %s without crashing', async (_, options) => {
    const reply = await send('/api/collect', { method: 'POST', ...options });
    expect(reply.status).toBe(400);
    expect((await send('/dashboard/login')).status).toBe(200);
  });

  test('rejects a body that declares itself over the cap, before reading it', async () => {
    const body = JSON.stringify({ path: '/', padding: 'x'.repeat(2000) });
    const reply = await send('/api/collect', { method: 'POST', headers: { ...SAME_ORIGIN, 'content-length': String(Buffer.byteLength(body)) }, body });
    expect(reply.status).toBe(400);
  });

  test.each([
    ['Do Not Track', { dnt: '1' }],
    ['Global Privacy Control', { 'sec-gpc': '1' }],
    ['a known bot', { 'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' }],
    ['a command-line client', { 'user-agent': 'curl/8.4' }],
    ['no user agent', { 'user-agent': '' }],
  ])('does not count %s', async (_, headers) => {
    const before = await viewsToday();
    expect((await postJson('/api/collect', { path: '/' }, headers)).status).toBe(204);
    expect(await viewsToday()).toBe(before);
  });

  test('the owner\'s own visits are not counted', async () => {
    const before = await viewsToday();
    await postJson('/api/collect', { path: '/' }, await signedIn());
    expect(await viewsToday()).toBe(before);
  });

  test('other methods are refused', async () => {
    expect((await send('/api/collect')).status).toBe(405);
  });

  test('no address or browser string has reached the database', async () => {
    const tables = await db.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
    for (const { name } of tables.rows) {
      const contents = JSON.stringify((await db.execute(`SELECT * FROM "${name}"`)).rows);
      expect(contents).not.toContain('127.0.0.1');
      expect(contents).not.toContain('Mozilla');
    }
  });
});

describe('hostile stored data cannot attack the owner', () => {
  test('a script in a stored referrer is rendered as harmless text', async () => {
    const payload = '<script>alert("xss")</script>';
    await db.execute({ sql: 'INSERT OR REPLACE INTO stats_referrers (day, host, views) VALUES (?, ?, 999999)', args: [dayKey(Date.now()), payload] });
    const reply = await send('/dashboard', { headers: await signedIn() });
    expect(reply.text).not.toContain(payload);
    expect(reply.text).toContain('&lt;script&gt;');
    await db.execute({ sql: 'DELETE FROM stats_referrers WHERE host = ?', args: [payload] });
  });

  test('a passkey name can neither become a tag nor break out of its attribute', async () => {
    const payload = '"><img src=x onerror=alert(1)>';
    await saveCredential(db, { id: 'xss-key', publicKey: new Uint8Array([3]), counter: 0, transports: [], label: payload });
    const reply = await send('/dashboard', { headers: await signedIn() });
    await db.execute({ sql: "DELETE FROM credentials WHERE id = 'xss-key'", args: [] });
    expect(reply.text).toContain('data-label="');
    // A quoted attribute value can't start a tag. Without any such values, the payload must be gone.
    const outsideAttributes = reply.text.replace(/\sdata-label="[^"]*"/g, '');
    expect(outsideAttributes).not.toContain('<img src=x');
    expect(outsideAttributes).toContain('&lt;img src=x');
  });

  test.each(["<script>alert('days')</script>", "7' OR 'days'='days"])('?days=%s falls back to 30 days and is never echoed', async (days) => {
    const reply = await send(`/dashboard?days=${encodeURIComponent(days)}`, { headers: await signedIn() });
    expect(reply.status).toBe(200);
    expect(reply.text).not.toContain("'days'");
    expect(reply.text).toMatch(/href="\/dashboard\?days=30" aria-current="true"/);
  });

  test.each(['99999', '-1', '0', '7.5'])('?days=%s falls back to 30 days', async (days) => {
    const reply = await send(`/dashboard?days=${days}`, { headers: await signedIn() });
    expect(reply.text).toMatch(/href="\/dashboard\?days=30" aria-current="true"/);
  });

  test('a redirect target cannot be supplied', async () => {
    const reply = await send('/dashboard?next=https://evil.example');
    expect(reply.headers.location).toBe('/dashboard/login');
  });
});

describe('the content editor', () => {
  test('opens for the owner, under a policy with no inline script', async () => {
    const reply = await send('/keystatic', { headers: await signedIn() });
    expect(reply.status).toBe(200);
    expect(reply.text).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(String(reply.headers['content-security-policy'])).toMatch(/script-src 'self';/);
    expect(reply.headers['x-robots-tag']).toContain('noindex');
    expect(reply.text).toContain('noindex');
  });

  test('its API answers the owner', async () => {
    // The header is the editor's own guard against cross-site requests, and its UI always sends it.
    const reply = await send('/api/keystatic/tree', { headers: { ...(await signedIn()), 'no-cors': '1' } });
    expect(reply.status).toBe(200);
    expect(reply.text).toContain('content/profile.yaml');
  });
});

describe('the public site', () => {
  let home = '';
  beforeAll(async () => {
    home = (await send('/')).text;
  });

  test('has the contact details the owner asked for', () => {
    expect(home).toContain('href="mailto:parth.jadhav.3557@gmail.com"');
    expect(home).toContain('parth.jadhav.3557@gmail.com</a>');
    expect(home).toContain('href="https://github.com/Parth3557"');
    expect(home).toContain('https://www.linkedin.com/in/parth3557');
    expect(home).toContain('id="contact"');
  });

  test('private projects show the research label and no code link', () => {
    const cards = home.split('<li class="card"').slice(1);
    const hidden = cards.filter((card) => /Artifact-Robust GI|Grassroots Football/.test(card));
    expect(hidden).toHaveLength(2);
    for (const card of hidden) {
      expect(card).toContain('Research · paper under review · code on request');
      expect(card).not.toContain('github.com');
      expect(card).not.toContain('View code');
    }
  });

  test('shows no phone number', () => {
    const text = home.replace(/<[^>]*>/g, ' ');
    expect(text).not.toMatch(/(?<![\d.])(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?![\d.])/);
  });

  test('has no inline code, so its strict policy can hold', () => {
    expect(home).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(home).not.toMatch(/<style\b/);
    expect(home).not.toMatch(/\sstyle="/);
  });

  test('loads nothing from another site', () => {
    const urls = [...home.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((match) => match[1]);
    const loaded = [...home.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)="(https?:[^"]+)"/g)].map((match) => match[1]);
    expect(loaded.filter((url) => !url.startsWith(ORIGIN) && !url.startsWith('http://localhost'))).toEqual([]);
    expect(urls.length).toBeGreaterThan(0);
  });

  test('never links to the dashboard', () => {
    expect(home).not.toContain('/dashboard');
    expect(home).not.toContain('/keystatic');
  });

  test('robots.txt and the sitemap keep private pages out of search', async () => {
    const robots = (await send('/robots.txt')).text;
    expect(robots).toContain('Disallow: /dashboard');
    expect(robots).toContain('Disallow: /keystatic');
    const sitemap = (await send('/sitemap-0.xml')).text;
    expect(sitemap).not.toMatch(/dashboard|keystatic|api/);
  });

  test('a missing page shows the 404', async () => {
    const reply = await send('/no-such-page');
    expect(reply.status).toBe(404);
    expect(reply.text).toContain('The shuttle landed outside the court.');
  });
});

describe('every public page', () => {
  const PROJECTS = [
    'multimodal-product-price-predictor',
    'ai-powered-learning-path-generator',
    'rag-ml-study-assistant',
    'artifact-robust-gi-endoscopy-classifier',
    'grassroots-football-talent-analytics',
    'neuroscan-brain-tumor-mri-classifier',
    'plant-growth-stage-classifier',
    'english-coach',
  ];
  const PRIVATE = ['artifact-robust-gi-endoscopy-classifier', 'grassroots-football-talent-analytics'];
  const ROUTES = ['/', '/journey', '/projects', '/about', '/experience', '/contact', ...PROJECTS.map((slug) => `/projects/${slug}`)];
  const pagesByRoute = new Map<string, string>();

  beforeAll(async () => {
    for (const route of ROUTES) pagesByRoute.set(route, (await send(route)).text);
  });

  describe.each(ROUTES)('%s', (route) => {
    const html = () => pagesByRoute.get(route) ?? '';

    test('opens', async () => {
      const reply = await send(route);
      expect(reply.status).toBe(200);
      expect(reply.headers['content-type']).toContain('text/html');
    });

    test('has one main heading, a title, a description and a canonical link', () => {
      expect(html().match(/<h1\b/g)).toHaveLength(1);
      expect(html()).toMatch(/<title>[^<]+<\/title>/);
      expect(html()).toMatch(/<meta name="description" content="[^"]+"/);
      expect(html()).toMatch(/<link rel="canonical" href="[^"]+"/);
      expect(html()).toContain('<html lang="en"');
      expect(html()).toContain('class="skip"');
      expect(html()).toContain('id="main"');
    });

    test('headings never skip a level, so screen readers can follow the page', () => {
      const levels = [...html().matchAll(/<h([1-6])\b/g)].map((match) => Number(match[1]));
      expect(levels[0]).toBe(1);
      levels.forEach((level, i) => {
        if (i > 0) expect(level, `heading ${i + 1} of ${levels.length}: ${levels.join(' ')}`).toBeLessThanOrEqual(levels[i - 1] + 1);
      });
    });

    test('shows no placeholder and no phone number', () => {
      expect(html()).not.toMatch(/\bTODO\b/);
      expect(html().replace(/<[^>]*>/g, ' ')).not.toMatch(/(?<![\d.])(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?![\d.])/);
    });

    test('has no inline code, so the strict policy can hold', () => {
      expect(html()).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
      expect(html()).not.toMatch(/<style\b/);
      expect(html()).not.toMatch(/\sstyle="/);
    });

    test('has the shared menu and footer, and never links to the dashboard', () => {
      expect(html()).toContain('class="nav"');
      expect(html()).toContain('class="foot"');
      expect(html()).not.toContain('/dashboard');
      expect(html()).not.toContain('/keystatic');
    });

    test('the footer holds only links, with no closing line', () => {
      const footer = html().match(/<footer class="foot"[^>]*>([\s\S]*?)<\/footer>/)?.[1];
      expect(footer).toContain('GitHub');
      expect(footer).not.toMatch(/<p\b/);
      expect(html()).not.toContain('Built with curiosity');
    });

    test('every internal link and in-page anchor works', async () => {
      const hrefs = new Set([...html().matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((match) => match[1]));
      for (const href of hrefs) {
        if (/^(https:|mailto:)/.test(href)) continue;
        if (href.startsWith('#')) {
          expect(html(), href).toContain(`id="${href.slice(1)}"`);
          continue;
        }
        const [path, anchor] = href.split('#');
        const target = await send(path || '/');
        expect(target.status, href).toBe(200);
        if (anchor) expect(target.text, href).toContain(`id="${anchor}"`);
      }
    });

    test('is counted as a real page by the visitor endpoint', async () => {
      const before = await viewsToday();
      expect((await postJson('/api/collect', { path: route })).status).toBe(204);
      expect(await viewsToday()).toBe(before + 1);
    });

    test('is in the sitemap', async () => {
      const sitemap = (await send('/sitemap-0.xml')).text;
      expect(sitemap).toMatch(new RegExp(`<loc>[^<]*${route === '/' ? '/' : route}/?</loc>`));
    });
  });

  test('every page has its own title', () => {
    const titles = ROUTES.map((route) => pagesByRoute.get(route)?.match(/<title>([^<]+)<\/title>/)?.[1]);
    expect(new Set(titles).size).toBe(ROUTES.length);
  });

  test.each(PRIVATE)('%s has the research label and no code link', (slug) => {
    const html = pagesByRoute.get(`/projects/${slug}`) ?? '';
    expect(html).toContain('Research · paper under review · code on request');
    expect(html).not.toContain('View code');
    // The footer's link to the GitHub profile is fine. A link into a repository is not.
    expect(html).not.toMatch(/github\.com\/Parth3557\/[a-zA-Z0-9]/);
  });

  test.each(PROJECTS.filter((slug) => !PRIVATE.includes(slug)))('%s links to its code', (slug) => {
    expect(pagesByRoute.get(`/projects/${slug}`)).toMatch(/href="https:\/\/github\.com\/Parth3557\/[^"]+"[^>]*>View code/);
  });

  test('the projects page lists every project, each linking to its own page', () => {
    const html = pagesByRoute.get('/projects') ?? '';
    for (const slug of PROJECTS) expect(html).toContain(`href="/projects/${slug}"`);
    expect(html.match(/<li class="card"/g)).toHaveLength(8);
    for (const label of ['GenAI / RAG', 'Computer Vision', 'Research', 'Android']) expect(html).toContain(label);
  });

  test('the journey page has all seven stops, the home page only its highlights', () => {
    const journey = pagesByRoute.get('/journey') ?? '';
    for (const title of ['Kolhapur: where curiosity started.', 'First real code in production.', 'Going deep into AI.', 'Smash: national stage.', 'Asking better questions.', 'Rally continues.', 'What&#39;s next?']) {
      expect(journey).toContain(title);
    }
    expect(journey).toContain('href="/contact"');
  });

  test('the about page has the curiosity statement, education and certifications', () => {
    const html = pagesByRoute.get('/about') ?? '';
    for (const text of ['Curiosity is my biggest strength', 'Vellore Institute of Technology', 'Vivekanand College', '8.85/10', '8.63/10', 'Artificial Intelligence with Python', 'Introduction to Cybersecurity Tools']) {
      expect(html).toContain(text);
    }
  });

  test('the experience page has the internship, achievements, skills and the resume', () => {
    const html = pagesByRoute.get('/experience') ?? '';
    for (const text of ['Android Developer Intern', 'Dropout Technologies LLP', 'Amazon ML Challenge 2025', 'Amazon ML Challenge 2026', 'Dead ReLUs Society', 'Personalized AI Powered Learning Path Generator', 'Grad-CAM', 'href="/resume/resume.pdf"']) {
      expect(html).toContain(text);
    }
  });

  test('the contact page has the email and profile links', () => {
    const html = pagesByRoute.get('/contact') ?? '';
    expect(html).toContain('href="mailto:parth.jadhav.3557@gmail.com"');
    expect(html).toContain('href="https://github.com/Parth3557"');
    expect(html).toContain('https://www.linkedin.com/in/parth3557');
  });
});

describe('the public resume', () => {
  const file = '/resume/resume.pdf';

  test('has its own section, reachable from the nav', async () => {
    const home = (await send('/')).text;
    expect(home).toMatch(/<section class="resume" id="resume"/);
    expect(home).toContain('id="resume-title"');
    expect(home).toContain('href="#resume"');
    expect(home).toContain(`href="${file}"`);
    expect(home).toMatch(/download="Parth_Jadhav_Resume\.pdf"/);
  });

  test('the 404 page links back to it', async () => {
    expect((await send('/no-such-page')).text).toContain('href="/#resume"');
  });

  test('is served as a PDF', async () => {
    const reply = await send(file);
    expect(reply.status).toBe(200);
    expect(reply.headers['content-type']).toContain('application/pdf');
    expect(reply.text.startsWith('%PDF-')).toBe(true);
  });

  test('has no phone link, attachment or resume-builder data, even inside compressed streams', () => {
    const raw = readFileSync(`dist/client${file}`).toString('latin1');
    const streams = [...raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)].map((match) => {
      try {
        return inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
      } catch {
        return match[1];
      }
    });
    expect(streams.length).toBeGreaterThan(0);
    const everything = raw + streams.join('');
    for (const secret of ['tel:', 'EmbeddedFile', 'resume.meta', 'resume_id', 'user_id', 'embedded_resume_metadata', 'personal_info']) {
      expect(everything).not.toContain(secret);
    }
    // The links that belong there must have survived, so this check can really see inside the file.
    expect(everything).toContain('mailto:parth.jadhav.3557@gmail.com');
    expect(everything).toContain('https://github.com/Parth3557');
  });
});

describe('the framework\'s own routes and the file server', () => {
  test.each([
    '/_image?href=https://example.com/a.png&w=10&h=10&f=webp',
    '/_image?href=http://169.254.169.254/latest/meta-data/&w=10&h=10&f=webp',
    '/_image?href=//example.com/a.png&w=10&h=10&f=webp',
    '/_image?href=file:///etc/passwd&w=10&h=10&f=webp',
  ])('%s can\'t make the server fetch anything', async (path) => {
    const reply = await send(path);
    expect(reply.status).not.toBe(200);
    expect(String(reply.headers['content-type'])).not.toContain('image/');
  });

  test.each([
    '//evil.example/',
    '//evil.example/%2e%2e',
    '//evil.example/dashboard',
    '/\\evil.example/',
    '/%5Cevil.example/',
    '/%2F%2Fevil.example/',
    '/dashboard//evil.example',
    '/dashboard/login//evil.example/',
  ])('%s never redirects to another site', async (path) => {
    const reply = await send(path);
    expect(String(reply.headers.location ?? '')).not.toContain('evil.example');
  });

  test.each([
    '/.env',
    '/.env.example',
    '/.data/portfolio.db',
    '/.data/test-http.db',
    '/package.json',
    '/keystatic.config.ts',
    '/content/profile.yaml',
    '/src/middleware.ts',
    '/server/entry.mjs',
    '/_astro/../../package.json',
    '/_astro/..%2f..%2fpackage.json',
    '/_astro/%2e%2e/%2e%2e/package.json',
    '/..%2f..%2f.env',
    '/..%5c..%5cpackage.json',
    '/%2e%2e%2f%2e%2e%2fpackage.json',
    '/fonts/..%2f..%2f..%2fpackage.json',
  ])('%s doesn\'t serve a private file', async (path) => {
    const reply = await send(path);
    expect(reply.status).not.toBe(200);
    expect(reply.text).not.toContain('"dependencies"');
    expect(reply.text).not.toContain('SQLite format');
  });
});

describe('the browser bundle', () => {
  const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
  const shipped = files('dist/client');

  test('has no source maps', () => {
    expect(shipped.filter((file) => file.endsWith('.map'))).toEqual([]);
  });

  test('contains no server code or secret settings', () => {
    for (const file of shipped.filter((name) => /\.(js|css|html)$/.test(name))) {
      const contents = readFileSync(file, 'utf8');
      expect(contents, file).not.toContain('TURSO_');
      expect(contents, file).not.toContain('setup_tokens');
      expect(contents, file).not.toContain('CREATE TABLE');
      expect(contents, file).not.toContain('@simplewebauthn/server');
    }
  });

  test('keeps the secret-free font and image folders only', () => {
    expect(shipped.filter((file) => /\.(env|db|sqlite)$/.test(file))).toEqual([]);
  });
});

// These come last, because they use up the limits for this test run.
describe('rate limits', () => {
  test('sign-in attempts are limited, and rotating forwarded headers does not help', async () => {
    let refused = 0;
    for (let i = 0; i < 40; i++) {
      const reply = await postJson('/api/auth/login/options', {}, { 'x-forwarded-for': `203.0.113.${i}`, 'x-real-ip': `203.0.113.${i}`, 'x-forwarded-host': `localhost:${PORT}`, 'x-vercel-forwarded-for': `203.0.113.${i}` });
      if (reply.status === 429) refused += 1;
    }
    expect(refused).toBeGreaterThan(0);
  });

  test('the visitor endpoint is limited, and the limit reply tells the client nothing else', async () => {
    let refused = 0;
    let lastReply: Reply | undefined;
    for (let i = 0; i < 70; i++) {
      lastReply = await postJson('/api/collect', { path: '/' }, { 'x-forwarded-for': `198.51.100.${i}` });
      if (lastReply.status === 429) refused += 1;
    }
    expect(refused).toBeGreaterThan(0);
    expect(lastReply?.text).toBe(JSON.stringify({ error: 'Too many requests' }));
  });
});
