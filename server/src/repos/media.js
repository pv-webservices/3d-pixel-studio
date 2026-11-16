// Media assets: one row per image, shared by project galleries, covers and film thumbnails.
import { now } from '../db/index.js';
import { HttpError, notFound } from '../lib/http.js';

/**
 * Build URLs for media rows. Uploaded files are served by this API; legacy 'site' files ship with the
 * website build, so public responses keep them relative (the website resolves them on its own origin)
 * while the admin needs absolute URLs to preview them from the API origin.
 */
export function createMediaUrls(config) {
  return {
    src(row, { absolute = false } = {}) {
      if (row.storage === 'upload') return `${config.publicUrl}${row.path}`;
      return absolute ? `${config.siteUrl}${row.path}` : row.path;
    },
  };
}

export function createMediaRepo(db, urls) {
  const toMedia = (row, opts) => ({
    id: row.id,
    src: urls.src(row, opts),
    w: row.width,
    h: row.height,
    sizes: JSON.parse(row.sizes),
    alt: row.alt,
  });

  const usageOf = (id) => ({
    projects: db
      .prepare(
        `SELECT DISTINCT p.id, p.name, p.status FROM projects p
         LEFT JOIN project_media pm ON pm.project_id = p.id
         WHERE pm.media_id = ? OR p.cover_media_id = ? ORDER BY p.name`,
      )
      .all(id, id),
    films: db.prepare('SELECT id, title, status FROM films WHERE thumbnail_media_id = ? ORDER BY title').all(id),
  });

  return {
    toMedia,
    getRow(id) {
      return db.prepare('SELECT * FROM media WHERE id = ?').get(id) ?? null;
    },
    existingIds(ids) {
      if (!ids.length) return new Set();
      const rows = db.prepare(`SELECT id FROM media WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
      return new Set(rows.map((r) => r.id));
    },
    insert({ id, storage, path, width, height, sizes, alt = '', originalName = null, bytes = null, importKey = null }) {
      db.prepare(
        `INSERT INTO media (id, storage, path, width, height, sizes, alt, original_name, bytes, import_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, storage, path, width, height, JSON.stringify(sizes), alt, originalName, bytes, importKey, now());
      return this.getRow(id);
    },
    setAlt(id, alt) {
      db.prepare('UPDATE media SET alt = ? WHERE id = ?').run(alt, id);
    },
    /** Admin library listing with usage counts. */
    list({ unusedOnly = false } = {}) {
      const rows = db
        .prepare(
          `SELECT m.*,
             (SELECT COUNT(*) FROM project_media pm WHERE pm.media_id = m.id)
             + (SELECT COUNT(*) FROM projects p WHERE p.cover_media_id = m.id)
             + (SELECT COUNT(*) FROM films f WHERE f.thumbnail_media_id = m.id) AS uses
           FROM media m ORDER BY m.created_at DESC, m.id`,
        )
        .all();
      return rows
        .filter((r) => !unusedOnly || r.uses === 0)
        .map((r) => ({ ...toMedia(r, { absolute: true }), storage: r.storage, originalName: r.original_name, bytes: r.bytes, uses: r.uses, createdAt: r.created_at }));
    },
    usage: usageOf,
    /** Delete a record only when nothing references it. Returns the row so callers can remove its files. */
    remove(id) {
      const row = this.getRow(id);
      if (!row) throw notFound('Image');
      const usage = usageOf(id);
      if (usage.projects.length || usage.films.length) {
        const names = [...usage.projects.map((p) => p.name), ...usage.films.map((f) => f.title)];
        throw new HttpError(409, `This image is still used by: ${names.join(', ')}. Remove it there first.`, { usage });
      }
      db.prepare('DELETE FROM media WHERE id = ?').run(id);
      return row;
    },
  };
}
