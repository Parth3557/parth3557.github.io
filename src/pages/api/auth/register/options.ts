import type { APIRoute } from 'astro';
import { listCredentials, saveChallenge, setupTokenValid } from '../../../../lib/server/enrollment';
import { authLimited, failure, json, ownerSession, readJson, setChallengeCookie } from '../../../../lib/server/http';
import { registrationOptions } from '../../../../lib/server/passkeys';
import { getDb } from '../../../../lib/server/runtime';

export const prerender = false;

/** Needs the one-time setup token, or a sign-in from the last few minutes. */
export const POST: APIRoute = async (context) => {
  if (await authLimited(context)) return failure('Too many attempts. Wait a few minutes and try again.', 429);
  const db = await getDb();
  const body = await readJson(context.request, 1024);
  const session = await ownerSession(context);
  if (!(await setupTokenValid(db, body?.token)) && !session?.fresh) return failure('Not allowed. Sign in again, or create a new setup link.', 403);

  const options = await registrationOptions(await listCredentials(db));
  setChallengeCookie(context, await saveChallenge(db, options.challenge, 'register'));
  return json(options);
};
