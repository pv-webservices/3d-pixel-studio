import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { client, makePng, projectBody, startServer } from './helpers.js';

describe('uploads and persistence', () => {
  test('valid images become responsive WebP variants; invalid files are rejected', async () => {
    const srv = await startServer();
    try {
      const c = client(srv.base);
      await c.login();
      const ok = await c.upload(await makePng(2400, 1350), '../../etc/My Render (Final).PNG');
      assert.equal(ok.status, 201);
      const m = ok.data.media;
      assert.match(m.id, /^my-render-final-[0-9a-f]{8}$/, 'filename is sanitised and unique');
      assert.deepEqual(m.sizes, [640, 1280, 2000]);
      assert.equal(m.w, 2400);
      assert.equal(m.h, 1350);
      for (const w of m.sizes) assert.ok(existsSync(path.join(srv.config.uploadsDir, `${m.id}-${w}.webp`)));
      const served = await fetch(`${m.src}-640.webp`);
      assert.equal(served.status, 200);
      assert.equal(served.headers.get('content-type'), 'image/webp');
      assert.match(served.headers.get('cache-control'), /immutable/);

      const fake = await c.upload(Buffer.from('<?php echo 1; ?>'), 'shell.png', 'image/png');
      assert.equal(fake.status, 415);
      const wrongType = await c.upload(Buffer.from('GIF89a'), 'x.gif', 'image/gif');
      assert.equal(wrongType.status, 415);
      const tiny = await c.upload(await makePng(100, 100), 'tiny.png');
      assert.equal(tiny.status, 422);
    } finally {
      await srv.stop();
    }
  });

  test('uploads above the size limit are refused', async () => {
    const srv = await startServer({ env: { UPLOAD_MAX_MB: '0' } });
    try {
      const c = client(srv.base);
      await c.login();
      const res = await c.upload(await makePng(), 'big.png');
      assert.equal(res.status, 413);
    } finally {
      await srv.stop();
    }
  });

  test('images in use cannot be deleted; unused ones can, including their files', async () => {
    const srv = await startServer();
    try {
      const c = client(srv.base);
      await c.login();
      const a = (await c.upload(await makePng(), 'a.png')).data.media;
      const b = (await c.upload(await makePng(), 'b.png')).data.media;
      await c.post('/api/admin/projects', projectBody([a.id], { status: 'draft' }));
      const blocked = await c.del(`/api/admin/media/${a.id}`);
      assert.equal(blocked.status, 409);
      assert.match(blocked.data.error, /still used/);
      assert.equal((await c.del(`/api/admin/media/${b.id}`)).status, 200);
      assert.ok(!existsSync(path.join(srv.config.uploadsDir, `${b.id}-640.webp`)));
      assert.ok(existsSync(path.join(srv.config.uploadsDir, `${a.id}-640.webp`)));
    } finally {
      await srv.stop();
    }
  });

  test('records, selections, sessions and uploads survive a backend restart on the same data directory', async () => {
    const first = await startServer();
    const c = client(first.base);
    await c.login();
    const media = (await c.upload(await makePng(), 'persist.png')).data.media;
    const { project } = (await c.post('/api/admin/projects', projectBody([media.id], { name: 'Persistent' }))).data;
    await c.put('/api/admin/homepage/selected-work', { projectIds: [project.id] });
    const cookie = c.cookie;
    await first.stop({ keepData: true });

    const second = await startServer({ dataDir: first.dataDir });
    try {
      const home = await (await fetch(`${second.base}/api/public/home`)).json();
      assert.equal(home.selectedWork[0].name, 'Persistent');
      const img = await fetch(`${second.base}/uploads/${media.id}-640.webp`);
      assert.equal(img.status, 200);
      const session = await fetch(`${second.base}/api/admin/session`, { headers: { Cookie: cookie } });
      assert.equal(session.status, 200, 'sessions are stored in the database, not memory');
    } finally {
      await second.stop();
    }
  });

  test('upload paths cannot escape the uploads directory', async () => {
    const srv = await startServer();
    try {
      const res = await fetch(`${srv.base}/uploads/..%2f..%2fcontent.db`);
      assert.ok([403, 404].includes(res.status), `unexpected ${res.status}`);
    } finally {
      await srv.stop();
    }
  });
});
