/** Filters the projects by category. Without JavaScript the buttons are hidden and every project shows. */
import { ScrollTrigger, fullMotion, gsap } from '../lib/motion';

export function setupFilter(): void {
  const buttons = gsap.utils.toArray<HTMLButtonElement>('[data-filter]');
  const cards = gsap.utils.toArray<HTMLElement>('[data-cards] > .card');
  const status = document.querySelector('[data-filter-status]');
  if (buttons.length === 0) return;

  const apply = (category: string, animate: boolean) => {
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.filter === category)));
    const shown = cards.filter((card) => {
      const match = category === 'all' || card.dataset.category === category;
      card.hidden = !match;
      return match;
    });
    if (status) status.textContent = `Showing ${shown.length} project${shown.length === 1 ? '' : 's'}`;
    if (animate && fullMotion()) {
      gsap.fromTo(shown, { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'expo.out', stagger: 0.04, overwrite: true });
    } else {
      gsap.set(shown, { y: 0, autoAlpha: 1, overwrite: true });
    }
    ScrollTrigger.refresh();
  };

  buttons.forEach((button) => button.addEventListener('click', () => {
    const category = button.dataset.filter ?? 'all';
    apply(category, true);
    // The address can be shared, and it never reaches the visitor count, which reads the path only.
    history.replaceState(null, '', category === 'all' ? location.pathname : `?category=${encodeURIComponent(category)}`);
  }));

  const requested = new URLSearchParams(location.search).get('category');
  if (requested && buttons.some((button) => button.dataset.filter === requested)) apply(requested, false);
}
