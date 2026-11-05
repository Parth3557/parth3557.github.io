import type { APIRoute } from 'astro';
import { audit, saveCredential, setupTokenValid, takeChallenge, useSetupToken } from '../../../../lib/server/enrollment';
import { authLimited, deviceOf, failure, json, ownerSession, readChallengeCookie, readJson, setSessionCookie } from '../../../../lib/server/http';
import { verifyRegistration } from '../../../../lib/server/passkeys';
import { getDb } from '../../../../lib/server/runtime';
import { createSession, endAllSessions } from '../../../../lib/server/sessions';

export const prerender = false;

const MAX_BODY_BYTES = 32 * 1024;
const FAILED = 'That passkey could not be saved. Try again.';

export const POST: APIRoute = async (context) => {
  if (await authLimited(context)) return failure('Too many attempts. Wait a few minutes and try again.', 429);
  const db = await getDb();
  const device = deviceOf(context.request);
  const body = await readJson(context.request, MAX_BODY_BYTES);
  const session = await ownerSession(context);
  const usingToken = await setupTokenValid(db, body?.token);
  if (!usingToken && !session?.fresh) return failure('Not allowed. Sign in again, or create a new setup link.', 403);

  const challenge = await takeChallenge(db, readChallengeCookie(context), 'register');
  if (!challenge || !body?.response) return failure(FAILED, 400);

  let credential;
  try {
    credential = await verifyRegistration(body.response, challenge);
  } catch {
    return failure(FAILED, 400);
  }
  if (!credential) return failure(FAILED, 400);

  // The token is spent atomically before anything is saved, so one link can't enroll two keys.
  if (usingToken && !(await useSetupToken(db, body.token))) return failure('Not allowed. Create a new setup link.', 403);

  const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 40) : 'Passkey';
  await saveCredential(db, { id: credential.id, publicKey: credential.publicKey, counter: credential.counter, transports: credential.transports ?? [], label });
  await audit(db, usingToken ? 'Passkey added with a setup link' : 'Passkey added', device);

  if (usingToken) {
    // A setup link may be recovering a lost device, so every older session ends here.
    await endAllSessions(db);
    setSessionCookie(context, await createSession(db, device));
  }
  return json({ ok: true });
};
