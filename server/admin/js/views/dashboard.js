// Overview: content counts and any homepage references that are currently hidden.
import { api } from '../api.js';
import { PROBLEM_LABEL, clear, errorView, h, loadingView, fill } from '../dom.js';

export function dashboardView() {
  const body = h('div', null, loadingView());
  const el = h(
    'div',
    { class: 'page' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Overview'), h('p', { class: 'lede' }, 'Work records are shared. The homepage only references them, so edits in Work update every place they appear.'))),
    body,
  );

  async function load() {
    fill(body, loadingView());
    try {
      const o = await api.get('/overview');
      fill(body, 
        o.issues.length
          ? h(
              'div',
              { class: 'notice notice--warn', role: 'status' },
              h('strong', null, 'Some homepage selections are hidden from visitors:'),
              h('ul', null, o.issues.map((i) => h('li', null, `${i.section}: ${i.name} — ${PROBLEM_LABEL[i.problem]}`))),
              h('p', { class: 'mt' }, 'Publish them again, or remove them in Homepage settings.'),
            )
          : null,
        h(
          'div',
          { class: 'stats' },
          h('a', { class: 'stat', href: '#/projects' }, h('strong', null, o.projects.published), h('span', null, `published projects (${o.projects.total} total)`)),
          h('a', { class: 'stat', href: '#/films' }, h('strong', null, o.films.published), h('span', null, `published films (${o.films.total} total)`)),
          h('a', { class: 'stat', href: '#/homepage/work' }, h('strong', null, o.homepage.selectedWork.length), h('span', null, 'projects in Selected Work')),
          h('a', { class: 'stat', href: '#/homepage/films' }, h('strong', null, (o.homepage.featuredFilm ? 1 : 0) + o.homepage.secondaryFilms.length), h('span', null, 'films on the homepage')),
        ),
        h(
          'div',
          { class: 'panel' },
          h('h2', null, 'How publishing works'),
          h(
            'ul',
            null,
            h('li', null, 'Drafts are never shown on the website. Publish a project or film to add it to the Work page.'),
            h('li', null, 'Publishing does not add anything to the homepage. Choose homepage items under Homepage.'),
            h('li', null, 'The website picks up changes on the next page load, within about a minute (browser cache).'),
          ),
        ),
      );
    } catch (err) {
      fill(body, errorView(err, load));
    }
  }
  load();
  return { el };
}
