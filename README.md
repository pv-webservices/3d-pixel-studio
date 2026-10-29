# 3d Pixel Studio — Website

Static multi-page site built with Vite, GSAP (ScrollTrigger, SplitText, Flip) and Lenis smooth scroll.

## Commands

```bash
npm install
npm run media   # regenerate optimized images/video from /public into /static/media
npm run dev     # http://localhost:5173
npm run build   # production output in /dist
```

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

### Images

Write `<img data-m="exterior/<slug>" sizes="…">` — the build expands it to `src`, `srcset`, `width`, `height`,
alt text and lazy loading from `src/data/media.json`. Add `data-eager` for the above-the-fold image.
New renders: drop them into `public/Architecture Cgi`, `public/Interior cgi` or `public/Isometric`, run `npm run media`;
they appear in the Work gallery automatically.

## Notes

- Theme colours are limited to the eight values in `public/Theme Color.txt`.
- The project brief form uses Netlify Forms (`data-netlify`, file uploads up to 8 MB). On another host, point the
  form `action` at a form endpoint.
- `TDcKozRHlKs` from `Youtube Videos Links.txt` is a third-party beach livestream and is not used.
