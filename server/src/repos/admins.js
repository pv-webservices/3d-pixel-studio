// Admin accounts and server-side sessions. Only a hash of each session token is stored.
import { randomUUID } from 'node:crypto';
import { now } from '../db/index.js';
import { hashPassword, randomToken, sha256 } from '../lib/security.js';

export function createAdminsRepo(db, config) {
  const idleMs = config.sessionIdleHours * 3600 * 1000;
  const maxMs = config.sessionMaxDays * 86400 * 1000;

  return {
    count() {
      return db.prepare('SELECT COUNT(*) AS n FROM admins').get().n;
    },
    findByEmail(email) {
      return db.prepare('SELECT * FROM admins WHERE email = ?').get(String(email).trim()) ?? null;
    },
    async upsert(email, password) {
      const hash = await hashPassword(password);
      const existing = this.findByEmail(email);
      if (existing) {
        db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, existing.id);
        db.prepare('DELETE FROM sessions WHERE admin_id = ?').run(existing.id);
        return { id: existing.id, created: false };
      }
      const id = randomUUID();
      db.prepare('INSERT INTO admins (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').run(id, String(email).trim(), hash, now());
      return { id, created: true };
    },
    createSession(adminId) {
      const token = randomToken();
      const csrfToken = randomToken();
      const t = Date.now();
      db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date(t).toISOString());
      db.prepare('INSERT INTO sessions (token_hash, admin_id, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(
        sha256(token),
        adminId,
        csrfToken,
        new Date(t).toISOString(),
        new Date(t + idleMs).toISOString(),
      );
      db.prepare('UPDATE admins SET last_login_at = ? WHERE id = ?').run(now(), adminId);
      return { token, csrfToken };
    },
    /** Resolve a session token, sliding its idle expiry but never past the absolute maximum. */
    resolveSession(token) {
      if (!token) return null;
      const row = db
        .prepare('SELECT s.*, a.email FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ?')
        .get(sha256(token));
      if (!row) return null;
      const t = Date.now();
      const hardLimit = Date.parse(row.created_at) + maxMs;
      if (Date.parse(row.expires_at) <= t || hardLimit <= t) {
        db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash);
        return null;
      }
      db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(new Date(Math.min(t + idleMs, hardLimit)).toISOString(), row.token_hash);
      return { adminId: row.admin_id, email: row.email, csrfToken: row.csrf_token, tokenHash: row.token_hash };
    },
    destroySession(tokenHash) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    },
  };
}
