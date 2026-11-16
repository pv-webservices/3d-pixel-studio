// Homepage → Architectural Films: one featured film plus ordered smaller cards, never the same film twice.
import { api } from '../api.js';
import { PROBLEM_LABEL, clear, errorView, h, loadingView, thumbUrl, toast, ytThumb, fill } from '../dom.js';
import { enableDragSort, moveItem, removeAt } from '../components/order.js';

const thumbOf = (f) => (f.thumbnail ? thumbUrl(f.thumbnail) : ytThumb(f.youtubeId));
const toRef = (f) => ({ id: f.id, title: f.title, location: f.location, youtubeId: f.youtubeId, status: f.status, thumbnail: f.thumbnail, problem: null });

export function homeFilmsView() {
  const root = h('div', { class: 'page' }, loadingView());
  let featured = null;
  let secondary = [];
  let films = [];
  let limit = 4;
  let saved = '';
  let busy = false;
  const snapshot = () => JSON.stringify({ f: featured?.id ?? null, s: secondary.map((x) => x.id) });
  const isDirty = () => snapshot() !== saved;

  const apply = (homepage) => {
    featured = homepage.featuredFilm;
    secondary = homepage.secondaryFilms;
    limit = homepage.limits.secondaryFilms;
    saved = snapshot();
  };

  const load = async () => {
    try {
      const [home, list] = await Promise.all([api.get('/homepage'), api.get('/films')]);
      apply(home.homepage);
      films = list.films;
      render();
    } catch (err) {
      fill(root, errorView(err, load));
    }
  };

  function render() {
    const featuredBox = h('div');
    const list = h('ol', { class: 'sel-list', 'aria-label': 'Smaller film cards in order' });
    const featuredSelect = h('select', { id: 'featured-film' });
    const addSelect = h('select', { id: 'add-film' });
    const addBtn = h('button', { class: 'btn', type: 'button', onclick: add }, 'Add film card');
    const status = h('span', { class: 'sticky-bar__state', 'aria-live': 'polite' });
    const saveBtn = h('button', { class: 'btn btn--primary', type: 'button', onclick: save }, 'Save films');
    const discardBtn = h('button', { class: 'btn', type: 'button', onclick: () => load() }, 'Discard changes');
    const problems = h('div');

    const published = () => films.filter((f) => f.status === 'published');

    function renderFeatured() {
      fill(featuredBox, 
        featured
          ? h(
              'div',
              { class: `featured-card${featured.problem ? ' has-problem' : ''}` },
              h('img', { src: thumbOf(featured), alt: '' }),
              h(
                'div',
                null,
                h('strong', null, featured.title),
                h('p', { class: 'hint' }, featured.location),
                featured.problem && h('p', null, h('span', { class: 'badge badge--problem' }, PROBLEM_LABEL[featured.problem])),
                h('button', { class: 'btn btn--small btn--danger mt', type: 'button', onclick: () => ((featured = null), refresh()) }, 'Remove featured film'),
              ),
            )
          : h('p', { class: 'empty' }, 'No featured film. The smaller cards fill the section on their own.'),
      );
      const options = published().filter((f) => f.id !== featured?.id);
      fill(featuredSelect, h('option', { value: '' }, featured ? 'Replace with…' : 'Choose the featured film…'), options.map((f) => h('option', { value: f.id }, f.title)));
      featuredSelect.disabled = busy || !options.length;
    }

    function renderList() {
      clear(list);
      if (!secondary.length) list.append(h('li', { class: 'empty' }, 'No smaller film cards selected.'));
      secondary.forEach((f, i) => {
        list.append(
          h(
            'li',
            { class: `sel-item${f.problem ? ' has-problem' : ''}`, dataset: { index: i } },
            h('span', { class: 'sel-item__num', draggable: 'true', title: 'Drag to reorder' }, String(i + 1).padStart(2, '0')),
            h('img', { src: thumbOf(f), alt: '' }),
            h('div', { class: 'sel-item__text' }, h('strong', null, f.title), h('span', null, f.location), f.problem && h('span', { class: 'badge badge--problem' }, PROBLEM_LABEL[f.problem])),
            h(
              'div',
              { class: 'sel-item__tools' },
              h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Move ${f.title} up`, disabled: i === 0, onclick: () => reorder(i, i - 1) }, '↑'),
              h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Move ${f.title} down`, disabled: i === secondary.length - 1, onclick: () => reorder(i, i + 1) }, '↓'),
              h('button', { class: 'btn btn--small btn--danger', type: 'button', onclick: () => ((secondary = removeAt(secondary, i)), refresh()) }, 'Remove'),
            ),
          ),
        );
      });
      const used = new Set([featured?.id, ...secondary.map((x) => x.id)]);
      const options = published().filter((f) => !used.has(f.id));
      fill(addSelect, h('option', { value: '' }, options.length ? 'Choose a published film…' : 'No other published films'), options.map((f) => h('option', { value: f.id }, f.title)));
      addSelect.disabled = busy || !options.length || secondary.length >= limit;
      addBtn.disabled = addSelect.disabled;
    }

    function refresh() {
      renderFeatured();
      renderList();
      const dirty = isDirty();
      const blocked = [featured, ...secondary].filter((f) => f?.problem);
      fill(problems, blocked.length ? h('div', { class: 'notice notice--warn', role: 'status' }, `${blocked.length} selected film(s) are unpublished and hidden on the homepage. Remove them, or publish them in Work, before saving.`) : null);
      status.className = `sticky-bar__state${dirty ? ' is-dirty' : ''}`;
      status.textContent = busy ? 'Saving…' : dirty ? 'Unsaved changes — the homepage is unchanged until you save' : `${featured ? 1 : 0} featured · ${secondary.length} of up to ${limit} smaller cards · saved`;
      saveBtn.disabled = busy || !dirty;
      discardBtn.disabled = busy || !dirty;
    }

    function reorder(from, to) {
      secondary = moveItem(secondary, from, to);
      refresh();
      list.querySelectorAll('.sel-item')[to]?.querySelector(to > from ? '[aria-label$=" down"]' : '[aria-label$=" up"]')?.focus();
    }

    function add() {
      const f = films.find((x) => x.id === addSelect.value);
      if (!f) return;
      secondary = [...secondary, toRef(f)];
      refresh();
      addSelect.focus();
    }

    featuredSelect.addEventListener('change', () => {
      const f = films.find((x) => x.id === featuredSelect.value);
      if (!f) return;
      // A film can only appear once: promoting a smaller card removes it from the list.
      const wasSecondary = secondary.some((x) => x.id === f.id);
      secondary = secondary.filter((x) => x.id !== f.id);
      featured = toRef(f);
      if (wasSecondary) toast(`${f.title} moved from the smaller cards to the featured slot.`);
      refresh();
    });

    async function save() {
      busy = true;
      refresh();
      try {
        const { homepage } = await api.put('/homepage/films', { featuredFilmId: featured?.id ?? null, secondaryFilmIds: secondary.map((x) => x.id) });
        apply(homepage);
        toast('Homepage films saved. The homepage updates on the next page load (about a minute).', 'success');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        busy = false;
        refresh();
      }
    }

    enableDragSort(list, reorder);
    fill(root, 
      h('div', { class: 'page-head' }, h('div', null, h('p', { class: 'crumb' }, 'Homepage'), h('h1', null, 'Architectural Films'), h('p', { class: 'lede' }, 'Choose the large featured film and the smaller cards beside it. Each film can appear once. Removing a film here never deletes it from Work.'))),
      problems,
      h('section', { class: 'panel' }, h('h2', null, 'Featured film'), featuredBox, h('div', { class: 'add-row mt-lg' }, h('div', { class: 'field' }, h('label', { for: 'featured-film' }, featured ? 'Replace the featured film' : 'Set the featured film'), featuredSelect))),
      h('section', { class: 'panel' }, h('h2', null, 'Smaller film cards'), list, h('div', { class: 'add-row' }, h('div', { class: 'field' }, h('label', { for: 'add-film' }, 'Add a film card'), addSelect), addBtn)),
      h('div', { class: 'sticky-bar' }, status, h('div', { class: 'actions' }, discardBtn, saveBtn)),
    );
    refresh();
  }

  load();
  return { el: root, isDirty };
}
