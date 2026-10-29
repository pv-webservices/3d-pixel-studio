// Scroll-driven scenes: stacking cards, expanding frame, pinned horizontal gallery, sticky image swap.
import { gsap, ScrollTrigger, prefersReducedMotion } from '../core/motion.js';

const media = gsap.matchMedia();
const MOTION_OK = '(prefers-reduced-motion: no-preference)';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const MOBILE = '(max-width: 899px)';
const DESKTOP = '(min-width: 900px)';

/** Cards that stick and recede as the next one slides over them. */
export function initStack() {
  document.querySelectorAll('[data-stack]').forEach((stack) => {
    const cards = [...stack.children];
    if (prefersReducedMotion) return;
    cards.forEach((card, i) => {
      const next = cards[i + 1];
      if (!next) return;
      gsap.to(card, {
        scale: 0.9 + i * 0.02,
        opacity: 0.55,
        ease: 'none',
        scrollTrigger: { trigger: next, start: 'top bottom', end: 'top 20%', scrub: true },
      });
    });
    cards.forEach((card) => {
      const img = card.querySelector('img');
      if (img) gsap.fromTo(img, { scale: 1.2 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'top top', scrub: true } });
    });
  });
}

/** A small framed image grows to full-bleed while the headline arrives over it. */
export function initStepIn() {
  const section = document.querySelector('[data-stepin]');
  if (!section) return;
  const frame = section.querySelector('[data-stepin-frame]');
  const img = frame.querySelector('img');
  const shade = section.querySelector('[data-stepin-shade]');
  const title = section.querySelector('[data-stepin-title]');
  const text = section.querySelector('[data-stepin-text]');

  if (prefersReducedMotion) {
    gsap.set(frame, { '--open': 1 });
    gsap.set(shade, { opacity: 1 });
    return;
  }

  // Tween a single CSS variable rather than clip-path: GSAP misreads the browser's shortened
  // "inset(22% 30% round 8px)" form and snapped the frame's left edge to 0 on the first frame.
  gsap
    .timeline({
      scrollTrigger: { trigger: section, start: 'top top', end: '+=160%', scrub: 1, pin: section.querySelector('.stepin__pin'), anticipatePin: 1 },
    })
    .fromTo(frame, { '--open': 0 }, { '--open': 1, ease: 'power2.inOut', duration: 1 })
    .to(img, { scale: 1, ease: 'power2.inOut', duration: 1 }, 0)
    .to(shade, { opacity: 1, duration: 0.5 }, 0.55)
    .from(title, { yPercent: 40, opacity: 0, duration: 0.5 }, 0.7)
    .from(text, { y: 50, opacity: 0, duration: 0.45 }, 0.9)
    .to({}, { duration: 0.3 });
}

/** Pinned horizontal gallery driven by vertical scroll on every screen; native swipe only for reduced motion. */
export function initHorizontal() {
  const section = document.querySelector('[data-works]');
  if (!section) return;
  const pin = section.querySelector('[data-works-pin]');
  const track = section.querySelector('[data-works-track]');
  const bar = section.querySelector('[data-works-bar]');
  const current = section.querySelector('[data-works-current]');
  const cards = [...track.querySelectorAll('.work-card:not(.work-card--end)')];

  const setProgress = (p) => {
    gsap.set(bar, { scaleX: p });
    if (current) current.textContent = String(Math.min(cards.length, Math.floor(p * cards.length) + 1)).padStart(2, '0');
  };

  media.add(MOTION_OK, () => {
    const distance = () => track.scrollWidth - window.innerWidth;
    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin,
        scrub: 1,
        invalidateOnRefresh: true,
        anticipatePin: 1,
        onUpdate: (self) => setProgress(self.progress),
      },
    });
    cards.forEach((card) => {
      const img = card.querySelector('img');
      gsap.fromTo(img, { xPercent: -6 }, { xPercent: 6, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
    });
  });

  media.add(REDUCED_MOTION, () => {
    const viewport = section.querySelector('.works__viewport');
    const onScroll = () => setProgress(viewport.scrollLeft / Math.max(1, viewport.scrollWidth - viewport.clientWidth));
    viewport.addEventListener('scroll', onScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', onScroll);
  });
}

/**
 * Sticky image that swaps as each list item reaches the activation line. Each image wipes up over
 * the previous one in step with the scroll (scrubbed, so it is smooth and reverses on the way back).
 * On mobile the image sticks to the top and the line sits below it, where the text is read.
 */
export function initPartner() {
  const grid = document.querySelector('[data-partner]');
  if (!grid) return;
  const items = [...grid.querySelectorAll('[data-partner-item]')];
  const images = [...grid.querySelectorAll('.partner__frame img')];
  const index = grid.querySelector('[data-partner-index]');
  const activate = (i) => {
    items.forEach((el, j) => el.classList.toggle('is-active', j === i));
    if (prefersReducedMotion) images.forEach((el, j) => el.classList.toggle('is-active', j === i));
    if (index) index.textContent = String(i + 1).padStart(2, '0');
  };

  media.add({ mobile: MOBILE, desktop: DESKTOP }, ({ conditions }) => {
    const line = conditions.mobile ? 74 : 60;
    items.forEach((item, i) => {
      ScrollTrigger.create({ trigger: item, start: `top ${line}%`, end: `bottom ${line}%`, onToggle: (self) => self.isActive && activate(i) });
      if (prefersReducedMotion || i === 0) return;
      gsap.fromTo(
        images[i],
        { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.15 },
        { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, ease: 'none', scrollTrigger: { trigger: item, start: `top ${line + 24}%`, end: `top ${line}%`, scrub: 0.6 } },
      );
    });
  });
}
