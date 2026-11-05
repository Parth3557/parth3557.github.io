import { describe, expect, test } from 'vitest';
import { countryName, greetingFor, pageName, plural, rangeFrom } from '../../src/lib/dashboard-format';

describe('greetingFor uses India time, wherever the server runs', () => {
  test.each([
    [Date.UTC(2026, 10, 5, 3, 0), 'Good morning'], // 08:30 IST
    [Date.UTC(2026, 10, 5, 8, 0), 'Good afternoon'], // 13:30 IST
    [Date.UTC(2026, 10, 5, 13, 0), 'Good evening'], // 18:30 IST
    [Date.UTC(2026, 10, 5, 20, 0), 'Still up'], // 01:30 IST
  ])('%i says %s', (now, expected) => {
    expect(greetingFor(now)).toBe(expected);
  });
});

describe('rangeFrom only accepts the three offered ranges', () => {
  test.each([
    ['7', 7],
    ['30', 30],
    ['90', 90],
    [null, 30],
    ['365', 30],
    ['-1', 30],
    ['7 OR 1=1', 30],
    ['<script>', 30],
  ])('%s gives %i', (value, expected) => {
    expect(rangeFrom(value)).toBe(expected);
  });
});

describe('countryName', () => {
  test('spells out a code', () => {
    expect(countryName('IN')).toBe('India');
    expect(countryName('US')).toBe('United States');
  });

  test('falls back to the code itself instead of throwing', () => {
    expect(countryName('not-a-code')).toBe('not-a-code');
  });
});

describe('pageName', () => {
  test('names the home page and leaves other paths alone', () => {
    expect(pageName('/')).toBe('Home');
    expect(pageName('/projects')).toBe('/projects');
  });
});

describe('plural', () => {
  test('counts in words', () => {
    expect(plural(0, 'visitor')).toBe('0 visitors');
    expect(plural(1, 'visitor')).toBe('1 visitor');
    expect(plural(1234, 'view')).toBe('1,234 views');
  });
});
