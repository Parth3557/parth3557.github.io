import type { APIRoute } from 'astro';
import { audit } from '../../../lib/server/enrollment';
import { clearSessionCookie, deviceOf, ownerSession, sessionToken } from '../../../lib/server/http';
import { getDb } from '../../../lib/server/runtime';
import { endAllSessions, endSession } from '../../../lib/server/sessions';

export const prerender = false;

/**
 * Ends this session, or every session when the form asks for it. Without a valid session it only
 * clears the cookie: an anonymous request must never end the owner's sessions or write to the database.
 */
export const POST: APIRoute = async (context) => {
  const session = await ownerSession(context);
  if (session) {
    const db = await getDb();
    const form = await context.request.formData().catch(() => null);
    if (form?.get('scope') === 'everywhere') {
      await endAllSessions(db);
      await audit(db, 'Signed out everywhere', deviceOf(context.request));
    } else {
      await endSession(db, sessionToken(context));
      await audit(db, 'Signed out', deviceOf(context.request));
    }
  }
  clearSessionCookie(context);
  return new Response(null, { status: 303, headers: { location: '/dashboard/login' } });
};
