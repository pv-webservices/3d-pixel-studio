// Scroll layering shared by every page: the hero holds still while the page slides over it, and the
// footer waits underneath the page and is uncovered at the end. The positioning itself is CSS
// (position: sticky); this module keeps the sticky offsets right for tall heroes/footers and drives
// the subtle "receding" veil on the hero.
//
// Sticky elements report their stuck position, not their place in the document, so ScrollTriggers
// tied to the hero or footer use the explicit scroll offsets below instead of `trigger: hero`.
import { gsap, ScrollTrigger, prefersReducedMotion } from './motion.js';

const root = document.documentElement;
const VEIL_OPACITY = 0.62;

export const getHero = () => document.querySelector('main > [data-hero]');
export const getFooter = () => document.querySelector('[data-footer]');

/** Scroll distance over which the next section fully covers the hero (the hero starts at y = 0). */
export const heroCoverEnd = (hero) => () => hero.offsetHeight;

/**
 * How many pixels before the end of the page an element inside the sticky footer is first uncovered.
 * Short footers stick to the bottom of the screen and are uncovered bottom-up; footers taller than
 * the screen stick by their top edge, then scroll normally once the page content has moved away.
 * @param {HTMLElement} footer
 * @param {HTMLElement} el element inside the footer
 */
export function footerRevealDistance(footer, el) {
  const vh = window.innerHeight;
  const footerH = footer.offsetHeight;
  let top = 0;
  for (let node = el; node && node !== footer; node = node.offsetParent) top += node.offsetTop;
  // Short footer: stuck at the screen bottom, so the page edge uncovers it from the bottom up.
  if (footerH <= vh) return top;
  // Tall footer: stuck by its top edge while the page moves away, then scrolls into view.
  return top < vh ? footerH - vh + top : footerH - top;
}

/** Scroll position at which `el` (inside the footer) starts to be uncovered. */
export const footerRevealStart = (footer, el, inset = 0) => () =>
  ScrollTrigger.maxScroll(window) - footerRevealDistance(footer, el) + inset;

function syncOffsets(hero, footer) {
  const vh = window.innerHeight;
  // A hero or footer taller than the screen scrolls normally until its far edge is in view, then holds.
  if (hero) root.style.setProperty('--hero-stick', `${Math.min(0, vh - hero.offsetHeight)}px`);
  if (footer) root.style.setProperty('--footer-stick', `${Math.min(0, vh - footer.offsetHeight)}px`);
}

function initHeroVeil(hero) {
  const veil = document.createElement('div');
  veil.className = 'hero-veil';
  veil.setAttribute('aria-hidden', 'true');
  hero.appendChild(veil);
  const content = hero.querySelector('[data-hero-content], .page-hero__inner, .studio-hero__inner');
  const cover = { start: 0, end: heroCoverEnd(hero), scrub: true, invalidateOnRefresh: true };

  gsap.fromTo(veil, { opacity: 0 }, { opacity: VEIL_OPACITY, ease: 'none', scrollTrigger: cover });
  if (content) gsap.fromTo(content, { opacity: 1 }, { opacity: 0, ease: 'power1.in', immediateRender: false, scrollTrigger: { ...cover, end: () => hero.offsetHeight * 0.75 } });

  // Nothing on a fully covered hero is visible, so stop the background film until it comes back.
  const video = hero.querySelector('video');
  if (video) {
    ScrollTrigger.create({
      start: 0,
      end: heroCoverEnd(hero),
      onLeave: () => video.pause(),
      onEnterBack: () => video.play().catch(() => {}),
    });
  }
}

export function initLayers() {
  const hero = getHero();
  const footer = getFooter();
  const sync = () => syncOffsets(hero, footer);
  sync();
  const observer = new ResizeObserver(sync);
  [hero, footer].forEach((el) => el && observer.observe(el));
  window.addEventListener('resize', sync, { passive: true });

  if (hero && !prefersReducedMotion) initHeroVeil(hero);
}
