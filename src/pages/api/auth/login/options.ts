import type { APIRoute } from 'astro';
import { saveChallenge } from '../../../../lib/server/enrollment';
import { authLimited, failure, json, setChallengeCookie } from '../../../../lib/server/http';
import { loginOptions } from '../../../../lib/server/passkeys';
import { getDb } from '../../../../lib/server/runtime';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  if (await authLimited(context)) return failure('Too many attempts. Wait a few minutes and try again.', 429);
  const options = await loginOptions();
  setChallengeCookie(context, await saveChallenge(await getDb(), options.challenge, 'login'));
  return json(options);
};
