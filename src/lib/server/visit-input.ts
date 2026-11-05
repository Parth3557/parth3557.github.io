/**
 * Everything arriving at the public visitor endpoint is untrusted, and it ends up on the owner's
 * dashboard. Each value is reduced to something that can't carry a payload, or it is dropped.
 */
const ROUTE = /^\/(?:(?:journey|about|experience|contact|projects(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?)\/?)?$/;
const HOST = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const BOT = /bot|crawl|spider|slurp|headless|curl|wget|python|httpclient|axios|node-fetch|go-http|java\/|libwww|scrapy|lighthouse|pagespeed|preview|monitor|facebookexternalhit/i;

/** Only paths of routes the site really has are stored. */
export function cleanPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 100 || !ROUTE.test(value)) return null;
  return value.length > 1 ? value.replace(/\/$/, '') : value;
}

/** A referrer is reduced to a validated hostname. The rest of the URL is thrown away. */
export function referrerHost(value: unknown, ownHost: string): string | null {
  if (typeof value !== 'string' || !value || value.length > 300) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host === ownHost.toLowerCase().replace(/^www\./, '') || host.length > 100 || !HOST.test(host)) return null;
  return host;
}

export function deviceClass(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
  if (/ipad|tablet|kindle|silk|android(?!.*mobile)/i.test(userAgent)) return 'tablet';
  if (/mobi|iphone|ipod|android/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

export function isBot(userAgent: string): boolean {
  return !userAgent || BOT.test(userAgent);
}

export function countryCode(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Z]{2}$/.test(value) ? value : null;
}

export function visitorOptedOut(headers: Headers): boolean {
  return headers.get('dnt') === '1' || headers.get('sec-gpc') === '1';
}
