import { createPasskey, explain, post } from './passkey';
import { themeToggle } from './theme-toggle';

themeToggle(new AbortController().signal);

// From now on, this browser's own visits to the public site aren't counted.
try {
  localStorage.setItem('pj_owner', '1');
} catch {
  // Storage can be refused. Visits while signed in still aren't counted, because the server checks.
}

type ChartPoint = { label: string; visitors: number; views: number; x: number; y: number };

/** A crosshair and one tooltip that snap to the nearest day, by pointer or arrow keys. */
function setupChart(plot: HTMLElement): void {
  const points = JSON.parse(plot.dataset.points ?? '[]') as ChartPoint[];
  const cross = plot.querySelector<HTMLElement>('.chart__cross');
  const dot = plot.querySelector<HTMLElement>('.chart__dot');
  const tip = plot.querySelector<HTMLElement>('.chart__tip');
  const visitors = plot.querySelector('[data-tip-visitors]');
  const views = plot.querySelector('[data-tip-views]');
  const day = plot.querySelector('[data-tip-day]');
  if (!cross || !dot || !tip || !visitors || !views || !day || points.length === 0) return;
  let current = -1;

  const show = (index: number) => {
    current = Math.max(0, Math.min(points.length - 1, index));
    const point = points[current];
    const { width, height } = plot.getBoundingClientRect();
    const x = point.x * width;
    const y = point.y * height;

    visitors.textContent = `${point.visitors.toLocaleString('en-IN')} visitor${point.visitors === 1 ? '' : 's'}`;
    views.textContent = `${point.views.toLocaleString('en-IN')} page view${point.views === 1 ? '' : 's'}`;
    day.textContent = point.label;
    cross.hidden = false;
    dot.hidden = false;
    tip.hidden = false;

    cross.style.transform = `translateX(${x}px)`;
    dot.style.transform = `translate(${x}px, ${y}px)`;
    const left = x + 14 + tip.offsetWidth > width ? x - 14 - tip.offsetWidth : x + 14;
    const top = Math.max(0, Math.min(height - tip.offsetHeight, y - tip.offsetHeight / 2));
    tip.style.transform = `translate(${Math.max(0, left)}px, ${top}px)`;
  };
  const hide = () => {
    current = -1;
    cross.hidden = true;
    dot.hidden = true;
    tip.hidden = true;
  };

  plot.addEventListener('pointermove', (event) => {
    const box = plot.getBoundingClientRect();
    const index = Math.round(((event.clientX - box.left) / box.width) * (points.length - 1));
    if (index !== current) show(index);
  });
  plot.addEventListener('pointerleave', hide);
  plot.addEventListener('focus', () => show(points.length - 1));
  plot.addEventListener('blur', hide);
  plot.addEventListener('keydown', (event) => {
    const moves: Record<string, number> = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: points.length - 1 };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    show(next);
  });
}

document.querySelectorAll<HTMLElement>('[data-chart]').forEach(setupChart);

const alert = document.querySelector<HTMLElement>('[data-passkey-alert]');
const report = (message: string) => {
  if (!alert) return;
  alert.textContent = message;
  alert.hidden = false;
};

const addForm = document.querySelector<HTMLFormElement>('[data-add-passkey]');
addForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = addForm.querySelector('button');
  if (submit) submit.disabled = true;
  try {
    await createPasskey(String(new FormData(addForm).get('label') ?? ''));
    location.reload();
  } catch (error) {
    report(explain(error));
    if (submit) submit.disabled = false;
  }
});

document.querySelectorAll<HTMLButtonElement>('[data-remove-passkey]').forEach((button) => {
  button.addEventListener('click', async () => {
    if (!confirm(`Remove the passkey "${button.dataset.label}"? That device won't be able to sign in any more.`)) return;
    button.disabled = true;
    try {
      await post('/api/dashboard/passkeys/remove', { id: button.dataset.removePasskey });
      location.reload();
    } catch (error) {
      report(explain(error));
      button.disabled = false;
    }
  });
});
