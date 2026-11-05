import { describe, expect, test } from 'vitest';
import { chartGeometry, niceMax, shortDay } from '../../src/lib/chart';

const day = (visitors: number, i = 0) => ({ day: `2026-11-0${i + 1}`, visitors, views: visitors * 2 });

describe('niceMax: an even, rounded top for the axis, so the middle label is a whole number', () => {
  test.each([
    [0, 4],
    [3, 4],
    [4, 4],
    [5, 6],
    [9, 10],
    [10, 10],
    [11, 20],
    [26, 30],
    [73, 80],
    [100, 100],
    [140, 200],
    [1234, 2000],
  ])('peak %i gives %i', (peak, expected) => {
    expect(niceMax(peak)).toBe(expected);
    expect(niceMax(peak) % 2).toBe(0);
    expect(niceMax(peak)).toBeGreaterThanOrEqual(peak);
  });
});

describe('chartGeometry', () => {
  test('points span the full width, with the top value at the top', () => {
    const { points, max } = chartGeometry([day(0, 0), day(2, 1), day(4, 2)], 1000, 300);
    expect(max).toBe(4);
    expect(points.map((point) => [point.x, point.y])).toEqual([[0, 300], [500, 150], [1000, 0]]);
  });

  test('line and area paths use those points, and the area closes on the baseline', () => {
    const { line, area } = chartGeometry([day(0, 0), day(4, 1)], 100, 50);
    expect(line).toBe('M0 50L100 0');
    expect(area).toBe('M0 50L100 0L100 50L0 50Z');
  });

  test('axis labels are 0, the middle and the top', () => {
    expect(chartGeometry([day(73)]).ticks).toEqual([80, 40, 0]);
  });

  test('a single day sits in the middle instead of dividing by zero', () => {
    const { points } = chartGeometry([day(1)], 1000, 300);
    expect(points[0].x).toBe(500);
    expect(Number.isFinite(points[0].y)).toBe(true);
  });

  test('reports when there is nothing to show', () => {
    expect(chartGeometry([day(0), day(0, 1)]).empty).toBe(true);
    expect(chartGeometry([day(0), day(1, 1)]).empty).toBe(false);
  });
});

describe('shortDay', () => {
  test('formats a stored day for people, without shifting it by time zone', () => {
    expect(shortDay('2026-11-05')).toBe('5 Nov');
    expect(shortDay('2026-01-31')).toBe('31 Jan');
  });
});
