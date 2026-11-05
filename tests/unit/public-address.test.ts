import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { publicCsp } from '../../src/lib/public-csp';
import { publicSiteOrigin } from '../../src/lib/server/runtime';

describe('publicCsp', () => {
  const headers = JSON.parse(readFileSync('vercel.json', 'utf8')).headers[0].headers as { key: string; value: string }[];
  const headerPolicy = headers.find((header) => header.key === 'Content-Security-Policy')?.value ?? '';

  test('is the policy the headers carry, minus the one directive a page cannot set', () => {
    expect(headerPolicy).toContain("frame-ancestors 'none'; ");
    expect(publicCsp(undefined)).toBe(headerPolicy.replace("frame-ancestors 'none'; ", ''));
  });

  test('allows a visitor counter on another address, by its origin only', () => {
    expect(publicCsp('https://parth3557.vercel.app/api/collect')).toContain("connect-src 'self' https://parth3557.vercel.app;");
  });

  test.each([undefined, '', '/api/collect', 'not a url', 'javascript:alert(1)', 'ftp://files.example/x'])('adds nothing for %s', (value) => {
    expect(publicCsp(value)).toContain("connect-src 'self';");
  });

  test('a value cannot smuggle in another rule', () => {
    const policy = publicCsp("https://x.example/;script-src 'unsafe-inline' *");
    expect(policy).toContain("connect-src 'self' https://x.example;");
    expect(policy).not.toContain('unsafe-inline');
  });
});

describe('publicSiteOrigin', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('is the public address when one is set', () => {
    vi.stubEnv('SITE_ORIGIN', 'https://parth3557.vercel.app');
    vi.stubEnv('PUBLIC_SITE_ORIGIN', 'https://parth3557.github.io/');
    expect(publicSiteOrigin()).toBe('https://parth3557.github.io');
  });

  test('is the app itself when the pages live with it', () => {
    vi.stubEnv('SITE_ORIGIN', 'https://parth3557.vercel.app');
    vi.stubEnv('PUBLIC_SITE_ORIGIN', '');
    expect(publicSiteOrigin()).toBe('https://parth3557.vercel.app');
  });

  test('a mistyped address stops the app instead of opening a gap', () => {
    vi.stubEnv('PUBLIC_SITE_ORIGIN', 'parth3557.github.io');
    expect(() => publicSiteOrigin()).toThrow();
  });
});
