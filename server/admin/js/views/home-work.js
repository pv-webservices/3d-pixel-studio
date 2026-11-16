// Homepage → Selected Work: choose and order published still-render projects. Saves references only.
import { api } from '../api.js';
import { CATEGORY_LABEL, PROBLEM_LABEL, clear, errorView, h, loadingView, thumbUrl, toast, fill } from '../dom.js';
import { enableDragSort, moveItem, removeAt } from '../components/order.js';

export function homeWorkView() {
  const root = h('div', { class: 'page' }, loadingView());
  let selected = [];
  let savedIds = '';
  let projects = [];
  let limit = 12;
  let busy = false;
  const ids = () => selected.map((p) => p.id);
  const isDirty = () => JSON.stringify(ids()) !== savedIds;

  const load = async () => {
    try {
      const [home, list] = await Promise.all([api.get('/homepage'), api.get('/projects')]);
      apply(home.homepage);
      projects = list.projects;
      render();
    } catch (err) {
      fill(root, errorView(err, load));
    }
  };
  const apply = (homepage) => {
    selected = homepage.selectedWork;
    limit = homepage.limits.selectedWork;
    savedIds = JSON.stringify(ids());
  };

  function render() {
    const list = h('ol', { class: 'sel-list', 'aria-label': 'Selected Work in homepage order' });
    const status = h('span', { class: 'sticky-bar__state', 'aria-live': 'polite' });
    const saveBtn = h('button', { class: 'btn btn--primary', type: 'button', onclick: save }, 'Save Selected Work');
    const discardBtn = h('button', { class: 'btn', type: 'button', onclick: () => load() }, 'Discard changes');
    const addSelect = h('select', { id: 'add-project' });
    const addBtn = h('button', { class: 'btn', type: 'button', onclick: add }, 'Add to Selected Work');
    const problems = h('div');

    function renderList() {
      clear(list);
      if (!selected.length) list.append(h('li', { class: 'empty' }, 'No projects selected. The Selected Work section will only show the "View All Projects" link.'));
      selected.forEach((p, i) => {
        list.append(
          h(
            'li',
            { class: `sel-item${p.problem ? ' has-problem' : ''}`, dataset: { index: i } },
            h('span', { class: 'sel-item__num', draggable: 'true', title: 'Drag to reorder' }, String(i + 1).padStart(2, '0')),
            p.cover ? h('img', { src: thumbUrl(p.cover), alt: '' }) : h('span'),
            h('div', { class: 'sel-item__text' }, h('strong', null, p.name), h('span', null, [CATEGORY_LABEL[p.category], p.location].filter(Boolean).join(' · ')), p.problem && h('span', { class: 'badge badge--problem' }, PROBLEM_LABEL[p.problem])),
            h(
              'div',
              { class: 'sel-item__tools' },
              h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Move ${p.name} up`, disabled: i === 0, onclick: () => reorder(i, i - 1) }, '↑'),
              h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Move ${p.name} down`, disabled: i === selected.length - 1, onclick: () => reorder(i, i + 1) }, '↓'),
              h('button', { class: 'btn btn--small btn--danger', type: 'button', onclick: () => ((selected = removeAt(selected, i)), refresh()) }, 'Remove'),
              h('a', { class: 'btn btn--small', href: `#/projects/${p.id}` }, 'Edit project'),
            ),
          ),
        );
      });
    }

    function renderAdd() {
      const chosen = new Set(ids());
      const options = projects.filter((p) => p.status === 'published' && p.cover && !chosen.has(p.id));
      fill(addSelect, h('option', { value: '' }, options.length ? 'Choose a published project…' : 'No other published projects'), options.map((p) => h('option', { value: p.id }, `${p.name} — ${CATEGORY_LABEL[p.category]}`)));
      const full = selected.length >= limit;
      addSelect.disabled = !options.length || full || busy;
      addBtn.disabled = addSelect.disabled;
    }

    function refresh() {
      renderList();
      renderAdd();
      const dirty = isDirty();
      const blocked = selected.filter((p) => p.problem);
      fill(problems, 
        blocked.length ? h('div', { class: 'notice notice--warn', role: 'status' }, `${blocked.length} selected project(s) cannot be shown and are hidden on the homepage. Remove them, or publish them in Work, before saving.`) : null,
      );
      status.className = `sticky-bar__state${dirty ? ' is-dirty' : ''}`;
      status.textContent = busy ? 'Saving…' : dirty ? 'Unsaved changes — the homepage is unchanged until you save' : `${selected.length} of up to ${limit} projects · saved`;
      saveBtn.disabled = busy || !dirty;
      discardBtn.disabled = busy || !dirty;
    }

    function reorder(from, to) {
      selected = moveItem(selected, from, to);
      refresh();
      list.querySelectorAll('.sel-item')[to]?.querySelector(to > from ? '[aria-label$=" down"]' : '[aria-label$=" up"]')?.focus();
    }

    function add() {
      const p = projects.find((x) => x.id === addSelect.value);
      if (!p) return;
      selected = [...selected, { id: p.id, name: p.name, location: p.location, category: p.category, status: p.status, cover: p.cover, problem: null }];
      refresh();
      addSelect.focus();
    }

    async function save() {
      busy = true;
      refresh();
      try {
        const { homepage } = await api.put('/homepage/selected-work', { projectIds: ids() });
        apply(homepage);
        toast('Selected Work saved. The homepage updates on the next page load (about a minute).', 'success');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        busy = false;
        refresh();
      }
    }

    enableDragSort(list, reorder);
    fill(root, 
      h(
        'div',
        { class: 'page-head' },
        h('div', null, h('p', { class: 'crumb' }, 'Homepage'), h('h1', null, 'Selected Work'), h('p', { class: 'lede' }, 'Pick published still-render projects for the homepage carousel and set their order. Cards use each project’s cover, name and location from Work. Removing a card here never deletes the project.')),
      ),
      problems,
      h('section', { class: 'panel' }, h('h2', null, 'Cards in order'), list, h('div', { class: 'add-row' }, h('div', { class: 'field' }, h('label', { for: 'add-project' }, 'Add a project'), addSelect), addBtn)),
      h('div', { class: 'sticky-bar' }, status, h('div', { class: 'actions' }, discardBtn, saveBtn)),
    );
    refresh();
  }

  load();
  return { el: root, isDirty };
}
