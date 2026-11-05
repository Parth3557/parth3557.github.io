/** Small helpers that turn stored values into words for the dashboard. */
const TIME_ZONE = 'Asia/Kolkata';
const number = new Intl.NumberFormat('en-IN');
const moment = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: TIME_ZONE });
const hourOfDay = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: TIME_ZONE });
const regions = new Intl.DisplayNames(['en'], { type: 'region' });

export const count = (value: number) => number.format(value);
export const when = (at: number) => moment.format(at);
export const plural = (value: number, word: string) => `${number.format(value).replace(/,/g, ',')} ${word}${value === 1 ? '' : 's'}`;

export function greetingFor(now: number): string {
  const hour = Number(hourOfDay.format(now));
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const RANGES = [7, 30, 90] as const;

/** Anything but the three offered ranges falls back to 30 days. The input never reaches a query. */
export function rangeFrom(value: string | null): (typeof RANGES)[number] {
  return RANGES.find((days) => String(days) === value) ?? 30;
}

export function countryName(code: string): string {
  try {
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
}

export const pageName = (path: string) => (path === '/' ? 'Home' : path);
