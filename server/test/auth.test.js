import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { client, filmBody, makePng, projectBody, startServer } from './helpers.js';

describe('authentication and authorisation', () => {
  let srv;
  before(async () => (srv = await startServer({ env: { LOGIN_MAX_ATTEMPTS: '3' } })));
  after(() => srv.stop());

  test('unauthenticated requests cannot read or change records, selections or assets', async () => {
    const anon = client(srv.base);
    const attempts = [
      anon.get('/api/admin/projects'),
      anon.post('/api/admin/projects', projectBody(['x'])),
      anon.put('/api/admin/projects/any', projectBody(['x'])),
      anon.del('/api/admin/projects/any'),
      anon.post('/api/admin/films', filmBody()),
      anon.del('/api/admin/films/any'),
      anon.put('/api/admin/homepage/selected-work', { projectIds: [] }),
      anon.put('/api/admin/homepage/films', { featuredFilmId: null, secondaryFilmIds: [] }),
      anon.upload(await makePng()),
      anon.del('/api/admin/media/any'),
    ];
    for (const res of await Promise.all(attempts)) assert.equal(res.status, 401);
    assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM media').get().n, 0);
  });

  test('there is no public registration endpoint', async () => {
    const res = await client(srv.base).post('/api/admin/register', { email: 'x@y.z', password: 'whatever-long-pass' });
    assert.equal(res.status, 401);
  });

  test('wrong password is rejected with a generic message', async () => {
    const res = await client(srv.base).login('owner@example.test', 'not the password');
    assert.equal(res.status, 401);
    assert.match(res.data.error, /incorrect/);
    const unknown = await client(srv.base).login('nobody@example.test', 'not the password');
    assert.equal(unknown.data.error, res.data.error);
  });

  test('session cookie is HttpOnly and SameSite=Strict', async () => {
    const c = client(srv.base);
    const res = await c.login();
    assert.equal(res.status, 200);
    const cookie = res.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
  });

  test('state changes need the CSRF token and a same-origin Origin', async () => {
    const c = client(srv.base);
    await c.login();
    const noToken = await fetch(`${srv.base}/api/admin/homepage/selected-work`, {
      method: 'PUT',
      headers: { Cookie: c.cookie, Origin: srv.base, 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectIds: [] }),
    });
    assert.equal(noToken.status, 403);
    const crossSite = await c.put('/api/admin/homepage/selected-work', { projectIds: [] }, { headers: { Origin: 'https://evil.example' } });
    assert.equal(crossSite.status, 403);
    const ok = await c.put('/api/admin/homepage/selected-work', { projectIds: [] });
    assert.equal(ok.status, 200);
  });

  test('logout invalidates the session server-side', async () => {
    const c = client(srv.base);
    await c.login();
    const cookie = c.cookie;
    assert.equal((await c.post('/api/admin/logout')).status, 200);
    const reuse = await fetch(`${srv.base}/api/admin/projects`, { headers: { Cookie: cookie } });
    assert.equal(reuse.status, 401);
  });

  test('repeated failed logins are rate limited', async () => {
    const c = client(srv.base);
    for (let i = 0; i < 3; i++) await c.login('limited@example.test', 'wrong password');
    const res = await c.login('limited@example.test', 'wrong password');
    assert.equal(res.status, 429);
    assert.ok(res.headers.get('retry-after'));
  });
});
