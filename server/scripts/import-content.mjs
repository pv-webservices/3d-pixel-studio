// Import the website's existing projects, films, media references and homepage selections.
// Usage: npm run import [-- --copy-media] [-- --reset-homepage]
//   --copy-media      copy the optimised legacy images into DATA_DIR/uploads (served by the API)
//                     instead of referencing the copies deployed with the website under /media/.
//   --reset-homepage  replace the current homepage selections with the legacy ones.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRepos, defaultLogger } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db/index.js';
import { importLegacyContent } from '../src/import/legacy.js';
import { createLocalStorage } from '../src/media/storage.js';
import { LEGACY_FILMS, LEGACY_HOMEPAGE, LEGACY_PROJECTS } from '../import/legacy-content.js';
import { PROJECTS } from '../../scripts/media-projects.mjs';

const SITE_ROOT = path.resolve(import.meta.dirname, '../..');
const args = new Set(process.argv.slice(2));

const config = loadConfig();
const db = openDatabase(config.dbFile);
const storage = createLocalStorage(config);
await storage.init();

const manifest = JSON.parse(readFileSync(path.join(SITE_ROOT, 'src/data/media.json'), 'utf8'));
const report = await importLegacyContent(
  { db, repos: createRepos(db, config), storage, legacy: { manifest, prefixes: PROJECTS, projects: LEGACY_PROJECTS, films: LEGACY_FILMS, homepage: LEGACY_HOMEPAGE } },
  { copyMedia: args.has('--copy-media'), staticDir: path.join(SITE_ROOT, 'static'), resetHomepage: args.has('--reset-homepage') },
);
db.close();

defaultLogger.info(`Database: ${config.dbFile}`);
defaultLogger.info(`Media    created ${report.media.created}, already present ${report.media.skipped}`);
defaultLogger.info(`Projects created ${report.projects.created}, already present ${report.projects.skipped}`);
defaultLogger.info(`Films    created ${report.films.created}, already present ${report.films.skipped}`);
defaultLogger.info(`Homepage ${report.homepage}`);
report.notes.forEach((n) => defaultLogger.info(`Note: ${n}`));
