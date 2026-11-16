import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { parseYouTubeId } from '../src/lib/youtube.js';
import { disciplineLabel } from '../src/repos/public-content.js';
import { client, filmBody, projectBody, startServer, uploadImages } from './helpers.js';

const pub = async (srv, name) => (await client(srv.base).get(`/api/public/${name}`)).data;

describe('projects, films and homepage selections', () => {
  let srv;
  let c;
  before(async () => {
    srv = await startServer();
    c = client(srv.base);
    await c.login();
  });
  after(() => srv.stop());
  beforeEach(() => {
    srv.db.exec('DELETE FROM homepage_projects; DELETE FROM homepage_films; DELETE FROM films; DELETE FROM project_media; DELETE FROM projects;');
  });

  const createProject = async (overrides = {}, images = 2) => {
    const ids = await uploadImages(c, images);
    const res = await c.post('/api/admin/projects', projectBody(ids, overrides));
    assert.equal(res.status, 201, JSON.stringify(res.data));
    return res.data.project;
  };
  const createFilm = async (overrides = {}) => {
    const res = await c.post('/api/admin/films', filmBody(overrides));
    assert.equal(res.status, 201, JSON.stringify(res.data));
    return res.data.film;
  };

  test('drafts are never exposed publicly', async () => {
    await createProject({ name: 'Secret Draft', status: 'draft' });
    await createFilm({ title: 'Draft Film', status: 'draft' });
    const work = await pub(srv, 'work');
    assert.equal(work.projects.length, 0);
    assert.equal(work.films.length, 0);
    assert.ok(!JSON.stringify(await pub(srv, 'home')).includes('Secret Draft'));
  });

  test('publishing requires the essential fields', async () => {
    const res = await c.post('/api/admin/projects', projectBody([], { coverMediaId: null }));
    assert.equal(res.status, 422);
    assert.match(res.data.error, /gallery image/);
    const noVideo = await c.post('/api/admin/films', filmBody({ videoUrl: 'https://vimeo.com/123' }));
    assert.equal(noVideo.status, 400);
    assert.ok(noVideo.data.fields.videoUrl);
  });

  test('publishing a Work item does not feature it on the homepage', async () => {
    await createProject();
    await createFilm();
    const home = await pub(srv, 'home');
    assert.equal(home.selectedWork.length, 0);
    assert.equal(home.films.featured, null);
    assert.equal(home.films.secondary.length, 0);
  });

  test('selection order is kept and unrelated uploads leave it unchanged', async () => {
    const a = await createProject({ name: 'A' });
    const b = await createProject({ name: 'B' });
    assert.equal((await c.put('/api/admin/homepage/selected-work', { projectIds: [b.id, a.id] })).status, 200);
    await createProject({ name: 'C (new upload)' });
    const home = await pub(srv, 'home');
    assert.deepEqual(home.selectedWork.map((p) => p.name), ['B', 'A']);
    assert.ok(home.selectedWork.every((p) => p.cover && p.gallery.length));
  });

  test('a shared edit updates both the Work page and the homepage', async () => {
    const p = await createProject({ name: 'Before' });
    await c.put('/api/admin/homepage/selected-work', { projectIds: [p.id] });
    const full = (await c.get(`/api/admin/projects/${p.id}`)).data.project;
    const body = projectBody(full.gallery.map((g) => g.media.id), { name: 'After', location: 'Thane' });
    assert.equal((await c.put(`/api/admin/projects/${p.id}`, body)).status, 200);
    const [home, work] = [await pub(srv, 'home'), await pub(srv, 'work')];
    assert.equal(home.selectedWork[0].name, 'After');
    assert.equal(work.projects[0].name, 'After');
    assert.equal(home.selectedWork[0].location, 'Thane');
  });

  test('removing a homepage selection keeps the Work record', async () => {
    const p = await createProject();
    await c.put('/api/admin/homepage/selected-work', { projectIds: [p.id] });
    await c.put('/api/admin/homepage/selected-work', { projectIds: [] });
    assert.equal((await pub(srv, 'home')).selectedWork.length, 0);
    assert.equal((await pub(srv, 'work')).projects.length, 1);
  });

  test('Selected Work rejects drafts and duplicates', async () => {
    const p = await createProject();
    const draft = await createProject({ status: 'draft', name: 'Draft' });
    assert.equal((await c.put('/api/admin/homepage/selected-work', { projectIds: [p.id, p.id] })).status, 400);
    assert.equal((await c.put('/api/admin/homepage/selected-work', { projectIds: [draft.id] })).status, 422);
  });

  test('unpublishing a selected project hides it publicly and flags it in the admin', async () => {
    const p = await createProject();
    await c.put('/api/admin/homepage/selected-work', { projectIds: [p.id] });
    const full = (await c.get(`/api/admin/projects/${p.id}`)).data.project;
    await c.put(`/api/admin/projects/${p.id}`, projectBody(full.gallery.map((g) => g.media.id), { status: 'draft' }));
    assert.equal((await pub(srv, 'home')).selectedWork.length, 0);
    const admin = (await c.get('/api/admin/homepage')).data.homepage;
    assert.equal(admin.selectedWork[0].problem, 'unpublished');
    const overview = (await c.get('/api/admin/overview')).data;
    assert.equal(overview.issues.length, 1);
  });

  test('deleting a selected project removes its homepage reference and unlinks films', async () => {
    const p = await createProject();
    const f = await createFilm({ projectId: p.id });
    await c.put('/api/admin/homepage/selected-work', { projectIds: [p.id] });
    const res = await c.del(`/api/admin/projects/${p.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.data.removedFromHomepage, true);
    assert.equal((await c.get('/api/admin/homepage')).data.homepage.selectedWork.length, 0);
    assert.equal((await c.get(`/api/admin/films/${f.id}`)).data.film.projectId, null);
    assert.equal((await pub(srv, 'home')).selectedWork.length, 0);
  });

  test('featured film rules: one featured, distinct secondaries, published only, limit', async () => {
    const films = [];
    for (let i = 0; i < 6; i++) films.push(await createFilm({ title: `Film ${i}` }));
    const [f0, f1, f2, f3, f4, f5] = films.map((f) => f.id);
    assert.equal((await c.put('/api/admin/homepage/films', { featuredFilmId: f0, secondaryFilmIds: [f0, f1] })).status, 400);
    assert.equal((await c.put('/api/admin/homepage/films', { featuredFilmId: f0, secondaryFilmIds: [f1, f1] })).status, 400);
    assert.equal((await c.put('/api/admin/homepage/films', { featuredFilmId: f0, secondaryFilmIds: [f1, f2, f3, f4, f5] })).status, 400);
    const draft = await createFilm({ title: 'Draft', status: 'draft' });
    assert.equal((await c.put('/api/admin/homepage/films', { featuredFilmId: draft.id, secondaryFilmIds: [] })).status, 422);

    assert.equal((await c.put('/api/admin/homepage/films', { featuredFilmId: f2, secondaryFilmIds: [f4, f1] })).status, 200);
    const home = await pub(srv, 'home');
    assert.equal(home.films.featured.title, 'Film 2');
    assert.deepEqual(home.films.secondary.map((f) => f.title), ['Film 4', 'Film 1']);

    // Removing the featured selection leaves the film in Work and promotes nothing automatically.
    await c.put('/api/admin/homepage/films', { featuredFilmId: null, secondaryFilmIds: [f4, f1] });
    const after = await pub(srv, 'home');
    assert.equal(after.films.featured, null);
    assert.equal(after.films.secondary.length, 2);
    assert.equal((await pub(srv, 'work')).films.length, 6);
  });

  test('deleting or unpublishing a selected film leaves no broken public reference', async () => {
    const f1 = await createFilm({ title: 'Featured' });
    const f2 = await createFilm({ title: 'Side' });
    await c.put('/api/admin/homepage/films', { featuredFilmId: f1.id, secondaryFilmIds: [f2.id] });
    await c.put(`/api/admin/films/${f2.id}`, filmBody({ title: 'Side', status: 'draft' }));
    await c.del(`/api/admin/films/${f1.id}`);
    const home = await pub(srv, 'home');
    assert.equal(home.films.featured, null);
    assert.equal(home.films.secondary.length, 0);
    const admin = (await c.get('/api/admin/homepage')).data.homepage;
    assert.equal(admin.featuredFilm, null);
    assert.equal(admin.secondaryFilms[0].problem, 'unpublished');
  });

  test('a project can have still renders and a related film; the pop-up gets the film', async () => {
    const p = await createProject({ name: 'Township' });
    await createFilm({ title: 'Township', projectId: p.id, videoUrl: 'https://www.youtube.com/watch?v=6qBQmVbrGW8' });
    await c.put('/api/admin/homepage/selected-work', { projectIds: [p.id] });
    const home = await pub(srv, 'home');
    assert.equal(home.selectedWork[0].film.youtubeId, '6qBQmVbrGW8');
    assert.match(home.selectedWork[0].discipline, /^Architectural Film · /);
  });

  test('public responses are cacheable for the documented interval and support revalidation', async () => {
    const res = await fetch(`${srv.base}/api/public/home`);
    assert.match(res.headers.get('cache-control'), /max-age=60/);
    const etag = res.headers.get('etag');
    assert.ok(etag);
    // fetch() adds "Cache-Control: no-cache" to manual conditional requests (Fetch spec), which forces a
    // full response; a browser revalidating its cached copy sends max-age=0 instead, as here.
    const again = await fetch(`${srv.base}/api/public/home`, { headers: { 'If-None-Match': etag, 'Cache-Control': 'max-age=0' } });
    assert.equal(again.status, 304);
  });

  test('CORS is only granted to configured origins', async () => {
    const allowed = await fetch(`${srv.base}/api/public/work`, { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const other = await fetch(`${srv.base}/api/public/work`, { headers: { Origin: 'https://elsewhere.example' } });
    assert.equal(other.headers.get('access-control-allow-origin'), null);
  });
});

describe('helpers', () => {
  test('parseYouTubeId accepts common link formats and rejects others', () => {
    for (const url of ['https://www.youtube.com/watch?v=4MpmzYg59g0', 'https://youtu.be/4MpmzYg59g0?t=3', 'https://youtube.com/shorts/4MpmzYg59g0', 'https://www.youtube-nocookie.com/embed/4MpmzYg59g0', '4MpmzYg59g0', 'https://m.youtube.com/watch?v=4MpmzYg59g0&list=x']) {
      assert.equal(parseYouTubeId(url), '4MpmzYg59g0', url);
    }
    for (const bad of ['', 'https://vimeo.com/1234', 'https://youtube.com.evil.example/watch?v=4MpmzYg59g0', 'javascript:alert(1)', 'https://www.youtube.com/watch?v=short']) {
      assert.equal(parseYouTubeId(bad), null, bad);
    }
  });

  test('disciplineLabel matches the original homepage wording', () => {
    assert.equal(disciplineLabel('interior', ['interior'], false), 'Interior CGI');
    assert.equal(disciplineLabel('interior', ['interior', 'exterior'], false), 'Interior & Exterior CGI');
    assert.equal(disciplineLabel('exterior', ['exterior', 'interior'], true), 'Architectural Film · Exterior & Interior CGI');
  });
});
