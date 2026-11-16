// Read models for the public website. Only published records are ever returned.
import { CATEGORY_LABEL } from './projects.js';

const HOME_GALLERY_MAX = 12;
const SHORT = { exterior: 'Exterior', interior: 'Interior' };

/** "Interior CGI", "Interior & Exterior CGI", with "Architectural Film · " when a film is linked. */
export function disciplineLabel(primary, categories, hasFilm) {
  const others = [...new Set(categories)].filter((c) => c !== primary);
  const cgi = others.length ? `${SHORT[primary]} & ${others.map((c) => SHORT[c]).join(' & ')} CGI` : CATEGORY_LABEL[primary];
  return hasFilm ? `Architectural Film · ${cgi}` : cgi;
}

export function createPublicContent(db, media) {
  const galleryStmt = db.prepare(
    `SELECT m.*, pm.category AS gallery_category FROM project_media pm JOIN media m ON m.id = pm.media_id
     WHERE pm.project_id = ? ORDER BY pm.position`,
  );
  const filmForProject = db.prepare(`SELECT youtube_id, title, kind FROM films WHERE project_id = ? AND status = 'published' ORDER BY sort_order, title LIMIT 1`);

  const toFilm = (f, publishedProjects) => ({
    id: f.id,
    title: f.title,
    location: f.location,
    kind: f.kind,
    youtubeId: f.youtube_id,
    thumbnail: f.thumbnail_media_id ? media.toMedia(media.getRow(f.thumbnail_media_id)) : null,
    projectId: f.project_id && publishedProjects.has(f.project_id) ? f.project_id : null,
  });

  const toProject = (p, { galleryMax = Infinity } = {}) => {
    const rows = galleryStmt.all(p.id);
    const gallery = rows.map((m) => ({ ...media.toMedia(m), cat: m.gallery_category }));
    const cover = gallery.find((m) => m.id === p.cover_media_id) ?? gallery[0] ?? null;
    const film = filmForProject.get(p.id);
    const ordered = cover ? [cover, ...gallery.filter((m) => m !== cover)] : gallery;
    return {
      id: p.id,
      name: p.name,
      location: p.location,
      category: p.category,
      categoryLabel: CATEGORY_LABEL[p.category],
      discipline: disciplineLabel(p.category, gallery.map((m) => m.cat), Boolean(film)),
      description: p.description,
      scope: JSON.parse(p.scope),
      cover,
      gallery: ordered.slice(0, galleryMax),
      imageCount: gallery.length,
      film: film ? { youtubeId: film.youtube_id, title: `${film.title} — ${film.kind}` } : null,
    };
  };

  const publishedProjectIds = () => new Set(db.prepare(`SELECT id FROM projects WHERE status = 'published'`).all().map((r) => r.id));

  return {
    home() {
      const published = publishedProjectIds();
      const selectedWork = db
        .prepare(
          `SELECT p.* FROM homepage_projects h JOIN projects p ON p.id = h.project_id
           WHERE p.status = 'published' AND p.cover_media_id IS NOT NULL ORDER BY h.position`,
        )
        .all()
        .map((p) => toProject(p, { galleryMax: HOME_GALLERY_MAX }))
        .filter((p) => p.cover);
      const films = db
        .prepare(`SELECT h.slot, f.* FROM homepage_films h JOIN films f ON f.id = h.film_id WHERE f.status = 'published' ORDER BY h.slot, h.position`)
        .all();
      const featured = films.find((f) => f.slot === 'featured');
      return {
        selectedWork,
        films: {
          featured: featured ? toFilm(featured, published) : null,
          secondary: films.filter((f) => f.slot === 'secondary').map((f) => toFilm(f, published)),
        },
      };
    },
    work() {
      const published = publishedProjectIds();
      const projects = db
        .prepare(`SELECT * FROM projects WHERE status = 'published' ORDER BY sort_order, name`)
        .all()
        .map((p) => toProject(p))
        .filter((p) => p.gallery.length);
      const films = db.prepare(`SELECT * FROM films WHERE status = 'published' ORDER BY sort_order, title`).all().map((f) => toFilm(f, published));
      return { projects, films };
    },
  };
}
