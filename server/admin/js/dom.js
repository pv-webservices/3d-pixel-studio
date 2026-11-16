// Tiny DOM helpers. All text goes through textContent, so editable content is never parsed as HTML.

/**
 * h('button', { class: 'btn', onclick }, 'Save')
 * @param {string} tag
 * @param {Record<string, any> | null} [attrs]
 * @param  {...any} children  strings, nodes, arrays, or falsy (skipped)
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  const { value, ...rest } = attrs ?? {};
  for (const [key, v] of Object.entries(rest)) {
    if (v === false || v == null) continue;
    if (key.startsWith('on') && typeof v === 'function') el.addEventListener(key.slice(2), v);
    else if (key === 'class') el.className = v;
    else if (key === 'dataset') Object.assign(el.dataset, v);
    else if (key in el && typeof v !== 'string') el[key] = v;
    else el.setAttribute(key, v === true ? '' : String(v));
  }
  append(el, children);
  // Set value last so <select> options and <textarea> content exist first.
  if (value != null) el.value = value;
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export const clear = (el) => {
  el.replaceChildren();
  return el;
};

/** Replace an element's children; accepts nested arrays and skips null/false like h(). */
export function fill(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}

export function toast(message, type = 'info', ms = 4000) {
  const box = document.getElementById('toasts');
  const el = h('div', { class: `toast toast--${type}`, role: type === 'error' ? 'alert' : 'status' }, message);
  box.append(el);
  setTimeout(() => el.remove(), type === 'error' ? ms * 2 : ms);
}

/**
 * Modal confirmation built on <dialog> (focus is trapped and restored by the browser).
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title, body, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const dialog = h(
      'dialog',
      { 'aria-labelledby': 'confirm-title' },
      h('div', { class: 'dialog__body' }, h('h2', { id: 'confirm-title' }, title), ...(Array.isArray(body) ? body : [body])),
      h(
        'div',
        { class: 'dialog__actions' },
        h('button', { class: 'btn', type: 'button', value: 'cancel', onclick: () => dialog.close('cancel') }, 'Cancel'),
        h('button', { class: `btn ${danger ? 'btn--danger-solid' : 'btn--primary'}`, type: 'button', onclick: () => dialog.close('ok') }, confirmLabel),
      ),
    );
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'ok');
      dialog.remove();
    });
    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector('.btn').focus();
  });
}

/** Generic modal returning the dialog element; caller closes it. */
export function openDialog({ title, content, wide = false, actions = [] }) {
  const dialog = h(
    'dialog',
    { class: wide ? 'dialog--wide' : '', 'aria-labelledby': 'dlg-title' },
    h('div', { class: 'dialog__body' }, h('h2', { id: 'dlg-title' }, title), content),
    h('div', { class: 'dialog__actions' }, ...actions(() => dialog.close())),
  );
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

export const statusBadge = (status) => h('span', { class: `badge badge--${status}` }, status === 'published' ? 'Published' : 'Draft');

export const CATEGORY_LABEL = { exterior: 'Exterior CGI', interior: 'Interior CGI' };

export const PROBLEM_LABEL = {
  unpublished: 'Unpublished — hidden on the homepage',
  deleted: 'Deleted',
  'no-cover': 'No cover image — hidden on the homepage',
};

/** Pick a small variant URL for previews. */
export const thumbUrl = (m, max = 640) => (m ? `${m.src}-${m.sizes.filter((w) => w <= max).at(-1) ?? m.sizes[0]}.webp` : '');

export const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export function loadingView(text = 'Loading…') {
  return h('div', { class: 'loading', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), ' ', text);
}

export function errorView(err, retry) {
  return h(
    'div',
    { class: 'notice notice--error', role: 'alert' },
    h('strong', null, 'Could not load this page. '),
    err.message,
    retry && h('div', { class: 'mt' },h('button', { class: 'btn btn--small', type: 'button', onclick: retry }, 'Try again')),
  );
}

/** Show field errors returned by the API next to their inputs. */
export function showFieldErrors(form, fields = {}) {
  form.querySelectorAll('.field.has-error').forEach((f) => f.classList.remove('has-error'));
  form.querySelectorAll('.field__error').forEach((e) => e.remove());
  let first = null;
  for (const [name, message] of Object.entries(fields)) {
    const field = form.querySelector(`[data-field="${CSS.escape(name)}"]`);
    if (!field) continue;
    field.classList.add('has-error');
    const id = `err-${name}`;
    field.append(h('p', { class: 'field__error', id }, message));
    const input = field.querySelector('input, select, textarea');
    input?.setAttribute('aria-describedby', id);
    first ??= input;
  }
  first?.focus();
}
