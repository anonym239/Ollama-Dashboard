// Ollama-API-Client (läuft über den Proxy in server.js).

let customUrl = '';
export function setOllamaUrl(url) { customUrl = (url || '').trim(); }

function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra };
  if (customUrl) h['x-ollama-url'] = customUrl;
  return h;
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(path, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j.error) msg = j.error;
    } catch { /* ignorieren */ }
    throw new Error(msg);
  }
  return res;
}

// Liest NDJSON-Streams Zeile für Zeile
async function* ndjson(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const obj = JSON.parse(line);
      if (obj.error) throw new Error(obj.error);
      yield obj;
    }
  }
  if (buf.trim()) {
    const obj = JSON.parse(buf);
    if (obj.error) throw new Error(obj.error);
    yield obj;
  }
}

export const ollama = {
  async version() {
    return (await request('/api/version')).json();
  },
  async models() {
    const j = await (await request('/api/tags')).json();
    return (j.models || []).sort((a, b) => a.name.localeCompare(b.name));
  },
  async running() {
    const j = await (await request('/api/ps')).json();
    return j.models || [];
  },
  async show(model) {
    return (await request('/api/show', { method: 'POST', body: { model } })).json();
  },
  async remove(model) {
    await request('/api/delete', { method: 'DELETE', body: { model } });
  },
  async *pull(model, signal) {
    const res = await request('/api/pull', { method: 'POST', body: { model, stream: true }, signal });
    yield* ndjson(res);
  },
  async *chat(body, signal) {
    const res = await request('/api/chat', { method: 'POST', body: { ...body, stream: true }, signal });
    yield* ndjson(res);
  },
  // Modell in den Arbeitsspeicher laden (keepAlive z. B. '30m') oder entladen (0)
  async keepAlive(model, keepAlive) {
    const res = await request('/api/generate', { method: 'POST', body: { model, keep_alive: keepAlive, stream: false } });
    return res.json();
  },
  async chatOnce(body, signal) {
    const res = await request('/api/chat', { method: 'POST', body: { ...body, stream: false }, signal });
    return res.json();
  },
};
