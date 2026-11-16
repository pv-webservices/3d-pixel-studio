// Accepts the YouTube link formats editors are likely to paste and returns the 11-character video id.
const ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be']);

/**
 * @param {string} input  a YouTube URL, or a bare video id
 * @returns {string | null}
 */
export function parseYouTubeId(input) {
  const value = String(input ?? '').trim();
  if (ID.test(value)) return value;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!['https:', 'http:'].includes(url.protocol) || !HOSTS.has(url.hostname.toLowerCase())) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  let id = null;
  if (url.hostname.toLowerCase() === 'youtu.be') id = parts[0];
  else if (parts[0] === 'watch') id = url.searchParams.get('v');
  else if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) id = parts[1];
  return id && ID.test(id) ? id : null;
}

export const youtubeUrl = (id) => `https://www.youtube.com/watch?v=${id}`;
export const youtubeThumb = (id, quality = 'maxresdefault') => `https://i.ytimg.com/vi/${id}/${quality}.jpg`;
