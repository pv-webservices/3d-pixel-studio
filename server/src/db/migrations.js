// Ordered, append-only schema migrations. Never edit a migration that has shipped; add a new one.
export const MIGRATIONS = [
  {
    id: 1,
    name: 'initial schema',
    sql: `
CREATE TABLE admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_admin ON sessions(admin_id);

-- storage = 'upload' (files on this server's persistent disk) or 'site' (legacy files deployed with the website).
CREATE TABLE media (
  id TEXT PRIMARY KEY,
  storage TEXT NOT NULL CHECK (storage IN ('upload', 'site')),
  path TEXT NOT NULL UNIQUE,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  sizes TEXT NOT NULL,
  alt TEXT NOT NULL DEFAULT '',
  original_name TEXT,
  bytes INTEGER,
  import_key TEXT UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('exterior', 'interior')),
  description TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT '[]',
  cover_media_id TEXT REFERENCES media(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  import_key TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);

-- Ordered gallery. category lets a mixed project (e.g. exterior + interior renders) keep each image in its Work filter.
CREATE TABLE project_media (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('exterior', 'interior')),
  PRIMARY KEY (project_id, media_id)
);
CREATE INDEX project_media_media ON project_media(media_id);

CREATE TABLE films (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT '3D Walkthrough',
  youtube_id TEXT NOT NULL,
  thumbnail_media_id TEXT REFERENCES media(id) ON DELETE RESTRICT,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  import_key TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);

-- Homepage settings hold references and order only. Deleting a record removes its reference (cascade);
-- unpublishing keeps the reference, which is hidden publicly and flagged in the admin.
CREATE TABLE homepage_projects (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  position INTEGER NOT NULL
);

CREATE TABLE homepage_films (
  film_id TEXT PRIMARY KEY REFERENCES films(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('featured', 'secondary')),
  position INTEGER NOT NULL
);
CREATE UNIQUE INDEX homepage_one_featured ON homepage_films(slot) WHERE slot = 'featured';

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`,
  },
];
