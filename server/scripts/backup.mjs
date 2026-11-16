// Consistent online backup of the content database (safe while the server is running), plus a list of
// the upload folders to copy alongside it. Keeps the newest BACKUP_KEEP (default 14) database copies.
// Usage: npm run backup
import { readdir, rm, stat } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db/index.js';

const config = loadConfig();
const keep = Number.parseInt(process.env.BACKUP_KEEP ?? '14', 10);
mkdirSync(config.backupsDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = path.join(config.backupsDir, `content-${stamp}.db`);
const db = openDatabase(config.dbFile);
// VACUUM INTO writes a transactionally consistent, compacted copy.
db.prepare('VACUUM INTO ?').run(target);
db.close();

const backups = (await readdir(config.backupsDir)).filter((f) => /^content-.*\.db$/.test(f)).sort().reverse();
for (const old of backups.slice(keep)) await rm(path.join(config.backupsDir, old));

const { size } = await stat(target);
console.info(`Database backup written: ${target} (${(size / 1024).toFixed(0)} KB)`);
console.info(`Also copy these folders off the server for a full backup: ${config.uploadsDir} and ${config.originalsDir}`);
