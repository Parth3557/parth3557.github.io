import type { APIContext, AstroGlobal } from 'astro';
import { sessionCookie } from './guards';
import { memoryLimiter, overLimit } from './rate-limit';
import { getDb, siteOrigin } from './runtime';
import { readSession, type Session } from './sessions';
import { deviceClass } from './visit-input';
import { clientKey } from './visits';

export const CHALLENGE_COOKIE = 'pj_challenge';

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export const failure = (message: string, status: number) => json({ error: message }, status);

/** Reads JSON with a hard size cap, counting bytes as they arrive so a false length can't bypass it. */
export async function readJson(request: Request, maxBytes: number): Promise<Record<string, unknown> | null> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return null;
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Astro reads this from the platform. On Vercel the platform sets it, and visitors can't override it. */
export function clientIp(context: Pick<APIContext, 'clientAddress'>): string {
  try {
    return context.clientAddress || 'unknown';
  } catch {
    return 'unknown';
  }
}

export const deviceOf = (request: Request) => deviceClass(request.headers.get('user-agent') ?? '');

export function sessionToken(context: Pick<APIContext | AstroGlobal, 'cookies'>): string | undefined {
  return context.cookies.get(sessionCookie(siteOrigin()).name)?.value;
}

export async function ownerSession(context: Pick<APIContext | AstroGlobal, 'cookies'>): Promise<Session | null> {
  const token = sessionToken(context);
  return token ? readSession(await getDb(), token) : null;
}

const authBurst = memoryLimiter(30, 60_000);

/** Limits passkey requests per client and overall. True means refuse. */
export async function authLimited(context: Pick<APIContext, 'clientAddress'>): Promise<boolean> {
  const ip = clientIp(context);
  if (authBurst(ip)) return true;
  const db = await getDb();
  return (await overLimit(db, `auth:${await clientKey(db, ip)}`, 30, 900)) || (await overLimit(db, 'auth:all', 300, 900));
}

export function setChallengeCookie(context: Pick<APIContext, 'cookies'>, id: string): void {
  const { secure } = sessionCookie(siteOrigin()).options;
  context.cookies.set(CHALLENGE_COOKIE, id, { httpOnly: true, secure, sameSite: 'strict', path: '/api/auth', maxAge: 300 });
}

export function readChallengeCookie(context: Pick<APIContext, 'cookies'>): string | undefined {
  const value = context.cookies.get(CHALLENGE_COOKIE)?.value;
  context.cookies.delete(CHALLENGE_COOKIE, { path: '/api/auth' });
  return value;
}

export function setSessionCookie(context: Pick<APIContext, 'cookies'>, token: string): void {
  const { name, options } = sessionCookie(siteOrigin());
  context.cookies.set(name, token, options);
}

export function clearSessionCookie(context: Pick<APIContext, 'cookies'>): void {
  const { name, options } = sessionCookie(siteOrigin());
  context.cookies.delete(name, { path: options.path, secure: options.secure, httpOnly: true, sameSite: options.sameSite });
}
