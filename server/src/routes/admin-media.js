// Authenticated image upload, library listing, alt text edits and guarded deletion.
import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { HttpError, notFound, parse, trimmed } from '../lib/http.js';
import { createRateLimiter } from '../lib/security.js';
import { processImage } from '../media/images.js';

const ACCEPTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function createAdminMediaRouter({ config, media, storage, logger }) {
  const router = express.Router();
  const uploadLimiter = createRateLimiter(config.uploadRateLimit);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.uploadMaxBytes, files: 1, fields: 4, fieldSize: 2048 },
    // First-pass filter only; the file is fully decoded by sharp before it is accepted.
    fileFilter: (req, file, cb) => cb(ACCEPTED_MIME.has(file.mimetype) ? null : new HttpError(415, 'Upload a JPEG, PNG or WebP image.'), ACCEPTED_MIME.has(file.mimetype)),
  });

  const limitUploads = (req, res, next) => {
    const key = `upload:${req.admin.adminId}`;
    const r = uploadLimiter.check(key);
    if (!r.allowed) {
      res.set('Retry-After', String(r.retryAfter));
      throw new HttpError(429, 'Upload limit reached. Please wait before uploading more images.');
    }
    uploadLimiter.hit(key);
    next();
  };

  router.get('/media', (req, res) => res.json({ media: media.list({ unusedOnly: req.query.unused === '1' }) }));

  router.post('/media', limitUploads, upload.single('file'), async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Choose an image to upload.');
    const alt = parse(z.object({ alt: trimmed(300).default('') }), req.body ?? {}).alt;
    const image = await processImage(req.file.buffer, req.file.originalname);
    const path = await storage.save({ id: image.id, ext: image.ext, original: req.file.buffer, variants: image.variants });
    try {
      const row = media.insert({
        id: image.id,
        storage: 'upload',
        path,
        width: image.width,
        height: image.height,
        sizes: image.sizes,
        alt,
        originalName: req.file.originalname.slice(0, 200),
        bytes: req.file.size,
      });
      res.status(201).json({ media: { ...media.toMedia(row, { absolute: true }), storage: 'upload' } });
    } catch (err) {
      await storage.remove({ id: image.id, sizes: image.sizes }).catch((e) => logger.error('cleanup after failed insert', e));
      throw err;
    }
  });

  router.patch('/media/:id', (req, res) => {
    const { alt } = parse(z.object({ alt: trimmed(300) }), req.body ?? {});
    if (!media.getRow(req.params.id)) throw notFound('Image');
    media.setAlt(req.params.id, alt);
    res.json({ media: media.toMedia(media.getRow(req.params.id), { absolute: true }) });
  });

  router.delete('/media/:id', async (req, res) => {
    const row = media.remove(req.params.id);
    // Legacy 'site' images ship with the website build, so only their record is removed here.
    if (row.storage === 'upload') await storage.remove({ id: row.id, sizes: JSON.parse(row.sizes) });
    res.json({ ok: true });
  });

  return router;
}
