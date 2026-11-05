/* Theme flip, cursor follower, magnetic buttons and smooth scroll for both concepts. */
window.PJ = (() => {
  const root = document.documentElement;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

  function themeToggle() {
    document.querySelector('[data-theme-toggle]').addEventListener('click', (event) => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      const apply = () => {
        root.dataset.theme = next;
        try { localStorage.setItem('theme', next); } catch {}
      };
      if (!document.startViewTransition || reduced()) return apply();

      // A keyboard click reports 0,0, so fall back to the toggle's position.
      const x = event.clientX || innerWidth - 40;
      const y = event.clientY || 36;
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      document.startViewTransition(apply).ready.then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 620, easing: 'cubic-bezier(.16, 1, .3, 1)', pseudoElement: '::view-transition-new(root)' },
        );
      });
    });
  }

  function cursor() {
    if (!finePointer() || reduced()) return;
    const el = document.querySelector('.cursor');
    const dot = el.querySelector('.cursor__dot');
    const mark = el.querySelector('.cursor__q');
    const xTo = gsap.quickTo(el, 'x', { duration: 0.38, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.38, ease: 'power3' });
    let visible = false;

    addEventListener('pointermove', (e) => {
      if (!visible) {
        gsap.set(el, { x: e.clientX, y: e.clientY, autoAlpha: 1 });
        visible = true;
      }
      xTo(e.clientX);
      yTo(e.clientY);
    });

    const setState = (scale, markOpacity) => {
      gsap.to(dot, { scale, duration: 0.4, ease: 'back.out(2.4)', overwrite: 'auto' });
      gsap.to(mark, { opacity: markOpacity, duration: 0.2, overwrite: 'auto' });
    };
    document.addEventListener('pointerover', (e) => {
      if (e.target.closest('[data-curious]')) setState(1, 1);
      else if (e.target.closest('a, button')) setState(0.42, 0);
      else setState(0.18, 0);
    });
  }

  function magneticButtons() {
    if (!finePointer() || reduced()) return;
    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const box = el.getBoundingClientRect();
        xTo((e.clientX - box.left - box.width / 2) * 0.3);
        yTo((e.clientY - box.top - box.height / 2) * 0.4);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  function smoothScroll() {
    const lenis = new Lenis({ lerp: 0.12 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    return lenis;
  }

  // Layout is measured once the display font is in. Never wait long for it.
  const fontsReady = () => Promise.race([
    document.fonts.ready,
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);

  // A page opened in a background tab waits to be seen, so the intro isn't over before anyone looks.
  const whenVisible = () => new Promise((resolve) => {
    if (!document.hidden) return resolve();
    document.addEventListener('visibilitychange', resolve, { once: true });
  });

  // The mockups measure layout once, so a real width change just restarts the page.
  function reloadOnWidthChange() {
    let width = innerWidth;
    let timer;
    addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (innerWidth !== width) location.reload(); width = innerWidth; }, 250);
    });
  }

  return {
    reduced,
    fontsReady,
    whenVisible,
    smoothScroll,
    chrome() {
      themeToggle();
      cursor();
      magneticButtons();
      reloadOnWidthChange();
    },
  };
})();
