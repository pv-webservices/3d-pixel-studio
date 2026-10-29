import { ScrollTrigger, prefersReducedMotion } from '../core/motion.js';

const CYCLE_MS = 2600;

/** Floor-plan card cycles through plans while it is on screen. */
export function init() {
  document.querySelectorAll('[data-cycle]').forEach((cycle) => {
    const slides = [...cycle.children];
    if (slides.length < 2 || prefersReducedMotion) return;
    let index = 0;
    let timer = null;
    const next = () => {
      slides[index].classList.remove('is-active');
      index = (index + 1) % slides.length;
      slides[index].classList.add('is-active');
    };
    ScrollTrigger.create({
      trigger: cycle,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => {
        clearInterval(timer);
        if (self.isActive) timer = setInterval(next, CYCLE_MS);
      },
    });
  });
}
