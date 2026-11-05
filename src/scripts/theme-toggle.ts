/** Light and dark, with a circular wipe from the toggle. Used on every page, so it stays free of GSAP. */
export function themeToggle(signal: AbortSignal): void {
  const root = document.documentElement;
  document.querySelector('[data-theme-toggle]')?.addEventListener('click', (event) => {
    const { clientX, clientY } = event as MouseEvent;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    const apply = () => {
      root.dataset.theme = next;
      try {
        localStorage.setItem('theme', next);
      } catch {
        // Private windows can refuse storage. The choice still applies to this page.
      }
    };
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return apply();

    // A keyboard click reports 0,0, so fall back to the toggle's position.
    const x = clientX || innerWidth - 40;
    const y = clientY || 36;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(apply).ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 620, easing: 'cubic-bezier(.16, 1, .3, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    });
  }, { signal });
}
