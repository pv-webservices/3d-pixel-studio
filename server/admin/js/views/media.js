// Media library: every image record, its usage, and deletion of images nothing uses any more.
import { api } from '../api.js';
import { clear, confirmDialog, errorView, h, loadingView, thumbUrl, toast, fill } from '../dom.js';
import { uploader } from '../components/uploader.js';

export function mediaView() {
  const grid = h('div', null, loadingView());
  const unusedOnly = h('input', { type: 'checkbox', id: 'only-unused' });
  let items = [];

  const render = () => {
    const shown = unusedOnly.checked ? items.filter((m) => m.uses === 0) : items;
    clear(grid);
    if (!shown.length) return grid.append(h('p', { class: 'empty' }, unusedOnly.checked ? 'Every image is in use.' : 'No images yet.'));
    grid.append(
      h('p', { class: 'hint' }, `${shown.length} image(s)`),
      h(
        'ul',
        { class: 'library mt' },
        shown.map((m) =>
          h(
            'li',
            { class: 'lib-item' },
            h('img', { src: thumbUrl(m), alt: '', loading: 'lazy' }),
            h(
              'div',
              { class: 'lib-item__body' },
              h('p', null, m.alt || m.originalName || m.id),
              h('p', null, h('span', { class: `badge${m.uses ? ' badge--published' : ''}` }, m.uses ? `Used ${m.uses}×` : 'Unused'), ' ', m.storage === 'site' && h('span', { class: 'badge', title: 'Deployed with the website build (legacy import)' }, 'Website file')),
              h('button', { class: 'btn btn--small btn--danger', type: 'button', disabled: m.uses > 0, title: m.uses ? 'Remove it from every project or film first' : '', onclick: () => remove(m) }, 'Delete'),
            ),
          ),
        ),
      ),
    );
  };

  const load = async () => {
    fill(grid, loadingView());
    try {
      items = (await api.get('/media')).media;
      render();
    } catch (err) {
      fill(grid, errorView(err, load));
    }
  };

  async function remove(m) {
    const body = [h('p', null, 'This image is not used by any project or film. Deleting it cannot be undone.')];
    if (m.storage === 'site') body.push(h('p', { class: 'hint' }, 'This is a legacy file deployed with the website; only its admin record is removed.'));
    if (!(await confirmDialog({ title: 'Delete image?', body, confirmLabel: 'Delete image', danger: true }))) return;
    try {
      await api.del(`/media/${m.id}`);
      items = items.filter((x) => x.id !== m.id);
      render();
      toast('Image deleted.', 'success');
    } catch (err) {
      toast(err.message, 'error');
      load();
    }
  }

  unusedOnly.addEventListener('change', render);
  load();
  return {
    el: h(
      'div',
      { class: 'page' },
      h('div', { class: 'page-head' }, h('div', null, h('p', { class: 'crumb' }, 'Library'), h('h1', null, 'Media'), h('p', { class: 'lede' }, 'Images uploaded here can be added to projects or used as film thumbnails. Images still in use cannot be deleted.'))),
      h('section', { class: 'panel' }, uploader({ onUploaded: (media) => ((items = [{ ...media, uses: 0 }, ...items]), render()) })),
      h('p', null, h('label', { class: 'choice' }, unusedOnly, 'Only show unused images')),
      grid,
    ),
  };
}
