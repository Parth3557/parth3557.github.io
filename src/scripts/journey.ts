/**
 * The journey page's rally: as you scroll, the shuttle flies from milestone to milestone, drawing its
 * path, and each stop lights up as it lands. Every stop is fully readable without this.
 */
import { gsap } from '../lib/motion';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function flyThroughJourney(): () => void {
  const wrap = document.querySelector<HTMLElement>('.tl-wrap');
  const svg = document.querySelector<SVGSVGElement>('.tl__flight');
  const shuttle = document.querySelector<SVGUseElement>('#tl-shuttle');
  const ring = document.querySelector<SVGEllipseElement>('#tl-ring');
  const stops = gsap.utils.toArray<HTMLElement>('.tl__stop');
  const created: Element[] = [];
  const undo = () => created.forEach((el) => el.remove());
  if (!wrap || !svg || !shuttle || !ring || stops.length < 2) return undo;

  const box = wrap.getBoundingClientRect();
  const dots = stops.map((stop) => {
    const dot = stop.querySelector('.tl__dot')?.getBoundingClientRect();
    return { x: (dot?.left ?? 0) + (dot?.width ?? 0) / 2 - box.left, y: (dot?.top ?? 0) + (dot?.height ?? 0) / 2 - box.top };
  });
  svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);

  const wide = matchMedia('(min-width: 901px)').matches;
  const reach = wide ? Math.min(innerWidth * 0.2, 300) : 58;
  const isSmash = (i: number) => stops[i].dataset.smash !== undefined;

  const add = (attrs: Record<string, string | number>) => {
    const path = document.createElementNS(SVG_NS, 'path');
    Object.entries(attrs).forEach(([key, value]) => path.setAttribute(key, String(value)));
    svg.insertBefore(path, svg.firstChild);
    created.push(path);
    return path;
  };

  // Each shot swings out over the empty side of the row. On a phone it stays between the line and the text.
  const hops = dots.slice(1).map((to, i) => {
    const from = dots[i];
    const side = !wide || i % 2 === 0 ? 1 : -1;
    const lift = isSmash(i + 1) ? 0.55 : 1;
    const d = `M${from.x} ${from.y}Q${from.x + side * reach * lift} ${from.y + (to.y - from.y) * 0.45} ${to.x} ${to.y}`;
    const live = add({ class: 'hop-live', d, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 });
    add({ class: 'hop-ghost', d });
    return live;
  });

  gsap.set(stops.slice(1), { opacity: 0.22 });
  gsap.set(shuttle, { svgOrigin: '0 0', x: dots[0].x, y: dots[0].y, rotation: 90, scale: (wide ? 46 : 34) / 60 });

  const rally = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: stops[0].querySelector('.tl__dot'),
      start: 'center 62%',
      endTrigger: stops[stops.length - 1].querySelector('.tl__dot'),
      end: 'clamp(center 62%)',
      scrub: true,
    },
  });

  // Durations are the distance between stops, so the shuttle reaches each one as it crosses the same spot on screen.
  let at = 0;
  hops.forEach((path, i) => {
    const distance = dots[i + 1].y - dots[i].y;
    const smash = isSmash(i + 1);
    const ease = smash ? 'power3.in' : 'power1.inOut';
    const arrival = at + distance;
    const landing = stops[i + 1];

    rally
      .to(shuttle, { duration: distance, ease, motionPath: { path, autoRotate: true } }, at)
      .to(path, { strokeDashoffset: 0, duration: distance, ease }, at)
      .to(landing, { opacity: 1, duration: distance * 0.18 }, arrival - distance * 0.18);

    const rank = landing.querySelector<HTMLElement>('.stop-rank__n');
    const from = Number(rank?.dataset.from);
    const to = Number(rank?.dataset.to);
    if (rank && Number.isFinite(from) && Number.isFinite(to) && rank.dataset.from) {
      const state = { n: from };
      const show = () => {
        rank.textContent = Math.round(state.n).toLocaleString('en-US');
      };
      show();
      rally.to(state, { n: to, duration: distance * 0.4, ease: 'expo.out', onUpdate: show }, arrival - distance * 0.04);
    }

    if (smash) {
      const card = landing.querySelector('.tl__card');
      ring.setAttribute('cx', String(dots[i + 1].x));
      ring.setAttribute('cy', String(dots[i + 1].y));
      rally
        .call(() => {
          if (rally.scrollTrigger && rally.scrollTrigger.direction > 0 && card) {
            gsap.to(card, { keyframes: { x: [0, -8, 7, -4, 2, 0], y: [0, 6, -5, 3, -1, 0] }, duration: 0.42, ease: 'none', overwrite: 'auto' });
          }
        }, undefined, arrival)
        .fromTo(ring, { scale: 0.2, opacity: 0, svgOrigin: `${dots[i + 1].x} ${dots[i + 1].y}` }, { opacity: 0.9, duration: 1 }, arrival)
        .to(ring, { scale: 7, opacity: 0, duration: distance * 0.3, ease: 'expo.out' }, arrival + 1);
    }
    at = arrival;
  });
  return undo;
}
