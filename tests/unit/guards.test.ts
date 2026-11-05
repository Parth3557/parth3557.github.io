import { describe, expect, test } from 'vitest';
import { isEditorPath, isGatedPath, isPublicAuthPath, originAllowed, securityHeaders, sessionCookie } from '../../src/lib/server/guards';

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
