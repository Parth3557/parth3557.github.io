/** The phone menu opens and closes without JavaScript. This adds Esc, tapping away and closing after a choice. */
export function setupMenu(signal: AbortSignal): void {
  const menu = document.querySelector<HTMLDetailsElement>('.menu');
  if (!menu) return;

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      menu.querySelector('summary')?.focus();
    }
  }, { signal });
  document.addEventListener('click', (event) => {
    if (menu.open && !menu.contains(event.target as Node)) menu.open = false;
  }, { signal });
  menu.addEventListener('click', (event) => {
    if ((event.target as Element).closest('a')) menu.open = false;
  }, { signal });
}
