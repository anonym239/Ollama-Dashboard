// Zugriff auf den lokalen Rechner über server.js (nur mit dem Token dieser Sitzung).

const token = document.querySelector('meta[name="dashboard-token"]')?.content || '';

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-dashboard-token': token },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const local = {
  status: () => call('/local/status'),
  startOllama: () => call('/local/ollama/start', { method: 'POST' }),
  stopOllama: () => call('/local/ollama/stop', { method: 'POST' }),
  exec: (command, timeout, cwd) => call('/local/exec', { method: 'POST', body: { command, timeout, cwd } }),
};

export const localFs = {
  info: () => call('/local/fs/info', { method: 'POST', body: {} }),
  stat: (path) => call('/local/fs/stat', { method: 'POST', body: { path } }),
  mkdir: (path) => call('/local/fs/mkdir', { method: 'POST', body: { path } }),
  write: (path, content) => call('/local/fs/write', { method: 'POST', body: { path, content } }),
  read: (path) => call('/local/fs/read', { method: 'POST', body: { path } }),
  list: (path) => call('/local/fs/list', { method: 'POST', body: { path } }),
  open: (path) => call('/local/fs/open', { method: 'POST', body: { path } }),
};

export const web = {
  search: (query, engine = 'google', keys = {}, pages = 3) => call('/local/web/search', { method: 'POST', body: { query, engine, keys, pages } }),
  fetch: (url) => call('/local/web/fetch', { method: 'POST', body: { url } }),
};
