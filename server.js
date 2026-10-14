#!/usr/bin/env node
// Ollama Dashboard – kleiner Server ohne Abhängigkeiten.
// Liefert die Oberfläche aus und leitet /api/* an Ollama weiter (kein CORS-Ärger).

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const DEFAULT_OLLAMA = normalizeUrl(process.env.OLLAMA_URL || 'http://127.0.0.1:11434');
const PUBLIC_DIR = path.join(__dirname, 'public');
// Geheimer Schlüssel pro Serverstart: nur die eigene Oberfläche darf lokale Aktionen ausführen
const TOKEN = crypto.randomBytes(24).toString('hex');
const IS_WIN = process.platform === 'win32';
let ollamaChild = null;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function normalizeUrl(u) {
  u = String(u || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
  return u.replace(/\/+$/, '');
}

function proxy(req, res) {
  // Optional: anderer Ollama-Server pro Anfrage (in den Einstellungen wählbar)
  const target = normalizeUrl(req.headers['x-ollama-url']) || DEFAULT_OLLAMA;
  let upstream;
  try {
    upstream = new URL(req.url, target + '/');
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Ungültige Ollama-URL' }));
  }
  const lib = upstream.protocol === 'https:' ? require('https') : http;
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.origin;
  delete headers.referer;
  delete headers['x-ollama-url'];

  const preq = lib.request(upstream, { method: req.method, headers }, (pres) => {
    res.writeHead(pres.statusCode || 502, {
      ...pres.headers,
      'cache-control': 'no-cache',
      'x-accel-buffering': 'no',
    });
    pres.pipe(res);
  });
  preq.on('error', (err) => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Ollama nicht erreichbar (${target}): ${err.message}` }));
  });
  // Abbruch im Browser (Stopp-Button) -> Anfrage an Ollama ebenfalls abbrechen
  res.on('close', () => { if (!res.writableEnded) preq.destroy(); });
  req.pipe(preq);
}

// ---------- Sicherheit ----------
// Schutz gegen fremde Webseiten (CSRF) und DNS-Rebinding: nur Anfragen an localhost
// und nur von der eigenen Seite werden akzeptiert.
function allowedHost(req) {
  const host = String(req.headers.host || '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  const ok = ['localhost', '127.0.0.1', '::1'];
  if (HOST !== '0.0.0.0' && HOST !== '127.0.0.1') ok.push(HOST);
  return ok.includes(host);
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // gleiche Seite (GET) oder kein Browser
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('Anfrage zu groß')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(new Error('Ungültiges JSON')); }
    });
    req.on('error', reject);
  });
}

// ---------- Lokale Steuerung (Ollama starten/stoppen, Terminal) ----------
function run(command, { timeout = 120_000, cwd } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    let out = '';
    let err = '';
    const LIMIT = 200_000;
    let child;
    try {
      child = spawn(command, { shell: true, cwd: cwd || require('os').homedir(), windowsHide: true, env: process.env });
    } catch (e) {
      return resolve({ code: -1, stdout: '', stderr: e.message, ms: 0 });
    }
    const timer = setTimeout(() => {
      err += `\n[Abgebrochen nach ${Math.round(timeout / 1000)} s]`;
      child.kill('SIGKILL');
    }, timeout);
    child.stdout.on('data', (d) => { if (out.length < LIMIT) out += d; });
    child.stderr.on('data', (d) => { if (err.length < LIMIT) err += d; });
    child.on('error', (e) => { err += e.message; });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout: out.slice(0, LIMIT), stderr: err.slice(0, LIMIT), ms: Date.now() - started });
    });
  });
}

async function ollamaVersion(url = DEFAULT_OLLAMA) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const r = await fetch(url + '/api/version', { signal: ctrl.signal });
    clearTimeout(t);
    return r.ok ? (await r.json()).version : null;
  } catch {
    return null;
  }
}

async function ollamaInstalled() {
  const r = await run('ollama --version', { timeout: 10_000 });
  if (r.code === 0) return (r.stdout + r.stderr).trim();
  // Windows: Standard-Installationsort prüfen
  if (IS_WIN && process.env.LOCALAPPDATA) {
    const exe = path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe');
    if (fs.existsSync(exe)) return 'installiert';
  }
  if (process.platform === 'darwin' && fs.existsSync('/Applications/Ollama.app')) return 'installiert';
  return null;
}

function ollamaBinary() {
  if (IS_WIN && process.env.LOCALAPPDATA) {
    const exe = path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe');
    if (fs.existsSync(exe)) return exe;
  }
  if (process.platform === 'darwin' && fs.existsSync('/Applications/Ollama.app/Contents/Resources/ollama')) {
    return '/Applications/Ollama.app/Contents/Resources/ollama';
  }
  return 'ollama';
}

async function startOllama() {
  if (await ollamaVersion()) return { ok: true, already: true };
  const env = { ...process.env };
  // OLLAMA_HOST (Bind-Adresse) aus unserer Ziel-URL ableiten
  try { env.OLLAMA_HOST = new URL(DEFAULT_OLLAMA).host; } catch { /* Standard */ }
  await new Promise((resolve, reject) => {
    const child = spawn(ollamaBinary(), ['serve'], { detached: true, stdio: 'ignore', windowsHide: true, env });
    child.once('error', reject);
    child.once('spawn', () => { ollamaChild = child; child.unref(); resolve(); });
  });
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const v = await ollamaVersion();
    if (v) return { ok: true, version: v };
  }
  return { ok: false, error: 'Ollama wurde gestartet, antwortet aber nicht.' };
}

async function stopOllama() {
  if (ollamaChild && ollamaChild.exitCode === null) {
    try { process.kill(IS_WIN ? ollamaChild.pid : -ollamaChild.pid); } catch { try { ollamaChild.kill(); } catch { /* egal */ } }
  }
  ollamaChild = null;
  await new Promise((r) => setTimeout(r, 800));
  if (await ollamaVersion()) {
    // Nicht von uns gestartet (z. B. Desktop-App/Dienst) -> per Systembefehl beenden
    if (IS_WIN) await run('taskkill /IM "ollama app.exe" /F & taskkill /IM ollama.exe /F', { timeout: 15_000 });
    else if (process.platform === 'darwin') await run('osascript -e \'quit app "Ollama"\' ; pkill -f "ollama serve"', { timeout: 15_000 });
    else await run('pkill -f "ollama serve" || systemctl stop ollama 2>/dev/null', { timeout: 15_000 });
    await new Promise((r) => setTimeout(r, 800));
  }
  return { ok: !(await ollamaVersion()) };
}

// ---------- Dateisystem ----------
let desktopCache = null;
async function desktopDir() {
  if (desktopCache) return desktopCache;
  const home = require('os').homedir();
  const candidates = [];
  if (IS_WIN && process.env.OneDrive) candidates.push(path.join(process.env.OneDrive, 'Desktop'));
  if (process.platform === 'linux') {
    const r = await run('xdg-user-dir DESKTOP', { timeout: 3000 });
    if (r.code === 0 && r.stdout.trim()) candidates.push(r.stdout.trim());
  }
  candidates.push(path.join(home, 'Desktop'), path.join(home, 'Schreibtisch'));
  desktopCache = candidates.find((d) => fs.existsSync(d)) || path.join(home, 'Desktop');
  return desktopCache;
}

// "~/x", "Desktop/x", "C:\\x" oder relativ (=> relativ zum Desktop)
async function resolvePath(p) {
  p = String(p || '').trim().replace(/^["']|["']$/g, '');
  if (!p) throw new Error('Kein Pfad angegeben');
  const home = require('os').homedir();
  const desk = await desktopDir();
  if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) return path.resolve(home, p.slice(2));
  const m = p.match(/^(desktop|schreibtisch)([\\/]|$)/i);
  if (m) return path.resolve(desk, p.slice(m[0].length));
  if (path.isAbsolute(p)) return path.resolve(p);
  return path.resolve(desk, p);
}

async function fsAction(action, body) {
  const fsp = fs.promises;
  if (action === 'info') {
    return { desktop: await desktopDir(), home: require('os').homedir(), platform: process.platform };
  }
  const target = await resolvePath(body.path);
  if (action === 'stat') {
    try {
      const st = await fsp.stat(target);
      return { path: target, exists: true, isDir: st.isDirectory(), size: st.size };
    } catch {
      return { path: target, exists: false };
    }
  }
  if (action === 'mkdir') {
    await fsp.mkdir(target, { recursive: true });
    return { path: target };
  }
  if (action === 'write') {
    await fsp.mkdir(path.dirname(target), { recursive: true });
    const existed = fs.existsSync(target);
    await fsp.writeFile(target, String(body.content ?? ''), 'utf8');
    return { path: target, bytes: Buffer.byteLength(String(body.content ?? '')), overwritten: existed };
  }
  if (action === 'read') {
    const st = await fsp.stat(target);
    if (st.isDirectory()) throw new Error('Das ist ein Ordner, keine Datei');
    const max = 200_000;
    const fh = await fsp.open(target, 'r');
    const buf = Buffer.alloc(Math.min(st.size, max));
    await fh.read(buf, 0, buf.length, 0);
    await fh.close();
    return { path: target, size: st.size, truncated: st.size > max, content: buf.toString('utf8') };
  }
  if (action === 'list') {
    const entries = await fsp.readdir(target, { withFileTypes: true });
    return {
      path: target,
      entries: entries.slice(0, 500).map((e) => ({ name: e.name, dir: e.isDirectory() }))
        .sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name)),
      more: entries.length > 500,
    };
  }
  if (action === 'open') {
    if (!fs.existsSync(target)) throw new Error('Pfad existiert nicht: ' + target);
    const q = JSON.stringify(target);
    const cmd = IS_WIN ? `start "" ${q}` : process.platform === 'darwin' ? `open ${q}` : `xdg-open ${q}`;
    spawn(cmd, { shell: true, stdio: 'ignore', detached: true }).on('error', () => {}).unref();
    return { path: target };
  }
  throw new Error('Unbekannte Dateiaktion');
}

// ---------- Websuche ohne API-Key ----------
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
const stripTags = (s) => decodeEntities(String(s).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

async function fetchText(url, { timeout = 10_000, method = 'GET', body, headers = {} } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, {
      method, body, signal: ctrl.signal, redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8', Accept: 'text/html,*/*', ...headers },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const type = r.headers.get('content-type') || '';
    if (!/text|html|json|xml/.test(type)) throw new Error('Kein Textinhalt (' + type + ')');
    const buf = Buffer.from(await r.arrayBuffer());
    return { text: buf.subarray(0, 3_000_000).toString('utf8'), url: r.url };
  } finally {
    clearTimeout(t);
  }
}

async function searchDuckDuckGo(query) {
  const { text } = await fetchText('https://html.duckduckgo.com/html/', {
    method: 'POST',
    body: new URLSearchParams({ q: query, kl: 'de-de' }).toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (/anomaly|captcha/i.test(text) && !/result__a/.test(text)) throw new Error('DuckDuckGo verlangt eine Bestätigung');
  const results = [];
  for (const chunk of text.split(/class="result__a"/).slice(1)) {
    const href = chunk.match(/href="([^"]+)"/);
    const title = chunk.match(/>([\s\S]*?)<\/a>/);
    const snip = chunk.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div|td)>/);
    if (!href || !title) continue;
    let url = decodeEntities(href[1]);
    const u = url.match(/[?&]uddg=([^&]+)/);
    if (u) url = decodeURIComponent(u[1]);
    if (url.startsWith('//')) url = 'https:' + url;
    if (!/^https?:/.test(url) || /duckduckgo\.com\/y\.js/.test(url)) continue; // Werbung
    results.push({ title: stripTags(title[1]), url, snippet: stripTags(snip ? snip[1] : '') });
    if (results.length >= 8) break;
  }
  return results;
}

async function searchBing(query) {
  const { text } = await fetchText('https://www.bing.com/search?setlang=de&cc=DE&q=' + encodeURIComponent(query));
  const results = [];
  for (const chunk of text.split(/<li class="b_algo/).slice(1)) {
    const a = chunk.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    const p = chunk.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    if (!a) continue;
    let url = decodeEntities(a[1]);
    // Bing-Weiterleitungen (bing.com/ck/a?...&u=a1BASE64) auflösen
    const enc = url.match(/[?&]u=a1([^&]+)/);
    if (/bing\.com\/ck\//.test(url) && enc) {
      try { url = Buffer.from(enc[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); } catch { /* lassen */ }
    }
    if (!/^https?:/.test(url)) continue;
    results.push({ title: stripTags(a[2]), url, snippet: stripTags(p ? p[1] : '') });
    if (results.length >= 8) break;
  }
  return results;
}

async function searchGoogle(query) {
  // Einfache HTML-Variante ohne JavaScript (Text-Browser-Kennung) + Consent-Cookie für die EU
  const { text } = await fetchText(`https://www.google.com/search?hl=de&gl=de&num=10&q=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': 'Lynx/2.9.0dev.12 libwww-FM/2.14 SSL-MM/1.4.1 GNUTLS/3.7.8', Cookie: 'CONSENT=YES+cb; SOCS=CAI' },
  });
  if (/enablejs|consent\.google|\/sorry\//.test(text) && !/\/url\?q=/.test(text)) throw new Error('Google verlangt JavaScript/Bestätigung');
  const results = [];
  const seen = new Set();
  const re = /<a[^>]+href="\/url\?q=([^&"]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(text)) && results.length < 8) {
    const url = decodeURIComponent(decodeEntities(m[1]));
    if (!/^https?:/.test(url) || /google\.[a-z.]+\//.test(url) || seen.has(url)) continue;
    const h = m[2].match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || m[2].match(/<span[^>]*>([\s\S]*?)<\/span>/);
    const title = stripTags(h ? h[1] : m[2]);
    if (!title) continue;
    // Snippet: Text nach dem Link bis zum nächsten Treffer
    const rest = text.slice(re.lastIndex, re.lastIndex + 3000);
    const next = rest.search(/<a[^>]+href="\/url\?q=/);
    const snippet = stripTags(next > 0 ? rest.slice(0, next) : rest).slice(0, 350);
    seen.add(url);
    results.push({ title, url, snippet });
  }
  return results;
}

async function searchBrave(query) {
  const { text } = await fetchText(`https://search.brave.com/search?source=web&q=${encodeURIComponent(query)}`);
  const results = [];
  const chunks = text.split(/<div[^>]+class="[^"]*\bsnippet\b[^"]*"[^>]*data-type="web"/).slice(1);
  for (const c of chunks) {
    const a = c.match(/<a[^>]+href="(https?:\/\/[^"]+)"/);
    const t = c.match(/class="[^"]*\btitle\b[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const d = c.match(/class="[^"]*(?:snippet-description|description|content)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|p)>/);
    if (a && t) results.push({ title: stripTags(t[1]), url: decodeEntities(a[1]), snippet: stripTags(d ? d[1] : '') });
    if (results.length >= 8) break;
  }
  return results;
}

// ---- Optionale Anbieter mit (kostenlosem) API-Key / eigener Instanz ----
async function fetchJson(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error?.message || data.detail || data.error || `HTTP ${r.status}`);
    return data;
  } finally {
    clearTimeout(t);
  }
}

async function searchGoogleApi(query, keys) {
  if (!keys.googleKey || !keys.googleCx) throw new Error('Google-API-Key oder Suchmaschinen-ID fehlt');
  const j = await fetchJson(`https://www.googleapis.com/customsearch/v1?hl=de&num=8&key=${encodeURIComponent(keys.googleKey)}&cx=${encodeURIComponent(keys.googleCx)}&q=${encodeURIComponent(query)}`);
  return (j.items || []).map((i) => ({ title: i.title, url: i.link, snippet: i.snippet || '' }));
}

async function searchTavily(query, keys) {
  if (!keys.tavilyKey) throw new Error('Tavily-API-Key fehlt');
  const j = await fetchJson('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keys.tavilyKey}` },
    body: JSON.stringify({ query, max_results: 8, search_depth: 'basic' }),
  });
  return (j.results || []).map((r) => ({ title: r.title, url: r.url, snippet: r.content || '', content: r.content }));
}

async function searchSearxng(query, keys) {
  const base = String(keys.searxngUrl || 'http://127.0.0.1:8080').replace(/\/+$/, '');
  const j = await fetchJson(`${base}/search?format=json&language=de&q=${encodeURIComponent(query)}`);
  return (j.results || []).slice(0, 8).map((r) => ({ title: r.title, url: r.url, snippet: r.content || '' }));
}

const ENGINES = {
  google_api: ['Google API', searchGoogleApi],
  tavily: ['Tavily', searchTavily],
  searxng: ['SearXNG', searchSearxng], google: ['Google', searchGoogle], duckduckgo: ['DuckDuckGo', searchDuckDuckGo], bing: ['Bing', searchBing], brave: ['Brave', searchBrave] };

function isPrivateHost(hostname) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return h === 'localhost' || h.endsWith('.local') || h.endsWith('.localhost') || h === '::1' || h === '0.0.0.0' ||
    /^(127|10)\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /^f[cd][0-9a-f]{2}:/.test(h) || /^fe80:/.test(h);
}

function htmlToText(html) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
  let body = html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe|aside)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const main = body.match(/<(main|article)[\s\S]*?<\/\1>/i);
  if (main && main[0].length > 1500) body = main[0];
  body = body
    .replace(/<(br|\/p|\/div|\/h\d|\/li|\/tr|\/section)[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<[^>]+>/g, ' ');
  body = decodeEntities(body).replace(/[ \t\u00a0]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  return { title: stripTags(title), text: body };
}

async function fetchPage(url, maxChars = 8000) {
  let u;
  try { u = new URL(url); } catch { throw new Error('Ungültige URL'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Nur http/https erlaubt');
  if (isPrivateHost(u.hostname)) throw new Error('Lokale Adressen sind gesperrt');
  const { text, url: finalUrl } = await fetchText(u.href, { timeout: 12_000 });
  const page = htmlToText(text);
  return { url: finalUrl, title: page.title, text: page.text.slice(0, maxChars), truncated: page.text.length > maxChars };
}

async function webSearch(query, { pages = 3, engine: preferred = 'google', keys = {} } = {}) {
  // Gewählter Anbieter zuerst, bei Problemen automatisch die kostenlosen ohne Key
  const order = [preferred, 'google', 'duckduckgo', 'bing', 'brave'].filter((e, i, a) => ENGINES[e] && a.indexOf(e) === i);
  let results = [];
  let engine = '';
  const errors = [];
  for (const key of order) {
    const [label, search] = ENGINES[key];
    try {
      results = await search(query, keys);
      if (results.length) { engine = label; break; }
      errors.push(`${label}: keine Treffer`);
    } catch (e) {
      errors.push(`${label}: ${e.message}`);
    }
  }
  if (!results.length) throw new Error('Websuche fehlgeschlagen – besteht eine Internetverbindung? (' + errors.join('; ') + ')');
  // Die besten Treffer direkt lesen, damit die KI echte Inhalte bekommt
  const top = results.slice(0, pages);
  await Promise.all(top.map(async (r) => {
    if (r.content && r.content.length > 800) return;
    try { r.content = (await fetchPage(r.url, 3000)).text; } catch { /* nur Snippet */ }
  }));
  return { query, engine, results };
}

// ---------- Befehle für Windows reparieren ----------
// Kleine Modelle schreiben oft "mkdir Desktop/ordner" – unter cmd ein Syntaxfehler und
// bei OneDrive-Desktops der falsche Ort. Hier werden solche Pfade korrigiert.
function fixWindowsCommand(cmd, desk, home) {
  const q = (p) => (/\s/.test(p) ? `"${p}"` : p);
  let s = String(cmd);
  // Linux-Befehle, die kleine Modelle gern schreiben, in cmd-Befehle übersetzen
  const seg = '(^|&&|\\|\\||&|\\|)(\\s*)';
  const tr = (re, fn) => { s = s.replace(new RegExp(seg + re, 'gi'), (m, a, b, ...rest) => a + b + fn(...rest)); };
  tr('(mkdir|md)\\s+-p\\s+', (c) => `${c} `);
  tr('rm\\s+-(?:rf|fr|r)\\s+', () => 'rmdir /s /q ');
  tr('rm\\s+(?:-f\\s+)?', () => 'del /q ');
  tr('ls(?:\\s+-[a-z]+)*(?=\\s|$)', () => 'dir');
  tr('cat\\s+', () => 'type ');
  tr('cp\\s+(?:-r\\s+)?', () => 'copy ');
  tr('mv\\s+', () => 'move ');
  tr('pwd(?=\\s*($|&|\\|))', () => 'cd');
  tr('clear(?=\\s*($|&|\\|))', () => 'cls');
  tr('touch\\s+("[^"]+"|\\S+)', (f) => `type nul >> ${f}`);
  // Desktop/... und ~/... in echte Pfade umwandeln
  const bs = (rest) => rest.replace(/\//g, '\\');
  s = s.replace(/(^|[\s"'(=>])(?:Desktop|Schreibtisch)([\\/][^\s"'&|<>]*)/gi, (_, pre, rest) => pre + desk + bs(rest));
  s = s.replace(/(^|[\s"'(=>])~([\\/][^\s"'&|<>]*)/g, (_, pre, rest) => pre + home + bs(rest));
  s = s.replace(/\b(cd|chdir|pushd|mkdir|md|explorer|dir|start)(\s+(?:\/d\s+)?)(?:Desktop|Schreibtisch|~)(?=\s|$|&|\|)/gi,
    (_, c, sp) => `${c}${sp}${q(c.toLowerCase() === 'start' ? `"" ${desk}` : desk)}`.replace(/""\s"/, '"" "'));
  // Schrägstriche in Pfaden (nicht Schalter wie /d) -> Backslashes
  s = s.replace(/((?<![\w:\/])[A-Za-z]:[\\/][^\s"'&|<>]*|(?<=\b(?:mkdir|md|cd|chdir|rd|rmdir|type|del|explorer|pushd)\s+(?:\/[a-z]\s+)?"?)[^\s"'&|<>\/][^\s"'&|<>]*\/[^\s"'&|<>]*)/gi,
    (m) => (/^https?:/i.test(m) ? m : m.replace(/\//g, '\\')));
  // Pfade mit Leerzeichen (z. B. OneDrive) in Anführungszeichen setzen
  if (/\s/.test(desk)) {
    const esc = desk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp(`(^|[^"\\\\])(${esc}[^\\s"&|<>]*)`, 'g'), (_, pre, p) => `${pre}"${p}"`);
  }
  // Laufwerkswechsel braucht cd /d
  s = s.replace(/\b(cd|chdir)\s+(?!\/d)(?=["']?[A-Za-z]:)/gi, 'cd /d ');
  // mkdir soll bei vorhandenem Ordner nicht scheitern
  s = s.replace(/\b(mkdir|md)\s+("[^"]+"|[^\s&|]+)(?=\s*($|&|\|))/gi, (m, c, p) => `if not exist ${p} ${c} ${p}`);
  return s;
}

async function prepareCommand(command) {
  if (!IS_WIN) return command;
  return fixWindowsCommand(command, await desktopDir(), require('os').homedir());
}

// Manche Programme melden Erfolg mit Exit-Code 1 (z. B. explorer)
const normalizeCode = (command, code) => (/^\s*(explorer|start)\b/i.test(command) ? 0 : code);

// ---------- Sichtbares KI-Terminal ----------
// Die KI öffnet ein echtes Terminal-Fenster, tippt Befehle sichtbar ein und
// bekommt die echte Ausgabe zurück. Kommunikation über eine Warteschlange im Temp-Ordner.
const TERM_DIR = path.join(require('os').tmpdir(), 'ollama-dashboard-terminal');
let termCwd = null;
let termSeq = 0;

const PS_TERMINAL = String.raw`param([string]$QueueDir, [string]$StartDir)
$ErrorActionPreference = 'Continue'
try { chcp 65001 > $null } catch {}
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$Host.UI.RawUI.WindowTitle = 'KI-Terminal - Ollama Dashboard'
try {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public static class KiWin {
  [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int hh, bool r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
}
"@
  $wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
  $w = [int]($wa.Width * 0.46); $h = [int]($wa.Height * 0.62)
  $hwnd = [KiWin]::GetConsoleWindow()
  if ($hwnd -ne [IntPtr]::Zero) { [void][KiWin]::MoveWindow($hwnd, $wa.Right - $w - 12, $wa.Bottom - $h - 12, $w, $h, $true) }
} catch {}
function Show-Front { try { $h = [KiWin]::GetConsoleWindow(); [void][KiWin]::ShowWindow($h, 9); [void][KiWin]::SetForegroundWindow($h) } catch {} }
$cwd = $StartDir
Write-Host ''
Write-Host '  KI-Terminal' -ForegroundColor Magenta
Write-Host '  Hier tippt und startet deine KI Befehle - sichtbar fuer dich.' -ForegroundColor DarkGray
Write-Host '  Fenster schliessen ist ok, es wird bei Bedarf neu geoeffnet.' -ForegroundColor DarkGray
Write-Host ''
Set-Content -Path (Join-Path $QueueDir 'session.pid') -Value $PID
while ($true) {
  $jobs = @(Get-ChildItem -Path $QueueDir -Filter 'job-*.cmd' -ErrorAction SilentlyContinue | Sort-Object Name)
  foreach ($job in $jobs) {
    $id = $job.BaseName
    $text = ''
    try { $text = [System.IO.File]::ReadAllText((Join-Path $QueueDir "$id.txt"), [System.Text.Encoding]::UTF8) } catch {}
    $out = Join-Path $QueueDir "$id.out"
    Show-Front
    Write-Host "$cwd>" -NoNewline -ForegroundColor Green
    $delay = [Math]::Max(4, [Math]::Min(35, [int](1600 / [Math]::Max(1, $text.Length))))
    foreach ($ch in $text.ToCharArray()) { Write-Host $ch -NoNewline; Start-Sleep -Milliseconds $delay }
    Write-Host ''
    [System.IO.File]::WriteAllText($out, '')
    & cmd.exe /d /c "$($job.FullName)" 2>&1 | ForEach-Object {
      $line = "$_"
      Write-Host $line
      [System.IO.File]::AppendAllText($out, $line + [Environment]::NewLine, [System.Text.Encoding]::UTF8)
    }
    $code = $LASTEXITCODE
    $cwdFile = Join-Path $QueueDir "$id.cwd"
    if (Test-Path $cwdFile) { $c = ([System.IO.File]::ReadAllText($cwdFile)).Trim(); if ($c) { $cwd = $c } }
    Write-Host ''
    Remove-Item $job.FullName -ErrorAction SilentlyContinue
    [System.IO.File]::WriteAllText((Join-Path $QueueDir "$id.done"), "$code")
  }
  Start-Sleep -Milliseconds 200
}
`;

const SH_TERMINAL = String.raw`#!/usr/bin/env bash
Q="$1"; CWD="$2"
printf '\033]0;KI-Terminal - Ollama Dashboard\007'
printf '\n  \033[35mKI-Terminal\033[0m\n  \033[90mHier tippt und startet deine KI Befehle - sichtbar fuer dich.\033[0m\n\n'
echo $$ > "$Q/session.pid"
while true; do
  for job in $(ls "$Q"/job-*.sh 2>/dev/null | sort); do
    id=$(basename "$job" .sh)
    cmd=$(cat "$Q/$id.txt" 2>/dev/null)
    printf '\033[32m%s $\033[0m ' "$CWD"
    for ((i=0; i<${"$"}{#cmd}; i++)); do printf '%s' "${"$"}{cmd:$i:1}"; sleep 0.012; done; echo
    bash "$job" 2>&1 | tee "$Q/$id.out"
    code=${"$"}{PIPESTATUS[0]}
    [ -f "$Q/$id.cwd" ] && CWD=$(cat "$Q/$id.cwd")
    rm -f "$job"; echo
    echo "$code" > "$Q/$id.done"
  done
  sleep 0.2
done
`.replace(/\$\{"\$"\}/g, '$');

function termAlive() {
  try {
    const pid = Number(fs.readFileSync(path.join(TERM_DIR, 'session.pid'), 'utf8').trim());
    if (!pid) return false;
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function findTerminalEmulator() {
  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return null;
  for (const [bin, flag] of [['x-terminal-emulator', '-e'], ['gnome-terminal', '--'], ['konsole', '-e'], ['xfce4-terminal', '-x'], ['kitty', ''], ['alacritty', '-e'], ['xterm', '-e']]) {
    const r = await run(`command -v ${bin}`, { timeout: 3000 });
    if (r.code === 0 && r.stdout.trim()) return [bin, flag];
  }
  return null;
}

async function openTerminal() {
  if (termAlive()) return true;
  if (!termCwd) termCwd = await desktopDir();
  fs.mkdirSync(TERM_DIR, { recursive: true });
  for (const f of fs.readdirSync(TERM_DIR)) { try { fs.rmSync(path.join(TERM_DIR, f), { force: true }); } catch { /* egal */ } }
  const q = (p) => `"${p}"`;
  if (IS_WIN) {
    const script = path.join(TERM_DIR, 'ki-terminal.ps1');
    // BOM, damit Windows PowerShell 5 das Skript als UTF-8 liest
    fs.writeFileSync(script, '﻿' + PS_TERMINAL.replace(/\r?\n/g, '\r\n'), 'utf8');
    spawn(`start "KI-Terminal" powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File ${q(script)} -QueueDir ${q(TERM_DIR)} -StartDir ${q(termCwd)}`,
      { shell: true, detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  } else {
    const script = path.join(TERM_DIR, 'ki-terminal.sh');
    fs.writeFileSync(script, SH_TERMINAL, { mode: 0o755 });
    const args = `bash ${q(script)} ${q(TERM_DIR)} ${q(termCwd)}`;
    if (process.platform === 'darwin') {
      const inner = args.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      spawn('osascript', ['-e', `tell application "Terminal" to do script "${inner}"`, '-e', 'tell application "Terminal" to activate'],
        { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
    } else {
      const emu = await findTerminalEmulator();
      if (!emu) return false;
      spawn(`${emu[0]} ${emu[1]} ${args}`, { shell: true, detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
    }
  }
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (termAlive()) return true;
  }
  return false;
}

const readText = (f) => { try { return fs.readFileSync(f, 'utf8').replace(/^﻿/, ''); } catch { return ''; } };

async function terminalRun(original, { timeout = 300_000 } = {}) {
  if (!(await openTerminal())) return null;
  if (!termCwd) termCwd = await desktopDir(); // Fenster lief schon vor dem App-Start
  const command = await prepareCommand(original);
  const id = `job-${Date.now()}-${String(++termSeq).padStart(4, '0')}`;
  const base = path.join(TERM_DIR, id);
  const cwdFile = `${base}.cwd`;
  fs.writeFileSync(`${base}.txt`, command, 'utf8');
  let script;
  if (IS_WIN) {
    script = ['@echo off', 'chcp 65001 >nul', `cd /d "${termCwd}"`, ...command.split(/\r?\n/), 'set "__EC=%ERRORLEVEL%"', `cd > "${cwdFile}"`, 'exit /b %__EC%'].join('\r\n') + '\r\n';
  } else {
    script = [`cd "${termCwd}" || exit 1`, command, '__ec=$?', `pwd > "${cwdFile}"`, 'exit $__ec'].join('\n') + '\n';
  }
  const ext = IS_WIN ? '.cmd' : '.sh';
  // Erst unter anderem Namen schreiben, dann umbenennen – das Terminal liest nie halbe Dateien
  fs.writeFileSync(`${base}.tmp`, script, 'utf8');
  fs.renameSync(`${base}.tmp`, base + ext);

  const started = Date.now();
  while (Date.now() - started < timeout) {
    await new Promise((r) => setTimeout(r, 250));
    if (fs.existsSync(`${base}.done`)) {
      const code = parseInt(readText(`${base}.done`).trim(), 10);
      const out = readText(`${base}.out`);
      const cwd = readText(cwdFile).trim();
      if (cwd) termCwd = cwd;
      for (const e of ['.txt', '.out', '.cwd', '.done']) { try { fs.rmSync(base + e, { force: true }); } catch { /* egal */ } }
      return { code: normalizeCode(command, Number.isNaN(code) ? 0 : code), stdout: out.slice(0, 200_000), stderr: '', visible: true, command, cwd: termCwd, ms: Date.now() - started };
    }
    if (!termAlive()) return { code: -1, stdout: readText(`${base}.out`), stderr: 'Das Terminal-Fenster wurde geschlossen.', visible: true, command };
  }
  return { code: 0, stdout: readText(`${base}.out`) + '\n[Läuft im Terminal-Fenster weiter …]', stderr: '', visible: true, command, running: true };
}

async function handleLocal(req, res) {
  if (req.headers['x-dashboard-token'] !== TOKEN) return json(res, 403, { error: 'Nicht erlaubt' });
  const route = new URL(req.url, 'http://x').pathname;
  try {
    if (route === '/local/status' && req.method === 'GET') {
      const [version, installed] = await Promise.all([ollamaVersion(), ollamaInstalled()]);
      return json(res, 200, {
        desktop: await desktopDir(),
        running: !!version,
        version,
        installed: !!installed || !!version,
        platform: process.platform,
        ollamaUrl: DEFAULT_OLLAMA,
        home: require('os').homedir(),
        shell: IS_WIN ? 'cmd.exe' : (process.env.SHELL || '/bin/sh'),
      });
    }
    if (route === '/local/ollama/start' && req.method === 'POST') {
      try {
        return json(res, 200, await startOllama());
      } catch (e) {
        const missing = e.code === 'ENOENT';
        return json(res, 200, { ok: false, missing, error: missing ? 'Ollama ist nicht installiert.' : e.message });
      }
    }
    if (route === '/local/ollama/stop' && req.method === 'POST') {
      return json(res, 200, await stopOllama());
    }
    if (route === '/local/exec' && req.method === 'POST') {
      const body = await readBody(req);
      if (body.cwd) body.cwd = await resolvePath(body.cwd);
      const command = String(body.command || '').trim();
      if (!command) return json(res, 400, { error: 'Kein Befehl angegeben' });
      const timeout = Math.min(Math.max(Number(body.timeout) || 120, 1), 1800) * 1000;
      const fixed = await prepareCommand(command);
      const r = await run(fixed, { timeout, cwd: body.cwd || await desktopDir() });
      return json(res, 200, { ...r, code: normalizeCode(fixed, r.code), command: fixed });
    }
    if (route === '/local/terminal/run' && req.method === 'POST') {
      const body = await readBody(req);
      const command = String(body.command || '').trim();
      if (!command) return json(res, 400, { error: 'Kein Befehl angegeben' });
      const timeout = Math.min(Math.max(Number(body.timeout) || 300, 1), 3600) * 1000;
      const r = await terminalRun(command, { timeout });
      if (r) return json(res, 200, r);
      // Kein sichtbares Terminal möglich (z. B. ohne Bildschirm) -> unsichtbar ausführen
      const fixed = await prepareCommand(command);
      const h = await run(fixed, { timeout, cwd: termCwd || await desktopDir() });
      return json(res, 200, { ...h, code: normalizeCode(fixed, h.code), visible: false, command: fixed });
    }
    if (route === '/local/terminal/open' && req.method === 'POST') {
      return json(res, 200, { ok: await openTerminal() });
    }
    if (route === '/local/web/search' && req.method === 'POST') {
      const body = await readBody(req);
      if (!String(body.query || '').trim()) return json(res, 400, { error: 'Keine Suchanfrage' });
      return json(res, 200, await webSearch(String(body.query).trim(), { pages: body.pages ?? 3, engine: body.engine, keys: body.keys || {} }));
    }
    if (route === '/local/web/fetch' && req.method === 'POST') {
      const body = await readBody(req);
      return json(res, 200, await fetchPage(String(body.url || ''), 12_000));
    }
    const fsRoute = route.match(/^\/local\/fs\/(\w+)$/);
    if (fsRoute && req.method === 'POST') {
      const body = await readBody(req, 20_000_000);
      return json(res, 200, await fsAction(fsRoute[1], body));
    }
    return json(res, 404, { error: 'Unbekannte Aktion' });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
}

function serveStatic(req, res) {
  let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (pathname === '/') pathname = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(file, (err, data) => {
    if (!err && file.endsWith('index.html')) data = Buffer.from(String(data).replace('{{TOKEN}}', TOKEN));
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Nicht gefunden');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (!allowedHost(req) || !sameOrigin(req)) return json(res, 403, { error: 'Zugriff verweigert' });
  if (req.url.startsWith('/local/')) return handleLocal(req, res);
  if (req.url.startsWith('/api/')) return proxy(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    return res.end();
  }
  serveStatic(req, res);
});

// Für Tests: Funktionen ohne laufenden Server nutzbar machen
module.exports = { fixWindowsCommand, prepareCommand, terminalRun, termAlive, desktopDir, resolvePath, fsAction, TERM_DIR, PS_TERMINAL, SH_TERMINAL, webSearch };

if (!process.env.OD_NO_LISTEN) {
process.title = 'Ollama Dashboard';
server.listen(PORT, HOST, () => {
  const shown = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log('\n  Ollama Dashboard läuft');
  console.log(`  ➜  Öffne:   http://${shown}:${PORT}`);
  console.log(`  ➜  Ollama:  ${DEFAULT_OLLAMA}`);
  console.log('\n  Dieses Fenster offen lassen, solange du das Dashboard nutzt.');
  console.log('  Schließen = Dashboard beenden.\n');
  if (!process.env.NO_OPEN) openBrowser(`http://${shown}:${PORT}`);
});

server.on('error', async (e) => {
  if (e.code === 'EADDRINUSE') {
    // Läuft das Dashboard schon? Dann einfach den Browser öffnen.
    const url = `http://localhost:${PORT}`;
    try {
      const r = await fetch(url + '/favicon.svg');
      if (r.ok) {
        console.log('\n  Das Dashboard läuft bereits – öffne den Browser …\n');
        if (!process.env.NO_OPEN) openBrowser(url);
        setTimeout(() => process.exit(0), 1500);
        return;
      }
    } catch { /* belegt durch etwas anderes */ }
    console.error(`\n  Port ${PORT} ist schon belegt. Starte mit einem anderen Port, z. B.: PORT=3001\n`);
    setTimeout(() => process.exit(1), 8000);
    return;
  }
  throw e;
});

}

function openBrowser(url) {
  const cmd = IS_WIN ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  try {
    spawn(cmd, { shell: true, stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  } catch { /* Browser bitte manuell öffnen */ }
}
