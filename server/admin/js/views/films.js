// Work → Architectural Films: list and editor (YouTube link, thumbnail, related project, publish, delete).
import { ApiError, api } from '../api.js';
import { clear, confirmDialog, errorView, h, loadingView, showFieldErrors, statusBadge, thumbUrl, toast, ytThumb, fill } from '../dom.js';
import { openLibraryPicker, uploader } from '../components/uploader.js';

// Mirrors the server-side parser so the preview updates as the editor types; the server re-validates.
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
export function youtubeIdFrom(value) {
  const v = String(value ?? '').trim();
  if (YT_ID.test(v)) return v;
  try {
    const url = new URL(v);
    const host = url.hostname.replace(/^(www|m|music)\./, '');
    const parts = url.pathname.split('/').filter(Boolean);
    let id = null;
    if (host === 'youtu.be') id = parts[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') id = parts[0] === 'watch' ? url.searchParams.get('v') : ['embed', 'shorts', 'live', 'v'].includes(parts[0]) ? parts[1] : null;
    return id && YT_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

const SLOT_LABEL = { featured: 'Homepage featured film', secondary: 'Homepage film card' };
const filmThumb = (f) => (f.thumbnail ? thumbUrl(f.thumbnail) : ytThumb(f.youtubeId));

export function filmsListView() {
  const list = h('div', null, loadingView());
  const load = async () => {
    fill(list, loadingView());
    try {
      const { films } = await api.get('/films');
      clear(list);
      if (!films.length) return list.append(h('div', { class: 'empty' }, h('p', null, 'No films yet.'), h('a', { class: 'btn btn--primary', href: '#/films/new' }, 'Add the first film')));
      list.append(
        h(
          'ul',
          { class: 'rows' },
          films.map((f) =>
            h(
              'li',
              { class: 'row' },
              h('img', { class: 'row__thumb', src: filmThumb(f), alt: '', loading: 'lazy' }),
              h(
                'div',
                { class: 'row__body' },
                h('p', { class: 'row__title' }, h('a', { href: `#/films/${f.id}` }, f.title)),
                h('p', { class: 'row__meta' }, statusBadge(f.status), f.homepageSlot && h('span', { class: 'badge badge--home' }, SLOT_LABEL[f.homepageSlot]), f.location && h('span', null, f.location), f.project && h('span', null, `Project: ${f.project.name}`)),
              ),
              h('div', { class: 'row__actions' }, h('a', { class: 'btn btn--small', href: `#/films/${f.id}` }, 'Edit')),
            ),
          ),
        ),
      );
    } catch (err) {
      fill(list, errorView(err, load));
    }
  };
  load();
  return {
    el: h(
      'div',
      { class: 'page' },
      h(
        'div',
        { class: 'page-head' },
        h('div', null, h('p', { class: 'crumb' }, 'Work'), h('h1', null, 'Architectural Films'), h('p', { class: 'lede' }, 'Films are hosted on YouTube. Add the video link; uploads of video files are not supported.')),
        h('a', { class: 'btn btn--primary', href: '#/films/new' }, 'New film'),
      ),
      list,
    ),
  };
}

const emptyFilm = () => ({ title: '', location: '', kind: '3D Walkthrough', youtubeUrl: '', youtubeId: null, thumbnail: null, thumbnailMediaId: null, projectId: null, status: 'draft', homepageSlot: null });

const payloadOf = (s, status = s.status) => ({
  title: s.title,
  location: s.location,
  kind: s.kind,
  videoUrl: s.youtubeUrl,
  thumbnailMediaId: s.thumbnail?.id ?? null,
  projectId: s.projectId || null,
  status,
});

export function filmEditView(id) {
  const root = h('div', { class: 'page' }, loadingView());
  let state = null;
  let projects = [];
  let saved = '';
  let busy = false;
  const isDirty = () => state !== null && JSON.stringify(payloadOf(state)) !== saved;

  const load = async () => {
    try {
      const [film, list] = await Promise.all([id ? api.get(`/films/${id}`).then((r) => r.film) : emptyFilm(), api.get('/projects').then((r) => r.projects)]);
      state = film;
      projects = list;
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
    const preview = h('div', { class: 'featured-card' });
    const renderPreview = () => {
      const ytId = youtubeIdFrom(state.youtubeUrl);
      clear(preview);
      if (state.thumbnail) preview.append(h('img', { src: thumbUrl(state.thumbnail, 1280), alt: '' }));
      else if (ytId) preview.append(h('img', { src: ytThumb(ytId), alt: '' }));
      else preview.append(h('div', { class: 'empty' }, 'Paste a YouTube link to preview its thumbnail.'));
      preview.append(
        h(
          'div',
          null,
          h('p', null, state.thumbnail ? 'Using a custom thumbnail.' : 'Using the YouTube thumbnail.'),
          state.thumbnail && h('button', { class: 'btn btn--small', type: 'button', onclick: () => ((state = { ...state, thumbnail: null }), renderPreview(), updateBar()) }, 'Use YouTube thumbnail instead'),
          h('div', { class: 'mt' }, uploader({ multiple: false, label: 'Upload custom thumbnail', onUploaded: (media) => ((state = { ...state, thumbnail: media }), renderPreview(), updateBar()), onBusy: (b) => ((busy = b), updateBar()) })),
          h('p', { class: 'mt' }, h('button', { class: 'btn btn--small', type: 'button', onclick: () => openLibraryPicker({ multiple: false, onPick: ([m]) => m && ((state = { ...state, thumbnail: m }), renderPreview(), updateBar()) }) }, 'Choose from media library')),
        ),
      );
    };

    const videoInput = h('input', { id: 'f-videoUrl', type: 'url', inputmode: 'url', value: state.youtubeUrl, placeholder: 'https://www.youtube.com/watch?v=…', required: true });
    const videoHint = h('p', { class: 'hint', 'aria-live': 'polite' });
    const checkVideo = () => {
      const ok = youtubeIdFrom(videoInput.value);
      videoHint.textContent = !videoInput.value ? 'Accepted: youtube.com/watch?v=…, youtu.be/…, /shorts/…, /embed/…' : ok ? `Video ID ${ok} recognised.` : 'This is not a recognised YouTube link.';
    };
    videoInput.addEventListener('input', (e) => {
      set('youtubeUrl')(e);
      checkVideo();
      if (!state.thumbnail) renderPreview();
    });
    checkVideo();

    const projectSelect = h(
      'select',
      { id: 'f-projectId', value: state.projectId ?? '', onchange: set('projectId') },
      h('option', { value: '' }, 'No related project'),
      projects.map((p) => h('option', { value: p.id }, `${p.name}${p.status === 'draft' ? ' (draft)' : ''}`)),
    );

    form.append(
      h(
        'section',
        { class: 'panel' },
        h('h2', null, 'Details'),
        h(
          'div',
          { class: 'form-grid form-grid--2 mt-lg' },
          field('title', 'Title', h('input', { id: 'f-title', type: 'text', value: state.title, maxlength: 120, oninput: set('title') }), 'Usually the project name.', true),
          field('location', 'Location', h('input', { id: 'f-location', type: 'text', value: state.location, maxlength: 120, oninput: set('location') }), 'Required to publish.'),
          field('kind', 'Film type', h('input', { id: 'f-kind', type: 'text', value: state.kind, maxlength: 60, oninput: set('kind') }), 'Shown as the label, e.g. "3D Walkthrough".'),
          field('projectId', 'Related project', projectSelect, 'Optional. A published related project shows a "Play the film" button in its pop-up.'),
        ),
        h('div', { class: 'form-grid mt-lg' }, h('div', { class: 'field', dataset: { field: 'videoUrl' } }, h('label', { for: 'f-videoUrl' }, 'YouTube link', h('span', { class: 'req', 'aria-hidden': 'true' }, ' *')), videoInput, videoHint)),
      ),
      h('section', { class: 'panel', dataset: { field: 'thumbnailMediaId' } }, h('h2', null, 'Thumbnail'), preview),
    );
    renderPreview();

    const stateText = h('span', { class: 'sticky-bar__state', 'aria-live': 'polite' });
    const buttons = h('div', { class: 'actions' });
    form.append(h('div', { class: 'sticky-bar' }, stateText, buttons));

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
      if (status === 'draft' && state.status === 'published' && state.homepageSlot) {
        const ok = await confirmDialog({ title: 'Unpublish this film?', body: h('p', null, 'It will disappear from Work and from the homepage. Its homepage slot is kept and flagged until you publish it again or remove it.'), confirmLabel: 'Unpublish' });
        if (!ok) return;
      }
      busy = true;
      updateBar();
      try {
        const body = payloadOf(state, status);
        const { film } = id ? await api.put(`/films/${id}`, body) : await api.post('/films', body);
        state = film;
        saved = JSON.stringify(payloadOf(state));
        toast(status === 'published' ? 'Saved and published. The website shows it on the next page load (about a minute).' : 'Saved as draft. It is not visible on the website.', 'success');
        if (!id) {
          location.hash = `#/films/${film.id}`;
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
      const body = [h('p', null, `"${state.title}" will be permanently deleted from Work. This cannot be undone.`)];
      if (state.homepageSlot) body.push(h('p', null, `It will also be removed from the homepage (${SLOT_LABEL[state.homepageSlot].toLowerCase()}). No other film replaces it automatically.`));
      if (!(await confirmDialog({ title: 'Delete film?', body, confirmLabel: 'Delete film', danger: true }))) return;
      try {
        await api.del(`/films/${id}`);
        saved = JSON.stringify(payloadOf(state));
        toast('Film deleted.', 'success');
        location.hash = '#/films';
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    form.addEventListener('submit', (e) => e.preventDefault());
    fill(root, 
      h('div', { class: 'page-head' }, h('div', null, h('p', { class: 'crumb' }, h('a', { href: '#/films' }, 'Work · Architectural Films')), h('h1', null, id ? state.title || 'Untitled film' : 'New film'), id && h('p', { class: 'row__meta' }, statusBadge(state.status), state.homepageSlot && h('span', { class: 'badge badge--home' }, SLOT_LABEL[state.homepageSlot])))),
      form,
    );
    updateBar();
  }

  load();
  return { el: root, isDirty };
}
