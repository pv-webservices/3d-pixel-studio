import { ScrollTrigger, initSmoothScroll } from './core/motion.js';
import { initChrome, runEntrance } from './core/chrome.js';
import { initReveals } from './fx/reveals.js';
import { initHero, initPageHero } from './modules/hero.js';
import { initHorizontal, initPartner, initStack, initStepIn } from './modules/scenes.js';
import { initAccordions, initCompare, initFilms, initHoverFollow } from './modules/interactions.js';

const page = document.body.dataset.page;

// Page-specific modules are code-split so each page only loads what it uses.
const pageModules = {
  work: () => import('./pages/work.js'),
  services: () => import('./pages/services.js'),
  studio: () => import('./pages/studio.js'),
  article: () => import('./pages/article.js'),
  review: () => import('./pages/review.js'),
};

async function boot() {
  initSmoothScroll();
  const ready = runEntrance();
  await (document.fonts?.ready ?? Promise.resolve());

  initChrome();
  initHero();
  initPageHero(ready);
  initStack();
  initStepIn();
  initHorizontal();
  initPartner();
  initHoverFollow();
  initCompare();
  initFilms();
  initAccordions();

  const loader = pageModules[page];
  if (loader) {
    const mod = await loader();
    await mod.init?.(ready);
  }

  // Reveals last, so pinned scenes above have already added their spacing.
  initReveals(ready);
  ScrollTrigger.refresh();
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
}

boot();
