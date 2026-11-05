import type { APIRoute } from 'astro';
import { audit, getCredential, markCredentialUsed, takeChallenge } from '../../../../lib/server/enrollment';
import { authLimited, deviceOf, failure, json, readChallengeCookie, readJson, setSessionCookie } from '../../../../lib/server/http';
import { verifyLogin } from '../../../../lib/server/passkeys';
import { getDb } from '../../../../lib/server/runtime';
import { createSession } from '../../../../lib/server/sessions';

export const prerender = false;

const MAX_BODY_BYTES = 16 * 1024;
// One message for every failure, so an attacker can't tell which check they failed.
const SIGN_IN_FAILED = 'Sign-in failed. Try again.';

export const POST: APIRoute = async (context) => {
  if (await authLimited(context)) return failure('Too many attempts. Wait a few minutes and try again.', 429);
  const device = deviceOf(context.request);
  const db = await getDb();
  const challenge = await takeChallenge(db, readChallengeCookie(context), 'login');
  const body = await readJson(context.request, MAX_BODY_BYTES);
  const response = body?.response as { id?: unknown } | undefined;
  if (!challenge || typeof response?.id !== 'string') return failure(SIGN_IN_FAILED, 400);

  const credential = await getCredential(db, response.id);
  if (!credential) {
    await audit(db, 'Failed sign-in', device);
    return failure(SIGN_IN_FAILED, 400);
  }
  try {
    const { verified, authenticationInfo } = await verifyLogin(response, challenge, credential);
    if (!verified) throw new Error('not verified');
    await markCredentialUsed(db, credential.id, authenticationInfo.newCounter);
  } catch {
    await audit(db, 'Failed sign-in', device);
    return failure(SIGN_IN_FAILED, 400);
  }
  // Always a brand-new token, so a session planted before login is worthless.
  setSessionCookie(context, await createSession(db, device));
  await audit(db, 'Signed in', device);
  return json({ ok: true });
};
