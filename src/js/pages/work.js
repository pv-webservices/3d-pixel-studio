// Portfolio: filterable gallery (FLIP-animated), paged loading and a keyboard/swipe lightbox.
import { Flip, gsap, ScrollTrigger, prefersReducedMotion, startScroll, stopScroll } from '../core/motion.js';
import MEDIA from '../../data/media.json';
import { FILMS, thumb } from '../data/films.js';

const PAGE_SIZE = 18;
const CATEGORY_LABEL = { exterior: 'Exterior CGI', interior: 'Interior CGI', plan: '3D Floor Plan', film: 'Architectural Film' };
const LAYOUT = ['', '', '', 'wide', '', '', '', '', '', 'wide'];

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const srcset = (m) => m.sizes.map((w) => `${m.src}-${w}.webp ${w}w`).join(', ');
const displayName = (it) => (it.cat === 'plan' ? it.location : it.project);
const pick = (m, max) => `${m.src}-${m.sizes.filter((w) => w <= max).at(-1) ?? m.sizes[0]}.webp`;

/** Interleave categories so "All" reads as a curated mix rather than folder order. */
function buildItems() {
  const films = FILMS.map((f) => ({ id: f.id, cat: 'film', project: f.project, location: f.location, film: true }));
  const byCat = {
    exterior: MEDIA.filter((m) => m.cat === 'exterior'),
    interior: MEDIA.filter((m) => m.cat === 'interior'),
    plan: MEDIA.filter((m) => m.cat === 'plan'),
  };
  const pattern = ['exterior', 'interior', 'exterior', 'interior', 'film', 'interior', 'exterior', 'plan'];
  const queues = { ...byCat, film: films };
  const cursors = { exterior: 0, interior: 0, plan: 0, film: 0 };
  const total = MEDIA.length + films.length;
  const mixed = [];
  for (let i = 0; mixed.length < total; i++) {
    const cat = pattern[i % pattern.length];
    const next = queues[cat][cursors[cat]++];
    if (next) mixed.push(next);
    if (i > total * 4) break;
  }
  return mixed;
}

function tileHtml(item, index) {
  const shape = item.cat === 'plan' ? '' : LAYOUT[index % LAYOUT.length];
  const cls = ['tile', shape && `tile--${shape}`, item.cat === 'plan' && 'tile--plan'].filter(Boolean).join(' ');
  const meta = `<span class="tile__meta"><strong>${escapeHtml(displayName(item))}</strong><span>${escapeHtml(CATEGORY_LABEL[item.cat])}</span></span>`;
  if (item.film) {
    return `<li class="${cls}" data-flip-id="${item.id}"><button type="button" class="tile__btn" data-film="${item.id}" data-film-title="${escapeHtml(item.project)} — 3D Walkthrough" data-cursor="Play">
      <span class="tile__media media"><img src="${thumb(item.id)}" alt="${escapeHtml(item.project)} 3D walkthrough film" loading="lazy" width="1280" height="720" data-yt-thumb /><span class="play-chip" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span></span>${meta}</button></li>`;
  }
  const sizes = shape === 'wide' ? '(min-width: 900px) 66vw, 100vw' : '(min-width: 900px) 33vw, 50vw';
  return `<li class="${cls}" data-flip-id="${item.id}"><button type="button" class="tile__btn" data-lightbox-id="${item.id}" data-cursor="View" aria-label="View ${escapeHtml(item.alt)}">
    <span class="tile__media media"><img src="${pick(item, 1280)}" srcset="${srcset(item)}" sizes="${sizes}" alt="${escapeHtml(item.alt)}" loading="lazy" decoding="async" width="${item.w}" height="${item.h}" /></span>${meta}</button></li>`;
}

function initGallery() {
  const gallery = document.querySelector('[data-gallery]');
  if (!gallery) return null;
  const moreBtn = document.querySelector('[data-more]');
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const all = buildItems();
  const counts = all.reduce((acc, it) => ({ ...acc, [it.cat]: (acc[it.cat] ?? 0) + 1 }), { all: all.length });
  document.querySelectorAll('[data-count-for]').forEach((el) => (el.textContent = counts[el.dataset.countFor] ?? 0));

  const params = new URLSearchParams(location.search);
  const state = { filter: CATEGORY_LABEL[params.get('filter')] ? params.get('filter') : 'all', shown: PAGE_SIZE };
  const visibleItems = () => (state.filter === 'all' ? all : all.filter((it) => it.cat === state.filter));

  const render = (animate) => {
    const items = visibleItems();
    const flipState = animate && !prefersReducedMotion ? Flip.getState(gallery.children) : null;
    gallery.innerHTML = items.slice(0, state.shown).map(tileHtml).join('');
    moreBtn.parentElement.hidden = state.shown >= items.length;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === state.filter)));
    if (flipState) {
      Flip.from(flipState, {
        targets: gallery.children,
        duration: 0.9,
        ease: 'expo.inOut',
        stagger: 0.015,
        absolute: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.04, ease: 'expo.out' }),
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.92, duration: 0.4 }),
        onComplete: () => ScrollTrigger.refresh(),
      });
    } else {
      ScrollTrigger.refresh();
    }
    gallery.querySelectorAll('[data-yt-thumb]').forEach((img) =>
      img.addEventListener('error', () => (img.src = img.src.replace('maxresdefault', 'hqdefault')), { once: true }),
    );
  };

  buttons.forEach((btn) =>
    btn.addEventListener('click', () => {
      if (btn.dataset.filter === state.filter) return;
      state.filter = btn.dataset.filter;
      state.shown = PAGE_SIZE;
      const url = new URL(location.href);
      if (state.filter === 'all') url.searchParams.delete('filter');
      else url.searchParams.set('filter', state.filter);
      history.replaceState(null, '', url);
      render(true);
    }),
  );

  moreBtn.addEventListener('click', () => {
    const before = gallery.children.length;
    state.shown += PAGE_SIZE;
    render(false);
    if (!prefersReducedMotion) gsap.from([...gallery.children].slice(before), { opacity: 0, y: 50, duration: 1, stagger: 0.05, ease: 'expo.out' });
  });

  render(false);
  if (!prefersReducedMotion) gsap.from(gallery.children, { opacity: 0, y: 60, duration: 1.1, stagger: 0.05, ease: 'expo.out', scrollTrigger: { trigger: gallery, start: 'top 85%', once: true } });

  return () => visibleItems().filter((it) => !it.film);
}

function initLightbox(getItems) {
  const box = document.querySelector('[data-lightbox]');
  if (!box || !getItems) return;
  const img = box.querySelector('[data-lb-img]');
  const title = box.querySelector('[data-lb-title]');
  const meta = box.querySelector('[data-lb-meta]');
  const indexEl = box.querySelector('[data-lb-index]');
  const totalEl = box.querySelector('[data-lb-total]');
  let items = [];
  let index = 0;
  let opener = null;

  const show = (i, dir = 0) => {
    index = (i + items.length) % items.length;
    const it = items[index];
    const swap = () => {
      img.src = pick(it, 2000);
      img.alt = it.alt;
      title.textContent = displayName(it);
      meta.textContent = it.cat === 'plan' ? CATEGORY_LABEL.plan : `${CATEGORY_LABEL[it.cat]} · ${it.location}`;
      indexEl.textContent = String(index + 1).padStart(2, '0');
      totalEl.textContent = String(items.length).padStart(2, '0');
    };
    if (!dir || prefersReducedMotion) return swap();
    gsap.timeline().to(img, { opacity: 0, x: -40 * dir, duration: 0.25, ease: 'power2.in', onComplete: swap }).fromTo(img, { x: 40 * dir }, { opacity: 1, x: 0, duration: 0.5, ease: 'expo.out' });
  };

  const open = (id, trigger) => {
    items = getItems();
    opener = trigger;
    box.hidden = false;
    show(items.findIndex((it) => it.id === id));
    requestAnimationFrame(() => box.classList.add('is-open'));
    stopScroll();
    box.querySelector('[data-lb-close]').focus({ preventScroll: true });
  };
  const close = () => {
    box.classList.remove('is-open');
    setTimeout(() => (box.hidden = true), 450);
    startScroll();
    opener?.focus({ preventScroll: true });
  };

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-lightbox-id]');
    if (t) open(t.dataset.lightboxId, t);
  });
  box.querySelector('[data-lb-close]').addEventListener('click', close);
  box.querySelector('[data-lb-prev]').addEventListener('click', () => show(index - 1, -1));
  box.querySelector('[data-lb-next]').addEventListener('click', () => show(index + 1, 1));
  document.addEventListener('keydown', (e) => {
    if (!box.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') show(index + 1, 1);
    if (e.key === 'ArrowLeft') show(index - 1, -1);
  });
  let startX = 0;
  box.addEventListener('touchstart', (e) => (startX = e.touches[0].clientX), { passive: true });
  box.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });
}

/** Hero image wall: columns drift in opposite directions as the hero scrolls away. */
function initWall() {
  if (prefersReducedMotion) return;
  document.querySelectorAll('[data-wall-col]').forEach((col) => {
    const dir = Number(col.dataset.wallCol);
    gsap.fromTo(col, { yPercent: dir * -6 }, { yPercent: dir * 10, ease: 'none', scrollTrigger: { trigger: col.closest('section'), start: 'top top', end: 'bottom top', scrub: true } });
  });
}

export function init() {
  initWall();
  initLightbox(initGallery());
}
