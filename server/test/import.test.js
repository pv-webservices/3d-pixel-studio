import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { importLegacyContent } from '../src/import/legacy.js';
import { LEGACY_FILMS, LEGACY_HOMEPAGE, LEGACY_PROJECTS } from '../import/legacy-content.js';
import { PROJECTS } from '../../scripts/media-projects.mjs';
import { startServer } from './helpers.js';

const SITE_ROOT = path.resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(readFileSync(path.join(SITE_ROOT, 'src/data/media.json'), 'utf8'));
const legacy = { manifest, prefixes: PROJECTS, projects: LEGACY_PROJECTS, films: LEGACY_FILMS, homepage: LEGACY_HOMEPAGE };

describe('legacy content import', () => {
  test('imports once, is idempotent, preserves URLs and seeds the homepage without the film card', async () => {
    const srv = await startServer();
    try {
      const deps = { db: srv.db, repos: srv.repos, storage: null, legacy };
      const first = await importLegacyContent(deps);
      const nonPlan = manifest.filter((m) => m.cat !== 'plan');
      assert.equal(first.media.created, nonPlan.length);
      assert.equal(first.films.created, LEGACY_FILMS.length);
      assert.equal(first.homepage, 'seeded');

      const second = await importLegacyContent(deps);
      assert.equal(second.media.created + second.projects.created + second.films.created, 0);
      assert.equal(second.homepage, 'unchanged');
      const count = (t) => srv.db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
      assert.equal(count('projects'), first.projects.created);

      const home = await (await fetch(`${srv.base}/api/public/home`)).json();
      assert.deepEqual(
        home.selectedWork.map((p) => p.name),
        ['Oberoi 360 Tower', 'Abhyudaya Celestial', 'Lodha Villa Royale', 'Mirador Prangan', 'Moksha at Avas', 'GeeCee Evana', 'Applaud 38'],
      );
      assert.equal(home.selectedWork[0].cover.src, '/media/interior/oberoi-360-tower-grand-piano-lounge-sea-view-interior-mumbai', 'legacy URL kept');
      assert.equal(home.films.featured.youtubeId, '4MpmzYg59g0');
      assert.deepEqual(home.films.secondary.map((f) => f.youtubeId), LEGACY_HOMEPAGE.secondaryFilms);

      const work = await (await fetch(`${srv.base}/api/public/work`)).json();
      const images = work.projects.flatMap((p) => p.gallery);
      assert.equal(images.length, nonPlan.length, 'every legacy render is on Work');
      assert.ok(!images.some((m) => m.src.includes('/plans/')), 'floor plans stay out of the database');
      const skh = work.projects.find((p) => p.name === 'Shubh Kamna Heights');
      assert.equal(skh.film.youtubeId, '4MpmzYg59g0', 'related film linked by name');
    } finally {
      await srv.stop();
    }
  });

  test('re-import never overwrites admin edits or homepage choices', async () => {
    const srv = await startServer();
    try {
      const deps = { db: srv.db, repos: srv.repos, storage: null, legacy };
      await importLegacyContent(deps);
      srv.db.prepare(`UPDATE projects SET name = 'Edited' WHERE import_key = 'legacy:project:oberoi-360-tower'`).run();
      srv.db.prepare('DELETE FROM homepage_projects').run();
      srv.db.prepare(`INSERT INTO homepage_projects (project_id, position) SELECT id, 0 FROM projects WHERE import_key = 'legacy:project:the-empire'`).run();
      const again = await importLegacyContent(deps);
      assert.equal(again.homepage, 'unchanged');
      assert.equal(srv.db.prepare(`SELECT name FROM projects WHERE import_key = 'legacy:project:oberoi-360-tower'`).get().name, 'Edited');
      assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM homepage_projects').get().n, 1);
    } finally {
      await srv.stop();
    }
  });
});
