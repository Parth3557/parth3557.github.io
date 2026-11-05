/** The one place GSAP plugins are registered and smooth scrolling is wired to ScrollTrigger. */
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin, SplitText, CustomEase);

export { CustomEase, ScrollTrigger, SplitText, gsap };
export type { Lenis };

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** False when the visitor asks for less motion, or the owner turned the full animations off. */
export const fullMotion = () => !reducedMotion() && document.documentElement.dataset.animations !== 'simple';

export const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

export function startSmoothScroll() {
  const lenis = new Lenis({ lerp: 0.12 });
  const offScroll = lenis.on('scroll', ScrollTrigger.update);
  const tick = (time: number) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return {
    lenis,
    stop() {
      offScroll();
      gsap.ticker.remove(tick);
      lenis.destroy();
    },
  };
}

/** Layout is measured once the display font is in. Never wait long for it. */
export const fontsReady = () => Promise.race([
  document.fonts.ready,
  new Promise((resolve) => setTimeout(resolve, 1500)),
]);

/** A page opened in a background tab waits to be seen, so the intro isn't over before anyone looks. */
export const whenVisible = () => new Promise<void>((resolve) => {
  if (!document.hidden) return resolve();
  document.addEventListener('visibilitychange', () => resolve(), { once: true });
});
