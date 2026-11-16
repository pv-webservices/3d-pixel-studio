// Image upload dropzone (sequential uploads with per-file status) and a media library picker.
import { api } from '../api.js';
import { clear, h, loadingView, openDialog, thumbUrl, fill } from '../dom.js';

const ACCEPT = 'image/jpeg,image/png,image/webp';

/**
 * @param {{ multiple?: boolean, label?: string, onUploaded: (media: object) => void, onBusy?: (busy: boolean) => void }} opts
 */
export function uploader({ multiple = true, label = 'Upload images', onUploaded, onBusy = () => {} }) {
  const input = h('input', { type: 'file', accept: ACCEPT, multiple, class: 'sr-only', id: `up-${Math.random().toString(36).slice(2, 8)}` });
  const status = h('ul', { class: 'upload-status', 'aria-live': 'polite' });
  const zone = h(
    'div',
    { class: 'dropzone' },
    h('p', null, h('label', { class: 'btn', for: input.id }, label), ' ', input),
    h('p', { class: 'hint' }, `or drag ${multiple ? 'images' : 'an image'} here · JPEG, PNG or WebP · 2000px+ wide recommended`),
    status,
  );

  async function handle(files) {
    const list = [...files].filter(Boolean);
    if (!list.length) return;
    onBusy(true);
    clear(status);
    let done = 0;
    for (const file of multiple ? list : list.slice(0, 1)) {
      const line = h('li', null, h('span', { class: 'spinner', 'aria-hidden': 'true' }), ` Uploading ${file.name}…`);
      status.append(line);
      try {
        const { media } = await api.upload(file);
        onUploaded(media);
        done++;
        line.replaceChildren(`✓ ${file.name}`);
      } catch (err) {
        line.classList.add('is-error');
        line.replaceChildren(`✕ ${file.name}: ${err.message}`);
      }
    }
    if (done === list.length) setTimeout(() => clear(status), 2500);
    input.value = '';
    onBusy(false);
  }

  input.addEventListener('change', () => handle(input.files));
  zone.addEventListener('dragover', (e) => {
    if (![...e.dataTransfer.types].includes('Files')) return;
    e.preventDefault();
    zone.classList.add('is-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
  zone.addEventListener('drop', (e) => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    zone.classList.remove('is-over');
    handle(e.dataTransfer.files);
  });
  return zone;
}

/**
 * Let the admin pick existing images (e.g. to re-add an image removed from a gallery).
 * @param {{ multiple?: boolean, exclude?: Set<string>, onPick: (media: object[]) => void }} opts
 */
export function openLibraryPicker({ multiple = true, exclude = new Set(), onPick }) {
  const chosen = new Map();
  const grid = h('div', { class: 'picker' }, loadingView('Loading library…'));
  const onlyUnused = h('input', { type: 'checkbox', checked: true, id: 'pick-unused' });
  const load = async () => {
    fill(grid, loadingView('Loading library…'));
    try {
      const { media } = await api.get(`/media${onlyUnused.checked ? '?unused=1' : ''}`);
      const items = media.filter((m) => !exclude.has(m.id));
      clear(grid);
      if (!items.length) return grid.append(h('p', { class: 'empty' }, onlyUnused.checked ? 'No unused images. Untick the box to see every image.' : 'The library is empty.'));
      grid.append(
        h(
          'ul',
          { class: 'library' },
          items.map((m) => {
            const btn = h(
              'button',
              { type: 'button', class: 'lib-item', 'aria-pressed': 'false', onclick: () => toggle(m, btn) },
              h('img', { src: thumbUrl(m), alt: '', loading: 'lazy' }),
              h('span', { class: 'lib-item__body' }, h('p', null, m.alt || m.originalName || m.id)),
            );
            return h('li', null, btn);
          }),
        ),
      );
    } catch (err) {
      fill(grid, h('p', { class: 'notice notice--error' }, err.message));
    }
  };
  const toggle = (m, btn) => {
    if (!multiple) {
      grid.querySelectorAll('[aria-pressed="true"]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      chosen.clear();
    }
    if (chosen.has(m.id)) chosen.delete(m.id);
    else chosen.set(m.id, m);
    btn.setAttribute('aria-pressed', String(chosen.has(m.id)));
  };
  onlyUnused.addEventListener('change', load);
  openDialog({
    title: multiple ? 'Add images from the library' : 'Choose an image',
    wide: true,
    content: [h('p', null, h('label', { class: 'choice' }, onlyUnused, 'Only show images not used anywhere')), grid],
    actions: (close) => [
      h('button', { class: 'btn', type: 'button', onclick: close }, 'Cancel'),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: () => { onPick([...chosen.values()]); close(); } }, multiple ? 'Add selected' : 'Use image'),
    ],
  });
  load();
}
