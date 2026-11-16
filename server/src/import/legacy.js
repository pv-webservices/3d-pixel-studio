// Repeatable import of the website's pre-admin content into the database.
// Every record gets an import_key, so re-running skips what already exists instead of duplicating it,
// and never overwrites edits made in the admin. Homepage selections are seeded only while empty.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { transaction } from '../db/index.js';

const PLAN_CATEGORY = 'plan';

/** First matching filename prefix wins, mirroring scripts/optimize-media.mjs. */
const projectFor = (prefixes, slug) => prefixes.find(([prefix]) => slug.startsWith(`${prefix}-`) || slug === prefix) ?? null;

/**
 * Group the image manifest into projects. Floor plans are excluded: they stay a build-time Work category.
 * @returns {{ groups: Map<string, { key: string, name: string, location: string, images: object[] }>, unmatched: object[] }}
 */
export function groupLegacyMedia(manifest, prefixes) {
  const groups = new Map();
  const unmatched = [];
  for (const m of manifest) {
    if (m.cat === PLAN_CATEGORY) continue;
    const match = projectFor(prefixes, m.id);
    if (!match) {
      unmatched.push(m);
      continue;
    }
    const [key, name, location] = match;
    if (!groups.has(key)) groups.set(key, { key, name, location, images: [] });
    groups.get(key).images.push(m);
  }
  return { groups, unmatched };
}

const majorityCategory = (images) => {
  const ext = images.filter((m) => m.cat === 'exterior').length;
  return ext >= images.length - ext ? 'exterior' : 'interior';
};

/**
 * @param {object} deps
 * @param {import('node:sqlite').DatabaseSync} deps.db
 * @param {ReturnType<typeof import('../app.js').createRepos>} deps.repos
 * @param {object} deps.storage
 * @param {object} deps.legacy  { manifest, prefixes, projects, films, homepage }
 * @param {{ copyMedia?: boolean, staticDir?: string, resetHomepage?: boolean }} [options]
 */
export async function importLegacyContent({ db, repos, storage, legacy }, options = {}) {
  const report = { media: { created: 0, skipped: 0 }, projects: { created: 0, skipped: 0 }, films: { created: 0, skipped: 0 }, homepage: 'unchanged', notes: [] };
  const { groups, unmatched } = groupLegacyMedia(legacy.manifest, legacy.prefixes);

  if (unmatched.length) {
    // These renders were shown on Work as "Private Residence · India" (the media script's fallback label).
    groups.set('private-residence', { key: 'private-residence', name: 'Private Residence', location: 'India', images: unmatched, uncertain: true });
    report.notes.push(`Unmatched renders grouped as "Private Residence" (location "India", as previously displayed): ${unmatched.map((m) => m.id).join(', ')}. Review and rename or split in the admin.`);
  }

  // 1. Media records.
  const mediaIdFor = new Map();
  for (const m of legacy.manifest.filter((x) => x.cat !== PLAN_CATEGORY)) {
    const importKey = `legacy:media:${m.src}`;
    const existing = db.prepare('SELECT id FROM media WHERE import_key = ?').get(importKey);
    if (existing) {
      mediaIdFor.set(m.id, existing.id);
      report.media.skipped++;
      continue;
    }
    let storageKind = 'site';
    let mediaPath = m.src;
    if (options.copyMedia) {
      const files = m.sizes.map((w) => ({ width: w, source: path.join(options.staticDir, `${m.src}-${w}.webp`) }));
      const missing = files.find((f) => !existsSync(f.source));
      if (missing) throw new Error(`Cannot copy ${missing.source}: file not found. Run "npm run media" in the website first.`);
      mediaPath = await storage.copyVariants({ id: m.id, files });
      storageKind = 'upload';
    }
    repos.media.insert({ id: m.id, storage: storageKind, path: mediaPath, width: m.w, height: m.h, sizes: m.sizes, alt: m.alt, importKey });
    mediaIdFor.set(m.id, m.id);
    report.media.created++;
  }

  // 2. Projects (published, preserving their previous public visibility on Work).
  let order = 0;
  for (const group of groups.values()) {
    order += 1;
    const importKey = `legacy:project:${group.key}`;
    if (repos.projects.findByImportKey(importKey)) {
      report.projects.skipped++;
      continue;
    }
    const details = legacy.projects[group.key];
    const homeCard = [...legacy.homepage.selectedWork, ...legacy.homepage.excludedFilmCards].find((c) => c.project === group.key);
    const category = ['exterior', 'interior'].includes(details?.filter) ? details.filter : majorityCategory(group.images);
    const coverSlug = homeCard?.lead && group.images.some((m) => m.id === homeCard.lead) ? homeCard.lead : group.images[0].id;
    repos.projects.create(
      {
        name: details?.name ?? group.name,
        location: details?.location ?? group.location,
        category,
        description: details?.summary ?? '',
        scope: details?.scope ?? [],
        status: 'published',
        coverMediaId: mediaIdFor.get(coverSlug),
        gallery: group.images.map((m) => ({ mediaId: mediaIdFor.get(m.id), category: m.cat })),
      },
      { importKey, sortOrder: order },
    );
    report.projects.created++;
  }

  // 3. Films, linked to a project when the names match exactly.
  legacy.films.forEach((f, i) => {
    const importKey = `legacy:film:${f.id}`;
    if (repos.films.findByImportKey(importKey)) {
      report.films.skipped++;
      return;
    }
    const project = db.prepare('SELECT id FROM projects WHERE name = ? AND import_key IS NOT NULL').get(f.project);
    repos.films.create(
      { title: f.project, location: f.location, kind: f.type, youtubeId: f.id, thumbnailMediaId: null, projectId: project?.id ?? null, status: 'published' },
      { importKey, sortOrder: i + 1 },
    );
    report.films.created++;
  });

  // 4. Homepage selections: seed only when empty (or explicitly reset), never on top of editorial choices.
  const hasSelections = db.prepare('SELECT (SELECT COUNT(*) FROM homepage_projects) + (SELECT COUNT(*) FROM homepage_films) AS n').get().n > 0;
  if (!hasSelections || options.resetHomepage) {
    const projectId = (key) => repos.projects.findByImportKey(`legacy:project:${key}`)?.id;
    const filmId = (yt) => repos.films.findByImportKey(`legacy:film:${yt}`)?.id;
    transaction(db, () => {
      db.prepare('DELETE FROM homepage_projects').run();
      db.prepare('DELETE FROM homepage_films').run();
    });
    repos.homepage.saveSelectedWork(legacy.homepage.selectedWork.map((c) => projectId(c.project)).filter(Boolean));
    repos.homepage.saveFilms({ featuredFilmId: filmId(legacy.homepage.featuredFilm) ?? null, secondaryFilmIds: legacy.homepage.secondaryFilms.map(filmId).filter(Boolean) });
    report.homepage = 'seeded';
    report.notes.push(`Selected Work seeded without the former film card (${legacy.homepage.excludedFilmCards.map((c) => c.project).join(', ')}); its film is the featured homepage film.`);
  }
  return report;
}
