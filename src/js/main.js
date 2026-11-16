import { ScrollTrigger, initSmoothScroll } from './core/motion.js';
import { initChrome, runEntrance } from './core/chrome.js';
import { initLayers } from './core/layers.js';
import { initReveals } from './fx/reveals.js';
import { initHero, initPageHero } from './modules/hero.js';
import { initHorizontal, initPartner, initStack, initStepIn } from './modules/scenes.js';
import { initAccordions, initCompare, initFilms, initHoverFollow } from './modules/interactions.js';

const page = document.body.dataset.page;

// Page-specific modules are code-split so each page only loads what it uses.
const pageModules = {
  home: () => import('./pages/home.js'),
  work: () => import('./pages/work.js'),
  services: () => import('./pages/services.js'),
  studio: () => import('./pages/studio.js'),
  article: () => import('./pages/article.js'),
  review: () => import('./pages/review.js'),
};

// Pages with runtime (admin-managed) content render it before the scroll scenes measure the layout.
// A slow API must not hold the page hostage: after this wait the scenes start anyway, and the page
// module re-measures (ScrollTrigger.refresh) when its content arrives.
const CONTENT_WAIT_MS = 3500;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function boot() {
  initSmoothScroll();
  const ready = runEntrance();
  const loader = pageModules[page];
  const modPromise = loader ? loader() : null;
  const contentReady = modPromise ? modPromise.then((mod) => mod.prepare?.()).catch(() => {}) : null;
  await (document.fonts?.ready ?? Promise.resolve());
  if (contentReady) await Promise.race([contentReady, delay(CONTENT_WAIT_MS)]);

  initLayers();
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

  if (modPromise) {
    const mod = await modPromise;
    await mod.init?.(ready);
  }

  // Reveals last, so pinned scenes above have already added their spacing.
  initReveals(ready);
  ScrollTrigger.refresh();
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
}

boot();
