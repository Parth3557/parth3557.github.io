/** Request-level security rules: which paths need a login, which origins may write, and response headers. */
const GATED = /^\/(?:dashboard|keystatic|api\/keystatic|api\/dashboard)(?:\/|$)/;

/** Resolves encodings, dot segments, repeated slashes and case. Returns null if it can't be decoded. */
function canonicalPath(raw: string): string | null {
  let path = raw;
  for (let round = 0; ; round++) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      return null;
    }
    if (decoded === path) break;
    if (round === 5) return null;
    path = decoded;
  }
  const segments: string[] = [];
  for (const segment of path.replaceAll('\\', '/').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment.toLowerCase());
  }
  return `/${segments.join('/')}`;
}

/** Anything that can't be decoded counts as gated, so a malformed path fails closed. */
export function isGatedPath(raw: string): boolean {
  const path = canonicalPath(raw);
  return path === null || GATED.test(path);
}

export function isPublicAuthPath(raw: string): boolean {
  const path = canonicalPath(raw);
  return path === '/dashboard/login' || path === '/dashboard/setup';
}

export function isEditorPath(raw: string): boolean {
  const path = canonicalPath(raw);
  return path !== null && /^\/(?:keystatic|api\/keystatic)(?:\/|$)/.test(path);
}

export function originAllowed(origin: string | null, siteOrigin: string): boolean {
  return origin === siteOrigin;
}

/** The one route the public pages may call. Matched exactly, so no other spelling of a path qualifies. */
const COLLECT_PATH = '/api/collect';

/** A write must come from the app itself. The public pages can live on another address, and may only send visits. */
export function writeAllowed(path: string, origin: string | null, siteOrigin: string, publicOrigin: string): boolean {
  return originAllowed(origin, siteOrigin) || (path === COLLECT_PATH && originAllowed(origin, publicOrigin));
}

/** Lets the public pages read the visitor endpoint's reply. Never a wildcard, and never with credentials. */
export function collectCorsHeaders(origin: string | null, publicOrigin: string): Record<string, string> {
  return originAllowed(origin, publicOrigin) ? { 'Access-Control-Allow-Origin': publicOrigin, Vary: 'Origin' } : { Vary: 'Origin' };
}

const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export function sessionCookie(siteOrigin: string) {
  const { protocol, hostname } = new URL(siteOrigin);
  const local = protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1');
  return {
    name: local ? 'pj_session' : '__Host-pj_session',
    options: { httpOnly: true, secure: !local, sameSite: 'lax' as const, path: '/', maxAge: SESSION_MAX_AGE_SECONDS },
  };
}

/**
 * private: the dashboard, login and APIs. Only same-origin scripts and styles, nothing else.
 * editor: Keystatic, which needs inline styles and talks to GitHub. It sits behind the same login.
 */
export function securityHeaders(area: 'private' | 'editor', dev: boolean): Record<string, string> {
  const shared = "base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'";
  // In dev only, Vite injects inline scripts and styles and needs a socket for hot reload.
  const devInline = dev ? " 'unsafe-inline'" : '';
  const devConnect = dev ? ' ws://localhost:* ws://127.0.0.1:*' : '';
  const csp = area === 'private'
    ? `default-src 'none'; script-src 'self'${devInline}; style-src 'self'${devInline}; img-src 'self'; font-src 'self'; connect-src 'self'${devConnect}; ${shared}`
    : `default-src 'self'; script-src 'self'${devInline}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://avatars.githubusercontent.com https://raw.githubusercontent.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://api.github.com https://raw.githubusercontent.com${devConnect}; ${shared}`;
  return {
    'Content-Security-Policy': csp,
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    // Not no-referrer: that makes browsers send "Origin: null" on form posts, which the origin check refuses.
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Strict-Transport-Security': 'max-age=63072000',
  };
}
