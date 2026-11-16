# 3d Pixel Studio — Website

Static multi-page site built with Vite, GSAP (ScrollTrigger, SplitText, Flip) and Lenis smooth scroll.
Portfolio content (Work projects and films, homepage Selected Work and Architectural Films) is loaded at
runtime from the content API and edited in its admin panel ([`server/`](./server/README.md)).

## Admin panel and dynamic portfolio

Implemented locally; not deployed. Read [ADMIN-PANEL-REQUIREMENTS.md](./ADMIN-PANEL-REQUIREMENTS.md) for the agreed
scope, resolved decisions and status, and [server/README.md](./server/README.md) for setup, import, deployment,
caching, backups and limitations.

- Projects and films are single shared records; the homepage stores only ordered references to them.
- Publishing a Work item never adds it to the homepage. Content edits appear on the next page load after the
  60-second cache interval, with no website build, commit or redeploy.
- 3D floor plans remain build-time media (`npm run media`), as before.

## Commands

```bash
npm install
npm run media      # regenerate optimized images/video from /public into /static/media
npm run dev        # http://localhost:5173 (proxies /api to the content API on :8787)
npm run build      # production output in /dist
npm run api        # content API + admin on http://localhost:8787/admin/ (after server setup)
npm run test:api   # backend test suite
```

First-time API setup (import existing content, create an admin): see [server/README.md](./server/README.md#local-setup).

Production builds need `VITE_API_URL` set to the API's public URL (or a host-level `/api` proxy); see
[Connecting the website](./server/README.md#connecting-the-website).

## Structure

| Path | Purpose |
|---|---|
| `public/` | Raw brief assets as supplied (not deployed — Vite's publicDir is `static/`) |
| `static/` | Deployed static files: optimized media, favicon, `_redirects`, `robots.txt`, `sitemap.xml` |
| `index.html`, `work/`, `studio/`, `services/`, `insights/`, `project-review/` | Pages (clean URLs) |
| `src/partials/` | Shared head, header/menu, CTA and footer, inlined at build via `<!-- @include name -->` |
| `src/styles/` | `base` (tokens/type), `components`, `sections` (home), `pages` (inner pages) |
| `src/js/core/` | Lenis + GSAP setup, preloader, page transitions, header, menu, cursor |
| `src/js/fx/reveals.js` | Data-attribute driven effects: `data-split`, `data-fade`, `data-reveal`, `data-parallax`, `data-speed`, `data-count`, `data-line`, `data-scrub-words`, `data-marquee` |
| `src/js/modules/` | Hero video, pinned scenes (stack, expanding frame, horizontal gallery, sticky swap), compare slider, films modal, accordions |
| `src/js/pages/` | Page-specific code (portfolio filter + lightbox, studio steps, form, article) |
| `src/js/content/` | Runtime content client and homepage section renderers (API → existing markup) |
| `server/` | Content API, admin panel, database migrations, import, tests ([README](./server/README.md)) |
| `render.yaml` | Draft Render Blueprint for the content API (not applied) |

### Images

Write `<img data-m="exterior/<slug>" sizes="…">` — the build expands it to `src`, `srcset`, `width`, `height`,
alt text and lazy loading from `src/data/media.json`. Add `data-eager` for the above-the-fold image.
This build-time pipeline still serves page imagery (hero walls, service rows) and 3D floor plans. Project renders
and films for Work and the homepage are now uploaded in the admin panel instead; `npm run media` no longer adds
renders to the Work gallery. `scripts/media-projects.mjs` holds the filename-prefix → project mapping used by
both the media script and the one-time content import.

## Notes

- Theme colours are limited to the eight values in `public/Theme Color.txt`.
- The project brief form uses Netlify Forms (`data-netlify`, file uploads up to 8 MB). On another host, point the
  form `action` at a form endpoint. The admin panel and API do not change or replace this form.
- `TDcKozRHlKs` from `Youtube Videos Links.txt` is a third-party beach livestream and is not used.
