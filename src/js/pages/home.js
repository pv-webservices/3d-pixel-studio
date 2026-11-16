// Home: Selected Work and Architectural Films are loaded from the admin API at runtime. "Selected Work"
// cards open a project pop-up (gallery + details); they stay real links to the portfolio as a fallback.
import { gsap, ScrollTrigger, prefersReducedMotion, startScroll, stopScroll } from '../core/motion.js';
import { bindYouTubeFallback, escapeHtml, fetchPublic, pad, pick, srcset } from '../content/client.js';
import { renderFilms, renderSelectedWork } from '../content/home-sections.js';

const SWIPE_PX = 50;
const CLOSE_MS = 450;
const CATEGORY = { exterior: 'Exterior', interior: 'Interior' };
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/** Projects currently rendered in Selected Work, by id, for the pop-up. */
const projectsById = new Map();
let initialised = false;

/**
 * Fetch and render the runtime sections. Called by main.js before the scroll scenes are set up; if the
 * API is slow, the scenes are set up anyway and this re-measures them once content arrives.
 * Never rejects: failures render an "unavailable" note instead of broken controls.
 */
export function prepare() {
  const works = document.querySelector('[data-works]');
  const films = document.querySelector('[data-films-grid]')?.closest('section');
  if (!works && !films) return Promise.resolve();
  if (works) renderSelectedWork(works, { projects: null, loading: true });
  if (films) renderFilms(films, { films: null, loading: true });

  return fetchPublic('home')
    .then((data) => {
      if (!Array.isArray(data?.selectedWork) || !data.films) throw new Error('Unexpected content response');
      return data;
    })
    .then(
      (data) => {
        projectsById.clear();
        data.selectedWork.forEach((p) => projectsById.set(p.id, p));
        if (works) renderSelectedWork(works, { projects: data.selectedWork });
        if (films) renderFilms(films, { films: data.films });
      },
      () => {
        if (works) renderSelectedWork(works, { projects: [], error: true });
        if (films) renderFilms(films, { films: null, error: true });
      },
    )
    .then(() => {
      if (films) bindYouTubeFallback(films);
      if (initialised) ScrollTrigger.refresh();
    });
}

function modalMarkup() {
  return `<div class="pmodal" data-pmodal role="dialog" aria-modal="true" aria-labelledby="pm-title" hidden>
  <div class="pmodal__backdrop" data-pm-close></div>
  <div class="pmodal__panel" data-pm-panel data-lenis-prevent>
    <button class="pmodal__close" type="button" data-pm-close aria-label="Close project details">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
    </button>
    <div class="pmodal__media">
      <div class="pmodal__stage" data-pm-stage>
        <img data-pm-img alt="" />
        <button class="pmodal__nav pmodal__nav--prev" type="button" data-pm-prev aria-label="Previous image"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg></button>
        <button class="pmodal__nav pmodal__nav--next" type="button" data-pm-next aria-label="Next image">${ARROW}</button>
        <p class="pmodal__count label"><span data-pm-index>01</span> / <span data-pm-total>01</span></p>
      </div>
      <ul class="pmodal__thumbs" data-pm-thumbs></ul>
    </div>
    <div class="pmodal__info" data-pm-info></div>
  </div>
</div>`;
}

function infoMarkup(project, images, number) {
  const cats = [...new Set(images.map((m) => CATEGORY[m.cat]).filter(Boolean))].join(' & ');
  const film = project.film
    ? `<button type="button" class="btn btn--gold" data-film="${escapeHtml(project.film.youtubeId)}" data-film-title="${escapeHtml(project.film.title)}" data-pm-film>
        <span class="btn__text"><span>Play the film</span><span aria-hidden="true">Play the film</span></span>
        <svg class="btn__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>`
    : '';
  const summary = project.description ? `<p class="pmodal__summary">${escapeHtml(project.description)}</p>` : '';
  const scope = project.scope?.length ? `<div class="pmodal__scope"><span class="label">Scope</span><ul>${project.scope.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul></div>` : '';
  return `<p class="pmodal__eyebrow"><span class="index">${number}</span><span class="label">${escapeHtml(project.discipline)}</span></p>
    <h2 class="h2 pmodal__title" id="pm-title">${escapeHtml(project.name)}</h2>
    <p class="pmodal__loc loc"><svg class="loc__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>${escapeHtml(project.location)}</p>
    ${summary}
    <dl class="pmodal__facts">
      <div><dt class="label">Discipline</dt><dd>${escapeHtml(project.discipline)}</dd></div>
      <div><dt class="label">Views shown</dt><dd>${images.length} ${cats ? `${escapeHtml(cats.toLowerCase())} ` : ''}renders</dd></div>
    </dl>
    ${scope}
    <div class="pmodal__actions">
      ${film}
      <a href="/work/?filter=${escapeHtml(project.category)}" class="btn${project.film ? ' btn--ghost' : ''}">
        <span class="btn__text"><span>View in portfolio</span><span aria-hidden="true">View in portfolio</span></span>${ARROW}</a>
      <a href="/project-review/" class="link-arrow">Request a project review ${ARROW}</a>
    </div>`;
}

function initProjectModal() {
  if (!document.querySelector('[data-works]')) return;
  document.body.insertAdjacentHTML('beforeend', modalMarkup());
  const box = document.querySelector('[data-pmodal]');
  const panel = box.querySelector('[data-pm-panel]');
  const img = box.querySelector('[data-pm-img]');
  const thumbs = box.querySelector('[data-pm-thumbs]');
  const info = box.querySelector('[data-pm-info]');
  const indexEl = box.querySelector('[data-pm-index]');
  const totalEl = box.querySelector('[data-pm-total]');
  const state = { images: [], index: 0, opener: null };

  const show = (i, dir = 0) => {
    const { images } = state;
    state.index = (i + images.length) % images.length;
    const m = images[state.index];
    const swap = () => {
      img.srcset = srcset(m);
      img.sizes = '(min-width: 900px) 62vw, 100vw';
      img.src = pick(m, 1280);
      img.alt = m.alt;
      indexEl.textContent = pad(state.index + 1);
      thumbs.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-current', String(j === state.index)));
      thumbs.children[state.index]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    };
    if (!dir || prefersReducedMotion) return swap();
    gsap.timeline()
      .to(img, { opacity: 0, x: -30 * dir, duration: 0.22, ease: 'power2.in', onComplete: swap })
      .fromTo(img, { x: 30 * dir }, { opacity: 1, x: 0, duration: 0.5, ease: 'expo.out' });
  };

  const open = (card) => {
    const project = projectsById.get(card.dataset.project);
    if (!project?.gallery?.length) return false;
    state.opener = card;
    state.images = project.gallery;
    const number = card.querySelector('.work-card__num')?.textContent ?? '';
    info.innerHTML = infoMarkup(project, state.images, number);
    totalEl.textContent = pad(state.images.length);
    thumbs.innerHTML = state.images
      .map((m, j) => `<li><button type="button" data-pm-thumb="${j}" aria-label="Show image ${j + 1}: ${escapeHtml(m.alt)}"><img src="${escapeHtml(pick(m, 640))}" alt="" loading="lazy" width="${m.w}" height="${m.h}" /></button></li>`)
      .join('');
    box.classList.toggle('is-single', state.images.length < 2);
    show(0);
    box.hidden = false;
    panel.scrollTop = 0;
    stopScroll();
    // Focus once the dialog is visible: a visibility:hidden element cannot take focus.
    requestAnimationFrame(() => {
      box.classList.add('is-open');
      box.querySelector('.pmodal__close').focus({ preventScroll: true });
    });
    return true;
  };

  const close = () => {
    if (box.hidden) return;
    box.classList.remove('is-open');
    setTimeout(() => (box.hidden = true), CLOSE_MS);
    startScroll();
    state.opener?.focus({ preventScroll: true });
  };

  // Delegated, so cards rendered after this runs (slow API) open the pop-up too.
  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-project]');
    if (!card || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (open(card)) e.preventDefault();
  });
  box.querySelectorAll('[data-pm-close]').forEach((el) => el.addEventListener('click', close));
  box.querySelector('[data-pm-prev]').addEventListener('click', () => show(state.index - 1, -1));
  box.querySelector('[data-pm-next]').addEventListener('click', () => show(state.index + 1, 1));
  thumbs.addEventListener('click', (e) => {
    const t = e.target.closest('[data-pm-thumb]');
    if (t) show(Number(t.dataset.pmThumb), Number(t.dataset.pmThumb) > state.index ? 1 : -1);
  });
  // The film opens in its own player above; close this sheet first so scrolling state stays consistent.
  info.addEventListener('click', (e) => e.target.closest('[data-pm-film]') && close());

  document.addEventListener('keydown', (e) => {
    if (!box.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') show(state.index + 1, 1);
    if (e.key === 'ArrowLeft') show(state.index - 1, -1);
    if (e.key === 'Tab') trapFocus(e, panel);
  });

  const stage = box.querySelector('[data-pm-stage]');
  let startX = 0;
  stage.addEventListener('touchstart', (e) => (startX = e.touches[0].clientX), { passive: true });
  stage.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > SWIPE_PX) show(state.index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });
}

/** Keep keyboard focus inside the open dialog. */
function trapFocus(e, container) {
  const focusable = [...container.querySelectorAll('a[href], button:not([disabled])')].filter((el) => el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function init() {
  initProjectModal();
  initialised = true;
}
