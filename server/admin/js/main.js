// Admin shell: session check, sign-in, navigation and a small hash router with an unsaved-changes guard.
import { ApiError, api, setCsrfToken, setUnauthorizedHandler } from './api.js';
import { clear, confirmDialog, h, showFieldErrors, toast, fill } from './dom.js';
import { dashboardView } from './views/dashboard.js';
import { filmEditView, filmsListView } from './views/films.js';
import { homeFilmsView } from './views/home-films.js';
import { homeWorkView } from './views/home-work.js';
import { mediaView } from './views/media.js';
import { projectEditView, projectsListView } from './views/projects.js';

const app = document.getElementById('app');
const state = { email: null, view: null, lastHash: '#/' };

const ROUTES = [
  [/^#\/$/, () => dashboardView()],
  [/^#\/projects$/, () => projectsListView()],
  [/^#\/projects\/new$/, () => projectEditView(null)],
  [/^#\/projects\/([\w-]+)$/, (m) => projectEditView(m[1])],
  [/^#\/films$/, () => filmsListView()],
  [/^#\/films\/new$/, () => filmEditView(null)],
  [/^#\/films\/([\w-]+)$/, (m) => filmEditView(m[1])],
  [/^#\/homepage\/work$/, () => homeWorkView()],
  [/^#\/homepage\/films$/, () => homeFilmsView()],
  [/^#\/media$/, () => mediaView()],
];

const NAV = [
  { href: '#/', label: 'Overview' },
  { group: 'Work' },
  { href: '#/projects', label: 'Projects' },
  { href: '#/films', label: 'Architectural Films' },
  { group: 'Homepage' },
  { href: '#/homepage/work', label: 'Selected Work' },
  { href: '#/homepage/films', label: 'Architectural Films', match: '#/homepage/films' },
  { group: 'Library' },
  { href: '#/media', label: 'Media' },
];

function renderLogin(message) {
  state.email = null;
  const form = h(
    'form',
    { novalidate: true },
    h('div', { class: 'field', dataset: { field: 'email' } }, h('label', { for: 'email' }, 'Email'), h('input', { id: 'email', name: 'email', type: 'email', autocomplete: 'username', required: true })),
    h('div', { class: 'field', dataset: { field: 'password' } }, h('label', { for: 'password' }, 'Password'), h('input', { id: 'password', name: 'password', type: 'password', autocomplete: 'current-password', required: true })),
    h('button', { class: 'btn btn--primary', type: 'submit' }, 'Sign in'),
  );
  const notice = h('div', { role: 'alert' }, message && h('p', { class: 'notice notice--info' }, message));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    clear(notice);
    try {
      const data = new FormData(form);
      const session = await api.post('/login', { email: data.get('email'), password: data.get('password') });
      setCsrfToken(session.csrfToken);
      state.email = session.email;
      renderShell();
    } catch (err) {
      notice.append(h('p', { class: 'notice notice--error' }, err.message));
      if (err instanceof ApiError) showFieldErrors(form, err.fields);
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });
  fill(app, 
    h('main', { class: 'login' }, h('div', { class: 'login__card' }, h('h1', null, '3d Pixel Studio'), h('p', { class: 'hint' }, 'Sign in to manage Work and the homepage.'), notice, form)),
  );
  form.querySelector('input').focus();
}

function renderShell() {
  const sidebar = h('aside', { class: 'sidebar' });
  const toggle = h('button', { class: 'menu-toggle', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'nav' }, 'Menu');
  toggle.addEventListener('click', () => {
    const open = sidebar.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  const nav = h(
    'nav',
    { class: 'nav', id: 'nav', 'aria-label': 'Admin' },
    NAV.map((item) => (item.group ? h('p', { class: 'nav__group' }, item.group) : h('a', { href: item.href, dataset: { nav: item.href } }, item.label))),
    h(
      'div',
      { class: 'nav__footer' },
      h('span', null, 'Signed in as ', h('strong', null, state.email)),
      h('button', { class: 'btn btn--ghost btn--small', type: 'button', onclick: logout }, 'Sign out'),
    ),
  );
  sidebar.append(h('div', { class: 'sidebar__top' }, h('a', { class: 'brand', href: '#/' }, '3d Pixel Studio ', h('span', null, 'Admin')), toggle), nav);
  const main = h('main', { class: 'main', id: 'main', tabindex: '-1' });
  fill(app, h('div', { class: 'shell' }, sidebar, main));
  route();
}

async function logout() {
  if (!(await leaveAllowed())) return;
  try {
    await api.post('/logout');
  } catch {
    /* session may already be gone */
  }
  setCsrfToken(null);
  renderLogin('You have signed out.');
}

async function leaveAllowed() {
  if (!state.view?.isDirty?.()) return true;
  return confirmDialog({ title: 'Discard unsaved changes?', body: h('p', null, 'You have changes on this page that have not been saved.'), confirmLabel: 'Discard changes', danger: true });
}

async function route() {
  const main = document.getElementById('main');
  if (!main) return;
  const hash = location.hash || '#/';
  if (state.view && hash !== state.lastHash && !(await leaveAllowed())) {
    history.replaceState(null, '', state.lastHash);
    return;
  }
  state.view?.destroy?.();
  state.lastHash = hash;
  const match = ROUTES.map(([re, make]) => [hash.match(re), make]).find(([m]) => m);
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const href = a.dataset.nav;
    const active = href === '#/' ? hash === '#/' : hash === href || hash.startsWith(`${href}/`);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.querySelector('.sidebar')?.classList.remove('is-open');
  clear(main);
  if (!match) {
    main.append(h('div', { class: 'page' }, h('h1', null, 'Page not found'), h('a', { href: '#/' }, 'Back to overview')));
    state.view = null;
    return;
  }
  const [m, make] = match;
  state.view = make(m);
  main.append(state.view.el);
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', (e) => {
  if (state.view?.isDirty?.()) e.preventDefault();
});

setUnauthorizedHandler(() => {
  if (state.email) {
    toast('Your session ended. Please sign in again.', 'error');
    renderLogin('Your session ended. Please sign in again.');
  }
});

async function boot() {
  try {
    const session = await api.get('/session');
    setCsrfToken(session.csrfToken);
    state.email = session.email;
    renderShell();
  } catch (err) {
    if (err.status === 401) renderLogin();
    else fill(app, h('div', { class: 'boot', role: 'alert' }, `The admin could not start: ${err.message}`));
  }
}

boot();
