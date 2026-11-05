import { describe, expect, test } from 'vitest';
import { cleanPath, countryCode, deviceClass, isBot, referrerHost, visitorOptedOut } from '../../src/lib/server/visit-input';

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Safari/604.1';

describe('cleanPath: only real routes are ever stored', () => {
  test.each([
    ['/', '/'],
    ['/journey', '/journey'],
    ['/projects', '/projects'],
    ['/projects/', '/projects'],
    ['/projects/rag-study-assistant', '/projects/rag-study-assistant'],
    ['/about', '/about'],
    ['/experience', '/experience'],
    ['/contact', '/contact'],
  ])('%s becomes %s', (input, expected) => {
    expect(cleanPath(input)).toBe(expected);
  });

  test.each([
    '/<script>alert(1)</script>',
    '/projects/<img src=x onerror=alert(1)>',
    '/projects/a/b',
    '/admin',
    '/dashboard',
    '/%2e%2e/%2e%2e/etc/passwd',
    "/projects/x' OR '1'='1",
    '/projects/' + 'a'.repeat(200),
    'https://evil.example/',
    '//evil.example',
    '',
  ])('rejects %s', (input) => {
    expect(cleanPath(input)).toBeNull();
  });

  test('rejects non-strings', () => {
    expect(cleanPath(undefined)).toBeNull();
    expect(cleanPath({ toString: () => '/' })).toBeNull();
  });
});

describe('referrerHost: reduced to a validated hostname', () => {
  test('keeps only the hostname, without www', () => {
    expect(referrerHost('https://www.linkedin.com/in/someone?x=1', 'parth3557.vercel.app')).toBe('linkedin.com');
  });

  test('a visit from the site itself is not a referrer', () => {
    expect(referrerHost('https://parth3557.vercel.app/projects', 'parth3557.vercel.app')).toBeNull();
  });

  test('script in the path cannot survive', () => {
    expect(referrerHost('https://evil.example/<script>alert(1)</script>', 'x.test')).toBe('evil.example');
  });

  test.each(['javascript:alert(1)', 'data:text/html,<script>1</script>', 'not a url', '', 'ftp://files.example/a'])('rejects %s', (input) => {
    expect(referrerHost(input, 'x.test')).toBeNull();
  });

  test('rejects non-strings and oversized input', () => {
    expect(referrerHost(42, 'x.test')).toBeNull();
    expect(referrerHost('https://' + 'a'.repeat(300) + '.example/', 'x.test')).toBeNull();
  });
});

describe('deviceClass', () => {
  test('recognises phones, tablets and desktops', () => {
    expect(deviceClass(IPHONE)).toBe('mobile');
    expect(deviceClass(IPAD)).toBe('tablet');
    expect(deviceClass(CHROME)).toBe('desktop');
  });
});

describe('isBot', () => {
  test.each(['Googlebot/2.1 (+http://www.google.com/bot.html)', 'curl/8.4', 'python-requests/2.32', 'Mozilla/5.0 HeadlessChrome/130.0', ''])('treats %s as a bot', (ua) => {
    expect(isBot(ua)).toBe(true);
  });

  test('a normal browser is not a bot', () => {
    expect(isBot(CHROME)).toBe(false);
    expect(isBot(IPHONE)).toBe(false);
  });
});

describe('countryCode', () => {
  test('accepts a two-letter code', () => {
    expect(countryCode('IN')).toBe('IN');
  });

  test.each(['in', 'IND', '<x>', '', null, undefined])('rejects %s', (value) => {
    expect(countryCode(value)).toBeNull();
  });
});

describe('visitorOptedOut', () => {
  test('honours Do Not Track and Global Privacy Control', () => {
    expect(visitorOptedOut(new Headers({ dnt: '1' }))).toBe(true);
    expect(visitorOptedOut(new Headers({ 'sec-gpc': '1' }))).toBe(true);
    expect(visitorOptedOut(new Headers())).toBe(false);
  });
});
