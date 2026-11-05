import { describe, expect, test } from 'vitest';
import { collectCorsHeaders, isEditorPath, isGatedPath, isPublicAuthPath, originAllowed, securityHeaders, sessionCookie, writeAllowed } from '../../src/lib/server/guards';

describe('isEditorPath', () => {
  test.each(['/keystatic', '/keystatic/collection/projects', '/%6beystatic', '/api/keystatic/update', '/API/KEYSTATIC/x'])('%s is the editor', (path) => {
    expect(isEditorPath(path)).toBe(true);
  });

  test.each(['/', '/dashboard', '/keystatics', '/api/dashboard/passkeys'])('%s is not', (path) => {
    expect(isEditorPath(path)).toBe(false);
  });
});

describe('isGatedPath: encoded and odd spellings cannot dodge the login check', () => {
  test.each([
    '/dashboard',
    '/dashboard/',
    '/dashboard/anything',
    '/DASHBOARD',
    '/DashBoard/x',
    '/%64ashboard',
    '/%2564ashboard',
    '/%252564ashboard',
    '//dashboard',
    '/./dashboard',
    '/x/../dashboard',
    '/dashboard%2f',
    '/keystatic',
    '/keystatic/collection/projects',
    '/%6beystatic',
    '/api/keystatic/update',
    '/API/KEYSTATIC/update',
    '/api/dashboard/passkeys',
    '/%zz/dashboard',
  ])('%s is gated', (path) => {
    expect(isGatedPath(path)).toBe(true);
  });

  test.each(['/', '/projects', '/dashboards', '/dashboard-info', '/keystatics', '/api/collect', '/api/auth/login/options', '/journey'])('%s is not gated', (path) => {
    expect(isGatedPath(path)).toBe(false);
  });

  test('only the exact login and setup pages are open, under any spelling', () => {
    expect(isPublicAuthPath('/dashboard/login')).toBe(true);
    expect(isPublicAuthPath('/dashboard/setup')).toBe(true);
    expect(isPublicAuthPath('/dashboard/login/')).toBe(true);
    expect(isPublicAuthPath('/dashboard/login/../secret')).toBe(false);
    expect(isPublicAuthPath('/dashboard/loginx')).toBe(false);
    expect(isPublicAuthPath('/dashboard')).toBe(false);
  });
});

describe('originAllowed: exact match only', () => {
  const site = 'https://parth3557.vercel.app';

  test('accepts the site itself', () => {
    expect(originAllowed(site, site)).toBe(true);
  });

  test.each([
    null,
    '',
    'null',
    'https://evil.example',
    'https://parth3557.vercel.app.evil.example',
    'http://parth3557.vercel.app',
    'https://parth3557.vercel.app:8443',
    'https://PARTH3557.vercel.app.evil.example',
  ])('rejects %s', (origin) => {
    expect(originAllowed(origin, site)).toBe(false);
  });
});

describe('writeAllowed: the public pages can live elsewhere, and may only send visits', () => {
  const app = 'https://parth3557.vercel.app';
  const pages = 'https://parth3557.github.io';

  test.each(['/api/collect', '/api/auth/logout', '/api/dashboard/passkeys/remove', '/api/keystatic/update'])('the app itself may write to %s', (path) => {
    expect(writeAllowed(path, app, app, pages)).toBe(true);
  });

  test('the public pages may send a visit', () => {
    expect(writeAllowed('/api/collect', pages, app, pages)).toBe(true);
  });

  test.each([
    '/api/auth/logout',
    '/api/auth/login/options',
    '/api/auth/login/verify',
    '/api/auth/register/options',
    '/api/auth/register/verify',
    '/api/dashboard/passkeys/remove',
    '/api/keystatic/update',
    '/dashboard',
    '/api/collect/',
    '/API/collect',
    '/api/%63ollect',
    '/api/collect/../auth/logout',
  ])('the public pages may not write to %s', (path) => {
    expect(writeAllowed(path, pages, app, pages)).toBe(false);
  });

  test.each([
    null,
    '',
    'null',
    'https://evil.example',
    'https://parth3557.github.io.evil.example',
    'http://parth3557.github.io',
    'https://parth3557.github.io:8443',
    'https://other-person.github.io',
  ])('%s may not send a visit', (origin) => {
    expect(writeAllowed('/api/collect', origin, app, pages)).toBe(false);
  });
});

describe('collectCorsHeaders', () => {
  const pages = 'https://parth3557.github.io';

  test('names the public pages exactly when they ask', () => {
    expect(collectCorsHeaders(pages, pages)).toEqual({ 'Access-Control-Allow-Origin': pages, Vary: 'Origin' });
  });

  test.each([null, '', 'null', 'https://evil.example', `${pages}.evil.example`, 'http://parth3557.github.io'])('gives %s no permission', (origin) => {
    expect(collectCorsHeaders(origin, pages)).toEqual({ Vary: 'Origin' });
  });

  test('never allows credentials', () => {
    expect(Object.keys(collectCorsHeaders(pages, pages)).join()).not.toMatch(/credentials/i);
  });
});

describe('sessionCookie', () => {
  test('on https it uses the __Host- prefix and Secure', () => {
    const cookie = sessionCookie('https://parth3557.vercel.app');
    expect(cookie.name).toBe('__Host-pj_session');
    expect(cookie.options).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  });

  test('on localhost http it stays usable in every browser, still HttpOnly', () => {
    const cookie = sessionCookie('http://localhost:4321');
    expect(cookie.name).toBe('pj_session');
    expect(cookie.options).toMatchObject({ httpOnly: true, secure: false, sameSite: 'lax', path: '/' });
  });

  test('never drops Secure for a non-local address', () => {
    expect(sessionCookie('http://192.168.1.5:4321').options.secure).toBe(true);
  });
});

describe('securityHeaders', () => {
  const csp = (area: 'private' | 'editor', dev = false) => securityHeaders(area, dev)['Content-Security-Policy'];

  test('private pages allow only their own scripts and styles', () => {
    expect(csp('private')).toContain("script-src 'self'");
    expect(csp('private')).toContain("style-src 'self'");
    expect(csp('private')).toContain("default-src 'none'");
    expect(csp('private')).not.toContain('unsafe-inline');
    expect(csp('private')).not.toContain('unsafe-eval');
  });

  test('every area blocks framing and base-tag injection', () => {
    for (const area of ['private', 'editor'] as const) {
      expect(csp(area)).toContain("frame-ancestors 'none'");
      expect(csp(area)).toContain("base-uri 'none'");
      expect(csp(area)).toContain("form-action 'self'");
      expect(csp(area)).toContain("object-src 'none'");
    }
  });

  test('private pages are never cached or indexed', () => {
    const headers = securityHeaders('private', false);
    expect(headers['Cache-Control']).toBe('no-store');
    expect(headers['X-Robots-Tag']).toContain('noindex');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    // Not no-referrer: browsers then send "Origin: null" on form posts, and the sign-out form would be refused.
    expect(headers['Referrer-Policy']).toBe('same-origin');
  });

  test('in production the editor allows no inline or evaluated script', () => {
    const scripts = csp('editor').split(';').find((part) => part.trim().startsWith('script-src'));
    expect(scripts?.trim()).toBe("script-src 'self'");
  });

  test('only the local dev server relaxes scripts, for hot reload', () => {
    expect(csp('private', true)).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp('editor', true)).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp('private', false)).not.toContain('unsafe-inline');
  });
});
