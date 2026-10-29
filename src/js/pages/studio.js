import { gsap, ScrollTrigger, prefersReducedMotion } from '../core/motion.js';

/** Pinned principles: scroll progress picks the active word + image. */
function initSteps() {
  document.querySelectorAll('[data-steps]').forEach((root) => {
    const steps = [...root.querySelectorAll('[data-step]')];
    const images = [...root.querySelectorAll('[data-step-img]')];
    const activate = (i) => {
      steps.forEach((el, j) => el.classList.toggle('is-active', j === i));
      images.forEach((el, j) => el.classList.toggle('is-active', j === i));
    };
    ScrollTrigger.create({
      trigger: root,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => activate(Math.min(steps.length - 1, Math.floor(self.progress * steps.length))),
    });
  });
}

/** Gold line draws across the four stages, lighting each one as it passes. */
function initProcess() {
  const track = document.querySelector('[data-process]');
  if (!track) return;
  const line = track.querySelector('[data-process-line]');
  const stages = [...track.querySelectorAll('[data-stage]')];
  ScrollTrigger.create({
    trigger: track,
    start: 'top 75%',
    end: 'bottom 45%',
    scrub: true,
    onUpdate: (self) => {
      if (line) gsap.set(line, { scaleX: self.progress });
      stages.forEach((stage, i) => stage.classList.toggle('is-active', self.progress >= i / stages.length + 0.02));
    },
  });
}

function initWord() {
  const word = document.querySelector('[data-studio-word]');
  if (!word || prefersReducedMotion) return;
  gsap.fromTo(word, { backgroundPosition: 'center 20%' }, { backgroundPosition: 'center 80%', ease: 'none', scrollTrigger: { trigger: word, start: 'top top', end: 'bottom top', scrub: true } });
  gsap.from(word, { yPercent: 30, opacity: 0, letterSpacing: '0.05em', duration: 2, ease: 'expo.out', delay: 0.2 });
}

export function init() {
  initSteps();
  initProcess();
  initWord();
}
