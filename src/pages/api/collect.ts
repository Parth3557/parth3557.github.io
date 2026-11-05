import type { APIContext, APIRoute } from 'astro';
import { collectCorsHeaders } from '../../lib/server/guards';
import { clientIp, json, ownerSession, readJson } from '../../lib/server/http';
import { memoryLimiter, overLimit } from '../../lib/server/rate-limit';
import { getDb, publicSiteOrigin } from '../../lib/server/runtime';
import { cleanPath, countryCode, deviceClass, isBot, referrerHost, visitorOptedOut } from '../../lib/server/visit-input';
import { clientKey, recordVisit, visitCapReached } from '../../lib/server/visits';

export const prerender = false;

const MAX_BODY_BYTES = 1024;
const MAX_VIEWS_PER_DAY = 20_000;
/** Browsers remember the answer to their advance check for this long, which saves a request per page view. */
const CORS_CACHE_SECONDS = '7200';
const burst = memoryLimiter(60, 60_000);
const accepted = () => new Response(null, { status: 204 });
const corsHeaders = (request: Request) => collectCorsHeaders(request.headers.get('origin'), publicSiteOrigin());

/** Counts a page view. It takes untrusted input, so every value is cleaned, and cheap checks run first. */
async function countVisit(context: APIContext): Promise<Response> {
  const { request } = context;
  const userAgent = request.headers.get('user-agent') ?? '';
  if (visitorOptedOut(request.headers) || isBot(userAgent)) return accepted();

  const body = await readJson(request, MAX_BODY_BYTES);
  const path = cleanPath(body?.path);
  if (!path) return json({ error: 'Bad request' }, 400);

  const ip = clientIp(context);
  if (burst(ip)) return json({ error: 'Too many requests' }, 429);

  try {
    const db = await getDb();
    if ((await ownerSession(context)) || (await visitCapReached(db, MAX_VIEWS_PER_DAY))) return accepted();
    if (await overLimit(db, `visit:${await clientKey(db, ip)}`, 60, 60)) return json({ error: 'Too many requests' }, 429);
    await recordVisit(db, {
      path,
      referrer: referrerHost(body?.referrer, new URL(publicSiteOrigin()).hostname),
      country: countryCode(request.headers.get('x-vercel-ip-country')),
      device: deviceClass(userAgent),
      ip,
      userAgent,
    });
  } catch {
    // Counting a visit must never break the visitor's page.
  }
  return accepted();
}

export const POST: APIRoute = async (context) => {
  const response = await countVisit(context);
  for (const [name, value] of Object.entries(corsHeaders(context.request))) response.headers.set(name, value);
  return response;
};

/** A browser asks first when the public pages live on another address. Nothing is read or counted here. */
export const OPTIONS: APIRoute = ({ request }) => {
  const cors = corsHeaders(request);
  if (!cors['Access-Control-Allow-Origin']) return new Response(null, { status: 403, headers: cors });
  return new Response(null, {
    status: 204,
    headers: { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': CORS_CACHE_SECONDS },
  });
};

export const ALL: APIRoute = () => json({ error: 'Method not allowed' }, 405);
