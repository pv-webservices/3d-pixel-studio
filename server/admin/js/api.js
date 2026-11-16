// Same-origin JSON client for the admin API. The session lives in an HttpOnly cookie; the CSRF token
// returned at sign-in is held in memory only and sent on every state-changing request.
let csrfToken = null;
let onUnauthorized = () => {};

export class ApiError extends Error {
  constructor(status, message, body = {}) {
    super(message);
    this.status = status;
    this.fields = body.fields ?? {};
    this.body = body;
  }
}

export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);
export const setCsrfToken = (token) => (csrfToken = token);

async function request(method, url, { json, form } = {}) {
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') headers['X-CSRF-Token'] = csrfToken ?? '';
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) body = form;

  let res;
  try {
    res = await fetch(`/api/admin${url}`, { method, headers, body, credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && url !== '/login') onUnauthorized();
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status}).`, data);
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, json) => request('POST', url, { json }),
  put: (url, json) => request('PUT', url, { json }),
  patch: (url, json) => request('PATCH', url, { json }),
  del: (url) => request('DELETE', url),
  upload: (file, alt = '') => {
    const form = new FormData();
    form.append('alt', alt);
    form.append('file', file);
    return request('POST', '/media', { form });
  },
};
