// Runtime configuration from environment variables. Secrets never have defaults.
import path from 'node:path';

const SERVER_ROOT = path.resolve(import.meta.dirname, '..');

const int = (value, fallback) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

const list = (value) =>
  String(value ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);

const stripSlash = (value) => String(value ?? '').trim().replace(/\/+$/, '');

/**
 * @param {Record<string, string | undefined>} env
 */
export function loadConfig(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';
  const port = int(env.PORT, 8787);
  const dataDir = path.resolve(SERVER_ROOT, env.DATA_DIR || './data');
  const publicUrl = stripSlash(env.API_PUBLIC_URL) || `http://localhost:${port}`;

  const config = {
    isProduction,
    port,
    dataDir,
    dbFile: path.join(dataDir, 'content.db'),
    uploadsDir: path.join(dataDir, 'uploads'),
    originalsDir: path.join(dataDir, 'originals'),
    backupsDir: path.join(dataDir, 'backups'),
    adminDir: path.join(SERVER_ROOT, 'admin'),
    /** Public origin of this API; used to build absolute URLs for uploaded media. */
    publicUrl,
    /** Origin of the public website; legacy media under /media/ is served from there. */
    siteUrl: stripSlash(env.SITE_URL) || 'http://localhost:5173',
    /** Origins allowed to read the public API cross-origin (no credentials). */
    corsOrigins: list(env.CORS_ORIGINS || (isProduction ? '' : 'http://localhost:5173,http://127.0.0.1:5173')),
    /** Browser cache lifetime for public content responses, in seconds. */
    publicCacheSeconds: Math.max(0, int(env.PUBLIC_CACHE_SECONDS, 60)),
    trustProxy: int(env.TRUST_PROXY, isProduction ? 1 : 0),
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProduction,
    sessionIdleHours: int(env.SESSION_IDLE_HOURS, 12),
    sessionMaxDays: int(env.SESSION_MAX_DAYS, 7),
    uploadMaxBytes: int(env.UPLOAD_MAX_MB, 20) * 1024 * 1024,
    loginRateLimit: { max: int(env.LOGIN_MAX_ATTEMPTS, 8), windowMs: 15 * 60 * 1000 },
    uploadRateLimit: { max: int(env.UPLOAD_MAX_PER_HOUR, 200), windowMs: 60 * 60 * 1000 },
  };

  if (isProduction && !env.API_PUBLIC_URL) throw new Error('API_PUBLIC_URL is required in production');
  if (isProduction && !env.SITE_URL) throw new Error('SITE_URL is required in production');
  return config;
}

/** @typedef {ReturnType<typeof loadConfig>} Config */
