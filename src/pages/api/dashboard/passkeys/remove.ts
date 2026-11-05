import type { APIRoute } from 'astro';
import { audit, removeCredential } from '../../../../lib/server/enrollment';
import { deviceOf, failure, json, ownerSession, readJson } from '../../../../lib/server/http';
import { getDb } from '../../../../lib/server/runtime';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await ownerSession(context);
  if (!session) return failure('Sign in required', 401);
  if (!session.fresh) return failure('For safety, sign in again before removing a passkey.', 403);

  const body = await readJson(context.request, 1024);
  if (typeof body?.id !== 'string') return failure('Bad request', 400);

  const db = await getDb();
  if (!(await removeCredential(db, body.id))) return failure("That passkey can't be removed. You need at least one.", 400);
  await audit(db, 'Passkey removed', deviceOf(context.request));
  return json({ ok: true });
};
