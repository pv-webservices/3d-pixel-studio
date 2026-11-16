// Authenticated CRUD for projects and films, plus the homepage selection settings.
import express from 'express';
import { z } from 'zod';
import { HttpError, notFound, parse, trimmed } from '../lib/http.js';
import { parseYouTubeId } from '../lib/youtube.js';

const id = z.string().trim().min(1).max(100);
const category = z.enum(['exterior', 'interior'], { error: 'Choose Exterior CGI or Interior CGI.' });
const status = z.enum(['draft', 'published']).default('draft');

const projectSchema = z.object({
  name: trimmed(120).min(1, 'Enter the project name.'),
  location: trimmed(120).default(''),
  category,
  description: trimmed(2000).default(''),
  scope: z.array(trimmed(120).min(1, 'Remove empty scope lines.')).max(12, 'Keep the scope to 12 lines or fewer.').default([]),
  status,
  coverMediaId: id.nullable().default(null),
  gallery: z
    .array(z.object({ mediaId: id, category, alt: trimmed(300).optional() }))
    .max(200, 'A gallery can hold up to 200 images.')
    .default([]),
});

const filmSchema = z.object({
  title: trimmed(120).min(1, 'Enter the film title.'),
  location: trimmed(120).default(''),
  kind: trimmed(60).default(''),
  videoUrl: z.string().trim().max(300).default(''),
  thumbnailMediaId: id.nullable().default(null),
  projectId: id.nullable().default(null),
  status,
});

const selectedWorkSchema = z.object({ projectIds: z.array(id).max(50) });
const homepageFilmsSchema = z.object({ featuredFilmId: id.nullable().default(null), secondaryFilmIds: z.array(id).max(50).default([]) });

function parseFilm(body) {
  const input = parse(filmSchema, body ?? {});
  const youtubeId = parseYouTubeId(input.videoUrl);
  if (!youtubeId) {
    throw new HttpError(400, 'Please correct the highlighted fields.', {
      fields: { videoUrl: 'Enter a YouTube link, e.g. https://www.youtube.com/watch?v=… or https://youtu.be/…' },
    });
  }
  return { ...input, kind: input.kind || '3D Walkthrough', youtubeId };
}

export function createAdminContentRouter({ projects, films, homepage }) {
  const router = express.Router();

  router.get('/overview', (req, res) => {
    const p = projects.list();
    const f = films.list();
    res.json({
      projects: { total: p.length, published: p.filter((x) => x.status === 'published').length },
      films: { total: f.length, published: f.filter((x) => x.status === 'published').length },
      homepage: homepage.getAdmin(),
      issues: homepage.issues(),
    });
  });

  router.get('/projects', (req, res) => res.json({ projects: projects.list() }));
  router.post('/projects', (req, res) => res.status(201).json({ project: projects.create(parse(projectSchema, req.body ?? {})) }));
  router.get('/projects/:id', (req, res) => {
    const project = projects.get(req.params.id);
    if (!project) throw notFound('Project');
    res.json({ project });
  });
  router.put('/projects/:id', (req, res) => res.json({ project: projects.update(req.params.id, parse(projectSchema, req.body ?? {})) }));
  router.delete('/projects/:id', (req, res) => res.json(projects.remove(req.params.id)));

  router.get('/films', (req, res) => res.json({ films: films.list() }));
  router.post('/films', (req, res) => res.status(201).json({ film: films.create(parseFilm(req.body)) }));
  router.get('/films/:id', (req, res) => {
    const film = films.get(req.params.id);
    if (!film) throw notFound('Film');
    res.json({ film });
  });
  router.put('/films/:id', (req, res) => res.json({ film: films.update(req.params.id, parseFilm(req.body)) }));
  router.delete('/films/:id', (req, res) => res.json(films.remove(req.params.id)));

  router.get('/homepage', (req, res) => res.json({ homepage: homepage.getAdmin() }));
  router.put('/homepage/selected-work', (req, res) => {
    const { projectIds } = parse(selectedWorkSchema, req.body ?? {});
    res.json({ homepage: homepage.saveSelectedWork(projectIds) });
  });
  router.put('/homepage/films', (req, res) => res.json({ homepage: homepage.saveFilms(parse(homepageFilmsSchema, req.body ?? {})) }));

  return router;
}
