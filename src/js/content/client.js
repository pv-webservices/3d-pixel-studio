// Runtime content from the admin API. Only the public, read-only endpoints are used here; the API base
// URL is not a secret. Responses are cached by the browser for the API's max-age (see server README).
const API_BASE = String(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
const TIMEOUT_MS = 8000;

/**
 * @param {'home' | 'work'} name
 * @returns {Promise<any>}
 */
export async function fetchPublic(name) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/public/${name}`, { signal: controller.signal, credentials: 'omit', headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Content request failed (${res.status})`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const srcset = (m) => m.sizes.map((w) => `${m.src}-${w}.webp ${w}w`).join(', ');
export const pick = (m, max) => `${m.src}-${m.sizes.filter((w) => w <= max).at(-1) ?? m.sizes[0]}.webp`;
export const ytThumb = (id, quality = 'maxresdefault') => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/${quality}.jpg`;
export const pad = (n) => String(n).padStart(2, '0');

const PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
export const playIcon = PLAY_ICON;

/** Thumbnail <img> for a film: the custom upload when set, otherwise YouTube's (with fallback via data-yt-thumb). */
export function filmImage(film, sizes) {
  const alt = escapeHtml(`${film.title} ${String(film.kind || 'film').toLowerCase()} film`);
  if (film.thumbnail) {
    const t = film.thumbnail;
    return `<img src="${escapeHtml(pick(t, 1280))}" srcset="${escapeHtml(srcset(t))}" sizes="${sizes}" alt="${alt}" loading="lazy" decoding="async" width="${t.w}" height="${t.h}" />`;
  }
  return `<img src="${escapeHtml(ytThumb(film.youtubeId))}" alt="${alt}" loading="lazy" width="1280" height="720" data-yt-thumb />`;
}

/** YouTube serves a 120px grey placeholder (not an error) when maxres is missing; fall back to hqdefault. */
export function bindYouTubeFallback(scope) {
  scope.querySelectorAll('[data-yt-thumb]').forEach((img) => {
    const fallback = () => {
      if (img.src.includes('maxresdefault')) img.src = img.src.replace('maxresdefault', 'hqdefault');
    };
    img.addEventListener('error', fallback, { once: true });
    img.addEventListener('load', () => img.naturalWidth === 120 && fallback());
    if (img.complete && img.naturalWidth === 120) fallback();
  });
}
