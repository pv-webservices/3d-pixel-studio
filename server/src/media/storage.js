// File storage for uploaded media on a local directory. In production this directory must be on a
// persistent volume (a Render persistent disk mounted at DATA_DIR); Render's default filesystem is ephemeral.
import { copyFile, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SAFE_ID = /^[a-z0-9-]{1,120}$/;

const assertId = (id) => {
  if (!SAFE_ID.test(id)) throw new Error(`Unsafe media id "${id}"`);
};

async function atomicWrite(file, buffer) {
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, buffer);
  await rename(tmp, file);
}

/**
 * @param {{ uploadsDir: string, originalsDir: string }} dirs
 */
export function createLocalStorage({ uploadsDir, originalsDir }) {
  return {
    uploadsDir,
    async init() {
      await mkdir(uploadsDir, { recursive: true });
      await mkdir(originalsDir, { recursive: true });
    },
    /** @returns {string} the media path stored in the database; variants live at `${path}-${width}.webp` */
    async save({ id, ext, original, variants }) {
      assertId(id);
      await Promise.all(variants.map((v) => atomicWrite(path.join(uploadsDir, `${id}-${v.width}.webp`), v.buffer)));
      // Originals are kept (not served) so variants can be regenerated later without asking for re-uploads.
      await atomicWrite(path.join(originalsDir, `${id}.${ext}`), original);
      return `/uploads/${id}`;
    },
    /** Copy existing pre-optimised variants (legacy import with --copy-media). */
    async copyVariants({ id, files }) {
      assertId(id);
      await Promise.all(files.map(({ width, source }) => copyFile(source, path.join(uploadsDir, `${id}-${width}.webp`))));
      return `/uploads/${id}`;
    },
    async remove({ id, sizes }) {
      assertId(id);
      await Promise.all(sizes.map((w) => rm(path.join(uploadsDir, `${id}-${w}.webp`), { force: true })));
      for (const ext of ['jpg', 'png', 'webp']) await rm(path.join(originalsDir, `${id}.${ext}`), { force: true });
    },
  };
}
