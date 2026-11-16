// Work → Projects: list and editor (details, ordered gallery with cover, publish state, delete).
import { ApiError, api } from '../api.js';
import { CATEGORY_LABEL, clear, confirmDialog, errorView, h, loadingView, showFieldErrors, statusBadge, thumbUrl, toast, fill } from '../dom.js';
import { enableDragSort, moveItem, removeAt } from '../components/order.js';
import { openLibraryPicker, uploader } from '../components/uploader.js';

export function projectsListView() {
  const list = h('div', null, loadingView());
  const search = h('input', { type: 'search', placeholder: 'Search projects', 'aria-label': 'Search projects' });
  const filter = h(
    'select',
    { 'aria-label': 'Filter by status or category' },
    h('option', { value: '' }, 'All projects'),
    h('option', { value: 'published' }, 'Published'),
    h('option', { value: 'draft' }, 'Drafts'),
    h('option', { value: 'exterior' }, 'Exterior CGI'),
    h('option', { value: 'interior' }, 'Interior CGI'),
  );
  let projects = [];

  const render = () => {
    const q = search.value.trim().toLowerCase();
    const f = filter.value;
    const shown = projects.filter((p) => (!q || `${p.name} ${p.location}`.toLowerCase().includes(q)) && (!f || p.status === f || p.category === f));
    clear(list);
    if (!projects.length) return list.append(h('div', { class: 'empty' }, h('p', null, 'No projects yet.'), h('a', { class: 'btn btn--primary', href: '#/projects/new' }, 'Add the first project')));
    if (!shown.length) return list.append(h('p', { class: 'empty' }, 'No projects match this search.'));
    list.append(
      h(
        'ul',
        { class: 'rows' },
        shown.map((p) =>
          h(
            'li',
            { class: 'row' },
            p.cover ? h('img', { class: 'row__thumb', src: thumbUrl(p.cover), alt: '', loading: 'lazy' }) : h('div', { class: 'row__thumb' }),
            h(
              'div',
              { class: 'row__body' },
              h('p', { class: 'row__title' }, h('a', { href: `#/projects/${p.id}` }, p.name)),
              h('p', { class: 'row__meta' }, statusBadge(p.status), p.onHomepage && h('span', { class: 'badge badge--home' }, 'On homepage'), h('span', null, CATEGORY_LABEL[p.category]), p.location && h('span', null, p.location), h('span', null, `${p.imageCount} images`)),
            ),
            h('div', { class: 'row__actions' }, h('a', { class: 'btn btn--small', href: `#/projects/${p.id}` }, 'Edit')),
          ),
        ),
      ),
    );
  };

  const load = async () => {
    fill(list, loadingView());
    try {
      projects = (await api.get('/projects')).projects;
      render();
    } catch (err) {
      fill(list, errorView(err, load));
    }
  };
  search.addEventListener('input', render);
  filter.addEventListener('change', render);
  load();

  return {
    el: h(
      'div',
      { class: 'page' },
      h(
        'div',
        { class: 'page-head' },
        h('div', null, h('p', { class: 'crumb' }, 'Work'), h('h1', null, 'Projects'), h('p', { class: 'lede' }, 'Still-render projects shown on the Work page. Floor plans are managed separately and are not listed here.')),
        h('a', { class: 'btn btn--primary', href: '#/projects/new' }, 'New project'),
      ),
      h('div', { class: 'toolbar' }, search, filter),
      list,
    ),
  };
}

const emptyProject = () => ({ name: '', location: '', category: 'exterior', description: '', scope: [], status: 'draft', coverMediaId: null, gallery: [], onHomepage: false, films: [] });

const payloadOf = (s, status = s.status) => ({
  name: s.name,
  location: s.location,
  category: s.category,
  description: s.description,
  scope: s.scope,
  status,
  coverMediaId: s.coverMediaId,
  gallery: s.gallery.map((g) => ({ mediaId: g.media.id, category: g.category, alt: g.media.alt })),
});

export function projectEditView(id) {
  const root = h('div', { class: 'page' }, loadingView());
  let state = null;
  let saved = '';
  let busy = false;
  const isDirty = () => state !== null && JSON.stringify(payloadOf(state)) !== saved;

  const load = async () => {
    try {
      state = id ? (await api.get(`/projects/${id}`)).project : emptyProject();
      saved = JSON.stringify(payloadOf(state));
      render();
    } catch (err) {
      fill(root, errorView(err, load));
    }
  };

  function field(name, label, input, hint, required = false) {
    return h('div', { class: 'field', dataset: { field: name } }, h('label', { for: `f-${name}` }, label, required && h('span', { class: 'req', 'aria-hidden': 'true' }, ' *')), input, hint && h('p', { class: 'hint' }, hint));
  }

  function render() {
    const form = h('form', { novalidate: true });
    const set = (key) => (e) => {
      state = { ...state, [key]: e.target.value };
      updateBar();
    };

    const details = h(
      'section',
      { class: 'panel' },
      h('h2', null, 'Details'),
      h(
        'div',
        { class: 'form-grid form-grid--2 mt-lg' },
        field('name', 'Project name', h('input', { id: 'f-name', type: 'text', value: state.name, maxlength: 120, required: true, oninput: set('name') }), null, true),
        field('location', 'Location', h('input', { id: 'f-location', type: 'text', value: state.location, maxlength: 120, oninput: set('location') }), 'Required to publish, e.g. "Bandra, Mumbai".'),
      ),
      h(
        'fieldset',
        { class: 'field mt-lg', dataset: { field: 'category' } },
        h('legend', null, 'Category'),
        h(
          'div',
          { class: 'choices' },
          ['exterior', 'interior'].map((c) =>
            h('label', { class: 'choice' }, h('input', { type: 'radio', name: 'category', value: c, checked: state.category === c, onchange: () => ((state = { ...state, category: c }), updateBar()) }), CATEGORY_LABEL[c]),
          ),
        ),
        h('p', { class: 'hint' }, 'Sets the main Work filter and the label on the homepage card. Individual images can be filed under the other category below.'),
      ),
      h(
        'div',
        { class: 'form-grid mt-lg' },
        field('description', 'Description', h('textarea', { id: 'f-description', maxlength: 2000, value: state.description, oninput: set('description') }), 'Shown in the project pop-up on the homepage.'),
        field(
          'scope',
          'Scope',
          h('textarea', {
            id: 'f-scope',
            rows: 4,
            value: state.scope.join('\n'),
            oninput: (e) => {
              state = { ...state, scope: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) };
              updateBar();
            },
          }),
          'One item per line, e.g. "Façade & elevations".',
        ),
      ),
    );

    const galleryList = h('ul', { class: 'gallery', 'aria-label': 'Gallery images in display order' });
    const gallery = h(
      'section',
      { class: 'panel', dataset: { field: 'gallery' } },
      h('h2', null, 'Gallery'),
      h('p', { class: 'hint' }, 'Drag images (or use the arrows) to set their order. The cover is shown on the homepage card and first in the pop-up.'),
      h('div', { class: 'mt', dataset: { field: 'coverMediaId' } }),
      uploader({
        onUploaded: (media) => {
          const first = state.gallery.length === 0;
          state = { ...state, gallery: [...state.gallery, { media, category: state.category }], coverMediaId: first ? media.id : state.coverMediaId };
          renderGallery();
        },
        onBusy: (b) => ((busy = b), updateBar()),
      }),
      h(
        'p',
        { class: 'mt' },
        h(
          'button',
          {
            class: 'btn btn--small',
            type: 'button',
            onclick: () =>
              openLibraryPicker({
                exclude: new Set(state.gallery.map((g) => g.media.id)),
                onPick: (items) => {
                  const added = items.map((media) => ({ media, category: state.category }));
                  state = { ...state, gallery: [...state.gallery, ...added], coverMediaId: state.coverMediaId ?? added[0]?.media.id ?? null };
                  renderGallery();
                },
              }),
          },
          'Add from media library',
        ),
      ),
      galleryList,
    );

    function renderGallery() {
      clear(galleryList);
      if (!state.gallery.length) galleryList.append(h('li', { class: 'empty' }, 'No images yet. Upload renders above.'));
      state.gallery.forEach((g, i) => {
        const isCover = g.media.id === state.coverMediaId;
        const update = (patch) => {
          state = { ...state, gallery: state.gallery.map((x, j) => (j === i ? { ...x, ...patch } : x)) };
          updateBar();
        };
        galleryList.append(
          h(
            'li',
            { class: `gitem${isCover ? ' is-cover' : ''}`, dataset: { index: i } },
            h('div', { class: 'gitem__img', draggable: 'true', title: 'Drag to reorder' }, h('img', { src: thumbUrl(g.media), alt: '', loading: 'lazy', draggable: 'false' }), h('span', { class: 'gitem__pos' }, i + 1), isCover && h('span', { class: 'gitem__cover' }, 'Cover')),
            h(
              'div',
              { class: 'gitem__body' },
              h('label', { class: 'sr-only', for: `alt-${i}` }, `Alt text for image ${i + 1}`),
              h('input', { id: `alt-${i}`, type: 'text', value: g.media.alt, maxlength: 300, placeholder: 'Describe the image (alt text)', oninput: (e) => update({ media: { ...g.media, alt: e.target.value } }) }),
              h('label', { class: 'sr-only', for: `cat-${i}` }, `Work filter for image ${i + 1}`),
              h('select', { id: `cat-${i}`, value: g.category, onchange: (e) => update({ category: e.target.value }) }, h('option', { value: 'exterior' }, 'Exterior CGI'), h('option', { value: 'interior' }, 'Interior CGI')),
              h(
                'div',
                { class: 'gitem__tools' },
                h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Move image ${i + 1} earlier`, disabled: i === 0, onclick: () => reorder(i, i - 1) }, '←'),
                h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Move image ${i + 1} later`, disabled: i === state.gallery.length - 1, onclick: () => reorder(i, i + 1) }, '→'),
                !isCover && h('button', { class: 'btn btn--small', type: 'button', onclick: () => ((state = { ...state, coverMediaId: g.media.id }), renderGallery()) }, 'Set as cover'),
                h('button', { class: 'btn btn--small btn--danger', type: 'button', onclick: () => removeImage(i) }, 'Remove'),
              ),
            ),
          ),
        );
      });
      updateBar();
    }

    const reorder = (from, to) => {
      state = { ...state, gallery: moveItem(state.gallery, from, to) };
      renderGallery();
      galleryList.querySelectorAll('.gitem')[to]?.querySelector(`[aria-label^="Move image ${to + 1} ${to > from ? 'later' : 'earlier'}"]`)?.focus();
    };
    const removeImage = (i) => {
      const removed = state.gallery[i];
      const gallery = removeAt(state.gallery, i);
      const coverMediaId = removed.media.id === state.coverMediaId ? (gallery[0]?.media.id ?? null) : state.coverMediaId;
      state = { ...state, gallery, coverMediaId };
      renderGallery();
      toast('Image removed from the gallery. It stays in the media library until deleted there.');
    };
    enableDragSort(galleryList, reorder);

    const stateText = h('span', { class: 'sticky-bar__state', 'aria-live': 'polite' });
    const buttons = h('div', { class: 'actions' });
    const bar = h('div', { class: 'sticky-bar' }, stateText, buttons);

    function updateBar() {
      const dirty = isDirty();
      stateText.className = `sticky-bar__state${dirty ? ' is-dirty' : ''}`;
      stateText.textContent = busy ? 'Working…' : dirty ? 'Unsaved changes' : state.status === 'published' ? 'Published · all changes saved' : id ? 'Draft · all changes saved' : 'New draft';
      fill(buttons, 
        id && h('button', { class: 'btn btn--danger', type: 'button', disabled: busy, onclick: remove }, 'Delete'),
        state.status === 'published'
          ? [h('button', { class: 'btn', type: 'button', disabled: busy, onclick: () => save('draft') }, 'Unpublish'), h('button', { class: 'btn btn--primary', type: 'button', disabled: busy || !dirty, onclick: () => save('published') }, 'Save changes')]
          : [h('button', { class: 'btn', type: 'button', disabled: busy, onclick: () => save('draft') }, 'Save draft'), h('button', { class: 'btn btn--primary', type: 'button', disabled: busy, onclick: () => save('published') }, id ? 'Save & publish' : 'Publish')],
      );
    }

    async function save(status) {
      if (status === 'draft' && state.status === 'published' && state.onHomepage) {
        const ok = await confirmDialog({
          title: 'Unpublish this project?',
          body: h('p', null, 'It will disappear from Work and from the homepage. Its Selected Work slot is kept and flagged until you publish it again or remove it.'),
          confirmLabel: 'Unpublish',
        });
        if (!ok) return;
      }
      busy = true;
      updateBar();
      try {
        const body = payloadOf(state, status);
        const { project } = id ? await api.put(`/projects/${id}`, body) : await api.post('/projects', body);
        state = project;
        saved = JSON.stringify(payloadOf(state));
        toast(status === 'published' ? 'Saved and published. The website shows it on the next page load (about a minute).' : 'Saved as draft. It is not visible on the website.', 'success');
        if (!id) {
          location.hash = `#/projects/${project.id}`;
          return;
        }
        busy = false;
        render();
      } catch (err) {
        toast(err.message, 'error');
        if (err instanceof ApiError) showFieldErrors(form, err.fields);
      } finally {
        busy = false;
        updateBar();
      }
    }

    async function remove() {
      const effects = [h('p', null, `"${state.name}" will be permanently deleted from Work. This cannot be undone.`)];
      if (state.onHomepage) effects.push(h('p', null, 'It will also be removed from homepage Selected Work.'));
      if (state.films.length) effects.push(h('p', null, `These films will stay, but will no longer be linked to it: ${state.films.map((f) => f.title).join(', ')}.`));
      effects.push(h('p', { class: 'hint' }, 'Its images stay in the media library, where unused images can be deleted.'));
      if (!(await confirmDialog({ title: 'Delete project?', body: effects, confirmLabel: 'Delete project', danger: true }))) return;
      try {
        await api.del(`/projects/${id}`);
        saved = JSON.stringify(payloadOf(state));
        toast('Project deleted.', 'success');
        location.hash = '#/projects';
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    form.append(details, gallery, bar);
    form.addEventListener('submit', (e) => e.preventDefault());
    fill(root, 
      h(
        'div',
        { class: 'page-head' },
        h('div', null, h('p', { class: 'crumb' }, h('a', { href: '#/projects' }, 'Work · Projects')), h('h1', null, id ? state.name || 'Untitled project' : 'New project'), id && h('p', { class: 'row__meta' }, statusBadge(state.status), state.onHomepage && h('span', { class: 'badge badge--home' }, 'In homepage Selected Work'))),
      ),
      state.films.length ? h('p', { class: 'notice notice--info' }, `Related film: ${state.films.map((f) => f.title).join(', ')}. The pop-up shows a "Play the film" button while the film is published.`) : null,
      form,
    );
    renderGallery();
  }

  load();
  return { el: root, isDirty };
}
