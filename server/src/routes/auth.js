// Login/logout and the requireAdmin guard. Sessions use an HttpOnly, SameSite=Strict cookie; every
// state-changing admin request must also carry the per-session CSRF token and a same-origin Origin header.
import express from 'express';
import { z } from 'zod';
import { HttpError, parse } from '../lib/http.js';
import { createRateLimiter, safeEqual, verifyAgainstDummy, verifyPassword } from '../lib/security.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email.').max(200),
  password: z.string().min(1, 'Enter your password.').max(500),
});

export function cookieName(config) {
  // The __Host- prefix pins the cookie to this exact origin; browsers only accept it with Secure.
  return config.cookieSecure ? '__Host-3dps_session' : '3dps_session';
}

function readCookie(req, name) {
  const header = req.headers.cookie ?? '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function sessionCookie(config, value, maxAgeSeconds) {
  return [`${cookieName(config)}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSeconds}`, config.cookieSecure && 'Secure'].filter(Boolean).join('; ');
}

/** Reject cross-site requests: the Origin (or Referer) must be this API's own origin. */
function refererOrigin(req) {
  try {
    return req.get('referer') ? new URL(req.get('referer')).origin : null;
  } catch {
    return null;
  }
}

function assertSameOrigin(req, config) {
  const origin = req.get('origin') ?? refererOrigin(req);
  const own = new Set([config.publicUrl, `${req.protocol}://${req.get('host')}`]);
  if (!origin || !own.has(origin)) throw new HttpError(403, 'Request blocked: it did not come from the admin panel.');
}

export function createAuth({ config, admins }) {
  const ipLimiter = createRateLimiter({ max: config.loginRateLimit.max * 3, windowMs: config.loginRateLimit.windowMs });
  const accountLimiter = createRateLimiter(config.loginRateLimit);

  /** @type {import('express').RequestHandler} */
  const requireAdmin = (req, res, next) => {
    const session = admins.resolveSession(readCookie(req, cookieName(config)));
    if (!session) throw new HttpError(401, 'Your session has ended. Please sign in again.');
    if (!SAFE_METHODS.has(req.method)) {
      assertSameOrigin(req, config);
      if (!safeEqual(req.get('x-csrf-token') ?? '', session.csrfToken)) throw new HttpError(403, 'Security token missing or out of date. Reload the page and try again.');
    }
    req.admin = session;
    res.set('Cache-Control', 'no-store');
    next();
  };

  const router = express.Router();

  router.post('/login', async (req, res) => {
    assertSameOrigin(req, config);
    const { email, password } = parse(loginSchema, req.body ?? {});
    const ipKey = `ip:${req.ip}`;
    const accountKey = `acct:${email.toLowerCase()}`;
    const limited = [ipLimiter.check(ipKey), accountLimiter.check(accountKey)].find((r) => !r.allowed);
    if (limited) {
      res.set('Retry-After', String(limited.retryAfter));
      throw new HttpError(429, `Too many sign-in attempts. Try again in ${Math.ceil(limited.retryAfter / 60)} minutes.`);
    }
    const admin = admins.findByEmail(email);
    const ok = admin ? await verifyPassword(password, admin.password_hash) : await verifyAgainstDummy(password);
    if (!ok) {
      ipLimiter.hit(ipKey);
      accountLimiter.hit(accountKey);
      throw new HttpError(401, 'Email or password is incorrect.');
    }
    accountLimiter.reset(accountKey);
    const { token, csrfToken } = admins.createSession(admin.id);
    res.set('Set-Cookie', sessionCookie(config, token, config.sessionMaxDays * 86400));
    res.set('Cache-Control', 'no-store');
    res.json({ email: admin.email, csrfToken });
  });

  router.get('/session', requireAdmin, (req, res) => {
    res.json({ email: req.admin.email, csrfToken: req.admin.csrfToken });
  });

  router.post('/logout', requireAdmin, (req, res) => {
    admins.destroySession(req.admin.tokenHash);
    res.set('Set-Cookie', sessionCookie(config, '', 0));
    res.json({ ok: true });
  });

  return { router, requireAdmin };
}
