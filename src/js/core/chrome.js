// Site chrome shared by every page: preloader, page transitions, header, menu, cursor, magnetic buttons.
import { gsap, ScrollTrigger, isTouch, prefersReducedMotion, scrollTo, startScroll, stopScroll } from './motion.js';

const root = document.documentElement;
const TRANSITION_KEY = '3dps-transition';
const LOADED_KEY = '3dps-loaded';

/* ---------- Ready signal: preloader or transition hands over to page intros ---------- */
export function runEntrance() {
  return new Promise((resolve) => {
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    if (root.classList.contains('is-preloading')) {
      fontsReady.then(() => runPreloader().then(resolve));
    } else if (root.classList.contains('is-entering')) {
      fontsReady.then(() => {
        const panel = document.querySelector('.transition__panel');
        gsap.to(panel, {
          yPercent: -100,
          duration: 1.05,
          ease: 'expo.inOut',
          onComplete: () => {
            root.classList.remove('is-entering');
            gsap.set(panel, { clearProps: 'all' });
          },
        });
        gsap.delayedCall(0.45, resolve);
      });
    } else {
      fontsReady.then(resolve);
    }
  });
}

function runPreloader() {
  const el = document.querySelector('[data-preloader]');
  const count = el.querySelector('[data-preloader-count]');
  const bar = el.querySelector('[data-preloader-bar]');
  const logo = el.querySelector('.preloader__logo');
  const tag = el.querySelector('[data-preloader-tag]');
  stopScroll();

  const pageLoaded = new Promise((r) => (document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true })));
  const minimum = new Promise((r) => setTimeout(r, 2200));
  const counter = { value: 0 };
  const render = () => {
    count.textContent = String(Math.round(counter.value)).padStart(2, '0');
    gsap.set(bar, { scaleX: counter.value / 100 });
  };

  return new Promise((resolve) => {
    gsap.from(logo, { scale: 0.6, opacity: 0, duration: 1.4, ease: 'expo.out' });
    gsap.from(tag, { yPercent: 110, duration: 1.2, delay: 0.3, ease: 'expo.out' });
    // Keeps creeping toward (never reaching) 100 while we wait, so there is no visible stall
    // before the final run to 100 — whatever the network does.
    const startedAt = gsap.ticker.time;
    const climb = () => {
      counter.value = 99 * (1 - Math.exp(-(gsap.ticker.time - startedAt) / 1.3));
      render();
    };
    gsap.ticker.add(climb);

    // Never block longer than 5s on slow networks.
    Promise.race([Promise.all([pageLoaded, minimum]), new Promise((r) => setTimeout(r, 5000))]).then(() => {
      gsap.ticker.remove(climb);
      gsap
        .timeline({
          onComplete: () => {
            root.classList.remove('is-preloading');
            startScroll();
            try {
              sessionStorage.setItem(LOADED_KEY, '1');
            } catch {
              /* storage unavailable — preloader simply shows again next visit */
            }
          },
        })
        .to(counter, { value: 100, duration: 0.5, ease: 'none', onUpdate: render })
        .to([logo, tag, count, el.querySelector('.preloader__meta')], { opacity: 0, y: -30, duration: 0.6, stagger: 0.05, ease: 'power2.in' })
        .add(resolve, '-=0.1')
        .to(el, { clipPath: 'inset(0 0 100% 0)', duration: 1.2, ease: 'expo.inOut' }, '<');
    });
  });
}

/* ---------- Page transitions ---------- */
function isInternalPageLink(a, event) {
  if (!a || event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (a.target && a.target !== '_self') return false;
  if (a.hasAttribute('download') || a.dataset.noTransition !== undefined) return false;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return false;
  if (url.pathname === location.pathname && url.hash) return false;
  if (url.pathname === location.pathname && url.search === location.search) return false;
  return true;
}

function initTransitions() {
  if (prefersReducedMotion) return;
  const layer = document.querySelector('[data-transition]');
  const panel = layer?.querySelector('.transition__panel');
  if (!panel) return;

  document.addEventListener('click', (event) => {
    const a = event.target.closest('a[href]');
    if (!isInternalPageLink(a, event)) return;
    event.preventDefault();
    try {
      sessionStorage.setItem(TRANSITION_KEY, '1');
    } catch {
      window.location.href = a.href;
      return;
    }
    gsap.set(layer, { visibility: 'visible' });
    gsap
      .timeline({ onComplete: () => (window.location.href = a.href) })
      .fromTo(panel, { yPercent: 100 }, { yPercent: 0, duration: 0.85, ease: 'expo.inOut' })
      .fromTo(panel.querySelector('img'), { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.5 }, '-=0.3');
  });

  // Returning through the back/forward cache must not leave the panel covering the page.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    gsap.set(layer, { clearProps: 'visibility' });
    gsap.set(panel, { clearProps: 'all' });
    gsap.set(panel.querySelector('img'), { clearProps: 'all' });
  });
}

/* ---------- Header ---------- */
function initHeader() {
  const header = document.querySelector('[data-header]');
  if (!header) return;
  const page = document.body.dataset.page;
  header.querySelector(`[data-nav="${page}"]`)?.setAttribute('aria-current', 'page');

  let lastY = window.scrollY;
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-solid', y > 40);
    const goingDown = y > lastY && y > window.innerHeight * 0.6;
    if (!root.classList.contains('menu-open')) header.classList.toggle('is-hidden', goingDown);
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Switch header tint while a dark section sits underneath it.
  const darkSections = document.querySelectorAll('[data-header-dark]');
  let activeDark = 0;
  darkSections.forEach((section) => {
    ScrollTrigger.create({
      trigger: section,
      start: 'top top+=40',
      end: 'bottom top+=40',
      onToggle: (self) => {
        activeDark += self.isActive ? 1 : -1;
        header.classList.toggle('is-on-dark', activeDark > 0);
      },
    });
  });

  const wa = document.querySelector('[data-float-wa]');
  if (wa) {
    ScrollTrigger.create({ start: () => window.innerHeight * 0.8, onToggle: (self) => wa.classList.toggle('is-visible', self.isActive) });
  }
  // Same-page anchors glide through Lenis and clear the fixed header.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]:not([href="#"]):not([data-scroll-top])');
    if (!a) return;
    const target = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
    if (!target) return;
    e.preventDefault();
    scrollTo(target, { offset: -Number.parseInt(getComputedStyle(root).getPropertyValue('--header-h'), 10) || 0 });
  });

  document.querySelectorAll('[data-scroll-top]').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      scrollTo(0);
    }),
  );
}

/* ---------- Fullscreen menu ---------- */
function initMenu() {
  const menu = document.querySelector('[data-menu]');
  const toggle = document.querySelector('[data-menu-toggle]');
  if (!menu || !toggle) return;
  const bg = menu.querySelector('[data-menu-bg]');
  const labels = menu.querySelectorAll('.menu__label');
  const nums = menu.querySelectorAll('.menu__num');
  const meta = menu.querySelector('.menu__meta');
  const preview = menu.querySelector('.menu__preview');
  const previews = preview ? preview.querySelectorAll('img') : [];
  let open = false;

  const tl = gsap
    .timeline({ paused: true })
    .set(menu, { visibility: 'visible', pointerEvents: 'auto' })
    .to(bg,{ clipPath: 'inset(0 0 0% 0)', duration: 0.9, ease: 'expo.inOut' })
    .fromTo(labels, { yPercent: 115 }, { yPercent: 0, duration: 0.9, stagger: 0.06, ease: 'expo.out' }, '-=0.35')
    .fromTo(nums, { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: 0.06 }, '<')
    .from(preview, { clipPath: 'inset(100% 0 0 0)', duration: 1.1, ease: 'expo.inOut' }, '<-0.2')
    .from(meta, { opacity: 0, y: 24, duration: 0.7 }, '-=0.6');

  const setOpen = (value) => {
    open = value;
    root.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    if (open) {
      stopScroll();
      tl.timeScale(1).play();
      setTimeout(() => menu.querySelector('a')?.focus({ preventScroll: true }), 400);
    } else {
      startScroll();
      tl.timeScale(1.6).reverse();
      toggle.focus({ preventScroll: true });
    }
  };

  toggle.addEventListener('click', () => setOpen(!open));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && open && setOpen(false));
  menu.querySelectorAll('[data-menu-link]').forEach((link) => {
    link.addEventListener('mouseenter', () => previews.forEach((img, i) => img.classList.toggle('is-active', i === Number(link.dataset.menuLink))));
  });
}

/* ---------- Cursor ---------- */
function initCursor() {
  const cursor = document.querySelector('[data-cursor]');
  if (!cursor || isTouch || prefersReducedMotion) return;
  root.classList.add('has-cursor');
  const dot = cursor.querySelector('.cursor__dot');
  const ring = cursor.querySelector('.cursor__ring');
  const label = cursor.querySelector('[data-cursor-label]');
  const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
  const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
  const ringX = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' });
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });

  window.addEventListener('pointermove', (e) => {
    dotX(e.clientX);
    dotY(e.clientY);
    ringX(e.clientX);
    ringY(e.clientY);
  });

  document.addEventListener('pointerover', (e) => {
    const labelled = e.target.closest('[data-cursor]:not(.cursor)');
    const interactive = e.target.closest('a, button, [role="button"], input, select, textarea, label');
    cursor.classList.toggle('is-label', Boolean(labelled));
    cursor.classList.toggle('is-hover', !labelled && Boolean(interactive));
    label.textContent = labelled ? labelled.dataset.cursor : '';
  });
  document.addEventListener('pointerleave', () => gsap.to([dot, ring], { opacity: 0, duration: 0.3 }));
  document.addEventListener('pointerenter', () => gsap.to([dot, ring], { opacity: 1, duration: 0.3 }));
}

/* ---------- Magnetic buttons ---------- */
function initMagnetic() {
  if (isTouch || prefersReducedMotion) return;
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const strength = Number(el.dataset.magnetic) || 0.28;
    const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * strength);
      yTo((e.clientY - r.top - r.height / 2) * strength);
    });
    el.addEventListener('pointerleave', () => {
      xTo(0);
      yTo(0);
    });
  });
}

export function initChrome() {
  initTransitions();
  initHeader();
  initMenu();
  initCursor();
  initMagnetic();
}
