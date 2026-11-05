/** The curiosity cursor and magnetic buttons. Desktop only, and off with reduced motion. */
import { finePointer, fullMotion, gsap } from '../lib/motion';

function cursor(signal: AbortSignal): void {
  const el = document.querySelector<HTMLElement>('.cursor');
  const dot = el?.querySelector('.cursor__dot');
  const mark = el?.querySelector('.cursor__q');
  if (!el || !dot || !mark) return;

  const xTo = gsap.quickTo(el, 'x', { duration: 0.38, ease: 'power3' });
  const yTo = gsap.quickTo(el, 'y', { duration: 0.38, ease: 'power3' });
  let visible = false;

  addEventListener('pointermove', (event) => {
    if (!visible) {
      gsap.set(el, { x: event.clientX, y: event.clientY, autoAlpha: 1 });
      visible = true;
    }
    xTo(event.clientX);
    yTo(event.clientY);
  }, { signal });

  const setState = (scale: number, markOpacity: number) => {
    gsap.to(dot, { scale, duration: 0.4, ease: 'back.out(2.4)', overwrite: 'auto' });
    gsap.to(mark, { opacity: markOpacity, duration: 0.2, overwrite: 'auto' });
  };
  document.addEventListener('pointerover', (event) => {
    const target = event.target as Element;
    if (target.closest('[data-curious]')) setState(1, 1);
    else if (target.closest('a, button')) setState(0.42, 0);
    else setState(0.18, 0);
  }, { signal });
}

function magneticButtons(signal: AbortSignal): void {
  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3' });
    el.addEventListener('pointermove', (event) => {
      const box = el.getBoundingClientRect();
      xTo((event.clientX - box.left - box.width / 2) * 0.3);
      yTo((event.clientY - box.top - box.height / 2) * 0.4);
    }, { signal });
    el.addEventListener('pointerleave', () => {
      xTo(0);
      yTo(0);
    }, { signal });
  });
}

export function startPointerEffects(signal: AbortSignal): void {
  if (!finePointer() || !fullMotion()) return;
  cursor(signal);
  magneticButtons(signal);
}
