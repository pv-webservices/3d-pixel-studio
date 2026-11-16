// Projects: one shared record per project, with an ordered gallery of media references.
import { randomUUID } from 'node:crypto';
import { now, transaction } from '../db/index.js';
import { HttpError, notFound } from '../lib/http.js';

export const CATEGORY_LABEL = { exterior: 'Exterior CGI', interior: 'Interior CGI' };

/** Fields that must be present before a project can be published. */
export function publishProblems(p) {
  const problems = [];
  if (!p.name?.trim()) problems.push('a project name');
  if (!p.location?.trim()) problems.push('a location');
  if (!p.gallery?.length) problems.push('at least one gallery image');
  if (!p.coverMediaId) problems.push('a cover image');
  return problems;
}

export function createProjectsRepo(db, media) {
  const galleryRows = (projectId) =>
    db
      .prepare(
        `SELECT m.*, pm.category AS gallery_category, pm.position FROM project_media pm
         JOIN media m ON m.id = pm.media_id WHERE pm.project_id = ? ORDER BY pm.position`,
      )
      .all(projectId);

  const toAdmin = (row) => ({
    id: row.id,
    name: row.name,
    location: row.location,
    category: row.category,
    description: row.description,
    scope: JSON.parse(row.scope),
    status: row.status,
    coverMediaId: row.cover_media_id,
    gallery: galleryRows(row.id).map((m) => ({ media: { ...media.toMedia(m, { absolute: true }), storage: m.storage }, category: m.gallery_category })),
    onHomepage: Boolean(db.prepare('SELECT 1 FROM homepage_projects WHERE project_id = ?').get(row.id)),
    films: db.prepare('SELECT id, title, status FROM films WHERE project_id = ? ORDER BY sort_order, title').all(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  });

  const getRow = (id) => db.prepare('SELECT * FROM projects WHERE id = ?').get(id) ?? null;

  function validate(input) {
    const ids = input.gallery.map((g) => g.mediaId);
    if (new Set(ids).size !== ids.length) throw new HttpError(400, 'The same image appears twice in the gallery.', { fields: { gallery: 'Remove the duplicate image.' } });
    const known = media.existingIds(ids);
    const missing = ids.filter((id) => !known.has(id));
    if (missing.length) throw new HttpError(400, 'Some gallery images no longer exist. Reload the page and try again.', { fields: { gallery: 'Unknown image.' } });
    if (input.coverMediaId && !ids.includes(input.coverMediaId)) {
      throw new HttpError(400, 'The cover image must be one of the gallery images.', { fields: { coverMediaId: 'Choose a cover from the gallery.' } });
    }
    if (input.status === 'published') {
      const problems = publishProblems(input);
      if (problems.length) throw new HttpError(422, `To publish, add ${problems.join(', ')}.`, { fields: { status: 'Not ready to publish.' } });
    }
  }

  function writeGallery(projectId, gallery) {
    db.prepare('DELETE FROM project_media WHERE project_id = ?').run(projectId);
    const insert = db.prepare('INSERT INTO project_media (project_id, media_id, position, category) VALUES (?, ?, ?, ?)');
    gallery.forEach((g, i) => {
      insert.run(projectId, g.mediaId, i, g.category);
      if (typeof g.alt === 'string') media.setAlt(g.mediaId, g.alt);
    });
  }

  return {
    getRow,
    get(id) {
      const row = getRow(id);
      return row ? toAdmin(row) : null;
    },
    list() {
      return db
        .prepare(
          `SELECT p.*, (SELECT COUNT(*) FROM project_media pm WHERE pm.project_id = p.id) AS image_count,
             EXISTS (SELECT 1 FROM homepage_projects h WHERE h.project_id = p.id) AS on_homepage,
             m.storage AS cover_storage, m.path AS cover_path, m.width AS cover_w, m.height AS cover_h, m.sizes AS cover_sizes, m.alt AS cover_alt
           FROM projects p LEFT JOIN media m ON m.id = p.cover_media_id
           ORDER BY p.sort_order, p.name`,
        )
        .all()
        .map((r) => ({
          id: r.id,
          name: r.name,
          location: r.location,
          category: r.category,
          status: r.status,
          imageCount: r.image_count,
          onHomepage: Boolean(r.on_homepage),
          cover: r.cover_path ? media.toMedia({ id: r.cover_media_id, storage: r.cover_storage, path: r.cover_path, width: r.cover_w, height: r.cover_h, sizes: r.cover_sizes, alt: r.cover_alt }, { absolute: true }) : null,
          updatedAt: r.updated_at,
        }));
    },
    create(input, { importKey = null, sortOrder } = {}) {
      validate(input);
      const id = randomUUID();
      const t = now();
      transaction(db, () => {
        const order = sortOrder ?? (db.prepare('SELECT COALESCE(MIN(sort_order), 0) - 1 AS o FROM projects').get().o);
        db.prepare(
          `INSERT INTO projects (id, name, location, category, description, scope, cover_media_id, status, sort_order, import_key, created_at, updated_at, published_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(id, input.name, input.location, input.category, input.description, JSON.stringify(input.scope), input.coverMediaId, input.status, order, importKey, t, t, input.status === 'published' ? t : null);
        writeGallery(id, input.gallery);
      });
      return this.get(id);
    },
    update(id, input) {
      const row = getRow(id);
      if (!row) throw notFound('Project');
      validate(input);
      const t = now();
      const publishedAt = input.status === 'published' ? (row.status === 'published' ? row.published_at : t) : row.published_at;
      transaction(db, () => {
        db.prepare(
          `UPDATE projects SET name = ?, location = ?, category = ?, description = ?, scope = ?, cover_media_id = ?, status = ?, updated_at = ?, published_at = ? WHERE id = ?`,
        ).run(input.name, input.location, input.category, input.description, JSON.stringify(input.scope), input.coverMediaId, input.status, t, publishedAt, id);
        writeGallery(id, input.gallery);
      });
      return this.get(id);
    },
    /** Deleting removes the homepage reference (cascade) and unlinks related films; media stays in the library. */
    remove(id) {
      const project = this.get(id);
      if (!project) throw notFound('Project');
      db.prepare('DELETE FROM projects WHERE id = ?').run(id);
      return { removedFromHomepage: project.onHomepage, unlinkedFilms: project.films };
    },
    findByImportKey(key) {
      return db.prepare('SELECT * FROM projects WHERE import_key = ?').get(key) ?? null;
    },
  };
}
