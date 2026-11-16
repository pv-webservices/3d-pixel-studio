// Read-only, cacheable endpoints used by the public website at runtime.
import express from 'express';

export function createPublicRouter({ config, publicContent }) {
  const router = express.Router();
  const allowed = new Set(config.corsOrigins);

  router.use((req, res, next) => {
    const origin = req.get('origin');
    res.vary('Origin');
    if (origin && allowed.has(origin)) res.set('Access-Control-Allow-Origin', origin);
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    // Browsers (and any CDN in front) may reuse a response for this long; after that they revalidate
    // with the ETag, so a publish is visible on the next page load once the interval has passed.
    res.set('Cache-Control', `public, max-age=${config.publicCacheSeconds}, must-revalidate`);
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET');
      res.set('Access-Control-Max-Age', '600');
      return res.status(204).end();
    }
    next();
  });

  router.get('/home', (req, res) => res.json(publicContent.home()));
  router.get('/work', (req, res) => res.json(publicContent.work()));

  return router;
}
