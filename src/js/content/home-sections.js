// Renders the homepage's editable sections (Selected Work, Architectural Films) from API content,
// keeping the original markup so the existing CSS, GSAP scenes, cursor and film modal keep working.
import { escapeHtml, filmImage, pad, pick, playIcon, srcset } from './client.js';

const SHORT_CATEGORY = { exterior: 'Exterior', interior: 'Interior' };

function workCard(project, index) {
  const tall = index % 2 === 1;
  const sizes = tall ? '(min-width: 900px) 30vw, 70vw' : '(min-width: 900px) 46vw, 85vw';
  const c = project.cover;
  return `<li class="work-card${tall ? ' work-card--tall' : ''}">
  <a href="/work/?filter=${escapeHtml(project.category)}" class="work-card__link" data-cursor="View" data-project="${escapeHtml(project.id)}" aria-haspopup="dialog">
    <div class="work-card__media media"><img src="${escapeHtml(pick(c, 1280))}" srcset="${escapeHtml(srcset(c))}" sizes="${sizes}" width="${c.w}" height="${c.h}" alt="${escapeHtml(c.alt)}" loading="lazy" decoding="async" /></div>
    <div class="work-card__meta"><span class="work-card__num">${pad(index + 1)}</span><h3 class="h3">${escapeHtml(project.name)}</h3><span class="label">${escapeHtml([project.categoryLabel, project.location].filter(Boolean).join(' · '))}</span></div>
  </a>
</li>`;
}

/**
 * @param {HTMLElement} section  [data-works]
 * @param {{ projects: any[] | null, error?: boolean, loading?: boolean }} state
 */
export function renderSelectedWork(section, { projects, error = false, loading = false }) {
  const track = section.querySelector('[data-works-track]');
  const end = track.querySelector('.work-card--end');
  const status = section.querySelector('[data-works-status]');
  const progress = section.querySelector('.works__progress');
  track.querySelectorAll('.work-card:not(.work-card--end)').forEach((el) => el.remove());
  const list = projects ?? [];
  end.insertAdjacentHTML('beforebegin', list.map(workCard).join(''));
  section.toggleAttribute('aria-busy', loading);

  const message = loading ? 'Loading selected work…' : error ? 'Selected projects could not be loaded right now. The full portfolio is available on the Work page.' : '';
  status.textContent = message;
  status.hidden = !message;
  progress.hidden = list.length === 0;
  const total = section.querySelector('[data-works-total]');
  if (total) total.textContent = pad(list.length);
  const current = section.querySelector('[data-works-current]');
  if (current) current.textContent = pad(Math.min(1, list.length));
  const cats = section.querySelector('[data-works-cats]');
  if (cats) cats.textContent = [...new Set(list.map((p) => SHORT_CATEGORY[p.category]))].join(' · ');
}

function filmButton(film, feature) {
  const title = escapeHtml(`${film.title} — ${film.kind}`);
  const media = `<span class="film__media media"${feature ? ' data-reveal' : ''}>${filmImage(film, feature ? '(min-width: 900px) 55vw, 100vw' : '(min-width: 900px) 20vw, 50vw')}<span class="film__play" aria-hidden="true">${playIcon}</span></span>`;
  const meta = feature
    ? `<span class="film__meta"><span class="label">${escapeHtml(film.kind)}</span><strong>${escapeHtml(film.title)}</strong><span class="muted">${escapeHtml(film.location)}</span></span>`
    : `<span class="film__meta"><strong>${escapeHtml(film.title)}</strong><span class="muted">${escapeHtml(film.location)}</span></span>`;
  return `<button type="button" class="film${feature ? ' film--feature' : ''}" data-film="${escapeHtml(film.youtubeId)}" data-film-title="${title}" data-cursor="Play">${media}${meta}</button>`;
}

/**
 * @param {HTMLElement} section  the films section
 * @param {{ films: { featured: any, secondary: any[] } | null, error?: boolean, loading?: boolean }} state
 */
export function renderFilms(section, { films, error = false, loading = false }) {
  const grid = section.querySelector('[data-films-grid]');
  const status = section.querySelector('[data-films-status]');
  const featured = films?.featured ?? null;
  const secondary = films?.secondary ?? [];
  const count = (featured ? 1 : 0) + secondary.length;

  grid.innerHTML = `${featured ? filmButton(featured, true) : ''}${secondary.length ? `<div class="films__side" data-stagger>${secondary.map((f) => filmButton(f, false)).join('')}</div>` : ''}`;
  grid.classList.toggle('films__grid--no-feature', !featured);
  grid.classList.toggle('films__grid--feature-only', Boolean(featured) && !secondary.length);
  grid.hidden = count === 0;
  section.toggleAttribute('aria-busy', loading);

  const message = loading ? 'Loading films…' : error ? 'Films could not be loaded right now.' : '';
  status.hidden = !message;
  status.querySelector('[data-films-status-text]').textContent = message;
  // Nothing selected (and nothing to report): the section has no content, so it is not shown.
  section.hidden = count === 0 && !message;
}
