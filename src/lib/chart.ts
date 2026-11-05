/** Geometry for the visitors chart. Drawn on the server, so the dashboard needs no chart library. */
export type DayCount = { day: string; visitors: number; views: number };

/** A rounded, even axis top. Even, so the middle label is always a whole number of people. */
export function niceMax(peak: number): number {
  if (peak <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  for (const step of [1, 2, 3, 4, 6, 8, 10]) {
    const top = step * magnitude;
    if (top >= peak && top % 2 === 0) return top;
  }
  return 10 * magnitude;
}

export function chartGeometry(series: readonly DayCount[], width = 1000, height = 300) {
  const peak = Math.max(0, ...series.map((point) => point.visitors));
  const max = niceMax(peak);
  const points = series.map((point, i) => ({
    ...point,
    x: series.length === 1 ? width / 2 : (i / (series.length - 1)) * width,
    y: height - (point.visitors / max) * height,
  }));
  const line = points.map((point, i) => `${i ? 'L' : 'M'}${point.x} ${point.y}`).join('');
  const last = points.at(-1)?.x ?? width;
  const first = points[0]?.x ?? 0;
  return {
    width,
    height,
    max,
    peak,
    points,
    line,
    area: `${line}L${last} ${height}L${first} ${height}Z`,
    ticks: [max, max / 2, 0],
    empty: peak === 0,
  };
}

const dayFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Stored days are plain calendar dates. Reading them as UTC keeps them from shifting by a day. */
export const shortDay = (day: string) => dayFormat.format(new Date(`${day}T00:00:00Z`));
