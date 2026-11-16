// Portfolio: filterable gallery (FLIP-animated), paged loading and a keyboard/swipe lightbox.
// Projects and films come from the admin API at runtime; 3D floor plans stay build-time media.
import { Flip, gsap, ScrollTrigger, prefersReducedMotion, startScroll, stopScroll } from '../core/motion.js';
import MEDIA from '../../data/media.json';
import { heroCoverEnd } from '../core/layers.js';
import { bindYouTubeFallback, escapeHtml, fetchPublic, filmImage, pick, playIcon, srcset } from '../content/client.js';

const PAGE_SIZE = 18;
const CATEGORY_LABEL = { exterior: 'Exterior CGI', interior: 'Interior CGI', plan: '3D Floor Plan', film: 'Architectural Film' };
const LAYOUT = ['', '', '', 'wide', '', '', '', '', '', 'wide'];
const PATTERN = ['exterior', 'interior', 'exterior', 'interior', 'film', 'interior', 'exterior', 'plan'];
// FLIP reflow on the narrow two-column grid overlaps tiles mid-flight; small screens get a clean fade instead.
const smallScreen = window.matchMedia('(max-width: 899px)');

const PLANS = MEDIA.filter((m) => m.cat === 'plan');
const displayName = (it) => (it.cat === 'plan' ? it.location : it.project);

/** @type {{ status: 'loading' | 'ready' | 'error', data: any }} */
const content = { status: 'loading', data: null };
let onContent = () => {};

export function prepare() {
  content.status = 'loading';
  return fetchPublic('work')
    .then((data) => {
      if (!Array.isArray(data?.projects) || !Array.isArray(data?.films)) throw new Error('Unexpected content response');
      Object.assign(content, { status: 'ready', data });
    })
    .catch(() => Object.assign(content, { status: 'error', data: null }))
    .then(() => onContent());
}

/** Flatten published projects into image tiles, add films and plans, and interleave by category. */
export function buildItems(data) {
  const images = (data?.projects ?? []).flatMap((p) => p.gallery.map((m) => ({ ...m, project: p.name, location: p.location })));
  const films = (data?.films ?? []).map((f) => ({ id: `film-${f.id}`, cat: 'film', film: true, project: f.title, location: f.location, youtubeId: f.youtubeId, kind: f.kind, thumbnail: f.thumbnail }));
  const queues = {
    exterior: images.filter((m) => m.cat === 'exterior'),
    interior: images.filter((m) => m.cat === 'interior'),
    plan: PLANS,
    film: films,
  };
  const cursors = { exterior: 0, interior: 0, plan: 0, film: 0 };
  const total = Object.values(queues).reduce((n, q) => n + q.length, 0);
  const mixed = [];
  // Every category appears in PATTERN, so each full cycle takes at least one remaining item: this ends.
  for (let i = 0; mixed.length < total; i++) {
    const cat = PATTERN[i % PATTERN.length];
    const next = queues[cat][cursors[cat]];
    if (next) {
      mixed.push(next);
      cursors[cat] += 1;
    }
  }
  return mixed;
}

function tileHtml(item, index) {
  const shape = item.cat === 'plan' ? '' : LAYOUT[index % LAYOUT.length];
  const cls = ['tile', shape && `tile--${shape}`, item.cat === 'plan' && 'tile--plan'].filter(Boolean).join(' ');
  const meta = `<span class="tile__meta"><strong>${escapeHtml(displayName(item))}</strong><span>${escapeHtml(CATEGORY_LABEL[item.cat])}</span></span>`;
  const sizes = shape === 'wide' ? '(min-width: 900px) 66vw, 100vw' : '(min-width: 900px) 33vw, 50vw';
  if (item.film) {
    const film = { title: item.project, kind: item.kind, youtubeId: item.youtubeId, thumbnail: item.thumbnail };
    return `<li class="${cls}" data-flip-id="${escapeHtml(item.id)}"><button type="button" class="tile__btn" data-film="${escapeHtml(item.youtubeId)}" data-film-title="${escapeHtml(`${item.project} — ${item.kind}`)}" data-cursor="Play">
      <span class="tile__media media">${filmImage(film, sizes)}<span class="play-chip" aria-hidden="true">${playIcon}</span></span>${meta}</button></li>`;
  }
  return `<li class="${cls}" data-flip-id="${escapeHtml(item.id)}"><button type="button" class="tile__btn" data-lightbox-id="${escapeHtml(item.id)}" data-cursor="View" aria-label="View ${escapeHtml(item.alt)}">
    <span class="tile__media media"><img src="${escapeHtml(pick(item, 1280))}" srcset="${escapeHtml(srcset(item))}" sizes="${sizes}" alt="${escapeHtml(item.alt)}" loading="lazy" decoding="async" width="${item.w}" height="${item.h}" /></span>${meta}</button></li>`;
}

function initGallery() {
  const gallery = document.querySelector('[data-gallery]');
  if (!gallery) return null;
  const moreBtn = document.querySelector('[data-more]');
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const statusBox = document.querySelector('[data-gallery-status]');
  const statusText = statusBox?.querySelector('[data-gallery-status-text]');
  const retry = statusBox?.querySelector('[data-gallery-retry]');
  let all = [];

  const params = new URLSearchParams(location.search);
  const state = { filter: CATEGORY_LABEL[params.get('filter')] ? params.get('filter') : 'all', shown: PAGE_SIZE };
  const visibleItems = () => (state.filter === 'all' ? all : all.filter((it) => it.cat === state.filter));

  const updateCounts = () => {
    const counts = all.reduce((acc, it) => ({ ...acc, [it.cat]: (acc[it.cat] ?? 0) + 1 }), { all: all.length });
    document.querySelectorAll('[data-count-for]').forEach((el) => (el.textContent = counts[el.dataset.countFor] ?? 0));
  };

  const updateStatus = () => {
    if (!statusBox) return;
    const empty = !visibleItems().length;
    const message =
      content.status === 'loading'
        ? 'Loading projects and films…'
        : content.status === 'error'
          ? 'Projects and films could not be loaded right now. Floor plans are still shown below.'
          : empty
            ? 'Nothing has been published in this category yet.'
            : '';
    statusText.textContent = message;
    statusBox.hidden = !message;
    retry.hidden = content.status !== 'error';
  };

  const swapContent = (items) => {
    gallery.innerHTML = items.slice(0, state.shown).map(tileHtml).join('');
    moreBtn.parentElement.hidden = state.shown >= items.length;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === state.filter)));
    bindYouTubeFallback(gallery);
    updateStatus();
  };

  const fadeSwap = (items) => {
    gsap.killTweensOf(gallery);
    gsap.to(gallery, {
      opacity: 0,
      duration: 0.25,
      ease: 'power2.in',
      onComplete: () => {
        swapContent(items);
        ScrollTrigger.refresh();
        gsap.to(gallery, { opacity: 1, duration: 0.45, ease: 'power2.out' });
      },
    });
  };

  const render = (animate) => {
    const items = visibleItems();
    if (animate && !prefersReducedMotion && smallScreen.matches) return fadeSwap(items);
    const flipState = animate && !prefersReducedMotion ? Flip.getState(gallery.children) : null;
    swapContent(items);
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

  /** (Re)build from the current content, e.g. when the API answers after the page was set up. */
  const load = (firstRun) => {
    all = buildItems(content.data);
    updateCounts();
    render(false);
    if (firstRun && !prefersReducedMotion && gallery.children.length) {
      gsap.from(gallery.children, { opacity: 0, y: 60, duration: 1.1, stagger: 0.05, ease: 'expo.out', scrollTrigger: { trigger: gallery, start: 'top 85%', once: true } });
    }
  };

  retry?.addEventListener('click', () => {
    content.status = 'loading';
    updateStatus();
    prepare();
  });
  onContent = () => load(false);
  load(true);

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
    const at = items.findIndex((it) => it.id === id);
    if (at < 0) return;
    opener = trigger;
    box.hidden = false;
    show(at);
    stopScroll();
    // Focus once the lightbox is visible: a visibility:hidden element cannot take focus.
    requestAnimationFrame(() => {
      box.classList.add('is-open');
      box.querySelector('[data-lb-close]').focus({ preventScroll: true });
    });
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
    const hero = col.closest('[data-hero]');
    gsap.fromTo(col, { yPercent: dir * -6 }, { yPercent: dir * 10, ease: 'none', scrollTrigger: { start: 0, end: heroCoverEnd(hero), scrub: true, invalidateOnRefresh: true } });
  });
}

export function init() {
  initWall();
  initLightbox(initGallery());
}
