// Architectural films: YouTube-hosted videos with an optional custom thumbnail and related project.
import { randomUUID } from 'node:crypto';
import { now } from '../db/index.js';
import { HttpError, notFound } from '../lib/http.js';
import { youtubeThumb, youtubeUrl } from '../lib/youtube.js';

export function filmPublishProblems(f) {
  const problems = [];
  if (!f.title?.trim()) problems.push('a title');
  if (!f.location?.trim()) problems.push('a location');
  if (!f.youtubeId) problems.push('a valid YouTube link');
  return problems;
}

export function createFilmsRepo(db, media) {
  const getRow = (id) => db.prepare('SELECT * FROM films WHERE id = ?').get(id) ?? null;

  const homepageSlot = (id) => db.prepare('SELECT slot FROM homepage_films WHERE film_id = ?').get(id)?.slot ?? null;

  const toAdmin = (row) => {
    const thumb = row.thumbnail_media_id ? media.getRow(row.thumbnail_media_id) : null;
    const project = row.project_id ? db.prepare('SELECT id, name, status FROM projects WHERE id = ?').get(row.project_id) : null;
    return {
      id: row.id,
      title: row.title,
      location: row.location,
      kind: row.kind,
      youtubeId: row.youtube_id,
      youtubeUrl: youtubeUrl(row.youtube_id),
      thumbnail: thumb ? media.toMedia(thumb, { absolute: true }) : null,
      thumbnailMediaId: row.thumbnail_media_id,
      youtubeThumbnail: youtubeThumb(row.youtube_id, 'hqdefault'),
      projectId: row.project_id,
      project: project ? { ...project } : null,
      status: row.status,
      homepageSlot: homepageSlot(row.id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
    };
  };

  function validate(input) {
    if (input.thumbnailMediaId && !media.getRow(input.thumbnailMediaId)) {
      throw new HttpError(400, 'The thumbnail image no longer exists.', { fields: { thumbnailMediaId: 'Upload the thumbnail again.' } });
    }
    if (input.projectId && !db.prepare('SELECT 1 FROM projects WHERE id = ?').get(input.projectId)) {
      throw new HttpError(400, 'The related project no longer exists.', { fields: { projectId: 'Choose another project or none.' } });
    }
    if (input.status === 'published') {
      const problems = filmPublishProblems(input);
      if (problems.length) throw new HttpError(422, `To publish, add ${problems.join(', ')}.`, { fields: { status: 'Not ready to publish.' } });
    }
  }

  return {
    getRow,
    get(id) {
      const row = getRow(id);
      return row ? toAdmin(row) : null;
    },
    list() {
      return db.prepare('SELECT * FROM films ORDER BY sort_order, title').all().map(toAdmin);
    },
    create(input, { importKey = null, sortOrder } = {}) {
      validate(input);
      const id = randomUUID();
      const t = now();
      const order = sortOrder ?? db.prepare('SELECT COALESCE(MIN(sort_order), 0) - 1 AS o FROM films').get().o;
      db.prepare(
        `INSERT INTO films (id, title, location, kind, youtube_id, thumbnail_media_id, project_id, status, sort_order, import_key, created_at, updated_at, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, input.title, input.location, input.kind, input.youtubeId, input.thumbnailMediaId, input.projectId, input.status, order, importKey, t, t, input.status === 'published' ? t : null);
      return this.get(id);
    },
    update(id, input) {
      const row = getRow(id);
      if (!row) throw notFound('Film');
      validate(input);
      const t = now();
      const publishedAt = input.status === 'published' ? (row.status === 'published' ? row.published_at : t) : row.published_at;
      db.prepare(
        `UPDATE films SET title = ?, location = ?, kind = ?, youtube_id = ?, thumbnail_media_id = ?, project_id = ?, status = ?, updated_at = ?, published_at = ? WHERE id = ?`,
      ).run(input.title, input.location, input.kind, input.youtubeId, input.thumbnailMediaId, input.projectId, input.status, t, publishedAt, id);
      return this.get(id);
    },
    remove(id) {
      const film = this.get(id);
      if (!film) throw notFound('Film');
      db.prepare('DELETE FROM films WHERE id = ?').run(id);
      return { removedFromHomepage: film.homepageSlot };
    },
    findByImportKey(key) {
      return db.prepare('SELECT * FROM films WHERE import_key = ?').get(key) ?? null;
    },
  };
}
