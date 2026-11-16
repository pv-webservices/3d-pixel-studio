// Test harness: a real HTTP server on an ephemeral port with its own temporary data directory.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createApp, createRepos } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db/index.js';
import { createLocalStorage } from '../src/media/storage.js';

export const ADMIN = { email: 'owner@example.test', password: 'correct horse battery staple' };
const silent = { info() {}, error() {} };

export function makeDataDir() {
  return mkdtempSync(path.join(tmpdir(), '3dps-test-'));
}

/** Start the app. Pass an existing dataDir to simulate a restart against the same persistent data. */
export async function startServer({ dataDir = makeDataDir(), env = {} } = {}) {
  const config = loadConfig({ DATA_DIR: dataDir, PORT: '0', ...env });
  const db = openDatabase(config.dbFile);
  const storage = createLocalStorage(config);
  await storage.init();
  const repos = createRepos(db, config);
  if (!repos.admins.findByEmail(ADMIN.email)) await repos.admins.upsert(ADMIN.email, ADMIN.password);

  const app = createApp({ config, db, storage, logger: silent });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  // URLs built for uploaded media must point at this server.
  config.publicUrl = base;

  return {
    base,
    config,
    db,
    repos,
    dataDir,
    async stop({ keepData = false } = {}) {
      await new Promise((resolve) => server.close(resolve));
      db.close();
      if (!keepData) rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

/** Minimal browser-like client: keeps the session cookie and sends Origin + CSRF like the admin UI. */
export function client(base) {
  let cookie = '';
  let csrf = '';
  async function call(method, url, { json, form, headers = {} } = {}) {
    const h = { Origin: base, ...headers };
    if (cookie) h.Cookie = cookie;
    if (csrf && method !== 'GET') h['X-CSRF-Token'] = csrf;
    let body;
    if (json !== undefined) {
      h['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    } else if (form) body = form;
    const res = await fetch(`${base}${url}`, { method, headers: h, body });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, headers: res.headers, data };
  }
  return {
    call,
    get: (url, o) => call('GET', url, o),
    post: (url, json, o) => call('POST', url, { ...o, json }),
    put: (url, json, o) => call('PUT', url, { ...o, json }),
    del: (url, o) => call('DELETE', url, o),
    async login(email = ADMIN.email, password = ADMIN.password) {
      const res = await call('POST', '/api/admin/login', { json: { email, password } });
      if (res.status === 200) csrf = res.data.csrfToken;
      return res;
    },
    async upload(buffer, name = 'render.png', type = 'image/png') {
      const form = new FormData();
      form.append('alt', `Alt for ${name}`);
      form.append('file', new Blob([buffer], { type }), name);
      return call('POST', '/api/admin/media', { form });
    },
    get cookie() {
      return cookie;
    },
  };
}

export async function makePng(width = 800, height = 500, color = { r: 20, g: 90, b: 70 }) {
  return sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();
}

/** Upload n images and return their media ids. */
export async function uploadImages(c, n = 2) {
  const ids = [];
  for (let i = 0; i < n; i++) {
    const res = await c.upload(await makePng(800 + i * 10, 500), `render-${i}.png`);
    if (res.status !== 201) throw new Error(`upload failed: ${res.status} ${JSON.stringify(res.data)}`);
    ids.push(res.data.media.id);
  }
  return ids;
}

export function projectBody(mediaIds, overrides = {}) {
  return {
    name: 'Test Tower',
    location: 'Pune',
    category: 'exterior',
    description: 'A test project.',
    scope: ['Facade'],
    status: 'published',
    coverMediaId: mediaIds[0],
    gallery: mediaIds.map((mediaId) => ({ mediaId, category: 'exterior' })),
    ...overrides,
  };
}

export function filmBody(overrides = {}) {
  return { title: 'Test Film', location: 'Mumbai', kind: '3D Walkthrough', videoUrl: 'https://youtu.be/4MpmzYg59g0', status: 'published', ...overrides };
}
