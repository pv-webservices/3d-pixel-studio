// Validates an uploaded image by decoding it (not by trusting the filename or MIME type) and
// produces the same responsive WebP widths the static media pipeline uses (640 / 1280 / 2000).
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { HttpError } from '../lib/http.js';

export const WIDTHS = [640, 1280, 2000];
const QUALITY = 76;
// ~60 MP (e.g. 10000 × 6000) is far above render sizes and bounds decode memory.
const MAX_INPUT_PIXELS = 60_000_000;
const MIN_WIDTH = 320;
const FORMATS = { jpeg: 'jpg', png: 'png', webp: 'webp' };

/** Lowercase a-z0-9 slug, safe for filenames and URLs. */
export function safeSlug(name, max = 60) {
  const base = String(name ?? '')
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return base || 'image';
}

/** Widths to generate for an image of the given width (mirrors scripts/optimize-media.mjs). */
export function variantWidths(width) {
  const sizes = WIDTHS.filter((w) => w < width).concat(width < WIDTHS.at(-1) ? [width] : []);
  return [...new Set(sizes.length ? sizes : [width])].slice(0, 3);
}

/**
 * @param {Buffer} buffer
 * @param {string} originalName
 */
export async function processImage(buffer, originalName) {
  let meta;
  try {
    meta = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new HttpError(415, 'This file could not be read as an image. Upload a JPEG, PNG or WebP file.');
  }
  const ext = FORMATS[meta.format];
  if (!ext) throw new HttpError(415, 'Unsupported image format. Upload a JPEG, PNG or WebP file.');
  if ((meta.pages ?? 1) > 1) throw new HttpError(415, 'Animated images are not supported.');

  // Respect EXIF orientation so portrait photos are not stored sideways.
  const oriented = (meta.orientation ?? 1) >= 5;
  const width = oriented ? meta.height : meta.width;
  const height = oriented ? meta.width : meta.height;
  if (width < MIN_WIDTH) throw new HttpError(422, `Image is too small (${width}px wide). Use at least ${MIN_WIDTH}px; 2000px or more is recommended.`);

  const id = `${safeSlug(originalName)}-${randomBytes(4).toString('hex')}`;
  const sizes = variantWidths(width);
  // One resize at a time keeps peak memory low on small (512 MB) instances.
  const variants = [];
  for (const w of sizes) {
    const out = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).rotate().resize({ width: w }).webp({ quality: QUALITY, effort: 4 }).toBuffer();
    variants.push({ width: w, buffer: out });
  }
  return { id, ext, width, height, sizes, variants };
}
