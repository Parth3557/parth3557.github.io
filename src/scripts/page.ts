/** Everything the inner pages share. All of it is optional: each page reads fully without this script. */
import { ScrollTrigger, fontsReady, fullMotion, gsap, startSmoothScroll } from '../lib/motion';
import { setupAnchors } from './anchors';
import { startPointerEffects } from './chrome';
import { setupMenu } from './menu';
import { themeToggle } from './theme-toggle';
import './track';

/** A page's own animation. It can return a function that undoes whatever it added to the page. */
type Build = () => void | (() => void);

const belowTheFold = (el: Element) => el.getBoundingClientRect().top > innerHeight * 0.92;

/** Only what's still off screen waits to be revealed, so nothing visible ever blinks out. */
function revealOnScroll(): void {
  const items = gsap.utils.toArray<HTMLElement>('[data-reveal], .work--page .card, .resume__text > *, .resume__page').filter(belowTheFold);
  if (items.length === 0) return;
  gsap.set(items, { y: 28, autoAlpha: 0 });
  ScrollTrigger.batch(items, {
    start: 'top 92%',
    once: true,
    onEnter: (batch) => gsap.to(batch, { y: 0, autoAlpha: 1, duration: 0.9, ease: 'expo.out', stagger: 0.07 }),
  });
}

/** A rank is climbed, not counted, so it falls from the size of the field to the final place. */
function fallingNumbers(): void {
  gsap.utils.toArray<HTMLElement>('[data-count-from][data-count-to]').filter(belowTheFold).forEach((el) => {
    const from = Number(el.dataset.countFrom);
    const to = Number(el.dataset.countTo);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return;
    const state = { n: from };
    const show = () => {
      el.textContent = Math.round(state.n).toLocaleString('en-US');
    };
    show();
    gsap.to(state, { n: to, duration: 1.4, ease: 'expo.out', onUpdate: show, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });
}

/** Every page opens with the shuttle coming down onto its court line. */
function landShuttle(): void {
  const landing = document.querySelector<HTMLElement>('.head__landing');
  const shuttle = landing?.querySelector('.head__shuttle');
  const ring = landing?.querySelector('.head__ring');
  const court = document.querySelector('.head__court');
  if (!landing || !shuttle || !ring || !court) return;

  const { width, height } = court.getBoundingClientRect();
  const size = landing.getBoundingClientRect().height;
  gsap.timeline({ delay: 0.15 })
    .fromTo(shuttle, { x: -Math.min(width * 0.32, 340), y: -height * 1.05, rotation: -62 }, { x: 0, y: 0, rotation: 0, duration: 0.62, ease: 'power2.in' })
    .fromTo(ring, { scale: 0.2, opacity: 0.95 }, { scale: 2.8, opacity: 0, duration: 0.8, ease: 'expo.out' })
    .to(shuttle, {
      keyframes: [
        { y: -size * 0.42, rotation: -7, duration: 0.17, ease: 'power2.out' },
        { y: 0, rotation: 5, duration: 0.2, ease: 'power2.in' },
        { y: -size * 0.1, rotation: -2, duration: 0.09, ease: 'power1.out' },
        { y: 0, rotation: 0, duration: 0.12, ease: 'power1.in' },
      ],
    }, '<');
}

export function startPage(build?: Build): void {
  const root = document.documentElement;
  const page = new AbortController();
  themeToggle(page.signal);
  setupMenu(page.signal);
  root.dataset.ready = '1';

  const start = (firstRun: boolean) => {
    if (!fullMotion()) {
      root.classList.remove('js-wait', 'motion');
      return () => {};
    }
    root.classList.add('motion');
    const abort = new AbortController();
    const { signal } = abort;
    const ctx = gsap.context(() => {});
    let smooth: ReturnType<typeof startSmoothScroll> | null = null;
    let undoBuild: void | (() => void);

    void fontsReady().then(() => {
      if (signal.aborted) return;
      root.classList.remove('js-wait');
      smooth = startSmoothScroll();
      setupAnchors(signal, () => smooth?.lenis ?? null);
      ctx.add(() => {
        startPointerEffects(signal);
        revealOnScroll();
        fallingNumbers();
        if (firstRun) landShuttle();
        undoBuild = build?.();
        ScrollTrigger.refresh();
      });
    });

    return () => {
      abort.abort();
      ctx.revert();
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      smooth?.stop();
      if (undoBuild) undoBuild();
      root.classList.remove('motion');
    };
  };

  let stop: (() => void) | null = start(true);

  // Measured geometry follows the width. Height changes alone, like a phone's address bar, don't count.
  let width = innerWidth;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!stop) return;
      stop();
      stop = start(false);
    }, 250);
  };
  addEventListener('resize', () => {
    if (innerWidth === width) return;
    width = innerWidth;
    rebuild();
  }, { signal: page.signal });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', rebuild, { signal: page.signal });

  // Ready for Astro's client router: nothing survives a page swap.
  document.addEventListener('astro:before-swap', () => {
    stop?.();
    stop = null;
  }, { signal: page.signal });
}
