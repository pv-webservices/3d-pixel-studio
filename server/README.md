# 3d Pixel Studio — content API and admin panel

A small Node.js service that stores portfolio projects, architectural films, uploaded images and the
homepage selections, serves them to the public website at runtime, and hosts the admin panel at `/admin/`.

- **Stack:** Node.js 24, Express 5, SQLite through Node's built-in `node:sqlite`, `sharp` for images,
  `zod` for validation, `helmet` for security headers. No build step; the admin UI is plain ES modules.
- **Data:** one SQLite file plus image files, all under `DATA_DIR` (a persistent disk in production).
- **Why this design:** see [Why a small custom backend](#why-a-small-custom-backend).

## Contents

1. [Local setup](#local-setup)
2. [Environment variables](#environment-variables)
3. [Database, migrations and content import](#database-migrations-and-content-import)
4. [Admin accounts](#admin-accounts)
5. [Media storage and image processing](#media-storage-and-image-processing)
6. [Publishing, caching and invalidation](#publishing-caching-and-invalidation)
7. [Connecting the website](#connecting-the-website)
8. [Deploying to Render](#deploying-to-render)
9. [Backup and recovery](#backup-and-recovery)
10. [Security notes](#security-notes)
11. [API reference](#api-reference)
12. [Tests](#tests)
13. [Known limitations](#known-limitations)
14. [Why a small custom backend](#why-a-small-custom-backend)

## Local setup

Requires Node.js 24.15 or newer (24.x). No paid service or Docker is needed.

```bash
cd server
npm install
cp .env.example .env          # local defaults; edit if ports differ
npm run import                # one-time: load existing projects, films and homepage picks
npm run admin:create -- --email you@example.com   # prompts for a password (12+ characters)
npm run dev                   # API + admin on http://localhost:8787
```

In a second terminal, from the repository root:

```bash
npm run dev                   # website on http://localhost:5173 (proxies /api to :8787)
```

Open the admin at <http://localhost:8787/admin/> and the website at <http://localhost:5173/>.
`.claude/launch.json` also defines `api`, `dev` and `preview` configurations.

## Environment variables

See [`.env.example`](./.env.example). None of these are exposed to the website bundle.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` enables Secure cookies, HSTS and required-variable checks |
| `PORT` | `8787` | Listen port (Render sets this automatically) |
| `DATA_DIR` | `./data` | Database, uploads, originals, backups. **Must be persistent storage in production** |
| `API_PUBLIC_URL` | `http://localhost:PORT` | Public URL of this API, used in uploaded image URLs. Required in production |
| `SITE_URL` | `http://localhost:5173` | Public website origin; legacy `/media/` images are served from there. Required in production |
| `CORS_ORIGINS` | localhost dev origins | Comma-separated origins allowed to read `/api/public/*` cross-origin |
| `PUBLIC_CACHE_SECONDS` | `60` | Browser cache lifetime of public content responses |
| `TRUST_PROXY` | `0` (`1` in production) | Proxy hops to trust for client IPs (rate limiting). Render: `1` |
| `COOKIE_SECURE` | production only | Override Secure-cookie behaviour (keep default) |
| `SESSION_IDLE_HOURS` / `SESSION_MAX_DAYS` | `12` / `7` | Session idle timeout and absolute lifetime |
| `UPLOAD_MAX_MB` | `20` | Maximum upload size per image |
| `UPLOAD_MAX_PER_HOUR` | `200` | Upload rate limit per admin |
| `LOGIN_MAX_ATTEMPTS` | `8` | Failed sign-ins per account per 15 minutes (per IP: 3×) |
| `BACKUP_KEEP` | `14` | Database backups kept by `npm run backup` |

There are no API keys or third-party credentials. The only secrets are admin passwords, stored as
scrypt hashes in the database.

## Database, migrations and content import

- The schema lives in [`src/db/migrations.js`](./src/db/migrations.js) as ordered, append-only migrations.
  They run automatically when the server starts; `npm run migrate` applies them explicitly.
- Tables: `projects`, `project_media` (ordered gallery with per-image Work category), `films`, `media`,
  `homepage_projects`, `homepage_films`, `admins`, `sessions`.
- Homepage tables hold **references and order only**. Deleting a project or film removes its reference
  (`ON DELETE CASCADE`); unpublishing keeps the reference, hides it publicly and flags it in the admin.

### Importing the existing website content

```bash
npm run import                       # safe to repeat
npm run import -- --reset-homepage   # also replace current homepage picks with the original ones
npm run import -- --copy-media       # copy legacy images into DATA_DIR/uploads instead of referencing them
```

The import reads the content that was hardcoded in the website before this panel existed:

| Source | What it becomes |
| --- | --- |
| `src/data/media.json` (exterior + interior renders) | `media` records; images grouped into projects by filename prefix |
| `scripts/media-projects.mjs` | Project names and locations for those prefixes |
| `server/import/legacy-content.js` | Snapshot of the former `projects.js` (descriptions, scope), `films.js` and homepage cards |

Rules: every record carries an `import_key`, so a repeat import skips existing records and never
overwrites edits made in the admin; homepage selections are seeded only while empty (or with
`--reset-homepage`). 3D floor plans are **not** imported: they remain a build-time Work category.

Mapping decisions and uncertain associations (review these in the admin):

- **33 projects** from 220 renders, all published so the Work page keeps showing what it showed before.
- `master-suite-c1` and `mb-1st-floor-c1` match no project prefix. They were shown as
  "Private Residence · India" (the media script's fallback label) and are imported as one project with
  that name. Whether they belong together is unknown.
- Projects with renders in both folders (e.g. Applaud 38, GeeCee Evana, Shubh Kamna Heights) keep each
  image under its original Work filter. The project category is the former `projects.js` filter, or the
  majority of its images when there was none (Shubh Kamna Heights → Exterior CGI).
- Only the eight former homepage projects have descriptions and scope; others are imported without them.
  Nothing was invented. Add descriptions in the admin before selecting those projects for the homepage.
- Films keep their titles, locations and type. Only **Shubh Kamna Heights** matches a project by name and is
  linked to it. The former homepage showed "Chembur, Mumbai" for White House while Work showed
  "Subhash Nagar, Chembur, Mumbai"; the shared record uses the Work value. Homepage-only alt-text wording for
  three films ("bungalow plots", "residential project") is replaced by a generated `<title> <type> film`.
- **Selected Work** is seeded with seven projects: the former third card (Shubh Kamna Heights) was a film
  card (play icon, "Architectural Film" label, linked to the film filter) and is excluded under the agreed
  rule that Selected Work shows still renders only. Its film remains the featured homepage film. To show its
  still renders on the homepage, add the project in **Homepage → Selected Work**.
- Covers for the former homepage projects are the renders those cards used; other projects use their first image.

### Local import assets vs. database records vs. production media storage

- **Local import assets** — the optimised legacy images in `static/media/` are part of the website build and
  are deployed with the website. By default the import only *references* them (`storage = 'site'`, URL
  `/media/...` on the website origin), so existing image URLs keep working and nothing is copied.
- **Database records** — the import creates records (metadata, alt text, dimensions, order) in SQLite.
  Editing a record in the admin never touches the image files.
- **Production media storage** — images uploaded in the admin are written to `DATA_DIR/uploads` on the
  API's persistent disk and served by the API. With `--copy-media`, legacy images are copied there too, which
  makes the API independent of the website's `static/media/exterior|interior` folders. Without it, those
  folders must stay in the website build for as long as imported records reference them.

## Admin accounts

There is no registration endpoint. Accounts are created from a shell on the server:

```bash
npm run admin:create -- --email owner@example.com                      # interactive, hidden prompt
printf '%s' "$PASSWORD" | npm run admin:create -- --email owner@example.com --password-stdin
```

Running it again for an existing email resets the password and signs out that account's sessions.
On Render, run it from the service's **Shell** tab (the disk is only available to the running service).
Passwords need 12+ characters and are stored as scrypt hashes. Never commit credentials.

## Media storage and image processing

- Accepted: JPEG, PNG, WebP up to `UPLOAD_MAX_MB` (20 MB). Files are decoded with `sharp`; the filename and
  MIME type are not trusted. Animated images and images narrower than 320 px are rejected.
- Each upload produces WebP variants at 640, 1280 and 2000 px (never upscaled), matching the website's
  existing `scripts/optimize-media.mjs` naming (`<src>-<width>.webp`). The original is kept in
  `DATA_DIR/originals` (not served) so variants can be regenerated later.
- Filenames are slugified and given a random suffix; they are never reused, so `/uploads/*` is served with
  `Cache-Control: immutable` for a year.
- Width, height, sizes and alt text are stored per image and returned to the website, which sets
  `srcset`, `sizes`, `width`, `height` and `alt`.
- Images used by any project gallery, cover or film thumbnail cannot be deleted (HTTP 409). Removing an image
  from a gallery leaves it in **Media**, where unused images can be deleted.

## Publishing, caching and invalidation

- Projects and films are **drafts** until published. Publishing requires a name/title, a location and, for
  projects, at least one gallery image and a cover; films need a valid YouTube link.
- Publishing never changes the homepage. Homepage selections are saved explicitly, as a whole, in one
  transaction; only published records (projects with a cover) can be selected.
- `GET /api/public/*` responses carry `Cache-Control: public, max-age=60, must-revalidate` and an ETag.
  **A published change appears on the next page load once the visitor's cached copy is older than 60 seconds**
  (configurable with `PUBLIC_CACHE_SECONDS`). After that, the browser revalidates; unchanged content returns
  `304 Not Modified`.
- There is no server-side cache, so there is nothing to purge. If a CDN is put in front of the API later,
  it must respect `Cache-Control`, or be purged on publish.
- Pages already open in a browser do not update live (not required).

## Connecting the website

The website calls only `GET /api/public/home` and `GET /api/public/work`.

- **Local:** Vite proxies `/api` to `http://localhost:8787` (`API_PROXY_TARGET` overrides the target).
- **Production, option A (recommended):** build the website with `VITE_API_URL=https://<api-host>` and set
  `CORS_ORIGINS` on the API to the website origin. The URL is public, not a secret.
- **Production, option B:** keep `VITE_API_URL` empty and proxy `/api/*` from the website host to the API
  (Netlify `_redirects`: `/api/*  https://<api-host>/api/:splat  200`). Check the host's own caching of
  proxied responses before relying on the 60-second interval.

Changing `VITE_API_URL` is an infrastructure change and needs one website rebuild; content changes do not.

## Deploying to Render

Render is a possible target; nothing has been provisioned. [`render.yaml`](../render.yaml) describes one web
service with a persistent disk (checked against Render's docs on 2026-11-16, not applied to an account).

1. Create the service from the Blueprint (or manually: Node runtime, root directory `server`,
   build `npm ci --omit=dev`, start `npm start`, health check `/api/health`).
2. Attach a persistent disk mounted at `/var/data` and set `DATA_DIR=/var/data`. Render's default filesystem is
   ephemeral: without the disk, the database and uploads are lost on every deploy or restart.
3. Set `NODE_ENV=production`, `NODE_VERSION=24`, `TRUST_PROXY=1`, `API_PUBLIC_URL`, `SITE_URL`, `CORS_ORIGINS`.
4. After the first deploy, open **Shell** and run `npm run import` (optionally `-- --copy-media`, which needs the
   repository's `static/media` folder, present in the checkout) and `npm run admin:create -- --email …`.
5. Build the website with `VITE_API_URL` pointing at the service and redeploy it once.

Render constraints that apply here (from Render's documentation): persistent disks need a paid instance type
(free services spin down and cannot attach disks); a service with a disk runs as a single instance and has a
few seconds of downtime per deploy; the disk is not available during the build or pre-deploy command; Render
snapshots disks daily and keeps snapshots for 7 days.

Alternative hosts work the same way as long as `DATA_DIR` is on persistent storage.

## Backup and recovery

- **Automatic (Render):** daily disk snapshots, retained 7 days; restore from the service's Disks page.
- **Application backups:** `npm run backup` writes a consistent copy of the database
  (`VACUUM INTO`) to `DATA_DIR/backups/` and keeps the newest 14. It is safe while the server runs.
  Schedule it (e.g. a daily `npm run backup` from the Shell, or a cron job on another host) and copy the
  backup plus `DATA_DIR/uploads` and `DATA_DIR/originals` off the server (object storage or another machine).
- **Restore:** stop the service, replace `DATA_DIR/content.db` with a backup copy (delete any
  `content.db-wal` / `content.db-shm` files next to it), restore `uploads/` and `originals/` from the same
  point in time, start the service. Re-running `npm run import` afterwards is safe.
- Off-server copies are not automated yet; set this up before launch.

## Security notes

- Authentication: server-side sessions in SQLite; the cookie holds a random 256-bit token (only its SHA-256
  hash is stored), `HttpOnly`, `SameSite=Strict`, `Secure` and `__Host-` prefixed in production. Idle timeout
  12 h, absolute 7 days. Logout deletes the session.
- CSRF: every state-changing admin request needs the per-session `X-CSRF-Token` header and a same-origin
  `Origin`/`Referer`. The admin is served from the API origin, so admin calls are same-origin.
- CORS: only `/api/public/*` sends CORS headers, to the configured origins, without credentials.
- Rate limits: sign-in failures per account and per IP; uploads per admin. Counters are in memory (fine for the
  single instance a disk-backed service runs as) and reset on restart.
- Validation: all inputs are validated with zod on the server; YouTube links are parsed to an 11-character ID.
- Output: the admin renders text with `textContent`; the website escapes every API string it inserts.
  A strict CSP (`script-src 'self'`, no inline styles or scripts) protects the admin.
- Unknown sign-in emails are compared against a dummy hash so timing does not reveal accounts.

## API reference

Public (no auth, cacheable): `GET /api/public/home`, `GET /api/public/work`, `GET /api/health`,
`GET /uploads/<file>`.

Admin (session + CSRF): `POST /api/admin/login`, `GET /api/admin/session`, `POST /api/admin/logout`,
`GET /api/admin/overview`, `GET|POST /api/admin/projects`, `GET|PUT|DELETE /api/admin/projects/:id`,
`GET|POST /api/admin/films`, `GET|PUT|DELETE /api/admin/films/:id`, `GET /api/admin/homepage`,
`PUT /api/admin/homepage/selected-work`, `PUT /api/admin/homepage/films`, `GET|POST /api/admin/media`,
`PATCH|DELETE /api/admin/media/:id`.

## Tests

```bash
npm test
```

Runs real HTTP requests against a temporary data directory per suite: authentication and CSRF, rate
limiting, draft visibility, homepage independence and ordering, featured-film rules, deletion and
unpublishing, uploads (validation, variants, in-use protection), persistence across a restart, cache headers,
CORS, YouTube parsing and the legacy import.

## Known limitations

- Runtime content is rendered by JavaScript. Google renders JavaScript, but other crawlers and link
  previews see only the static parts of the homepage (Selected Work and film cards are not in the initial HTML).
  The Work gallery was already JavaScript-rendered before this change. Page-level titles, descriptions and
  Open Graph tags are static and unaffected; there are no per-project pages. Indexing has not been tested
  against a live deployment.
- Single instance (SQLite + disk). Fine for an admin-edited portfolio; not designed for horizontal scaling.
- One role: every admin can do everything. No audit log or edit history beyond backups.
- No manual ordering for the Work page: newest projects appear first, imported projects keep their old order.
- Floor plans are still managed through `npm run media` and a website deploy (outside the agreed scope).
- `node:sqlite` is a release-candidate API in Node 24; the warning is silenced in npm scripts. Pin Node 24.x.
