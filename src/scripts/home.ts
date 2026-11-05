/**
 * The rally: the court draws itself, the shuttle's last shot traces the "?", the smash lands, and
 * scrolling carries the shuttle through the journey. Everything is readable without any of this.
 */
import { CustomEase, ScrollTrigger, SplitText, fontsReady, fullMotion, gsap, startSmoothScroll, whenVisible } from '../lib/motion';
import type { Lenis } from '../lib/motion';
import { setupAnchors } from './anchors';
import { startPointerEffects } from './chrome';
import { setupMenu } from './menu';
import { themeToggle } from './theme-toggle';

const PORTRAIT = '(max-aspect-ratio: 1/1), (max-width: 760px)';
const SHORT = '((max-aspect-ratio: 1/1) or (max-width: 760px)) and (max-height: 720px), (min-aspect-ratio: 1/1) and (min-width: 761px) and (max-height: 500px)';
const REDUCED = '(prefers-reduced-motion: reduce)';
const SVG_NS = 'http://www.w3.org/2000/svg';
const HOOK = 'M36 176C36 88 94 32 166 32 240 32 288 86 288 152 288 214 248 248 208 282 176 310 160 340 160 392L160 452';

function $<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`Missing element: ${selector}`);
  return found;
}

const asNumber = (value: string | undefined) => {
  const parsed = Number(value);
  return value && Number.isFinite(parsed) ? parsed : null;
};

/** Screen coordinates are the SVG's units, and portrait swaps the court's axes. */
function drawCourt(portrait: boolean) {
  const viewBox = portrait ? '0 0 610 1340' : '0 0 1340 610';
  $('.plan').setAttribute('viewBox', viewBox);
  $('.fx').setAttribute('viewBox', viewBox);
  if (portrait) $('#lines').setAttribute('transform', 'matrix(0 1 1 0 0 0)');
  else $('#lines').removeAttribute('transform');

  // The line the name stands on and the shuttle lands on. The "?" is drawn in a 306x640 box
  // whose bottom edge sits on this line, so the shuttle's cork becomes the dot of the "?".
  const WIDTH = portrait ? 610 : 1340;
  const GROUND = portrait ? 868 : 564;
  const MARK_SCALE = portrait ? 0.85 : 0.78125;
  const MARK_RIGHT = portrait ? 600 : 1264;
  const markX = (x: number) => MARK_RIGHT - (306 - x) * MARK_SCALE;
  const markY = (y: number) => GROUND - (640 - y) * MARK_SCALE;
  const REST_SIZE = 2.25 * MARK_SCALE; // makes the cork as wide as the stroke of the "?"
  const REST = { x: markX(160), y: GROUND - 30 * REST_SIZE };

  const hook = $<SVGPathElement>('#hook');
  const ground = $('#ground');
  hook.setAttribute('d', HOOK.replace(/(\d+) (\d+)/g, (_, x, y) => `${markX(+x)} ${markY(+y)}`));
  hook.setAttribute('stroke-width', String(36 * MARK_SCALE));
  ground.setAttribute('x2', String(WIDTH));
  ground.setAttribute('y1', String(GROUND));
  ground.setAttribute('y2', String(GROUND));
  $('#ball').setAttribute('transform', `translate(${REST.x} ${REST.y})`);
  $('#bird').setAttribute('transform', `rotate(90) scale(${REST_SIZE})`);

  return { WIDTH, GROUND, REST, REST_SIZE, markX, markY };
}

type Page = {
  signal: AbortSignal;
  ctx: gsap.Context;
  portrait: boolean;
  shortScreen: boolean;
  lenis: () => Lenis | null;
  finishIntro: () => void;
  /** Elements created at runtime, removed again on cleanup. */
  created: Element[];
};

/** Clicking Projects opens a panel of all the cards, which also works with reduced motion. */
function setupGlimpse(page: Page) {
  const { signal, ctx } = page;
  const panel = $<HTMLDialogElement>('#glimpse');
  const section = $('#projects');
  const sheet = $('.glimpse__sheet', panel);
  const shade = $('.glimpse__shade', panel);
  const flyer = $('#shuttle3');
  let opening: gsap.core.Timeline | null = null;
  let tilt: gsap.core.Tween | null = null;
  let closing = false;

  // The cards are copied on first use, which keeps the page's start-up light.
  function cardStrip() {
    const empty = panel.querySelector('[data-glimpse-cards]');
    if (empty) {
      const copy = $('.cards', section).cloneNode(true) as HTMLElement;
      // The originals may be waiting for their scroll reveal. The copies start clean.
      copy.querySelectorAll('.card').forEach((card) => card.removeAttribute('style'));
      empty.replaceWith(copy);
    }
    return $('.cards', panel);
  }

  function open(event: MouseEvent) {
    page.finishIntro();
    page.lenis()?.stop();
    const strip = cardStrip();
    const cards = gsap.utils.toArray<HTMLElement>(strip.children);
    panel.showModal();
    strip.scrollLeft = 0;
    if (!fullMotion()) return;

    const from = { x: event.clientX || innerWidth / 2, y: event.clientY || 40 };
    const shot = $('.card__shot', cards[0]).getBoundingClientRect();
    const land = { x: shot.left + 34, y: shot.top + 8 };

    // The camera tips back as the panel rises, and the shuttle carries the click onto the first card.
    ctx.add(() => {
      if (scrollY < 40) tilt = gsap.to('.court', { rotationX: '+=14', duration: 0.8, ease: 'expo.out' });
      gsap.set(flyer, { svgOrigin: '0 0', scale: 0.9, autoAlpha: 1 });
      opening = gsap.timeline()
        .fromTo(shade, { opacity: 0 }, { opacity: 0.55, duration: 0.35, ease: 'power1.out' }, 0)
        .fromTo(sheet, { yPercent: 100 }, { yPercent: 0, duration: 0.8, ease: 'expo.out' }, 0)
        .fromTo(cards, { x: 140, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.9, ease: 'expo.out', stagger: 0.055 }, 0.1)
        .to(flyer, {
          duration: 0.75,
          ease: 'power2.in',
          motionPath: { path: `M${from.x} ${from.y}Q${(from.x + land.x) / 2} ${Math.min(from.y, land.y) - 90} ${land.x} ${land.y}`, autoRotate: true },
        }, 0)
        .to(flyer, { autoAlpha: 0, duration: 0.2 }, 0.75);
    });
  }

  function close(afterClose?: () => void) {
    if (!panel.open || closing) return;
    const done = () => {
      panel.close();
      closing = false;
      page.lenis()?.start();
      afterClose?.();
    };
    if (!fullMotion()) return done();

    closing = true;
    opening?.kill();
    tilt?.reverse();
    ctx.add(() => {
      gsap.set(flyer, { autoAlpha: 0 });
      gsap.timeline({ onComplete: done })
        .to(sheet, { yPercent: 100, duration: 0.45, ease: 'power3.in' }, 0)
        .to(shade, { opacity: 0, duration: 0.4, ease: 'power1.in' }, 0.05);
    });
  }

  document.querySelectorAll<HTMLAnchorElement>('[data-glimpse]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    open(event);
  }, { signal }));
  $('[data-glimpse-close]', panel).addEventListener('click', () => close(), { signal });
  shade.addEventListener('click', () => close(), { signal });
  panel.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  }, { signal });
  $('[data-glimpse-all]', panel).addEventListener('click', (event) => {
    event.preventDefault();
    close(() => {
      const lenis = page.lenis();
      if (lenis) lenis.scrollTo(section, { immediate: true });
      else section.scrollIntoView();
    });
  }, { signal });

  // A mouse wheel moves the strip sideways. Trackpads and touch already can.
  panel.addEventListener('wheel', (event) => {
    const strip = (event.target as Element).closest<HTMLElement>('.cards');
    if (strip && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      strip.scrollLeft += event.deltaY;
      event.preventDefault();
    }
  }, { passive: false, signal });
}

const INTRO_SEEN = 'pj_intro_seen';

/** The rally plays once a visit, so coming back from another page doesn't make anyone sit through it again. */
function introSeen(): boolean {
  try {
    return sessionStorage.getItem(INTRO_SEEN) === '1';
  } catch {
    return false;
  }
}

function rememberIntro(): void {
  try {
    sessionStorage.setItem(INTRO_SEEN, '1');
  } catch {
    // Storage can be refused. The rally just plays again next time.
  }
}

const nextFrame = () => new Promise<void>((resolve) => {
  requestAnimationFrame(() => resolve());
});

/**
 * Scroll tips the camera to a broadcast view, then the shuttle lifts away into the journey. Built a
 * piece per frame, so a slow phone never freezes for all of it at once.
 */
async function setupScroll(page: Page, pos: { y: number; angle: number }, draw: () => void) {
  const { ctx, portrait, shortScreen, signal } = page;

  if (!shortScreen) {
    ctx.add(() => {
      gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: '.runway', start: 'top top', end: 'bottom bottom', scrub: true },
      })
        // Pivots on the near edge, so the text below the court never grows off the sides of the screen.
        .to('.court', { rotationX: portrait ? 54 : 64, scale: portrait ? 0.92 : 0.98, transformOrigin: portrait ? '50% 100%' : '50% 112%', duration: 1 }, 0)
        .to(pos, { angle: -90, duration: 0.12, onUpdate: draw }, 0.55)
        .to(pos, { y: -320, duration: 0.45, ease: 'power2.in', onUpdate: draw }, 0.55);
    });
  }

  await nextFrame();
  if (signal.aborted) return;
  ctx.add(() => {
    const projectCards = gsap.utils.toArray<HTMLElement>('#projects .card');
    gsap.set(projectCards, { y: 36, autoAlpha: 0 });
    ScrollTrigger.batch(projectCards, {
      start: 'top 90%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { y: 0, autoAlpha: 1, duration: 0.9, ease: 'expo.out', stagger: 0.07 }),
    });
  });

  await nextFrame();
  if (signal.aborted) return;
  ctx.add(() => {
    const homeCards = document.querySelector('.work__more');
    if (homeCards) gsap.from(homeCards, { y: 18, autoAlpha: 0, duration: 0.8, ease: 'expo.out', scrollTrigger: { trigger: homeCards, start: 'top 94%', once: true } });
    if (!document.querySelector('.resume')) return;
    gsap.from('.resume__text > *', {
      y: 22,
      autoAlpha: 0,
      duration: 0.8,
      ease: 'expo.out',
      stagger: 0.08,
      scrollTrigger: { trigger: '.resume', start: 'top 78%', once: true },
    });
    if (document.querySelector('.resume__page')) {
      gsap.from('.resume__page', {
        y: 64,
        autoAlpha: 0,
        duration: 1,
        ease: 'expo.out',
        scrollTrigger: { trigger: '.resume', start: 'top 72%', once: true },
      });
    }
  });

  await nextFrame();
  if (signal.aborted) return;
  ctx.add(() => {
    // The last shot: the question rises out of its own baseline, then the ways to answer it follow.
    const title = SplitText.create('.contact__title', { type: 'chars', mask: 'chars' });
    gsap.from(title.chars, {
      yPercent: 105,
      duration: 0.9,
      ease: 'expo.out',
      stagger: 0.022,
      scrollTrigger: { trigger: '.contact', start: 'top 74%', once: true },
    });
    gsap.from('.contact [data-reveal-contact]', {
      y: 22,
      autoAlpha: 0,
      duration: 0.8,
      ease: 'expo.out',
      stagger: 0.09,
      scrollTrigger: { trigger: '.contact', start: 'top 62%', once: true },
    });
  });

  // A short screen reads the journey as a plain list.
  if (!shortScreen) {
    await nextFrame();
    if (signal.aborted) return;
    ctx.add(() => setupJourney(page));
  }

  await nextFrame();
  if (signal.aborted) return;
  ScrollTrigger.refresh();
}

function setupJourney(page: Page) {
  const shuttle = $<SVGUseElement>('#shuttle2');
  const section = $('.stops');
  const stage = $('.stops__sticky');
  const svg = $<SVGSVGElement>('.stops__flight');
  const stops = gsap.utils.toArray<HTMLElement>('.stop');
  if (stops.length === 0) return;

  const stageBox = stage.getBoundingClientRect();
  const dots = stops.map((stop) => {
    const dot = $('.stop__dot', stop).getBoundingClientRect();
    return { x: dot.left + dot.width / 2 - stageBox.left, y: dot.top + dot.height / 2 - stageBox.top };
  });
  svg.setAttribute('viewBox', `0 0 ${stageBox.width} ${stageBox.height}`);

  const vertical = matchMedia('(max-width: 1000px)').matches;
  const SHUTTLE_PX = vertical ? 34 : 46;
  const add = (name: string, attrs: Record<string, string | number>) => {
    const el = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
    svg.insertBefore(el, svg.firstChild);
    page.created.push(el);
    return el;
  };

  const isSmash = (i: number) => stops[i].dataset.smash !== undefined;
  const hops = dots.slice(1).map((to, i) => {
    const from = dots[i];
    // On phones the arcs stay in the channel between the line and the text.
    const control = vertical
      ? `${from.x + 70} ${(from.y + to.y) / 2}`
      : `${(from.x + to.x) / 2} ${from.y - (isSmash(i + 1) ? 40 : 170)}`;
    const d = `M${from.x} ${from.y}Q${control} ${to.x} ${to.y}`;
    // add() prepends, so adding the live arc first leaves the dotted guide underneath it.
    const live = add('path', { class: 'hop-live', d, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 });
    add('path', { class: 'hop-ghost', d });
    return live as SVGPathElement;
  });

  gsap.set(stops.slice(1), { opacity: 0.22 });
  gsap.set(shuttle, { svgOrigin: '0 0', x: dots[0].x, y: -80, scale: SHUTTLE_PX / 60 });

  const rally = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        shuttle.style.visibility = self.progress > 0 ? 'visible' : 'hidden';
      },
    },
  });

  // It comes back down from the high clear onto the first stop.
  rally.to(shuttle, {
    duration: 0.6,
    ease: 'power2.in',
    motionPath: { path: `M${dots[0].x + 260} -80Q${dots[0].x + 120} ${dots[0].y * 0.3} ${dots[0].x} ${dots[0].y}`, autoRotate: true },
  }, 0);

  const hopStart = (i: number) => 0.75 + i * 1.5;
  hops.forEach((path, i) => {
    const smash = isSmash(i + 1);
    const ease = smash ? 'power3.in' : 'power2.inOut';
    const at = hopStart(i);
    const duration = smash ? 0.8 : 1;
    rally
      .to(shuttle, { duration, ease, motionPath: { path, autoRotate: true } }, at)
      .to(path, { strokeDashoffset: 0, duration, ease }, at)
      .to(stops[i + 1], { opacity: 1, duration: 0.3 }, at + 0.7);
  });

  // Each rank falls from the size of that year's field to the place the team finished, as the shuttle lands.
  stops.forEach((stop, i) => {
    const el = stop.querySelector<HTMLElement>('.stop-rank__n');
    const from = asNumber(el?.dataset.from);
    const to = asNumber(el?.dataset.to);
    if (!el || from === null || to === null) return;
    const state = { n: from };
    const show = () => {
      el.textContent = Math.round(state.n).toLocaleString('en-US');
    };
    show();
    const landing = i === 0 ? 0.6 : hopStart(i - 1) + (isSmash(i) ? 0.8 : 0.75);
    rally.to(state, { n: to, duration: 0.9, ease: 'expo.out', onUpdate: show }, landing);
  });

  const smashStop = stops.findIndex((stop) => stop.dataset.smash !== undefined);
  if (smashStop > 0) {
    const hit = hopStart(smashStop - 1) + 0.8;
    const ring = $('#smash-ring');
    ring.setAttribute('cx', String(dots[smashStop].x));
    ring.setAttribute('cy', String(dots[smashStop].y));
    rally
      .call(() => {
        if (rally.scrollTrigger && rally.scrollTrigger.direction > 0) {
          gsap.to('.stops__list', { keyframes: { x: [0, -8, 7, -4, 2, 0], y: [0, 6, -5, 3, -1, 0] }, duration: 0.42, ease: 'none' });
        }
      }, undefined, hit)
      .fromTo(ring, { scale: 0.2, opacity: 0, svgOrigin: `${dots[smashStop].x} ${dots[smashStop].y}` }, { opacity: 0.9, duration: 0.01 }, hit)
      .to(ring, { scale: 7, opacity: 0, duration: 0.7, ease: 'expo.out' }, hit + 0.01);
  }
  rally.to({}, { duration: 0.5 });
}

/** The intro timeline. It returns once it's built, and plays straight through or jumps to the end. */
function buildIntro(page: Page, court: ReturnType<typeof drawCourt>, onScrollReady: (pos: { y: number; angle: number }, draw: () => void) => void) {
  const { portrait } = page;
  const { WIDTH, GROUND, REST, REST_SIZE, markX, markY } = court;
  const toScreen = (u: number, v: number): [number, number] => (portrait ? [v, u] : [u, v]);

  const hook = $<SVGPathElement>('#hook');
  const ground = $('#ground');
  const ball = $('#ball');
  const bird = $('#bird');
  const shade = $('#shade');
  const bbox = $('#bbox');
  const tag = $('#tag');
  const trail = $('#trail');
  const hits = $('#hits');
  const tail = $<SVGPathElement>('#tail');
  const flightPath = $<SVGPathElement>('#flight');
  const pulse = $('#pulse');
  const fx = $('.fx');
  const unit = gsap.utils.clamp(0, 1);
  const rings = gsap.utils.toArray<SVGEllipseElement>('.fx .ring');
  const unitsPerPx = WIDTH / $('.court').getBoundingClientRect().width;
  const RALLY_SIZE = portrait ? 1.3 : 1;
  const tagLabel = tag.dataset.label ?? '';
  tag.setAttribute('font-size', String(12 * unitsPerPx));
  gsap.set(shade, { visibility: 'visible' });
  gsap.set([bbox, tag], { opacity: 1 });

  // Off the racket fast, hangs at the top of the hook, then the smash down the stem.
  CustomEase.create('rally', 'M0,0 C0.1,0.32 0.2,0.42 0.38,0.5 0.58,0.58 0.74,0.64 1,1');

  // Portrait mirrors the rally end for end, so the last shot climbs up into the "?".
  const end = (u: number) => (portrait ? 1340 - u : u);
  const START = toScreen(end(150), 470);
  const SHOTS = [
    { to: toScreen(end(1185), 130), height: 0.85, time: 0.46 },
    { to: toScreen(end(205), 110), height: 1, time: 0.42 },
  ];
  const FLIGHT_TIME = 1.5;
  const COMET = 300;

  const last = SHOTS[SHOTS.length - 1].to;
  const hookStart = { x: markX(36), y: markY(176) };
  const tailD = portrait
    ? `M${last[0]} ${last[1]}C${last[0]} ${last[1] - 340} ${hookStart.x} ${hookStart.y + 290} ${hookStart.x} ${hookStart.y}`
    : `M${last[0]} ${last[1]}C${last[0] + 600} ${last[1] + 190} ${hookStart.x} ${hookStart.y + 150} ${hookStart.x} ${hookStart.y}`;
  const hookD = hook.getAttribute('d') ?? '';
  tail.setAttribute('d', tailD);
  flightPath.setAttribute('d', `${tailD}${hookD.replace(/^M[^C]+/, '')}L${REST.x} ${REST.y}`);
  const tailLength = tail.getTotalLength();
  const hookLength = hook.getTotalLength();
  const flightLength = flightPath.getTotalLength();
  hook.style.strokeDasharray = '1 1';

  const pos = { x: START[0], y: START[1], height: 0, squash: 0, size: RALLY_SIZE, angle: 0, auto: true, trailing: true };
  let lastX: number | null = null;
  let lastY: number | null = null;
  let points: Array<[number, number]> = [];

  // Draws one frame of the tracked shuttle: position, apparent height, shadow and tight box.
  function draw() {
    if (pos.auto && lastX !== null && lastY !== null && Math.hypot(pos.x - lastX, pos.y - lastY) > 0.5) {
      pos.angle = Math.atan2(pos.y - lastY, pos.x - lastX) * 180 / Math.PI;
    }
    const previous = points[points.length - 1];
    if (pos.trailing && (!previous || Math.hypot(pos.x - previous[0], pos.y - previous[1]) > 16)) {
      points.push([pos.x, pos.y]);
      trail.setAttribute('points', points.join(' '));
    }
    lastX = pos.x;
    lastY = pos.y;

    const scale = pos.size * (1 + pos.height * 0.6);
    const radians = pos.angle * Math.PI / 180;
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    const w = (cos * 60 + sin * 36) * scale + 12;
    const h = (sin * 60 + cos * 36) * scale + 12;

    ball.setAttribute('transform', `translate(${pos.x} ${pos.y})`);
    bird.setAttribute('transform', `rotate(${pos.angle}) scale(${scale * (1 - pos.squash * 0.2)} ${scale * (1 + pos.squash * 0.14)})`);
    shade.setAttribute('transform', `translate(${8 + pos.height * 44} ${10 + pos.height * 56}) scale(${pos.size * (1 - pos.height * 0.3)})`);
    bbox.setAttribute('x', String(-w / 2));
    bbox.setAttribute('y', String(-h / 2));
    bbox.setAttribute('width', String(w));
    bbox.setAttribute('height', String(h));
    // Near the right edge the label hangs from the box's other corner, so it never clips.
    const flip = pos.x > WIDTH * 0.62;
    tag.setAttribute('text-anchor', flip ? 'end' : 'start');
    tag.setAttribute('x', String(flip ? w / 2 : -w / 2));
    tag.setAttribute('y', String(-h / 2 - 5 * unitsPerPx));
  }

  // Keeps the thin trail and the "?" locked to the shuttle's place on the path.
  function followFlight(travelled: number) {
    const head = unit(travelled / tailLength);
    const back = unit((travelled - COMET) / tailLength);
    tail.style.strokeDasharray = `${head - back} 2`;
    tail.style.strokeDashoffset = String(-back);
    tail.style.visibility = head > back ? 'visible' : 'hidden'; // a zero-length round cap still draws a dot
    hook.style.visibility = travelled > tailLength ? 'visible' : 'hidden';
    hook.style.strokeDashoffset = String(1 - unit((travelled - tailLength) / hookLength));
  }

  const rank = $('.rank__n');
  const rankFrom = asNumber(rank.dataset.from);
  const rankTo = asNumber(rank.dataset.to);
  const count = { n: rankTo ?? 0 };
  const showCount = () => {
    rank.textContent = Math.round(count.n).toLocaleString('en-US');
  };
  const nameLines = gsap.utils.toArray<HTMLElement>('.name__line');
  // The heading carries the full name as its label, so a screen reader never hears single letters.
  const firstName = SplitText.create(nameLines[0], { type: 'chars', aria: 'hidden' }).chars;
  const lastName = SplitText.create(nameLines[1], { type: 'chars', aria: 'hidden' }).chars;
  const fontSize = parseFloat(getComputedStyle($('.name')).fontSize);
  const lines = gsap.utils.toArray<SVGLineElement>('#lines line:not(#net)');

  rings.forEach((ring) => {
    ring.setAttribute('cx', String(REST.x));
    ring.setAttribute('cy', String(GROUND));
  });
  pulse.setAttribute('x1', '0');
  pulse.setAttribute('x2', String(REST.x));
  pulse.setAttribute('y1', String(GROUND));
  pulse.setAttribute('y2', String(GROUND));

  const fly = { travelled: 0 };
  const intro = gsap.timeline({ paused: true });

  // 1. The court draws itself.
  intro.fromTo('#surface', { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power1.out' }, 0);
  lines.forEach((line, i) => {
    const [x1, y1, , y2] = ['x1', 'y1', 'x2', 'y2'].map((name) => Number(line.getAttribute(name)));
    const axis = y1 === y2 ? 'scaleX' : 'scaleY';
    intro.fromTo(line, { [axis]: 0, svgOrigin: `${x1} ${y1}` }, { [axis]: 1, duration: 0.6, ease: 'expo.inOut' }, 0.02 + i * 0.022);
  });
  intro
    .fromTo('#net', { scaleY: 0, svgOrigin: '670 305' }, { scaleY: 1, duration: 0.4, ease: 'back.out(2)' }, 0.34)
    .fromTo(ground, { scaleX: 0, svgOrigin: `0 ${GROUND}` }, { scaleX: 1, duration: 0.7, ease: 'expo.inOut' }, 0.06)
    .set(ball, { visibility: 'visible' }, 0.44);

  // 2. The rally: each exchange brings up part of the name.
  let t = 0.48;
  const shotStart: number[] = [];
  SHOTS.forEach((shot, i) => {
    shotStart[i] = t;
    intro
      .to(pos, { x: shot.to[0], y: shot.to[1], duration: shot.time, ease: 'power2.out', onUpdate: draw }, t)
      .to(pos, { height: shot.height, duration: shot.time * 0.45, ease: 'power2.out' }, t)
      .to(pos, { height: 0.12, duration: shot.time * 0.55, ease: 'power2.in' }, t + shot.time * 0.45)
      .call(() => {
        const dot = document.createElementNS(SVG_NS, 'circle');
        dot.setAttribute('cx', String(shot.to[0]));
        dot.setAttribute('cy', String(shot.to[1]));
        dot.setAttribute('r', String(3.5 * unitsPerPx));
        hits.append(dot);
      }, undefined, t + shot.time);
    t += shot.time;
  });

  const rise = { yPercent: 0, duration: 0.7, ease: 'expo.out', stagger: 0.024 };
  const enter = { y: 0, autoAlpha: 1, duration: 0.8, ease: 'expo.out' };
  intro
    .fromTo(firstName, { yPercent: 105 }, rise, shotStart[0] + 0.06)
    .fromTo(lastName, { yPercent: 105 }, rise, shotStart[1] + 0.06);

  // 3. The last shot goes high: its flight draws the "?" and the smash comes down the stem.
  const flightStart = t;
  intro
    .call(() => {
      pos.trailing = false;
    }, undefined, flightStart)
    .to(fly, {
      travelled: flightLength,
      duration: FLIGHT_TIME,
      ease: 'rally',
      onUpdate() {
        const point = flightPath.getPointAtLength(fly.travelled);
        pos.x = point.x;
        pos.y = point.y;
        followFlight(fly.travelled);
        draw();
      },
    }, flightStart)
    .to(pos, { size: REST_SIZE, duration: FLIGHT_TIME, ease: 'power2.in' }, flightStart)
    .to(pos, { height: 0.9, duration: FLIGHT_TIME * 0.5, ease: 'power2.out' }, flightStart)
    .to(pos, { height: 0, duration: FLIGHT_TIME * 0.5, ease: 'power2.in' }, flightStart + FLIGHT_TIME * 0.5)
    .to([trail, hits], { opacity: 0, duration: 0.6, ease: 'power1.out' }, flightStart + 0.15)
    .fromTo('.who', { y: 16, autoAlpha: 0 }, enter, flightStart + 0.28)
    .addLabel('impact', flightStart + FLIGHT_TIME)

    // 4. The smash: everything answers the hit at once.
    .call(() => {
      pos.auto = false;
      pos.angle = 90;
      fx.classList.add('is-smash');
      tag.textContent = 'in';
    }, undefined, 'impact')
    .to(shade, { opacity: 0, duration: 0.15 }, 'impact')
    .to('.court', { keyframes: { x: [0, -10, 8, -5, 3, 0], y: [0, 7, -6, 3, -1, 0], easeEach: 'sine.inOut' }, duration: 0.46, ease: 'none' }, 'impact')
    .fromTo(rings, { scale: 0.15, opacity: 0, svgOrigin: `${REST.x} ${GROUND}` }, { opacity: 0.95, duration: 0.01 }, 'impact')
    .to(rings, { scale: 5.5, opacity: 0, duration: 0.95, ease: 'expo.out', stagger: 0.08 }, 'impact+=0.01')
    .fromTo(pos, { squash: 1 }, { squash: 0, duration: 0.6, ease: 'elastic.out(1, .4)', onUpdate: draw, immediateRender: false }, 'impact')
    .to(pos, {
      keyframes: [
        { y: REST.y - 42, angle: 81, duration: 0.17, ease: 'power2.out' },
        { y: REST.y, angle: 95, duration: 0.2, ease: 'power2.in' },
        { y: REST.y - 8, angle: 88, duration: 0.09, ease: 'power1.out' },
        { y: REST.y, angle: 90, duration: 0.12, ease: 'power1.in' },
      ],
      onUpdate: draw,
    }, 'impact')
    // The hit runs along the court line and through the name, nearest letter first.
    .fromTo(pulse, { scaleX: 0, opacity: 0, svgOrigin: `${REST.x} ${GROUND}` }, { scaleX: 1, opacity: 1, duration: 0.6, ease: 'power3.out' }, 'impact')
    .to(pulse, { opacity: 0, duration: 0.35, ease: 'power1.in' }, 'impact+=0.3')
    .to(lastName, {
      keyframes: [
        { y: -fontSize * 0.09, duration: 0.12, ease: 'power2.out' },
        { y: 0, duration: 0.42, ease: 'bounce.out' },
      ],
      stagger: { each: 0.018, from: 'end' },
    }, 'impact')
    .fromTo('.rank', { y: 18, autoAlpha: 0 }, { ...enter, immediateRender: false }, 'impact');

  // A rank is climbed, not counted, so the number falls from the size of the field to the final place.
  if (rankFrom !== null && rankTo !== null) {
    intro.fromTo(count, { n: rankFrom }, { n: rankTo, duration: 1.2, ease: 'expo.out', onUpdate: showCount, immediateRender: false }, 'impact');
  }

  intro
    .fromTo('.cta, .social', { y: 18, autoAlpha: 0 }, { ...enter, immediateRender: false }, 'impact+=0.12')
    // The tracker's job is done. It comes back when someone hovers the shuttle.
    .to([bbox, tag], { opacity: 0, duration: 0.5, ease: 'power1.inOut' }, 'impact+=1.5')
    .call(() => onScrollReady(pos, draw));

  function reset() {
    points = [];
    lastX = null;
    lastY = null;
    Object.assign(pos, { x: START[0], y: START[1], height: 0, squash: 0, size: RALLY_SIZE, angle: 0, auto: true, trailing: true });
    fly.travelled = 0;
    hits.replaceChildren();
    trail.setAttribute('points', '');
    gsap.set([trail, hits, bbox, tag], { opacity: 1 });
    gsap.set(shade, { opacity: 0.16 });
    fx.classList.remove('is-smash');
    tag.textContent = tagLabel;
    followFlight(0);
    gsap.set(['.rank', '.cta', '.social'], { autoAlpha: 0 });
    gsap.set(ball, { visibility: 'hidden' });
    draw();
  }

  const showTracker = (on: boolean) => {
    if (!intro.isActive()) gsap.to([bbox, tag], { opacity: on ? 1 : 0, duration: 0.25, overwrite: 'auto' });
  };

  return { intro, reset, showTracker, tag, fx, tagLabel };
}

/** Runs the page. Returns a function that undoes all of it: listeners, ScrollTriggers and Lenis. */
function start(firstRun: boolean): () => void {
  const root = document.documentElement;
  const abort = new AbortController();
  const { signal } = abort;
  const portrait = matchMedia(PORTRAIT).matches;
  const shortScreen = matchMedia(SHORT).matches;
  const court = drawCourt(portrait);
  const ctx = gsap.context(() => {});
  let smooth: ReturnType<typeof startSmoothScroll> | null = null;

  const page: Page = {
    signal,
    ctx,
    portrait,
    shortScreen,
    lenis: () => smooth?.lenis ?? null,
    finishIntro: () => {},
    created: [],
  };

  themeToggle(signal);
  setupMenu(signal);
  setupGlimpse(page);

  root.dataset.ready = '1';

  const stop = () => {
    abort.abort();
    ctx.revert();
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    smooth?.stop();
    smooth = null;
    page.created.forEach((el) => el.remove());
    ['#hook', '#tail', '#shuttle2'].forEach((selector) => {
      $(selector).style.cssText = '';
    });
    root.classList.remove('motion');
  };

  if (!fullMotion()) {
    root.classList.remove('js-wait', 'motion');
    ctx.add(() => gsap.from('.hero', { opacity: 0, duration: 0.4 }));
    return stop;
  }

  root.classList.add('motion');
  const jumpTarget = firstRun && location.hash ? document.getElementById(location.hash.slice(1)) : null;
  if (firstRun && !jumpTarget) {
    history.scrollRestoration = 'manual';
    scrollTo(0, 0);
  }

  void (async () => {
    await fontsReady();
    if (signal.aborted) return;

    smooth = startSmoothScroll();
    const { lenis } = smooth;
    ctx.add(() => startPointerEffects(signal));
    setupAnchors(signal, page.lenis, () => page.finishIntro());

    let scrollReady = false;
    const onScrollReady = (pos: { y: number; angle: number }, draw: () => void) => {
      if (scrollReady) return;
      scrollReady = true;
      void setupScroll(page, pos, draw).then(() => {
        if (jumpTarget && !signal.aborted) lenis.scrollTo(jumpTarget, { immediate: true, force: true });
      });
    };

    ctx.add(() => {
      const { intro, reset, showTracker, tag, fx, tagLabel } = buildIntro(page, court, onScrollReady);
      page.finishIntro = () => {
        if (intro.isActive()) intro.progress(1);
      };
      reset();
      root.classList.remove('js-wait');

      const serve = $('.serve');
      serve.addEventListener('click', () => {
        if (intro.isActive() || scrollY > 4) return;
        intro.pause(0);
        reset();
        intro.restart();
      }, { signal });
      ['pointerenter', 'focus'].forEach((type) => serve.addEventListener(type, () => {
        tag.textContent = tagLabel;
        fx.classList.remove('is-smash');
        showTracker(true);
      }, { signal }));
      ['pointerleave', 'blur'].forEach((type) => serve.addEventListener(type, () => showTracker(false), { signal }));

      // Scrolling during the intro finishes it straight away instead of fighting the visitor.
      lenis.on('scroll', () => {
        if (intro.isActive() && scrollY > 2) intro.progress(1);
      });

      // After a resize, a deep link or a return visit, the page is already in its final state.
      if (!firstRun || jumpTarget || introSeen()) {
        intro.progress(1);
      } else {
        void whenVisible().then(() => {
          if (signal.aborted) return;
          intro.play();
          rememberIntro();
        });
      }
    });
  })();

  return stop;
}

const layoutKey = () => [innerWidth, matchMedia(PORTRAIT).matches, matchMedia(SHORT).matches, matchMedia(REDUCED).matches].join('|');

let stopPage: (() => void) | null = start(true);
let layout = layoutKey();
let resizeTimer: ReturnType<typeof setTimeout> | undefined;

// The court's geometry is measured, so a real layout change rebuilds it. Height changes alone, like a
// phone's address bar sliding away, don't count.
function rebuildIfLayoutChanged() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const next = layoutKey();
    if (next === layout || !stopPage) return;
    layout = next;
    stopPage();
    stopPage = start(false);
  }, 250);
}
addEventListener('resize', rebuildIfLayoutChanged);
matchMedia(REDUCED).addEventListener('change', rebuildIfLayoutChanged);

// Ready for Astro's client router: nothing survives a page swap.
document.addEventListener('astro:before-swap', () => {
  stopPage?.();
  stopPage = null;
});
document.addEventListener('astro:page-load', () => {
  stopPage ??= start(true);
});
