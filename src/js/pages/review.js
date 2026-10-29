// Project brief form: inline validation, file picker feedback, Netlify Forms submission.
const MAX_TOTAL_MB = 8;

function setError(field, message) {
  const wrap = field.closest('.field');
  if (!wrap) return;
  wrap.classList.toggle('has-error', Boolean(message));
  let el = wrap.querySelector('.field__error');
  if (!message) return el?.remove();
  if (!el) {
    el = document.createElement('span');
    el.className = 'field__error';
    wrap.appendChild(el);
  }
  el.textContent = message;
  field.setAttribute('aria-invalid', 'true');
}

function validate(form) {
  let firstInvalid = null;
  form.querySelectorAll('[required]').forEach((field) => {
    field.removeAttribute('aria-invalid');
    let message = '';
    if (field.type === 'file') {
      const total = [...field.files].reduce((sum, f) => sum + f.size, 0) / 1e6;
      if (!field.files.length) message = 'Please attach drawings or reference files.';
      else if (total > MAX_TOTAL_MB) message = `Files exceed ${MAX_TOTAL_MB} MB — please share large sets on WhatsApp or email.`;
    } else if (!field.value.trim()) {
      message = 'Required';
    } else if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value.trim())) {
      message = 'Please enter a valid email.';
    }
    setError(field, message);
    if (message && !firstInvalid) firstInvalid = field;
  });
  return firstInvalid;
}

export function init() {
  const form = document.querySelector('[data-brief-form]');
  if (!form) return;
  const status = form.querySelector('[data-form-status]');
  const dropzone = form.querySelector('[data-dropzone]');
  const fileInput = dropzone.querySelector('input[type="file"]');
  const fileList = dropzone.querySelector('[data-files]');

  fileInput.addEventListener('change', () => {
    fileList.textContent = [...fileInput.files].map((f) => f.name).join(', ');
    setError(fileInput, '');
  });
  ['dragenter', 'dragover'].forEach((t) => dropzone.addEventListener(t, () => dropzone.classList.add('is-over')));
  ['dragleave', 'drop'].forEach((t) => dropzone.addEventListener(t, () => dropzone.classList.remove('is-over')));
  form.querySelectorAll('input, select').forEach((f) => f.addEventListener('input', () => f.closest('.has-error') && setError(f, '')));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const invalid = validate(form);
    if (invalid) {
      invalid.focus();
      return;
    }
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    status.dataset.state = '';
    status.textContent = 'Sending…';
    try {
      const res = await fetch(form.getAttribute('action') || '/', { method: 'POST', body: new FormData(form) });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      form.reset();
      fileList.textContent = '';
      status.textContent = 'Thank you — fast, structured response within 12–24 hours.';
    } catch {
      status.dataset.state = 'error';
      status.innerHTML = 'Could not send right now. Please <a href="mailto:contact@3dpixelstudio.com" style="text-decoration:underline">email us</a> or <a href="https://wa.me/919769595024" target="_blank" rel="noopener" style="text-decoration:underline">Discuss On Whatsapp</a>.';
    } finally {
      button.disabled = false;
    }
  });
}
