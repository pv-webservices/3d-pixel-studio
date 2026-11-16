// Password hashing (scrypt), opaque session tokens and a small in-memory rate limiter.
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keyLen: 64 };
const SCRYPT_MAXMEM = 128 * SCRYPT.N * SCRYPT.r * 2;
export const MIN_PASSWORD_LENGTH = 12;

/** @returns {Promise<string>} self-describing hash: scrypt$N$r$p$salt$hash */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT.keyLen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: SCRYPT_MAXMEM });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  const [algo, N, r, p, salt, hash] = String(stored).split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const params = { N: Number(N), r: Number(r), p: Number(p), maxmem: 128 * Number(N) * Number(r) * 2 };
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, params);
  return timingSafeEqual(actual, expected);
}

// A fixed hash to compare against when the email is unknown, so response time does not reveal accounts.
let dummyHash = null;
export async function verifyAgainstDummy(password) {
  dummyHash ??= await hashPassword(randomBytes(12).toString('hex'));
  await verifyPassword(password, dummyHash);
  return false;
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Fixed-window limiter kept in memory. Adequate for a single-instance service (a Render service with
 * a persistent disk cannot scale horizontally); counters reset on restart.
 */
export function createRateLimiter({ max, windowMs }) {
  const hits = new Map();
  const sweep = setInterval(() => {
    const t = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= t) hits.delete(key);
  }, windowMs);
  sweep.unref();

  return {
    /** @returns {{ allowed: boolean, retryAfter: number }} */
    check(key) {
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= Date.now()) return { allowed: true, retryAfter: 0 };
      return { allowed: entry.count < max, retryAfter: Math.ceil((entry.resetAt - Date.now()) / 1000) };
    },
    hit(key) {
      const t = Date.now();
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= t) hits.set(key, { count: 1, resetAt: t + windowMs });
      else entry.count += 1;
    },
    reset(key) {
      hits.delete(key);
    },
  };
}
