# Admin Panel and Dynamic Portfolio Requirements

Last updated: 2026-11-16 (Asia/Kolkata)

Status: Implemented and verified locally (2026-11-16). Not deployed: no backend host, database or media storage has been provisioned, and live verification (acceptance criterion 12) is outstanding. See [Implementation status](#implementation-status).

## Purpose and use by agents

This is the shared requirements reference for Codex, Claude, and human developers working on the website admin panel. Keep requirements here rather than maintaining separate versions for each agent.

This document describes the requested feature. It does not replace agent instructions, grant deployment or account permissions, or claim that the feature already exists. Follow current user instructions and applicable repository instructions. If a later request changes a decision, update the relevant requirement and record the reason in the decision history.

Before editing, read the current file and inspect the working tree. Preserve unrelated changes. When agents work concurrently, coordinate ownership of files or use separate worktrees; this Markdown file alone cannot prevent simultaneous edit conflicts. Avoid having two agents edit the same section at once.

## Confirmed decisions

1. Provide admin controls to add, edit, and delete portfolio projects and architectural films.
2. Give the homepage its own selection and ordering controls, separate from the Work page.
3. Manage project and film details once in shared records. Homepage selections reference those records rather than duplicating their content or uploads.
4. Uploading or publishing an item in Work must not automatically add it to the homepage.
5. Use Selected Work for still renders from Exterior CGI and Interior CGI. Use the dedicated Architectural Films section for film cards.
6. Load editable public content from a backend API at runtime. Routine content and homepage selection changes must not require a frontend build, a Git commit, or a redeployment.
7. Design, layout, JavaScript, dependency, or infrastructure changes may still require deployment.

The earlier idea of automatically showing the newest item from each category has been superseded by manual homepage selection. Do not implement automatic latest-item selection or automatic rebuilds as the default publishing workflow.

## Current project baseline

Before the admin panel, the website was a static, multi-page Vite project using GSAP and Lenis. The table records that baseline; `src/js/data/projects.js` and `src/js/data/films.js` have since been replaced by runtime API content (their data is preserved in `server/import/legacy-content.js`), and the homepage cards are rendered from the API:

| Path | Current responsibility |
| --- | --- |
| `index.html` | Hardcoded Selected Work and Architectural Films cards |
| `work/index.html` | Portfolio page structure and category controls |
| `src/js/data/projects.js` | Project details used by homepage project dialogs |
| `src/js/data/films.js` | Film metadata used by the Work gallery |
| `src/data/media.json` | Generated image metadata |
| `src/js/pages/home.js` | Project dialogs and galleries |
| `src/js/pages/work.js` | Portfolio filtering, pagination, and lightbox |
| `scripts/optimize-media.mjs` | Local image optimisation and media manifest generation |
| `vite.config.js` | Build-time HTML includes, image expansion, and page entries |

The current homepage has eight project cards and a film layout with one large card and four smaller cards. These are existing design counts, not a final requirement for the new admin controls.

## Admin areas and behaviour

### Work: projects

- Create and edit a project with its name, location, category, description, scope, cover image, and gallery.
- Manage Exterior CGI and Interior CGI content for this scope.
- Associate gallery images with a stable project ID instead of inferring membership solely from filename prefixes.
- Changes to a project's shared details must appear on Work and in its homepage card/dialog when selected there.
- Treat additional image uploads as updates to an existing project when appropriate, rather than creating duplicate project entries.
- Provide a deliberate delete action with clear consequences for any homepage references.

### Work: architectural films

- Create and edit a film with its title, location, video link, thumbnail, and an optional related project.
- The existing films use YouTube links. Direct video uploads and transcoding are outside the agreed initial scope.
- Changes to shared film details must appear on Work and on the homepage when the film is selected there.
- A project may have both still renders and a related film. Still-render cards can appear in Selected Work; film cards belong in Architectural Films.

### Homepage: Selected Work

- Select existing still-render projects from Work.
- Add or remove homepage selections and arrange their display order independently of the Work page.
- Use each project's shared cover image and metadata; do not require a second upload or a duplicate project record.
- Removing a homepage selection must leave the project available in Work.
- New Work uploads must leave the existing homepage selection unchanged.
- Exclude film cards and duplicate project selections.

### Homepage: Architectural Films

- Select existing films from Work's Architectural Films category.
- Choose the large featured film and arrange the remaining selected films.
- Keep selected films distinct; the featured film must not also appear as a smaller card in the same section.
- Removing a homepage film selection must leave the film available in Work.
- New film uploads must leave the homepage selection unchanged.

## Content structure

The following entities describe the required relationships, not a committed database schema or CMS choice:

| Entity | Purpose |
| --- | --- |
| Project | Shared project details, classification, cover, and gallery references |
| Film | Shared film details, video source, thumbnail, and optional project reference |
| Media asset | Persistent file reference, alternative text, image dimensions, and optimised variants |
| Homepage settings | Ordered project references, featured film reference, and ordered secondary film references |
| Admin account | Authenticated content management access |

Separate homepage controls mean separate selection settings. They do not mean separate copies of project and film details. Homepage-specific title, image, or description overrides have not been requested.

Preserve the existing 3D Floor Plan category on Work. Its admin management and possible homepage inclusion have not been agreed; do not remove it or silently expand this scope.

## Runtime delivery and publishing

- Fetch public content and homepage settings through an API instead of compiling editable data into the frontend bundle.
- Public read access must expose only content intended for publication. All editing and deletion must require backend-authorised admin access.
- Keep backend credentials and privileged API keys out of browser code.
- Store uploaded media persistently. The existing local media script must not be the required production publishing path for admin uploads.
- Preserve responsive image delivery, alternative text, loading performance, keyboard access, and reduced-motion behaviour.
- Integrate fetched content with gallery handlers, project dialogs, film playback, and scroll animations. Refresh layout measurements after content loads where required.
- Provide loading, empty, unavailable-content, and failed-request states without broken images or empty interactive controls.
- Do not require already-open visitor pages to update in real time. Published changes should appear on subsequent page loads after the agreed cache refresh interval.
- Define and verify cache invalidation before launch. Do not promise instant visibility while serving stale cached responses.
- Evaluate how runtime-loaded portfolio content affects search indexing and social previews; document any limitations before launch.

## Proposed defaults to resolve during implementation planning

These were recommendations, not additional confirmed product decisions. All five were adopted during implementation (see [Resolved implementation decisions](#resolved-implementation-decisions)):

- Use draft and published states so incomplete uploads are not publicly visible.
- If a selected item is deleted or unpublished, hide its public card and flag the invalid selection in admin. Do not automatically choose a replacement unless the user requests that behaviour.
- Block deletion of media still used by published content, or require an explicit replacement/removal flow.
- Make saving homepage selections explicit, and avoid partially applying a reordered list.
- Retain the current visual treatment where practical, while adapting counts and animation measurements to the selected items.

## Acceptance criteria

1. An administrator can create, edit, and delete project and film records through the admin interface.
2. Publishing a Work item makes it available in the correct Work category without automatically selecting it for the homepage.
3. Selecting and ordering existing projects changes Selected Work in that order without a frontend rebuild.
4. Selecting a featured film and secondary films changes the dedicated film section without a frontend rebuild.
5. Editing shared metadata, a cover image, or a video link updates every public appearance of that record after publication and cache refresh.
6. Removing an item from homepage settings does not delete its Work entry.
7. Selected Work contains still-render cards; the dedicated film section contains film cards, with no duplicate featured/secondary film.
8. Deletion or unpublishing produces no broken homepage references or unplayable cards; follow the resolved handling rule.
9. Non-admin users cannot mutate content, homepage settings, or uploaded assets through direct API requests.
10. Uploaded content survives backend restarts and redeployments.
11. Existing Work filters, pagination, dialogs, lightboxes, film playback, mobile layouts, and keyboard interactions remain functional.
12. A content-only change is verified on the deployed frontend without a new frontend build or deployment. Local verification and live verification must be reported separately.

## Decisions still open

Originally open (listed here for history); each is now resolved below unless marked otherwise:

- Existing CMS versus custom backend/admin implementation.
- Backend hosting provider and plan; Render was discussed as an option, not selected or provisioned. **Still open.**
- Database, persistent media storage, backup, and recovery approach.
- Final Selected Work card count and secondary film count; behaviour when fewer items are selected.
- Draft/publish workflow, admin account count, and whether multiple roles are needed.
- Work page ordering and whether administrators need manual ordering there too.
- Exact cache refresh interval and API failure fallback.
- Migration mapping for existing projects, films, and media while retaining working URLs where possible.

Resolve these during implementation planning without reopening the confirmed manual homepage selection and runtime content delivery decisions unless the user changes them.

## Resolved implementation decisions

Technical decisions taken during implementation (2026-11-16). They do not change the confirmed product decisions above and can be revisited.

| Topic | Resolution | Reason |
| --- | --- | --- |
| CMS vs custom | Small custom backend in `server/`: Node.js 24, Express 5, SQLite (`node:sqlite`), `sharp`; admin UI served by the same service at `/admin/`. | Git-based CMSs (e.g. Decap) publish through commits/rebuilds, which the confirmed decisions rule out. Hosted CMSs (e.g. Sanity) need an external account before anything can be demonstrated locally. Self-hosted CMSs (Strapi, Directus, Payload) would still need custom code for the homepage rules (still renders only, distinct featured/secondary films, flagged unavailable references) and add a much larger runtime and upgrade surface than this five-entity model needs. |
| Database | One SQLite file on persistent storage; append-only migrations run on start. | One process, one disk, no separate database service; consistent online backups with `VACUUM INTO`. |
| Media storage | Uploads stored on the API's persistent disk (`DATA_DIR/uploads`), WebP variants 640/1280/2000 px plus kept originals; served with immutable caching. Legacy renders keep their existing `/media/` URLs on the website (optional `--copy-media` import moves them to the API). | Same responsive pipeline as the existing site; no third-party image service account required. |
| Hosting | Render-compatible: one web service + persistent disk (`render.yaml`, not applied). Requires a paid instance; single instance; brief downtime per deploy. **Provider and plan still need the owner's decision.** | Render's default filesystem is ephemeral and free services cannot attach disks. |
| Backup and recovery | Render daily disk snapshots (7 days) plus `npm run backup` database copies; off-server copies of backups and uploads still to be scheduled. | See `server/README.md` → Backup and recovery. |
| Card counts | Selected Work: up to 12 (the pinned horizontal track scales; 8 was the original design). Smaller film cards: up to 4 (grid designed for 4); one optional featured film. Fewer selections render without gaps; counters (`01 / 07`) and category labels are computed from what is shown; an empty films section is hidden. | Uses existing counts as guidance while supporting fewer items. |
| Draft/publish | Draft and published states for projects and films. Publishing requires name/title, location, and for projects a cover and at least one gallery image; films require a valid YouTube link. | Prevents incomplete content going public. |
| Accounts and roles | Any number of admin accounts, one role, created only from the server shell (`npm run admin:create`). No public registration. | Small team; roles were not requested. |
| Unavailable selections | Unpublished or cover-less selections are hidden publicly and flagged in the admin (overview and homepage pages). Deleting a record removes its homepage reference. Nothing is replaced automatically. Homepage saves are explicit, whole-list and transactional. | Adopts the proposed defaults. |
| Media deletion | Images used by any gallery, cover or film thumbnail cannot be deleted; removed images stay in the media library until deleted there. | Adopts the proposed default. |
| Work ordering | No manual ordering UI. Imported projects keep their previous order; new projects appear first. The "All" view keeps the existing category interleave. | Manual ordering was not requested; can be added later. |
| Mixed projects | A project has one category (Exterior or Interior CGI, used for its label and "View in portfolio"); each gallery image keeps its own Work filter. | Preserves where existing renders appeared (e.g. Applaud 38 has both). |
| Cache interval | Public API responses: `Cache-Control: public, max-age=60, must-revalidate` + ETag. Changes appear on the next page load once the visitor's cached copy is older than 60 s. No server cache to purge. | Verified locally in the browser (stale inside the window, fresh after it). |
| API failure fallback | Pages wait at most 3.5 s for content before starting animations, then render it when it arrives. On failure: a short "could not be loaded" note, the "View All Projects" link and a link to films on Work; the Work page shows floor plans plus a "Try again" button. No stale built-in copy is shown, so unpublished content cannot reappear. | Avoids broken controls or a page stuck behind the preloader. |
| Migration mapping | Repeatable import keyed by `import_key`; never overwrites admin edits; seeds the homepage only when empty. Details and uncertain mappings are listed in `server/README.md`. | Avoids duplicates on re-runs. |
| Former film card in Selected Work | The Shubh Kamna Heights card (play icon, "Architectural Film" label) is not seeded into Selected Work; the project and its film are imported and the film stays featured. | Applies the confirmed "Selected Work shows still renders" rule. |
| Frontend API configuration | `VITE_API_URL` (public URL, not a secret) or a host-level `/api` proxy; Vite proxies `/api` locally. | No database credentials or privileged keys in frontend variables. |

## Implementation status

Verified locally on 2026-11-16 (Windows, Node 24.19, Chromium-based browser pane). Nothing below has been verified on a deployed service.

| # | Acceptance criterion | Local status |
| --- | --- | --- |
| 1 | Create, edit, delete projects and films | Verified in the browser and by API tests |
| 2 | Publishing adds to Work, not to the homepage | Verified in the browser and by tests |
| 3 | Selecting/ordering projects changes Selected Work without a rebuild | Verified, including on a pre-built `dist` served by `vite preview` |
| 4 | Featured and secondary film selection without a rebuild | Verified in the browser and by tests |
| 5 | Shared edits update every appearance after cache refresh | Verified (homepage card, pop-up, Work tile, lightbox, related-film button) |
| 6 | Removing a homepage selection keeps the Work entry | Verified for projects and the featured film |
| 7 | Still renders in Selected Work; films in the film section; no duplicate films | Enforced server-side and in the admin UI; tested |
| 8 | No broken references after deletion/unpublishing | Verified by tests and a browser deletion flow |
| 9 | Non-admins cannot mutate content, selections or assets | Verified by tests (401/403 for every mutating route, CSRF and Origin checks) |
| 10 | Uploads survive restarts and redeployments | Restart verified locally against the same data directory. Redeployment persistence depends on a persistent disk and is **not verified** (nothing deployed) |
| 11 | Existing Work filters, pagination, dialogs, lightbox, film playback, mobile layouts, keyboard | Verified in the browser at desktop and 375 px widths. Reduced-motion paths are unchanged in code but were not browser-emulated |
| 12 | Content-only change verified on the deployed frontend | **Not done** — requires deployment |

Remaining external setup: choose the backend host and plan; provision the service and persistent disk; set production environment variables; run the import and create the owner's admin account on the server; build the website with `VITE_API_URL`; schedule off-server backups; then verify criteria 10 and 12 live.

Known limitations: Selected Work and homepage film cards are no longer in the initial HTML, so crawlers that do not run JavaScript and link previews do not see them (page-level meta tags are unchanged; Work was already JavaScript-rendered). Single-instance backend. Floor plans remain build-time content.

## Outside the agreed initial scope

Editing all website pages, managing blog articles, editing services/team/FAQs, enquiry management, payments, a drag-and-drop page builder, automatic latest-item homepage population, live push updates to open pages, and direct video hosting are not included in the confirmed scope.

The current project brief form is configured for Netlify Forms. If the public website host changes, evaluate that integration separately; an admin backend does not automatically replace form processing.

## Decision history

| Date | Decision and reason |
| --- | --- |
| 2026-11-16 | Initially discussed automatic latest-project and film selection from Work to avoid duplicate homepage editing. |
| 2026-11-16 | Replaced automatic selection with independent homepage selection and ordering controls, per the user's request for editorial flexibility. Retained shared records to avoid duplicate content maintenance. |
| 2026-11-16 | Chose runtime content delivery to avoid automatic frontend rebuilds for content changes. Backend/CMS provider and final implementation details remain open. |
| 2026-11-16 | Created this shared requirements document for Codex and Claude; no backend or frontend functionality implemented by this documentation change. |
| 2026-11-16 | Chose a small custom backend (Node.js, Express, SQLite, local persistent media storage) over an existing CMS, because the homepage rules need custom logic either way and git-based or hosted CMSs conflict with runtime publishing or local demonstration. Render remains a candidate host, not provisioned. |
| 2026-11-16 | Implemented the API, admin panel, runtime homepage/Work integration and repeatable legacy import; adopted the proposed draft/publish, unavailable-selection and media-deletion defaults; set a 60-second public cache. Excluded the former Shubh Kamna Heights film card from the seeded Selected Work under the still-renders rule. Verified locally only. |
