import { defineMiddleware } from 'astro:middleware';
import { isEditorPath, isGatedPath, isPublicAuthPath, originAllowed, securityHeaders, sessionCookie } from './lib/server/guards';
import { getDb, siteOrigin } from './lib/server/runtime';
import { readSession } from './lib/server/sessions';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function respond(status: number, message: string): Response {
  return new Response(message, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

/** Every on-demand response gets the security headers. A redirect's headers can be immutable, so copy it. */
function secured(response: Response, area: 'private' | 'editor'): Response {
  const result = new Response(response.body, response);
  for (const [name, value] of Object.entries(securityHeaders(area, import.meta.env.DEV))) result.headers.set(name, value);
  return result;
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) return next();

  const path = context.url.pathname;
  const area = isEditorPath(path) ? 'editor' : 'private';

  // A write must come from this site's own pages. Other sites and missing origins are refused.
  if (!SAFE_METHODS.has(context.request.method) && !originAllowed(context.request.headers.get('origin'), siteOrigin())) {
    return secured(respond(403, 'Forbidden'), area);
  }

  if (isGatedPath(path) && !isPublicAuthPath(path)) {
    let signedIn = false;
    try {
      const token = context.cookies.get(sessionCookie(siteOrigin()).name)?.value;
      signedIn = (await readSession(await getDb(), token)) !== null;
    } catch {
      return secured(respond(503, 'Service unavailable'), area);
    }
    if (!signedIn) {
      const wantsPage = SAFE_METHODS.has(context.request.method) && !/^\/api\//i.test(path);
      const refusal = wantsPage ? new Response(null, { status: 303, headers: { location: '/dashboard/login' } }) : respond(401, 'Sign in required');
      return secured(refusal, area);
    }
  }

  try {
    return secured(await next(), area);
  } catch (error) {
    // The details go to the private server log. The visitor sees nothing about what went wrong.
    console.error(error);
    return secured(respond(500, 'Something went wrong'), area);
  }
});
