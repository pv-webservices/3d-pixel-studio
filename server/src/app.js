// Express application: public content API, authenticated admin API, uploaded media and the admin UI.
import express from 'express';
import helmet from 'helmet';
import { errorHandler } from './lib/http.js';
import { createAdminsRepo } from './repos/admins.js';
import { createFilmsRepo } from './repos/films.js';
import { createHomepageRepo } from './repos/homepage.js';
import { createMediaRepo, createMediaUrls } from './repos/media.js';
import { createProjectsRepo } from './repos/projects.js';
import { createPublicContent } from './repos/public-content.js';
import { createAdminContentRouter } from './routes/admin-content.js';
import { createAdminMediaRouter } from './routes/admin-media.js';
import { createAuth } from './routes/auth.js';
import { createPublicRouter } from './routes/public.js';

export const defaultLogger = {
  info: (...args) => console.info(...args),
  error: (...args) => console.error(...args),
};

export function createRepos(db, config) {
  const media = createMediaRepo(db, createMediaUrls(config));
  return {
    media,
    projects: createProjectsRepo(db, media),
    films: createFilmsRepo(db, media),
    homepage: createHomepageRepo(db, media),
    publicContent: createPublicContent(db, media),
    admins: createAdminsRepo(db, config),
  };
}

/**
 * @param {{ config: import('./config.js').Config, db: import('node:sqlite').DatabaseSync, storage: ReturnType<typeof import('./media/storage.js').createLocalStorage>, logger?: typeof defaultLogger }} deps
 */
export function createApp({ config, db, storage, logger = defaultLogger }) {
  const repos = createRepos(db, config);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'img-src': ["'self'", 'data:', 'blob:', 'https://i.ytimg.com', config.siteUrl],
          'connect-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'"],
          'frame-ancestors': ["'none'"],
          'upgrade-insecure-requests': config.isProduction ? [] : null,
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      strictTransportSecurity: config.isProduction,
    }),
  );

  app.get('/api/health', (req, res) => {
    db.prepare('SELECT 1').get();
    res.set('Cache-Control', 'no-store').json({ ok: true });
  });

  app.use('/api/public', createPublicRouter({ config, publicContent: repos.publicContent }));

  const auth = createAuth({ config, admins: repos.admins });
  const admin = express.Router();
  admin.use(express.json({ limit: '256kb' }));
  admin.use(auth.router);
  admin.use(auth.requireAdmin);
  admin.use(createAdminContentRouter(repos));
  admin.use(createAdminMediaRouter({ config, media: repos.media, storage, logger }));
  app.use('/api/admin', admin);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Uploaded variants have random, never-reused names, so they can be cached forever.
  app.use(
    '/uploads',
    (req, res, next) => {
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    },
    express.static(config.uploadsDir, { immutable: true, maxAge: '365d', index: false, fallthrough: false }),
  );

  app.use('/admin', express.static(config.adminDir, { index: 'index.html', maxAge: 0, setHeaders: (res) => res.set('Cache-Control', 'no-cache') }));
  app.get('/', (req, res) => res.redirect('/admin/'));

  app.use(errorHandler(logger));
  return app;
}
