// Generates web-ready, responsive media from the raw brief assets in /public
// into /static/media (Vite's publicDir) plus a manifest at src/data/media.json.
// Usage: npm run media
import { readdir, mkdir, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'static', 'media');
const WIDTHS = [640, 1280, 2000];
const QUALITY = 76;

const SOURCES = [
  { dir: 'Architecture Cgi', cat: 'exterior', out: 'exterior' },
  { dir: 'Interior cgi', cat: 'interior', out: 'interior' },
  { dir: 'Isometric', cat: 'plan', out: 'plans' },
];

// Project prefix → display name + location (derived from the supplied filenames).
const PROJECTS = [
  ['abhyudaya-celestial', 'Abhyudaya Celestial', 'Lucknow'],
  ['ace-atlantis', 'Ace Atlantis', 'Thane'],
  ['applaud-38', 'Applaud 38', 'Goregaon, Mumbai'],
  ['bhoomi-lakescape', 'Bhoomi Lakescape', 'Thane'],
  ['geecee-evana', 'GeeCee Evana', 'Bandra, Mumbai'],
  ['godrej-rejuve', 'Godrej Rejuve', 'Pune'],
  ['indapur', 'Indapur Bungalow', 'Indapur'],
  ['jeet-rivera', 'Jeet Rivera', 'Varanasi'],
  ['lavik-shanthi', 'Lavik Shanthi', 'Coimbatore'],
  ['lm-wind-power', 'LM Wind Power', 'Industrial Facility'],
  ['mirador-prangan', 'Mirador Prangan', 'Atgaon, Thane'],
  ['modern-waterfront', 'Waterfront Bridge', 'Maharashtra'],
  ['river-crossing', 'River Crossing', 'Maharashtra'],
  ['premium-mid-rise-hotel', 'Hillside Hotel', 'Shillong'],
  ['premium-religious', 'Religious Architecture', 'India'],
  ['temple', 'Temple Architecture', 'India'],
  ['puri-greens-2', 'Puri Greens 2', 'Gurgaon'],
  ['sarika', 'Sarika', 'Thane'],
  ['savvy-swaraj', 'Savvy Swaraj Sports Academy', 'Ahmedabad'],
  ['shapoorji-pallonji-golfland', 'Shapoorji Pallonji Golfland', 'Pune'],
  ['shubh-kamna-heights', 'Shubh Kamna Heights', 'Varanasi'],
  ['sunbeam-heights', 'Sunbeam Heights', 'Andheri, Mumbai'],
  ['tata-adwita', 'Tata Adwita', 'Kolkata'],
  ['the-empire', 'The Empire', 'Nashik'],
  ['unique-shubharambh', 'Unique Shubharambh', 'Mira Road'],
  ['lodha-villa-royale-gold', 'Lodha Villa Royale', 'Thane'],
  ['lonavala', 'Lonavala Villa', 'Lonavala'],
  ['london', 'London Residence', 'London'],
  ['mgm-hospital', 'MGM Hospital', 'Mumbai'],
  ['moksha-at-avas', 'Moksha at Avas', 'Alibaug'],
  ['oberoi-360-tower', 'Oberoi 360 Tower', 'Mumbai'],
  ['radio-mirchi', 'Radio Mirchi', 'Mumbai'],
];

const slugify = (name) =>
  name
    .replace(/(\.webp)+$/i, '')
    .replace(/\.web$/i, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

function describe(slug, cat) {
  const match = PROJECTS.find(([prefix]) => slug.startsWith(prefix));
  if (cat === 'plan') {
    const label = titleCase(slug.replace(/-/g, ' ').replace(/\boffiice\b/g, 'office').replace(/\bim\b/g, ''));
    return { project: '3D Floor Plan', location: label.trim(), alt: `3D isometric floor plan — ${label.trim()}` };
  }
  if (!match) {
    return { project: cat === 'interior' ? 'Private Residence' : 'Architectural Project', location: 'India', alt: `${cat} CGI — ${slug.replace(/-/g, ' ')}` };
  }
  const [prefix, project, location] = match;
  const scene = slug.slice(prefix.length).replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  const alt = `${project} ${cat === 'interior' ? 'interior' : 'exterior'} CGI — ${scene}`;
  return { project, location, alt };
}

async function processImage(srcFile, outDir, slug) {
  const img = sharp(srcFile, { failOn: 'none' });
  const meta = await img.metadata();
  const sizes = WIDTHS.filter((w) => w < meta.width).concat(meta.width < WIDTHS.at(-1) ? [meta.width] : []);
  const unique = [...new Set(sizes.length ? sizes : [meta.width])].slice(0, 3);
  for (const w of unique) {
    const target = path.join(outDir, `${slug}-${w}.webp`);
    if (existsSync(target)) continue;
    await sharp(srcFile, { failOn: 'none' }).resize({ width: w }).webp({ quality: QUALITY, effort: 4 }).toFile(target);
  }
  return { w: meta.width, h: meta.height, sizes: unique };
}

async function processGallery() {
  const manifest = [];
  for (const { dir, cat, out } of SOURCES) {
    const outDir = path.join(OUT, out);
    await mkdir(outDir, { recursive: true });
    const files = (await readdir(path.join(SRC, dir))).filter((f) => /\.webp$/i.test(f)).sort();
    for (const file of files) {
      const slug = slugify(file);
      const info = await processImage(path.join(SRC, dir, file), outDir, slug);
      manifest.push({ id: slug, cat, src: `/media/${out}/${slug}`, ...info, ...describe(slug, cat) });
      process.stdout.write('.');
    }
  }
  return manifest;
}

async function processBrand() {
  const outDir = path.join(OUT, 'brand');
  await mkdir(outDir, { recursive: true });
  const logo = path.join(SRC, 'Logo-3dpixelstudio-1.png');
  await sharp(logo).trim().resize({ height: 240 }).webp({ quality: 90 }).toFile(path.join(outDir, 'logo-gold.webp'));
  await sharp(logo).trim().resize({ height: 240 }).png({ compressionLevel: 9 }).toFile(path.join(outDir, 'logo-gold.png'));
  await sharp(logo).trim().resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(OUT, '..', 'favicon.png'));
  await sharp(path.join(SRC, 'Logo-3dpixelstudio (1).png')).resize(512).webp({ quality: 88 }).toFile(path.join(outDir, 'logo-emerald.webp'));

  const team = [
    ['Mushir Qazi.png', 'mushir-qazi'],
    ['Kamran Qazi.png', 'kamran-qazi'],
    ['Athar Ansari.png', 'athar-ansari'],
  ];
  const teamDir = path.join(OUT, 'team');
  await mkdir(teamDir, { recursive: true });
  for (const [file, slug] of team) {
    await sharp(path.join(SRC, file)).resize(900, 1100, { fit: 'cover', position: 'north' }).webp({ quality: 80 }).toFile(path.join(teamDir, `${slug}.webp`));
  }
}

async function processVideo() {
  const outDir = path.join(OUT, 'video');
  await mkdir(outDir, { recursive: true });
  const src = path.join(SRC, 'website hero section.mp4');
  const jobs = [
    ['hero-1080.mp4', ['-vf', 'scale=1920:-2', '-crf', '30', '-maxrate', '3000k', '-bufsize', '6000k']],
    ['hero-720.mp4', ['-vf', 'scale=1280:-2', '-crf', '31', '-maxrate', '1600k', '-bufsize', '3200k']],
  ];
  for (const [name, args] of jobs) {
    const target = path.join(outDir, name);
    if (existsSync(target)) continue;
    await run('ffmpeg', ['-y', '-v', 'error', '-i', src, '-an', '-c:v', 'libx264', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', ...args, target]);
  }
  const poster = path.join(outDir, 'hero-poster.jpg');
  if (!existsSync(poster)) {
    await run('ffmpeg', ['-y', '-v', 'error', '-ss', '12', '-i', src, '-frames:v', '1', '-vf', 'scale=1920:-2', '-q:v', '4', poster]);
  }
}

const started = Date.now();
await processBrand();
const manifest = await processGallery();
await mkdir(path.join(ROOT, 'src', 'data'), { recursive: true });
await writeFile(path.join(ROOT, 'src', 'data', 'media.json'), JSON.stringify(manifest, null, 1));
console.log(`\n${manifest.length} images processed`);
await processVideo();
const { size } = await stat(path.join(OUT, 'video', 'hero-1080.mp4'));
console.log(`video ready (${(size / 1e6).toFixed(1)} MB) in ${((Date.now() - started) / 1000).toFixed(0)}s`);
