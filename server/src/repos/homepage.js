// Homepage settings: ordered references to shared project and film records. No content is copied here.
import { transaction } from '../db/index.js';
import { HttpError } from '../lib/http.js';

// The current design shows 8 Selected Work cards and 1 + 4 film cards. The pinned horizontal track
// scales to any count, so a few more projects are allowed; the film side grid is designed for four.
export const LIMITS = { selectedWork: 12, secondaryFilms: 4 };

export function createHomepageRepo(db, media) {
  const coverOf = (mediaId) => {
    const row = mediaId ? media.getRow(mediaId) : null;
    return row ? media.toMedia(row, { absolute: true }) : null;
  };

  /** Why a reference cannot currently be shown publicly, or null when it can. */
  const projectProblem = (p) => (!p ? 'deleted' : p.status !== 'published' ? 'unpublished' : !p.cover_media_id ? 'no-cover' : null);
  const filmProblem = (f) => (!f ? 'deleted' : f.status !== 'published' ? 'unpublished' : null);

  const getAdmin = () => {
    const projects = db
      .prepare('SELECT h.position, p.* FROM homepage_projects h JOIN projects p ON p.id = h.project_id ORDER BY h.position')
      .all()
      .map((p) => ({
        id: p.id,
        name: p.name,
        location: p.location,
        category: p.category,
        status: p.status,
        cover: coverOf(p.cover_media_id),
        problem: projectProblem(p),
      }));
    const films = db.prepare('SELECT h.slot, h.position, f.* FROM homepage_films h JOIN films f ON f.id = h.film_id ORDER BY h.slot, h.position').all();
    const filmView = (f) => ({
      id: f.id,
      title: f.title,
      location: f.location,
      youtubeId: f.youtube_id,
      status: f.status,
      thumbnail: coverOf(f.thumbnail_media_id),
      problem: filmProblem(f),
    });
    const featured = films.find((f) => f.slot === 'featured');
    return {
      limits: LIMITS,
      selectedWork: projects,
      featuredFilm: featured ? filmView(featured) : null,
      secondaryFilms: films.filter((f) => f.slot === 'secondary').map(filmView),
    };
  };

  return {
    getAdmin,
    /** Problems shown on the admin dashboard so hidden homepage cards are noticed. */
    issues() {
      const h = getAdmin();
      return [
        ...h.selectedWork.filter((p) => p.problem).map((p) => ({ section: 'Selected Work', name: p.name, problem: p.problem })),
        ...[h.featuredFilm, ...h.secondaryFilms].filter((f) => f?.problem).map((f) => ({ section: 'Architectural Films', name: f.title, problem: f.problem })),
      ];
    },
    saveSelectedWork(projectIds) {
      if (new Set(projectIds).size !== projectIds.length) throw new HttpError(400, 'A project can only appear once in Selected Work.');
      if (projectIds.length > LIMITS.selectedWork) throw new HttpError(400, `Selected Work holds up to ${LIMITS.selectedWork} projects.`);
      const get = db.prepare('SELECT * FROM projects WHERE id = ?');
      // Checks run inside the write transaction, so a concurrent unpublish cannot slip between check and save.
      transaction(db, () => {
        for (const id of projectIds) {
          const p = get.get(id);
          const problem = projectProblem(p);
          if (problem === 'deleted') throw new HttpError(400, 'One of the selected projects no longer exists. Reload and try again.');
          if (problem === 'unpublished') throw new HttpError(422, `"${p.name}" is a draft. Publish it in Work first, or remove it from Selected Work.`);
          if (problem === 'no-cover') throw new HttpError(422, `"${p.name}" has no cover image.`);
        }
        db.prepare('DELETE FROM homepage_projects').run();
        const insert = db.prepare('INSERT INTO homepage_projects (project_id, position) VALUES (?, ?)');
        projectIds.forEach((id, i) => insert.run(id, i));
      });
      return getAdmin();
    },
    saveFilms({ featuredFilmId, secondaryFilmIds }) {
      if (new Set(secondaryFilmIds).size !== secondaryFilmIds.length) throw new HttpError(400, 'A film can only appear once.');
      if (featuredFilmId && secondaryFilmIds.includes(featuredFilmId)) throw new HttpError(400, 'The featured film cannot also be a smaller card.');
      if (secondaryFilmIds.length > LIMITS.secondaryFilms) throw new HttpError(400, `Up to ${LIMITS.secondaryFilms} smaller film cards can be shown.`);
      const get = db.prepare('SELECT * FROM films WHERE id = ?');
      transaction(db, () => {
        for (const id of [featuredFilmId, ...secondaryFilmIds].filter(Boolean)) {
          const f = get.get(id);
          const problem = filmProblem(f);
          if (problem === 'deleted') throw new HttpError(400, 'One of the selected films no longer exists. Reload and try again.');
          if (problem === 'unpublished') throw new HttpError(422, `"${f.title}" is a draft. Publish it in Work first, or remove it from the homepage.`);
        }
        db.prepare('DELETE FROM homepage_films').run();
        const insert = db.prepare('INSERT INTO homepage_films (film_id, slot, position) VALUES (?, ?, ?)');
        if (featuredFilmId) insert.run(featuredFilmId, 'featured', 0);
        secondaryFilmIds.forEach((id, i) => insert.run(id, 'secondary', i));
      });
      return getAdmin();
    },
  };
}
