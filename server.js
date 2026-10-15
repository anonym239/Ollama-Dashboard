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
let pageServed = false;

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

// Wird alle paar Sekunden abgefragt, solange Ollama nicht läuft – deshalb erst die Dateien prüfen
// und "ollama --version" höchstens einmal pro Minute starten
let installedCache = { at: 0, value: null };
async function ollamaInstalled() {
  if (IS_WIN && process.env.LOCALAPPDATA && fs.existsSync(path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe'))) return 'installiert';
  if (process.platform === 'darwin' && fs.existsSync('/Applications/Ollama.app')) return 'installiert';
  if (Date.now() - installedCache.at < 60_000) return installedCache.value;
  const r = await run('ollama --version', { timeout: 10_000 });
  installedCache = { at: Date.now(), value: r.code === 0 ? (r.stdout + r.stderr).trim() : null };
  return installedCache.value;
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

// Mehrfaches Klicken startet Ollama trotzdem nur einmal
let ollamaStarting = null;
function startOllama() {
  if (!ollamaStarting) ollamaStarting = doStartOllama().finally(() => { ollamaStarting = null; });
  return ollamaStarting;
}

async function doStartOllama() {
  if (await ollamaVersion()) return { ok: true, already: true };
  const env = { ...process.env };
  // OLLAMA_HOST (Bind-Adresse) aus unserer Ziel-URL ableiten
  try { env.OLLAMA_HOST = new URL(DEFAULT_OLLAMA).host; } catch { /* Standard */ }
  if (IS_WIN) {
    // Ollama startet für GPU-Erkennung und jedes Modell eigene Hilfsprozesse. Ohne eigene Konsole
    // (detached) bekäme jeder davon ein sichtbares CMD-Fenster. Deshalb: über PowerShell mit einer
    // unsichtbaren Konsole starten – die Hilfsprozesse nutzen sie mit, und Ollama läuft weiter,
    // auch wenn das Dashboard geschlossen wird.
    const exe = ollamaBinary().replace(/'/g, "''");
    const r = await new Promise((resolve) => {
      const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        `Start-Process -FilePath '${exe}' -ArgumentList 'serve' -WindowStyle Hidden`], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true, env });
      let err = '';
      ps.stderr.on('data', (d) => { err += d; });
      ps.on('error', (e) => resolve({ code: -1, err: e.message }));
      ps.on('close', (code) => resolve({ code, err }));
    });
    if (r.code !== 0) return { ok: false, error: `Ollama ließ sich nicht starten: ${r.err.trim().split('\n')[0] || 'unbekannter Fehler'}` };
  } else {
    await new Promise((resolve, reject) => {
      const child = spawn(ollamaBinary(), ['serve'], { detached: true, stdio: 'ignore', env });
      child.once('error', reject);
      child.once('spawn', () => { ollamaChild = child; child.unref(); resolve(); });
    });
  }
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

// ---------- Relevanz: passende Treffer und passende Textstellen finden ----------
const STOPWORDS = new Set(('der die das den dem des ein eine einer eines einem einen und oder aber nicht kein keine ist sind war waren wird werden '
  + 'wie was wer wo wann warum welche welcher welches mit von zu zum zur im in am an auf aus bei für fur über uber unter um nach vor '
  + 'auch noch schon sehr mehr bitte mal gibt gib es ich du er sie wir ihr mir mich dir dich sich man kann können konnen soll sollte '
  + 'hat hatte haben habe neue neuen neueste neuesten neu aktuell aktuelle aktuellen heute jetzt etwas alles alle zeige zeig suche such finde erkläre erklär '
  + 'the a an and or of to in on for with what how why who is are was were new latest best about from by').split(' '));

function keyTerms(query) {
  return [...new Set(String(query).toLowerCase().split(/[^\p{L}\p{N}+#.]+/u)
    .map((w) => w.replace(/^\.+|\.+$/g, ''))
    .filter((w) => w.length > 1 && !STOPWORDS.has(w)))];
}

// Allgemeine Wörter ("neueste", "beste", "aktuell") sind nie das Thema – sonst passt z. B. "Neuste Duden-Wörter" zu "neuste RTX Grafikkarte"
const GENERIC_TERM = /^(neu\p{L}*|aktuell\p{L}*|letzt\p{L}*|best\p{L}*|gut\p{L}*|groß\p{L}*|klein\p{L}*|schnell\p{L}*|günstig\p{L}*|billig\p{L}*|teuer\p{L}*|top|heute|jetzt|gerade|welche\p{L}*|gibt|ist|sind|alle|viele|latest|new|newest|best|current|top|today|recherch\p{L}*|such\p{L}*|internet|web|online|bitte|infos?|information\p{L}*)$/u;

// Wichtigste Begriffe: Namen/Produkte (Großschreibung mitten im Satz, Ziffern, unbekannte Wörter)
function anchorTerms(query, terms) {
  const caps = String(query).split(/\s+/).slice(1).filter((w) => /^[A-ZÄÖÜ]/.test(w)).map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}+#.]/gu, ''));
  const specific = terms.filter((t) => !GENERIC_TERM.test(t) && !/^(19|20)\d{2}$/.test(t)); // Jahreszahlen sind kein Thema
  const anchors = specific.filter((t) => caps.includes(t) || /\d/.test(t) || !/(ung|heit|keit|ion|en|er|ern|lich|isch)$/.test(t));
  return anchors.length ? anchors : specific.length ? specific : terms;
}

// Starke Begriffe: Abkürzungen/Produktnamen in GROSSBUCHSTABEN (RTX, iPhone 16, GPT-5) oder mit Ziffern.
// Kommt so ein Begriff in der Frage vor, MUSS er im Treffer stehen.
function strongTerms(query) {
  return [...new Set(String(query).split(/[^\p{L}\p{N}+#.-]+/u)
    .filter((w) => w.length >= 2 && (/^[A-ZÄÖÜ0-9][A-ZÄÖÜ0-9+#.-]+$/.test(w) && /[A-ZÄÖÜ]/.test(w) || /\p{L}/u.test(w) && /\d/.test(w)))
    .map((w) => w.toLowerCase().replace(/^[.-]+|[.-]+$/g, '')))].filter((w) => w && !/^\d+$/.test(w));
}

function scoreResult(r, terms, anchors, strong = []) {
  if (!terms.length) return 1;
  const hay = `${r.title} ${r.snippet} ${r.url}`.toLowerCase();
  if (strong.length && !strong.some((t) => hay.includes(t))) return 0;
  if (anchors.length && !anchors.some((t) => hay.includes(t))) return 0;
  let host = '';
  try { host = new URL(r.url).hostname.replace(/^www\./, ''); } catch { /* egal */ }
  const hits = terms.filter((t) => hay.includes(t)).length / terms.length;
  const anchorHit = anchors.some((t) => hay.includes(t)) ? 0.5 : 0;
  const official = anchors.some((t) => t.length > 2 && host.split('.').some((part) => part === t || part.startsWith(t))) ? 1 : 0;
  return hits + anchorHit + official;
}

// Aus einem langen Seitentext die Absätze holen, die zur Frage passen
function bestPassages(text, terms, budget = 1800) {
  const paras = String(text).split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 30);
  const chunks = [];
  let cur = '';
  for (const p of paras) {
    if ((cur + ' ' + p).length > 450 && cur) { chunks.push(cur); cur = p; } else cur = cur ? `${cur} ${p}` : p;
  }
  if (cur) chunks.push(cur);
  if (!chunks.length) return String(text).slice(0, budget);
  const scored = chunks.map((c, i) => {
    const low = c.toLowerCase();
    let score = 0;
    for (const t of terms) score += Math.min(3, low.split(t).length - 1);
    if (/\b(19|20)\d{2}\b|\bv?\d+\.\d+/.test(c)) score += 0.5; // Daten/Versionen sind oft wichtig
    return { c, i, score };
  });
  const picked = [];
  let used = 0;
  for (const x of [...scored].sort((a, b) => b.score - a.score || a.i - b.i)) {
    if (used + x.c.length > budget) continue;
    if (x.score === 0 && picked.length) break;
    picked.push(x);
    used += x.c.length;
  }
  if (!picked.length) return chunks[0].slice(0, budget);
  return picked.sort((a, b) => a.i - b.i).map((x) => x.c).join('\n…\n');
}

// Vorschau-Infos einer Seite (Titel, Bild, Beschreibung) aus den Meta-Tags
function pageMeta(html, baseUrl) {
  const meta = (name) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    const v = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    return v ? decodeEntities(v).trim() : '';
  };
  let image = meta('og:image') || meta('twitter:image');
  if (image) { try { image = new URL(image, baseUrl).href; } catch { image = ''; } }
  return {
    title: meta('og:title') || meta('twitter:title'),
    description: (meta('og:description') || meta('description')).slice(0, 220),
    image: /^https:\/\//.test(image) ? image : '',
    site: meta('og:site_name'),
  };
}

async function fetchPage(url, maxChars = 8000, query = '') {
  let u;
  try { u = new URL(url); } catch { throw new Error('Ungültige URL'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Nur http/https erlaubt');
  if (isPrivateHost(u.hostname)) throw new Error('Lokale Adressen sind gesperrt');
  const { text, url: finalUrl } = await fetchText(u.href, { timeout: 10_000 });
  const page = htmlToText(text);
  const terms = keyTerms(query);
  const body = terms.length ? bestPassages(page.text, terms, maxChars) : page.text.slice(0, maxChars);
  return { url: finalUrl, title: page.title, text: body, truncated: page.text.length > body.length, meta: pageMeta(text, finalUrl) };
}

// ---------- YouTube ----------
const YT_HEADERS = { Cookie: 'CONSENT=YES+cb; SOCS=CAI', 'Accept-Language': 'de-DE,de;q=0.9' };

function ytInitialData(html) {
  const i = html.indexOf('ytInitialData');
  if (i < 0) return null;
  const start = html.indexOf('{', i);
  // JSON bis zum passenden Ende lesen (Klammern zählen, Strings beachten)
  let depth = 0;
  let inStr = false;
  for (let k = start; k < html.length; k++) {
    const c = html[k];
    if (inStr) { if (c === '\\') k++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(html.slice(start, k + 1)); } catch { return null; }
    }
  }
  return null;
}

const ytText = (t) => (t ? t.simpleText || (t.runs || []).map((r) => r.text).join('') : '');

function ytCollect(node, out = { videos: [], channels: [] }, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 60) return out;
  if (Array.isArray(node)) { for (const n of node) ytCollect(n, out, depth + 1); return out; }
  for (const [k, v] of Object.entries(node)) {
    if ((k === 'videoRenderer' || k === 'gridVideoRenderer') && v?.videoId) {
      out.videos.push({
        type: 'video',
        videoId: v.videoId,
        title: ytText(v.title),
        channel: ytText(v.ownerText || v.shortBylineText),
        published: ytText(v.publishedTimeText),
        views: ytText(v.viewCountText) || ytText(v.shortViewCountText),
        length: ytText(v.lengthText),
        description: ytText(v.detailedMetadataSnippets?.[0]?.snippetText) || ytText(v.descriptionSnippet),
      });
    } else if (k === 'lockupViewModel' && v?.contentId && /VIDEO/.test(v.contentType || '')) {
      // Neueres YouTube-Format
      const md = v.metadata?.lockupMetadataViewModel;
      const parts = [];
      (function grab(o, d = 0) {
        if (!o || typeof o !== 'object' || d > 12) return;
        if (Array.isArray(o)) { o.forEach((x) => grab(x, d + 1)); return; }
        if (typeof o.content === 'string' && o !== md?.title) parts.push(o.content);
        Object.values(o).forEach((x) => grab(x, d + 1));
      })(md?.metadata);
      out.videos.push({ type: 'video', videoId: v.contentId, title: md?.title?.content || '', channel: parts[0] || '', published: parts.find((x) => /vor|ago/i.test(x)) || '', views: parts.find((x) => /aufruf|view/i.test(x)) || '', length: '', description: '' });
    } else if (k === 'channelRenderer' && v?.channelId) {
      out.channels.push({
        name: ytText(v.title),
        url: v.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || `/channel/${v.channelId}`,
        subscribers: ytText(v.videoCountText) || ytText(v.subscriberCountText),
      });
    } else ytCollect(v, out, depth + 1);
  }
  return out;
}

function ytResult(v) {
  return {
    ...v,
    url: `https://www.youtube.com/watch?v=${v.videoId}`,
    image: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    site: 'YouTube',
    snippet: [v.channel, v.published, v.views, v.length].filter(Boolean).join(' · '),
    content: `YouTube-Video: „${v.title}“ von ${v.channel || 'unbekannt'}${v.published ? `, veröffentlicht ${v.published}` : ''}${v.views ? `, ${v.views}` : ''}${v.length ? `, Länge ${v.length}` : ''}.${v.description ? ` Beschreibung: ${v.description}` : ''}`,
  };
}

const wantsYouTube = (q) => /(youtube|youtuber|video|videos|kanal|channel|clip|vlog|stream|let'?s play)/i.test(q);

async function searchYouTube(query) {
  // Füllwörter raus, damit der Name des Kanals/Videos übrig bleibt
  const q = query.replace(/\b(youtube|youtuber|auf|von|vom|das|die|der|den|neuste|neueste|neusten|neuesten|letzte|letzten|aktuelle|aktuellste|video|videos|kanal|channel|zeig|zeige|mir|bitte|such|suche|finde|link|zum|zur|was|ist|welches|welche)\b/gi, ' ').replace(/\s+/g, ' ').trim() || query;
  const { text } = await fetchText(`https://www.youtube.com/results?hl=de&gl=DE&search_query=${encodeURIComponent(q)}`, { headers: YT_HEADERS });
  const data = ytInitialData(text);
  if (!data) throw new Error('YouTube-Seite nicht lesbar');
  const found = ytCollect(data);
  const results = [];
  // Wird ein Kanal gesucht ("neustes Video von X"), dessen neueste Uploads holen
  const channel = found.channels[0];
  if (channel && /(neu|letzt|aktuell|kanal|channel|von )/i.test(query)) {
    try {
      const page = await fetchText(`https://www.youtube.com${channel.url}/videos?hl=de`, { headers: YT_HEADERS });
      const ch = ytCollect(ytInitialData(page.text));
      for (const v of ch.videos.slice(0, 5)) results.push(ytResult({ ...v, channel: v.channel || channel.name, latest: true }));
    } catch { /* dann normale Treffer */ }
  }
  for (const v of found.videos.slice(0, 6)) if (!results.some((r) => r.videoId === v.videoId)) results.push(ytResult(v));
  return { results, channel };
}

async function linkPreview(url) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol) || isPrivateHost(u.hostname)) throw new Error('Nicht erlaubt');
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${yt[1]}`)}`);
    const j = r.ok ? await r.json() : {};
    return { type: 'video', url, videoId: yt[1], title: j.title || 'YouTube-Video', channel: j.author_name || '', image: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`, site: 'YouTube' };
  }
  const { text, url: finalUrl } = await fetchText(u.href, { timeout: 8000 });
  const m = pageMeta(text, finalUrl);
  return { type: 'page', url: finalUrl, title: m.title || htmlToText(text).title, description: m.description, image: m.image, site: m.site || u.hostname.replace(/^www\./, '') };
}


async function webSearch(query, { pages = 4, engine: preferred = 'google', keys = {} } = {}) {
  const yt = wantsYouTube(query) ? searchYouTube(query).catch(() => null) : null;
  const terms = keyTerms(query);
  const anchors = anchorTerms(query, terms);
  const strong = strongTerms(query);
  // Gewählter Anbieter zuerst; passen die Treffer nicht, werden weitere Anbieter dazugenommen
  const order = [preferred, 'google', 'duckduckgo', 'bing', 'brave'].filter((e, i, a) => ENGINES[e] && a.indexOf(e) === i);
  const seen = new Set();
  let results = [];
  const engines = [];
  const errors = [];
  for (const key of order) {
    const [label, search] = ENGINES[key];
    try {
      const found = (await search(query, keys)).map((r) => ({ ...r, score: scoreResult(r, terms, anchors, strong) }));
      const good = found.filter((r) => r.score >= 0.75 && !seen.has(r.url));
      good.forEach((r) => seen.add(r.url));
      if (good.length) { results.push(...good); engines.push(label); }
      else errors.push(`${label}: keine passenden Treffer`);
    } catch (e) {
      errors.push(`${label}: ${e.message}`);
    }
    if (results.length >= 5 || engines.length >= 2) break;
  }
  // Notfalls nur mit den wichtigsten Begriffen erneut suchen
  if (!results.length && anchors.length && anchors.join(' ') !== query.toLowerCase()) {
    for (const key of order.slice(0, 2)) {
      try {
        const found = (await ENGINES[key][1](anchors.join(' '), keys)).map((r) => ({ ...r, score: scoreResult(r, terms, anchors, strong) }));
        results = found.filter((r) => r.score >= 0.5);
        if (results.length) { engines.push(ENGINES[key][0]); break; }
      } catch { /* weiter */ }
    }
  }
  const ytRes = yt ? await yt : null;
  if (!results.length && !ytRes?.results.length) throw new Error('Keine passenden Treffer gefunden – besteht eine Internetverbindung? (' + errors.join('; ') + ')');
  results.sort((a, b) => b.score - a.score);
  results = results.filter((r) => !/youtube\.com\/(watch|results)/.test(r.url)).slice(0, 8);
  // Die besten Seiten wirklich öffnen und die passenden Textstellen + Vorschau-Infos holen
  await Promise.all(results.slice(0, pages).map(async (r) => {
    if (r.content && r.content.length > 800) { r.content = bestPassages(r.content, terms, 1800); return; }
    try {
      const page = await fetchPage(r.url, 1800, query);
      r.content = page.text;
      Object.assign(r, { image: page.meta.image, site: page.meta.site, description: page.meta.description });
    } catch { /* nur Snippet */ }
  }));
  if (ytRes?.results.length) {
    results = [...ytRes.results.slice(0, 5), ...results].slice(0, 9);
    engines.unshift('YouTube');
  }
  return { query, engine: engines.join(' + '), results, channel: ytRes?.channel || null };
}

// ---------- Befehle für Windows reparieren ----------
// Kleine Modelle schreiben oft "mkdir Desktop/ordner" – unter cmd ein Syntaxfehler und
// bei OneDrive-Desktops der falsche Ort. Hier werden solche Pfade korrigiert.
function fixWindowsCommand(cmd, desk, home) {
  const q = (p) => (/\s/.test(p) ? `"${p}"` : p);
  let s = String(cmd);
  // "Öffne ein CMD" – das KI-Terminal ist schon offen, kein zweites Fenster
  if (/^\s*(start\s+(""\s+)?)?(cmd|cmd\.exe|powershell|powershell\.exe|pwsh|wt)(\s+\/[kc])?\s*$/i.test(s)) {
    return 'echo Das KI-Terminal ist schon offen - Befehle laufen direkt hier.';
  }
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
  // start-Befehle von der Ausgabe abkoppeln – sonst wartet das Terminal, bis das gestartete Fenster zu ist
  s = s.replace(/(^|&&|&|\|\|)(\s*start\b[^&|>]*?)(\s*)(?=&&|&|\|\||$)/gi, (m, a, c, sp) => `${a}${c} >nul 2>&1${sp}`);
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
# PID schreiben – mit Wiederholung, falls das Dashboard die Datei gerade liest (Windows sperrt sie dann kurz)
$pidFile = Join-Path $QueueDir 'session.pid'
for ($i = 0; $i -lt 50; $i++) {
  try { [System.IO.File]::WriteAllText($pidFile, "$PID"); break } catch { Start-Sleep -Milliseconds 100 }
}
while ($true) {
  $jobs = @(Get-ChildItem -Path $QueueDir -Filter 'job-*.cmd' -ErrorAction SilentlyContinue | Sort-Object Name)
  foreach ($job in $jobs) {
    $id = $job.BaseName
    $text = ''
    try { $text = [System.IO.File]::ReadAllText((Join-Path $QueueDir "$id.txt"), [System.Text.Encoding]::UTF8) } catch {}
    $out = Join-Path $QueueDir "$id.out"
    Show-Front
    Write-Host "$cwd>" -NoNewline -ForegroundColor Green
    $delay = [Math]::Max(2, [Math]::Min(18, [int](600 / [Math]::Max(1, $text.Length))))
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
    for ($i = 0; $i -lt 50; $i++) {
      try { [System.IO.File]::WriteAllText((Join-Path $QueueDir "$id.done"), "$code"); break } catch { Start-Sleep -Milliseconds 100 }
    }
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
    for ((i=0; i<${"$"}{#cmd}; i++)); do printf '%s' "${"$"}{cmd:$i:1}"; sleep 0.005; done; echo
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
    const pid = Number(fs.readFileSync(path.join(TERM_DIR, 'session.pid'), 'utf8').replace(/^\ufeff/, '').trim());
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

async function terminalRun(original, { timeout = 120_000 } = {}) {
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
      const raw = readText(`${base}.done`).trim();
      if (!raw) continue; // wird gerade noch geschrieben
      const code = parseInt(raw, 10);
      const out = readText(`${base}.out`);
      const cwd = readText(cwdFile).trim();
      if (cwd) termCwd = cwd;
      for (const e of ['.txt', '.out', '.cwd', '.done']) { try { fs.rmSync(base + e, { force: true }); } catch { /* egal */ } }
      return { code: normalizeCode(command, Number.isNaN(code) ? 0 : code), stdout: out.slice(0, 200_000), stderr: '', visible: true, command, cwd: termCwd, ms: Date.now() - started };
    }
    if (!termAlive()) return { code: -1, stdout: readText(`${base}.out`), stderr: 'Das Terminal-Fenster wurde geschlossen.', visible: true, command };
  }
  return { code: 0, stdout: readText(`${base}.out`) + '\n[Der Befehl läuft im Terminal-Fenster weiter (z. B. ein Server oder ein offenes Programm). Bisherige Ausgabe siehe oben.]', stderr: '', visible: true, command, running: true };
}

// ---------- Updates: neue Version auf GitHub finden, herunterladen, prüfen, installieren, neu starten ----------
const UPDATE_REPO = 'anonym239/Ollama-Dashboard';
const APP_VERSION = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version || '0.0.0'; } catch { return '0.0.0'; }
})();
const IS_PACKAGED = (() => { try { return require('node:sea').isSea(); } catch { return false; } })();
let updateCache = null;
let updateJob = { phase: 'idle' };

function newerVersion(a, b) {
  const pa = String(a || '').replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b || '').replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

// Nur die Abschnitte "### Neu in X" der Versionen, die neuer sind als die installierte
function notesSince(body, current) {
  const parts = String(body || '').split(/^(?=###\s+Neu in\s+)/m);
  const out = parts.filter((p) => {
    const m = p.match(/^###\s+Neu in\s+v?([\d.]+)/);
    return m && newerVersion(m[1], current);
  });
  return out.join('\n').trim().slice(0, 6000);
}

// Für alle Benutzer installiert (Programme-Ordner)? Dann braucht das Update Administratorrechte
const isProgramFiles = (p) => [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.ProgramW6432]
  .filter(Boolean).some((d) => String(p).toLowerCase().startsWith(d.toLowerCase() + '\\'));

// Automatisch installieren geht nur mit der installierten Windows-Version (Setup)
const canSelfUpdate = () => IS_WIN && IS_PACKAGED && fs.existsSync(path.join(path.dirname(process.execPath), 'unins000.exe'));

async function checkUpdate(force = false) {
  if (!force && updateCache && Date.now() - updateCache.at < 30 * 60_000) return updateCache.data;
  const r = await fetch(`${process.env.OD_UPDATE_API || 'https://api.github.com'}/repos/${UPDATE_REPO}/releases/latest`, {
    headers: { 'User-Agent': 'Ollama-Dashboard', Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!r.ok) throw new Error(`GitHub antwortet nicht (${r.status})`);
  const j = await r.json();
  const latest = String(j.tag_name || '').replace(/^v/, '');
  const assets = j.assets || [];
  const setup = assets.find((a) => /^OllamaDashboard-Setup-.*\.exe$/i.test(a.name));
  const sums = assets.find((a) => a.name === 'SHA256SUMS.txt');
  const data = {
    current: APP_VERSION, latest, newer: newerVersion(latest, APP_VERSION),
    url: j.html_url, published: j.published_at, notes: notesSince(j.body, APP_VERSION),
    canInstall: canSelfUpdate() && !!setup && !!sums, size: setup?.size || 0,
  };
  updateCache = { at: Date.now(), data, setup, sums };
  return data;
}

async function downloadTo(url, file, onProgress) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Ollama-Dashboard' }, signal: AbortSignal.timeout(15 * 60_000) });
  if (!r.ok || !r.body) throw new Error(`Download fehlgeschlagen (${r.status})`);
  const hash = crypto.createHash('sha256');
  const out = fs.createWriteStream(file);
  let received = 0;
  try {
    for await (const chunk of r.body) {
      hash.update(chunk);
      received += chunk.length;
      onProgress(received);
      if (!out.write(chunk)) await new Promise((ok) => out.once('drain', ok));
    }
  } finally {
    await new Promise((ok) => out.end(ok));
  }
  return hash.digest('hex');
}

// Kleines PowerShell-Skript: wartet, bis die App beendet ist, installiert still und startet die neue Version
function updaterScript({ setupFile, exe, pid, log, allUsers = false }) {
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const dir = path.win32.dirname(exe);
  return [
    '$ErrorActionPreference = "SilentlyContinue"',
    `Wait-Process -Id ${pid} -Timeout 30`,
    'Start-Sleep -Milliseconds 500',
    `$p = Start-Process -FilePath ${q(setupFile)} -ArgumentList '/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/CLOSEAPPLICATIONS','/NOCANCEL','/SP-','${allUsers ? '/ALLUSERS' : '/CURRENTUSER'}',${q(`/LOG="${log}"`)} -Wait -PassThru`,
    // Merker als Start-Parameter (Umgebungsvariablen kommen über Start-Process nicht zuverlässig an)
    `Start-Process -FilePath ${q(exe)} -ArgumentList '--nach-update' -WorkingDirectory ${q(dir)}`,
    `Remove-Item -LiteralPath ${q(setupFile)} -Force`,
    'Remove-Item -LiteralPath $PSCommandPath -Force',
  ].join('\r\n');
}

async function installUpdate() {
  if (['download', 'verify', 'restarting'].includes(updateJob.phase)) return updateJob;
  const info = await checkUpdate(true);
  if (!info.newer) throw new Error('Du hast schon die neueste Version.');
  if (!info.canInstall) throw new Error('Automatische Updates gehen nur mit der installierten Windows-Version (Setup).');
  const { setup, sums } = updateCache;
  updateJob = { phase: 'download', version: info.latest, received: 0, total: setup.size };
  (async () => {
    const dir = path.join(require('os').tmpdir(), 'ollama-dashboard-update');
    fs.mkdirSync(dir, { recursive: true });
    const setupFile = path.join(dir, setup.name);
    const sumsText = await (await fetch(sums.browser_download_url, { headers: { 'User-Agent': 'Ollama-Dashboard' }, signal: AbortSignal.timeout(30_000) })).text();
    const expected = sumsText.split(/\r?\n/).map((l) => l.trim().split(/\s+/)).find((x) => x[1] === setup.name)?.[0]?.toLowerCase();
    if (!expected) throw new Error('Keine Prüfsumme für das Update gefunden.');
    const got = await downloadTo(setup.browser_download_url, setupFile, (n) => { updateJob.received = n; });
    updateJob.phase = 'verify';
    if (got !== expected) { fs.rmSync(setupFile, { force: true }); throw new Error('Prüfsumme stimmt nicht – Update abgebrochen.'); }
    const script = path.join(dir, 'update.ps1');
    fs.writeFileSync(script, '﻿' + updaterScript({ setupFile, exe: process.execPath, pid: process.pid, log: path.join(dir, 'setup.log'), allUsers: isProgramFiles(process.execPath) }), 'utf8');
    spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', script], {
      detached: true, stdio: 'ignore', windowsHide: true,
    }).unref();
    updateJob.phase = 'restarting';
    setTimeout(() => process.exit(0), 1500);
  })().catch((e) => { updateJob = { phase: 'error', error: e.message }; });
  return updateJob;
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
        appVersion: APP_VERSION,
        ollamaUrl: DEFAULT_OLLAMA,
        home: require('os').homedir(),
        shell: IS_WIN ? 'cmd.exe' : (process.env.SHELL || '/bin/sh'),
      });
    }
    if (route === '/local/update/check' && req.method === 'GET') {
      return json(res, 200, await checkUpdate(new URL(req.url, 'http://x').searchParams.has('force')));
    }
    if (route === '/local/update/install' && req.method === 'POST') {
      return json(res, 200, await installUpdate());
    }
    if (route === '/local/update/status' && req.method === 'GET') {
      return json(res, 200, updateJob);
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
      const timeout = Math.min(Math.max(Number(body.timeout) || 120, 1), 3600) * 1000;
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
      return json(res, 200, await webSearch(String(body.query).trim(), { pages: body.pages ?? 4, engine: body.engine, keys: body.keys || {} }));
    }
    if (route === '/local/web/preview' && req.method === 'POST') {
      const body = await readBody(req);
      return json(res, 200, await linkPreview(String(body.url || '')));
    }
    if (route === '/local/web/fetch' && req.method === 'POST') {
      const body = await readBody(req);
      return json(res, 200, await fetchPage(String(body.url || ''), body.query ? 6000 : 12_000, String(body.query || '')));
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
    if (!err && file.endsWith('index.html')) { data = Buffer.from(String(data).replace('{{TOKEN}}', TOKEN)); pageServed = true; }
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
module.exports = { ytInitialData, ytCollect, pageMeta, wantsYouTube, keyTerms, anchorTerms, strongTerms, scoreResult, startOllama, bestPassages, fixWindowsCommand, prepareCommand, terminalRun, termAlive, desktopDir, resolvePath, fsAction, TERM_DIR, PS_TERMINAL, SH_TERMINAL, webSearch, newerVersion, notesSince, updaterScript, APP_VERSION };

if (!process.env.OD_NO_LISTEN) {
process.title = 'Ollama Dashboard';
server.listen(PORT, HOST, () => {
  const shown = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log('\n  Ollama Dashboard läuft');
  console.log(`  ➜  Öffne:   http://${shown}:${PORT}`);
  console.log(`  ➜  Ollama:  ${DEFAULT_OLLAMA}`);
  console.log('\n  Dieses Fenster offen lassen, solange du das Dashboard nutzt.');
  console.log('  Schließen = Dashboard beenden.\n');
  if (process.argv.includes('--nach-update')) {
    // Nach einem Update lädt sich die offene Seite selbst neu – nur wenn keine kommt, den Browser öffnen
    setTimeout(() => { if (!pageServed && !process.env.NO_OPEN) openBrowser(`http://${shown}:${PORT}`); }, 10_000);
  } else if (!process.env.NO_OPEN) openBrowser(`http://${shown}:${PORT}`);
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
