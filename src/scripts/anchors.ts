import type { Lenis } from '../lib/motion';

/** In-page links glide with the smooth scroller, and move focus so keyboard users land there too. */
export function setupAnchors(signal: AbortSignal, lenis: () => Lenis | null, before?: () => void): void {
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]:not([data-glimpse]):not([data-glimpse-all])').forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = document.getElementById(link.hash.slice(1));
      const scroller = lenis();
      if (!target || !scroller) return;
      event.preventDefault();
      before?.();
      scroller.scrollTo(target, { duration: 1.4 });
      target.focus({ preventScroll: true });
    }, { signal });
  });
}
