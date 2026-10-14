// Ollama Dashboard – Hauptlogik der Oberfläche
import { ollama, setOllamaUrl } from './ollama.js';
import { chatsDb, loadJson, loadList, saveJson, uid } from './store.js';
import { renderMarkdown, escapeHtml } from './markdown.js';
import { Speaker, Dictation } from './tts.js';
import { readAttachment, formatBytes, buildContent } from './files.js';
import { local, localFs, web, skillsApi } from './local.js';
import { TOOL_DEFS, TOOL_META, needsApproval, systemPrompt, parseTextActions, executeTool, findStopBlock, wantsExecution, selectSkills, collectCodeBlocks, resolveCodeRef, wantsReuse, detectRewrite, detectLanguage, LANGUAGE_REMINDER, stripForeign, needsWeb, makeQuery } from './agent.js';

// ---------------------------------------------------------------------------
// Icons (Lucide-Stil)
// ---------------------------------------------------------------------------
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  clip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4"/>',
  send: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
  volume: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  volumeOff: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  dots: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
  folderPlus: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/><path d="M12 10v6M9 13h6"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  terminal: '<path d="m4 17 6-6-6-6M12 19h8"/>',
  play: '<path d="m6 3 14 9-14 9z"/>',
  power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  pin: '<path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  loader: '<path d="M21 12a9 9 0 1 1-6.2-8.56"/>',
};
const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

// ---------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------
const DEFAULT_SETTINGS = {
  theme: 'system',
  ollamaUrl: '',
  sendOnEnter: true,
  autoTitle: true,
  think: true,
  agent: true,
  visibleTerminal: true,
  autoPreview: true,
  previewWidth: 560,
  autoApprove: 'none',
  webSearch: true,
  searchEngine: 'google',
  searchKeys: { googleKey: '', googleCx: '', tavilyKey: '', searxngUrl: 'http://127.0.0.1:8080' },
  lastModel: '',
  lastAssistantId: 'default',
  memory: [],
  disabledSkills: [],
  sidebarHidden: false,
  tts: { auto: false, voiceURI: '', rate: 1, pitch: 1 },
};

const DEFAULT_ASSISTANTS = [
  { id: 'default', name: 'Assistent', color: '#7c5cff', model: '', systemPrompt: '', temperature: 0.7, numCtx: 8192, agent: true },
  {
    id: 'coder', name: 'Programmierer', color: '#0ea5e9', model: '', temperature: 0.3, numCtx: 16384, agent: true,
    systemPrompt: 'Du bist ein erfahrener Softwareentwickler. Wenn der Nutzer möchte, dass du etwas programmierst, erstellst du ein vollständiges, lauffähiges Projekt in einem neuen Ordner auf dem Desktop und speicherst jede Datei komplett mit einem datei:-Block (keine Platzhalter, kein „Rest bleibt gleich“). Danach erklärst du kurz, wie man es startet.',
  },
];

const TEMPLATES = [
  { name: 'Übersetzer', color: '#10b981', temperature: 0.2, systemPrompt: 'Du bist ein professioneller Übersetzer. Übersetze Texte präzise und natürlich. Wenn keine Zielsprache genannt ist: Deutsch ↔ Englisch.' },
  { name: 'Lehrer', color: '#f59e0b', temperature: 0.6, systemPrompt: 'Du bist ein geduldiger Lehrer. Erkläre Dinge Schritt für Schritt, mit einfachen Beispielen, und prüfe am Ende mit einer kleinen Frage, ob alles verstanden wurde.' },
  { name: 'Kreativ-Autor', color: '#ec4899', temperature: 1.0, systemPrompt: 'Du bist ein kreativer Autor. Schreibe lebendig, bildhaft und originell – Geschichten, Gedichte, Slogans und mehr.' },
  { name: 'Recherche', color: '#6366f1', temperature: 0.3, systemPrompt: 'Du bist ein gründlicher Rechercheur. Suche bei Faktenfragen im Internet, vergleiche Quellen und fasse die Ergebnisse klar strukturiert mit Quellenangaben zusammen.' },
];

const RECOMMENDED = [
  { name: 'llama3.2', size: 'ca. 2 GB', desc: 'Schnell & gut für den Alltag' },
  { name: 'qwen2.5:3b', size: 'ca. 1,9 GB', desc: 'Klein, stark als Agent (Tools)' },
  { name: 'qwen3:4b', size: 'ca. 2,6 GB', desc: 'Denkt nach, kann Tools' },
  { name: 'gemma3:4b', size: 'ca. 3,3 GB', desc: 'Kann Bilder verstehen' },
  { name: 'qwen2.5-coder:7b', size: 'ca. 4,7 GB', desc: 'Spezialist fürs Programmieren' },
  { name: 'llama3.1:8b', size: 'ca. 4,9 GB', desc: 'Starker Allrounder' },
  { name: 'deepseek-r1:7b', size: 'ca. 4,7 GB', desc: 'Logik & Nachdenken' },
  { name: 'llama3.2:1b', size: 'ca. 1,3 GB', desc: 'Winzig, für schwache PCs' },
];

const SEARCH_ENGINES = {
  google: { label: 'Google (Standard, ohne Key)' },
  duckduckgo: { label: 'DuckDuckGo (ohne Key)' },
  bing: { label: 'Bing (ohne Key)' },
  brave: { label: 'Brave Search (ohne Key)' },
  google_api: { label: 'Google Custom Search API (kostenloses Kontingent, Key nötig)' },
  tavily: { label: 'Tavily (kostenloses Kontingent, Key nötig)' },
  searxng: { label: 'SearXNG (eigene Instanz, kostenlos)' },
};

const COLORS = ['#7c5cff', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#64748b'];

let settings = loadJson('od.settings', DEFAULT_SETTINGS);
settings.tts = { ...DEFAULT_SETTINGS.tts, ...settings.tts };
settings.searchKeys = { ...DEFAULT_SETTINGS.searchKeys, ...settings.searchKeys };
if (!Array.isArray(settings.memory)) settings.memory = [];
if (!Array.isArray(settings.disabledSkills)) settings.disabledSkills = [];
let assistants = loadList('od.assistants', DEFAULT_ASSISTANTS);
if (!assistants.length) assistants = structuredClone(DEFAULT_ASSISTANTS);

let chats = [];
let currentChatId = null;
let draft = { assistantId: settings.lastAssistantId, model: '' };
let models = [];
let online = null;
let ollamaVersion = '';
let localStatus = null;
let sysInfo = null;
let pending = [];
let busy = null;
let search = '';
const capsCache = new Map();
const noTools = new Set();
const noThink = new Set();
const approvals = new Map();
const downloads = new Map();

const speaker = new Speaker();
speaker.settings = settings.tts;

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const el = {
  app: $('#app'), sidebar: $('#sidebar'), chatList: $('#chatList'), messages: $('#messages'), inner: $('#messagesInner'),
  input: $('#input'), composer: $('#composer'), sendBtn: $('#sendBtn'), attachments: $('#attachments'), fileInput: $('#fileInput'),
  modelSelect: $('#modelSelect'), assistantPicker: $('#assistantPicker'), status: $('#status'), banner: $('#bannerArea'),
  modalRoot: $('#modalRoot'), menuRoot: $('#menuRoot'), toasts: $('#toasts'), hint: $('#composerHint'),
};

const saveSettings = () => saveJson('od.settings', settings);
const saveAssistants = () => saveJson('od.assistants', assistants);
const currentChat = () => chats.find((c) => c.id === currentChatId) || null;
const getAssistant = (id) => assistants.find((a) => a.id === id) || assistants[0];
const isMobile = () => matchMedia('(max-width: 860px)').matches;

// ---------------------------------------------------------------------------
// Kleine UI-Helfer
// ---------------------------------------------------------------------------
function toast(text, type = '') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = text;
  el.toasts.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 3200);
  setTimeout(() => t.remove(), 3600);
}

function openModal({ title, body, foot = '', size = '', onMount }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true">
    <div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-close title="Schließen">${icon('x')}</button></div>
    <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
  const close = () => { wrap.remove(); wrap.dispatchEvent(new Event('closed')); };
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  el.modalRoot.appendChild(wrap);
  const api = { el: wrap, close, body: $('.modal-body', wrap) };
  onMount?.(api);
  setTimeout(() => $('input:not([type=checkbox]):not([type=range]), textarea', wrap)?.focus(), 30);
  return api;
}

function confirmDialog(text, { title = 'Bist du sicher?', ok = 'OK', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = openModal({
      title, size: 'small', body: `<p style="margin:0">${text}</p>`,
      foot: `<button class="btn" data-close>Abbrechen</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${ok}</button>`,
    });
    $('[data-ok]', m.el).onclick = () => { done = true; resolve(true); m.close(); };
    m.el.addEventListener('closed', () => { if (!done) resolve(false); });
  });
}

function promptDialog(title, value = '', { label = '', ok = 'Speichern', hint = '' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = openModal({
      title, size: 'small',
      body: `<div class="field">${label ? `<label>${label}</label>` : ''}<input class="input" id="promptInput" value="${escapeHtml(value)}">${hint ? `<span class="hint">${hint}</span>` : ''}</div>`,
      foot: `<button class="btn" data-close>Abbrechen</button><button class="btn btn-primary" data-ok>${ok}</button>`,
    });
    const input = $('#promptInput', m.el);
    const submit = () => { done = true; resolve(input.value.trim()); m.close(); };
    $('[data-ok]', m.el).onclick = submit;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    m.el.addEventListener('closed', () => { if (!done) resolve(null); });
    setTimeout(() => input.select(), 40);
  });
}

function openMenu(anchor, items) {
  closeMenu();
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.innerHTML = items.map((it, i) => it === 'sep' ? '<div class="menu-sep"></div>' :
    `<button class="menu-item ${it.danger ? 'danger' : ''}" data-i="${i}">${it.html || (it.icon ? icon(it.icon) : '')}
      <span class="mi-text">${escapeHtml(it.label)}${it.sub ? `<span class="mi-sub">${escapeHtml(it.sub)}</span>` : ''}</span>
      ${it.checked ? `<span class="check">${icon('check')}</span>` : ''}</button>`).join('');
  el.menuRoot.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  let left = Math.min(r.left, innerWidth - mw - 8);
  let top = r.bottom + 6;
  if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${top}px`;
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    closeMenu();
    items[+b.dataset.i].onClick?.();
  });
  setTimeout(() => document.addEventListener('mousedown', outsideMenu), 0);
}
function outsideMenu(e) { if (!e.target.closest('.menu')) closeMenu(); }
function closeMenu() { el.menuRoot.innerHTML = ''; document.removeEventListener('mousedown', outsideMenu); }

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('Kopiert');
}

function applyTheme() {
  if (settings.theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', settings.theme);
}

// Avatar = App-Logo (Stern), Standard-Assistent im Logo-Verlauf, andere in ihrer Farbe
const LOGO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.3 6.5 6.5 2.3-6.5 2.3L12 20.8l-2.3-6.5L3.2 12l6.5-2.3z" fill="#fff"/></svg>';
const avatarBg = (a) => (!a.color || a.color === '#7c5cff' ? 'var(--grad)' : `linear-gradient(135deg, ${escapeHtml(a.color)}, color-mix(in srgb, ${escapeHtml(a.color)} 55%, #22c3ee))`);
const avatarHtml = (a, cls = '', style = '') => `<div class="avatar ${cls}" style="background:${avatarBg(a)};${style}">${LOGO}</div>`;

// ---------------------------------------------------------------------------
// Ollama-Status, Modelle & Banner
// ---------------------------------------------------------------------------
let statusTimer = null;
async function checkStatus() {
  clearTimeout(statusTimer);
  const wasOnline = online;
  try {
    const v = await ollama.version();
    online = true;
    ollamaVersion = v.version;
    if (!wasOnline || !models.length) await refreshModels();
  } catch {
    online = false;
    localStatus = await local.status().catch(() => null);
  }
  renderStatus();
  renderBanner();
  statusTimer = setTimeout(checkStatus, online ? 15000 : 4000);
}

async function refreshModels() {
  try {
    models = await ollama.models();
  } catch {
    models = [];
  }
  renderModelSelect();
  renderBanner();
  if ($('#modelsModal')) renderModelsModal();
}

async function getCaps(model) {
  if (capsCache.has(model)) return capsCache.get(model);
  let caps = null;
  try {
    const info = await ollama.show(model);
    caps = Array.isArray(info.capabilities) ? info.capabilities : null;
  } catch { /* unbekannt */ }
  capsCache.set(model, caps);
  return caps;
}

function renderStatus() {
  el.status.className = `status ${online ? 'online' : 'offline'}`;
  $('.status-text', el.status).textContent = online
    ? `Ollama ${ollamaVersion ? 'v' + ollamaVersion : ''} · ${models.length} ${models.length === 1 ? 'Modell' : 'Modelle'}${sessionTokens ? ` · ${fmtTokens(sessionTokens)} Tokens` : ''}`
    : 'Ollama nicht verbunden';
}

function renderBanner() {
  let html = '';
  if (online === false) {
    if (settings.ollamaUrl) {
      html = banner('error', 'power', 'Ollama nicht erreichbar', `Unter ${escapeHtml(settings.ollamaUrl)} antwortet kein Ollama-Server.`,
        `<button class="btn btn-sm" data-banner="retry">${icon('refresh')} Erneut prüfen</button><button class="btn btn-sm" data-banner="settings">Einstellungen</button>`);
    } else if (localStatus && !localStatus.installed) {
      const win = localStatus.platform === 'win32';
      html = banner('error', 'download', 'Ollama ist nicht installiert', 'Ollama ist der Motor für deine lokalen KIs. Installiere es einmalig – danach läuft alles offline.',
        `${win ? `<button class="btn btn-sm btn-primary" data-banner="install">${icon('download')} Automatisch installieren</button>` : ''}
         <a class="btn btn-sm ${win ? '' : 'btn-primary'}" href="https://ollama.com/download" target="_blank" rel="noopener">${icon('external')} Download-Seite</a>
         <button class="btn btn-sm" data-banner="retry">${icon('refresh')} Erneut prüfen</button>`);
    } else {
      html = banner('warn', 'power', 'Ollama läuft gerade nicht', 'Deine KIs schlafen noch. Soll ich Ollama für dich starten?',
        `<button class="btn btn-sm btn-primary" data-banner="start">${icon('power')} Ollama starten</button>
         <button class="btn btn-sm" data-banner="retry">${icon('refresh')} Erneut prüfen</button>`);
    }
  } else if (online && !models.length) {
    html = banner('', 'cpu', 'Noch keine KI installiert', 'Lade dein erstes Modell herunter – z. B. Llama 3.2 (ca. 2 GB, schnell und gut).',
      `<button class="btn btn-sm btn-primary" data-banner="pull" data-model="llama3.2">${icon('download')} Llama 3.2 laden</button>
       <button class="btn btn-sm" data-banner="models">Alle Modelle</button>`);
    const dl = downloads.get('llama3.2');
    if (dl) html = banner('', 'download', 'Llama 3.2 wird heruntergeladen …', escapeHtml(dl.text || ''), `<div style="width:160px">${progressHtml(dl.pct)}</div>`);
  }
  el.banner.innerHTML = html;
}

const banner = (type, ico, title, text, actions) =>
  `<div class="banner ${type}"><div class="b-icon">${icon(ico)}</div><div class="b-text"><strong>${title}</strong><span>${text}</span></div><div class="b-actions">${actions}</div></div>`;
const progressHtml = (pct) => `<div class="progress ${pct == null ? 'indeterminate' : ''}"><div style="width:${pct || 0}%"></div></div>`;

el.banner.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-banner]');
  if (!b) return;
  const action = b.dataset.banner;
  if (action === 'retry') { b.disabled = true; await checkStatus(); }
  if (action === 'settings') openSettings();
  if (action === 'models') openModels();
  if (action === 'pull') pullModel(b.dataset.model);
  if (action === 'start') {
    b.disabled = true;
    b.innerHTML = `${icon('loader', 'spin')} Starte …`;
    try {
      const r = await local.startOllama();
      if (r.ok) toast('Ollama läuft');
      else toast(r.error || 'Start fehlgeschlagen', 'error');
    } catch (err) {
      toast(err.message, 'error');
    }
    await checkStatus();
  }
  if (action === 'install') {
    const ok = await confirmDialog('Ollama wird über <b>winget</b> (Windows-Paketmanager) installiert. Das kann einige Minuten dauern.', { title: 'Ollama installieren?', ok: 'Installieren' });
    if (!ok) return;
    b.disabled = true;
    b.innerHTML = `${icon('loader', 'spin')} Installiere …`;
    const r = await local.exec('winget install -e --id Ollama.Ollama --accept-source-agreements --accept-package-agreements', 900).catch((err) => ({ code: -1, stderr: err.message }));
    if (r.code === 0) toast('Ollama installiert – starte …');
    else toast('Installation fehlgeschlagen. Bitte über die Download-Seite installieren.', 'error');
    await local.startOllama().catch(() => {});
    await checkStatus();
  }
});

// Modell herunterladen (mit Fortschritt im Banner und im Modell-Dialog)
async function pullModel(name) {
  name = name.trim();
  if (!name || downloads.has(name)) return;
  const ctrl = new AbortController();
  const dl = { text: 'Starte …', pct: null, ctrl };
  downloads.set(name, dl);
  renderBanner();
  if ($('#modelsModal')) renderModelsModal();
  try {
    let lastRender = 0;
    for await (const ev of ollama.pull(name, ctrl.signal)) {
      dl.pct = ev.total ? Math.round((ev.completed || 0) / ev.total * 100) : null;
      dl.text = ev.total ? `${ev.status} · ${formatBytes(ev.completed || 0)} / ${formatBytes(ev.total)}` : ev.status;
      if (Date.now() - lastRender > 250) {
        lastRender = Date.now();
        renderBanner();
        updateDownloadsUi();
      }
    }
    toast(`${name} ist bereit`);
    downloads.delete(name);
    await refreshModels();
    if (!currentChat()?.model && !draft.model) { draft.model = name; renderModelSelect(); }
  } catch (err) {
    downloads.delete(name);
    if (err.name !== 'AbortError') toast(`Download fehlgeschlagen: ${err.message}`, 'error');
  }
  renderBanner();
  if ($('#modelsModal')) renderModelsModal();
}

function updateDownloadsUi() {
  const box = $('#downloadsBox');
  if (!box) return;
  box.innerHTML = downloadsHtml();
}

function downloadsHtml() {
  if (!downloads.size) return '';
  return [...downloads].map(([name, d]) => `<div class="list-item"><div class="li-main"><div class="li-title">${escapeHtml(name)}</div>
    <div class="li-sub" style="margin:6px 0">${escapeHtml(d.text || '')}</div>${progressHtml(d.pct)}</div>
    <div class="li-actions"><button class="btn btn-sm" data-cancel-dl="${escapeHtml(name)}">Abbrechen</button></div></div>`).join('');
}

function renderModelSelect() {
  const chat = currentChat();
  const selected = chat ? chat.model : draft.model;
  const names = models.map((m) => m.name);
  let opts = names.map((n) => `<option value="${escapeHtml(n)}" ${n === selected ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('');
  if (selected && !names.includes(selected)) opts = `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)} (fehlt)</option>` + opts;
  if (!opts) opts = '<option value="">Kein Modell</option>';
  el.modelSelect.innerHTML = opts;
  if (!selected && names.length) {
    const m = resolveModel(getAssistant(chat ? chat.assistantId : draft.assistantId));
    if (chat) chat.model = m; else draft.model = m;
    el.modelSelect.value = m;
  }
}

function resolveModel(assistant) {
  const names = models.map((m) => m.name);
  const match = (n) => n && (names.includes(n) ? n : names.find((x) => x === `${n}:latest` || x.startsWith(n + ':')));
  return match(assistant?.model) || match(settings.lastModel) || names[0] || '';
}

el.modelSelect.addEventListener('change', () => {
  const v = el.modelSelect.value;
  const chat = currentChat();
  if (chat) { chat.model = v; persist(chat); } else draft.model = v;
  settings.lastModel = v;
  saveSettings();
  updateComposer();
});

// ---------------------------------------------------------------------------
// Assistenten-Auswahl
// ---------------------------------------------------------------------------
function renderAssistantPicker() {
  const chat = currentChat();
  const a = getAssistant(chat ? chat.assistantId : draft.assistantId);
  el.assistantPicker.innerHTML = `${avatarHtml(a)}<span class="ap-name">${escapeHtml(a.name)}</span>${icon('chevron')}`;
}

el.assistantPicker.addEventListener('click', () => {
  const chat = currentChat();
  const curId = chat ? chat.assistantId : draft.assistantId;
  openMenu(el.assistantPicker, [
    ...assistants.map((a) => ({
      label: a.name, sub: a.model || 'Standardmodell', checked: a.id === curId,
      html: avatarHtml(a, 'avatar-sm'),
      onClick: () => selectAssistant(a.id),
    })),
    'sep',
    { label: 'Neuer Assistent …', icon: 'plus', onClick: () => editAssistant() },
    { label: 'Assistenten verwalten', icon: 'users', onClick: openAssistants },
  ]);
});

function selectAssistant(id) {
  const a = getAssistant(id);
  const chat = currentChat();
  const model = a.model ? resolveModel(a) : (chat ? chat.model : draft.model) || resolveModel(a);
  if (chat) {
    chat.assistantId = a.id;
    chat.model = model;
    persist(chat);
  } else {
    draft = { assistantId: a.id, model };
  }
  settings.lastAssistantId = a.id;
  saveSettings();
  renderAssistantPicker();
  renderModelSelect();
  renderMessages();
  renderSidebar();
}

// ---------------------------------------------------------------------------
// Seitenleiste
// ---------------------------------------------------------------------------
function renderSidebar() {
  const q = search.toLowerCase();
  const list = chats
    .filter((c) => !q || c.title.toLowerCase().includes(q) || c.messages.some((m) => typeof m.content === 'string' && m.content.toLowerCase().includes(q)))
    .sort((a, b) => (b.pinned - a.pinned) || b.updatedAt - a.updatedAt);
  if (!list.length) {
    el.chatList.innerHTML = `<div class="chat-empty">${q ? 'Keine Treffer' : 'Noch keine Chats.<br>Starte einfach unten eine Unterhaltung!'}</div>`;
    return;
  }
  const startOfDay = new Date().setHours(0, 0, 0, 0);
  const groupOf = (c) => {
    if (c.pinned) return 'Angeheftet';
    if (c.updatedAt >= startOfDay) return 'Heute';
    if (c.updatedAt >= startOfDay - 864e5) return 'Gestern';
    if (c.updatedAt >= startOfDay - 7 * 864e5) return 'Letzte 7 Tage';
    if (c.updatedAt >= startOfDay - 30 * 864e5) return 'Letzte 30 Tage';
    return 'Älter';
  };
  let html = '';
  let last = '';
  for (const c of list) {
    const g = groupOf(c);
    if (g !== last) { html += `<div class="chat-group">${g}</div>`; last = g; }
    const a = getAssistant(c.assistantId);
    html += `<button class="chat-item ${c.id === currentChatId ? 'active' : ''}" data-chat="${c.id}">
      <span class="ci-text"><span class="ci-title">${escapeHtml(c.title)}</span><span class="ci-sub">${escapeHtml(a.name)}${c.model ? ' · ' + escapeHtml(c.model.replace(/:latest$/, '')) : ''}</span></span>
      ${busy?.chatId === c.id ? '<span class="ci-busy"></span>' : ''}
      <span class="ci-more" data-chat-menu="${c.id}" title="Optionen">${icon('dots')}</span></button>`;
  }
  el.chatList.innerHTML = html;
}

el.chatList.addEventListener('click', (e) => {
  const more = e.target.closest('[data-chat-menu]');
  if (more) {
    e.stopPropagation();
    const chat = chats.find((c) => c.id === more.dataset.chatMenu);
    openMenu(more, [
      { label: 'Umbenennen', icon: 'edit', onClick: async () => {
        const t = await promptDialog('Chat umbenennen', chat.title);
        if (t) { chat.title = t; persist(chat); renderSidebar(); }
      } },
      { label: chat.pinned ? 'Lösen' : 'Anheften', icon: 'pin', onClick: () => { chat.pinned = !chat.pinned; persist(chat); renderSidebar(); } },
      { label: 'Als Markdown exportieren', icon: 'download', onClick: () => exportChatMd(chat) },
      'sep',
      { label: 'Löschen', icon: 'trash', danger: true, onClick: () => deleteChat(chat) },
    ]);
    return;
  }
  const item = e.target.closest('[data-chat]');
  if (item) openChat(item.dataset.chat);
});

$('#chatSearch').addEventListener('input', (e) => { search = e.target.value; renderSidebar(); });

function setSidebar(open) {
  if (isMobile()) el.app.classList.toggle('sidebar-open', open);
  else {
    el.app.classList.toggle('sidebar-hidden', !open);
    settings.sidebarHidden = !open;
    saveSettings();
  }
}
$('#toggleSidebar').addEventListener('click', () => {
  setSidebar(isMobile() ? !el.app.classList.contains('sidebar-open') : el.app.classList.contains('sidebar-hidden'));
});
$('#closeSidebar').addEventListener('click', () => setSidebar(false));
$('#backdrop').addEventListener('click', () => setSidebar(false));

async function deleteChat(chat) {
  const ok = await confirmDialog(`„${escapeHtml(chat.title)}“ wird dauerhaft gelöscht.`, { title: 'Chat löschen?', ok: 'Löschen', danger: true });
  if (!ok) return;
  if (busy?.chatId === chat.id) busy.controller.abort();
  chats = chats.filter((c) => c.id !== chat.id);
  await chatsDb.remove(chat.id);
  if (currentChatId === chat.id) newChat();
  renderSidebar();
}

function exportChatMd(chat) {
  const lines = [`# ${chat.title}`, ''];
  for (const m of chat.messages) {
    if (m.role === 'user') lines.push(`**Du:**\n\n${m.content}\n`);
    else if (m.role === 'assistant' && m.content) lines.push(`**${getAssistant(m.assistantId).name}** (${m.model}):\n\n${m.content}\n`);
  }
  download(`${chat.title.replace(/[^\w\- äöüÄÖÜß]/g, '').trim() || 'chat'}.md`, lines.join('\n'), 'text/markdown');
}

function download(name, content, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------------------------------------------------------------------------
// Chats
// ---------------------------------------------------------------------------
let persistTimers = new Map();
function persist(chat, immediate = false) {
  clearTimeout(persistTimers.get(chat.id));
  const run = () => chatsDb.put(structuredClone(chat)).catch((e) => toast('Speichern fehlgeschlagen: ' + e.message, 'error'));
  if (immediate) run();
  else persistTimers.set(chat.id, setTimeout(run, 600));
}

function newChat() {
  currentChatId = null;
  const a = getAssistant(settings.lastAssistantId);
  draft = { assistantId: a.id, model: resolveModel(a) };
  renderAll();
  if (isMobile()) setSidebar(false);
  el.input.focus();
}

function openChat(id) {
  if (currentChatId !== id && !pv.el.hidden) closePreview();
  currentChatId = id;
  renderAll();
  if (isMobile()) setSidebar(false);
  scrollToBottom(true);
}

function renderAll() {
  renderSidebar();
  renderAssistantPicker();
  renderModelSelect();
  renderMessages();
  updateComposer();
}

// ---------------------------------------------------------------------------
// Nachrichten darstellen
// ---------------------------------------------------------------------------
// Fremde Schriftzeichen nur ausblenden, wenn der Nutzer Deutsch/Englisch schreibt (Einstellung, Standard an)
const shown = (m, text, keepCode = true) => (settings.filterForeign !== false && (m.lang || 'de') !== 'other' ? stripForeign(text, keepCode) : text);

function splitThink(content) {
  const m = String(content || '').match(/^\s*<think>([\s\S]*?)(<\/think>|$)([\s\S]*)$/);
  if (!m) return { think: '', text: content || '' };
  return { think: m[1].trim(), text: m[3] || '', open: !m[2] };
}

function renderMessages() {
  const chat = currentChat();
  if (!chat || !chat.messages.length) {
    el.inner.innerHTML = welcomeHtml();
    return;
  }
  const lastAi = [...chat.messages].reverse().find((m) => m.role === 'assistant');
  const scrolls = saveCodeScroll(el.inner);
  el.inner.innerHTML = chat.messages.map((m, i) => messageHtml(m, i, chat, m === lastAi)).join('');
  restoreCodeScroll(el.inner, scrolls);
  hydratePreviews();
}

function welcomeHtml() {
  const chat = currentChat();
  const a = getAssistant(chat ? chat.assistantId : draft.assistantId);
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
  const sug = [
    ['Programmiere mir ein Spiel', 'Snake im Browser – als Projekt auf dem Desktop', 'Programmiere mir das Spiel Snake als einzelne HTML-Datei und speichere es in einem neuen Ordner auf meinem Desktop.'],
    ['Recherchiere im Web', 'Was gibt es Neues bei Ollama?', 'Was sind die neuesten Funktionen von Ollama? Recherchiere bitte im Internet.'],
    ['Lade eine neue KI', 'z. B. Gemma 3, die Bilder versteht', 'Lade das Modell gemma3:4b herunter.'],
    ['Erkläre mir etwas', 'Wie funktioniert eigentlich eine KI?', 'Erkläre mir einfach und anschaulich, wie ein Sprachmodell wie du funktioniert.'],
  ];
  return `<div class="welcome">${avatarHtml(a, 'w-avatar')}
    <h1>${greet}! Ich bin ${escapeHtml(a.name)}.</h1>
    <p>Wie kann ich dir heute helfen?</p>
    <div class="suggestions">${sug.map(([t, s, p]) => `<button class="suggestion" data-suggest="${escapeHtml(p)}"><strong>${t}</strong><span>${s}</span></button>`).join('')}</div></div>`;
}

function attachmentsHtml(m) {
  const imgs = (m.images || []).map((b64) => `<img src="data:image/png;base64,${b64}" alt="Bild" data-zoom>`).join('');
  const files = (m.files || []).filter((f) => f.kind === 'text').map((f) => fileChip(f)).join('');
  return imgs || files ? `<div class="msg-attachments">${imgs}${files}</div>` : '';
}
const fileChip = (f) => `<div class="file-chip"><div class="fc-icon">${icon('file')}</div><div class="fc-text"><span class="fc-name">${escapeHtml(f.name)}</span><span class="fc-size">${formatBytes(f.size)}${f.truncated ? ' · gekürzt' : ''}</span></div></div>`;

function messageHtml(m, i, chat, isLastAi) {
  if (m.role === 'user') {
    return `<div class="msg user" id="m-${m.id}" data-id="${m.id}"><div class="msg-col">${attachmentsHtml(m)}
      ${m.content ? `<div class="bubble">${escapeHtml(m.content)}</div>` : ''}
      <div class="msg-actions">
        <button class="icon-btn" data-action="copy" title="Kopieren">${icon('copy')}</button>
        <button class="icon-btn" data-action="edit" title="Bearbeiten">${icon('edit')}</button>
      </div></div></div>`;
  }
  if (m.role === 'tool') return toolHtml(m);

  const streaming = busy?.msgId === m.id;
  const parts = splitThink(m.content);
  const think = shown(m, parts.think, false);
  const text = shown(m, parts.text);
  const thinking = shown(m, m.thinking || '', false) + (think ? (m.thinking ? '\n' : '') + think : '');
  // Reine Werkzeugaufrufe ohne Text nicht als leere Blase anzeigen
  if (!streaming && !text.trim() && !thinking && !m.error && m.tool_calls?.length) return '';
  const a = getAssistant(m.assistantId);
  const sources = collectSources(chat, i);
  return `<div class="msg ai ${isLastAi ? 'last' : ''}" id="m-${m.id}" data-id="${m.id}">${avatarHtml(a, 'msg-avatar')}
    <div class="msg-main">
      <div class="msg-name">${escapeHtml(a.name)} <span class="model-tag">${escapeHtml(m.model || '')}</span>${m.skills?.length ? `<span class="skill-tag" title="Genutzte Skills">${escapeHtml(m.skills.join(', '))}</span>` : ''}${streaming ? '<span class="model-tag live-meta" data-ti></span>' : ''}</div>
      <div class="msg-body">${thinkingHtml(thinking, streaming && !text)}<div class="md">${bodyHtml(text, streaming, m)}</div></div>
      ${sources.length ? sourcesHtml(sources) : ''}
      ${!streaming && m.content ? linkPreviewsHtml(m.content, sources) : ''}
      ${streaming ? '' : `<div class="msg-actions">
        <button class="icon-btn" data-action="copy" title="Kopieren">${icon('copy')}</button>
        <button class="icon-btn" data-action="speak" title="Vorlesen">${icon(speaker.currentId === m.id ? 'volumeOff' : 'volume')}</button>
        <button class="icon-btn" data-action="regen" title="Neu generieren">${icon('refresh')}</button>
        ${m.stats ? `<span class="msg-stats">${statsText(m.stats)}</span>` : ''}
      </div>`}
    </div></div>`;
}

function bodyHtml(text, streaming, m) {
  if (m.error) return `${text ? renderMarkdown(text) : ''}<div class="banner error" style="margin-top:6px"><div class="b-icon">${icon('x')}</div><div class="b-text"><strong>Fehler</strong><span>${escapeHtml(m.error)}</span></div></div>`;
  if (streaming && !text.trim()) return thinkIndicator(m.thinking ? 'Denkt nach' : 'Überlegt');
  let html = renderMarkdown(text);
  if (m.reusedCode && !streaming) html += `<p class="reuse-note">${icon('copy')} Code ${m.reusedCode} aus dem Chat übernommen – nicht neu geschrieben</p>`;
  if (m.stopped) html += '<p style="color:var(--text-faint);font-size:13px">Gestoppt</p>';
  return streaming ? html.replace(/(<\/p>|<\/li>)(?![\s\S]*(<\/p>|<\/li>))/, '<span class="cursor"></span>$1') : html;
}

function thinkIndicator(label) {
  const dots = Array.from({ length: 8 }, (_, i) => `<i style="--i:${i}"></i>`).join('');
  return `<div class="think-ind"><span class="ti-dots" aria-hidden="true">${dots}</span><span class="ti-label">${label}</span><span class="ti-meta" data-ti></span></div>`;
}

function thinkingHtml(thinking, active) {
  if (!thinking) return '';
  return `<details class="thinking"${active ? ' open' : ''}><summary>${active ? '<span class="ti-label">Denkt nach</span>' : 'Gedankengang anzeigen'}</summary><div class="think-body">${escapeHtml(thinking)}</div></details>`;
}

function statsText(s) {
  const parts = [];
  if (s.eval_count && s.eval_duration) parts.push(`${(s.eval_count / (s.eval_duration / 1e9)).toFixed(1)} Token/s`);
  if (s.total_duration) parts.push(`${(s.total_duration / 1e9).toFixed(1)} s`);
  if (s.prompt_eval_count || s.eval_count) parts.push(`${fmtTokens((s.prompt_eval_count || 0) + (s.eval_count || 0))} Tokens`);
  return parts.join(' · ');
}

function collectSources(chat, i) {
  const out = [];
  for (let k = i - 1; k >= 0; k--) {
    const m = chat.messages[k];
    if (m.role === 'user') break;
    if (m.role === 'tool' && m.sources) out.push(...m.sources);
  }
  const seen = new Set();
  return out.filter((s) => !seen.has(s.url) && seen.add(s.url)).slice(0, 8);
}

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
const ytId = (url) => String(url).match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/)?.[1] || '';

// Große Vorschau-Karte: Video (Vorschaubild + Titel + Kanal) oder Webseite (Bild + Titel + Beschreibung)
function previewCard(p) {
  const vid = p.videoId || ytId(p.url);
  const img = p.image || (vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : '');
  const meta = vid ? [p.channel, p.published, p.views].filter(Boolean).join(' · ') : (p.site || hostOf(p.url));
  return `<a class="pcard ${vid ? 'video' : ''}" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer"${p.hydrate ? ` data-preview-url="${escapeHtml(p.url)}"` : ''}>
    ${img ? `<span class="pc-img"><img src="${escapeHtml(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()">${vid ? `<span class="pc-play">${icon('play')}</span>` : ''}</span>` : ''}
    <span class="pc-text"><span class="pc-title">${escapeHtml(p.title || hostOf(p.url))}</span>
    ${!vid && p.description ? `<span class="pc-desc">${escapeHtml(p.description)}</span>` : ''}
    <span class="pc-meta">${vid ? `<b class="pc-yt">YouTube</b> ` : `${icon('globe')} `}${escapeHtml(meta)}</span></span></a>`;
}

function sourcesHtml(sources) {
  // Videos und Seiten mit Bild als Karten, der Rest als kleine Links
  const cards = sources.filter((s) => s.type === 'video' || ytId(s.url) || s.image).slice(0, 6);
  const chips = sources.filter((s) => !cards.includes(s));
  return `${cards.length ? `<div class="pcards">${cards.map(previewCard).join('')}</div>` : ''}
    ${chips.length ? `<div class="sources">${chips.map((s) => `<a class="source-chip" href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(s.title)}">${icon('globe')}<span>${escapeHtml(hostOf(s.url) || s.title)}</span></a>`).join('')}</div>` : ''}`;
}

// YouTube-Links in der Antwort bekommen automatisch eine Vorschau
function linkPreviewsHtml(text, sources) {
  const known = new Set(sources.map((s) => ytId(s.url)).filter(Boolean));
  const ids = [...new Set([...String(text).matchAll(/https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[\w-]{11}[^\s)\]"]*/g)].map((m) => m[0]))]
    .filter((u) => !known.has(ytId(u))).slice(0, 4);
  return ids.length ? `<div class="pcards">${ids.map((u) => previewCard({ url: u, title: 'YouTube-Video', hydrate: true })).join('')}</div>` : '';
}

const previewCache = new Map();
function hydratePreviews(root = el.inner) {
  root.querySelectorAll('[data-preview-url]').forEach(async (card) => {
    const url = card.dataset.previewUrl;
    card.removeAttribute('data-preview-url');
    try {
      if (!previewCache.has(url)) previewCache.set(url, web.preview(url));
      const p = await previewCache.get(url);
      card.outerHTML = previewCard(p);
    } catch { /* bleibt einfache Karte */ }
  });
}

const STATUS_TEXT = { pending: 'Wartet auf Erlaubnis', running: 'Läuft …', done: 'Erledigt', error: 'Fehler', denied: 'Abgelehnt', cancelled: 'Abgebrochen' };

function toolHtml(t) {
  const meta = TOOL_META[t.name] || { icon: 'zap', label: () => t.name };
  // Websuche läuft dezent im Hintergrund – nur eine kleine Zeile
  if (t.name === 'search_chats' || t.name === 'remember') {
    const running = t.status === 'running';
    const label = t.name === 'remember' ? `Gemerkt: ${escapeHtml(t.args?.fact || '')}` : `In früheren Chats nachgesehen${t.hits != null ? ` · ${t.hits} ${t.hits === 1 ? 'Stelle' : 'Stellen'}` : ''}`;
    return `<div class="msg tool" id="m-${t.id}" data-id="${t.id}"><span class="research ${running ? 'running' : ''}">${icon(running ? 'loader' : t.name === 'remember' ? 'save' : 'search')} ${running ? 'Erinnere mich …' : label}</span></div>`;
  }
  if (t.name === 'web_search' || t.name === 'fetch_webpage') {
    const running = t.status === 'running';
    const label = t.name === 'web_search' ? `Im Web recherchiert: „${escapeHtml(t.args?.query || '')}“` : `Webseite gelesen`;
    return `<div class="msg tool" id="m-${t.id}" data-id="${t.id}"><span class="research ${running ? 'running' : ''}">${icon(running ? 'loader' : 'globe')}
      ${running ? 'Recherchiere im Web …' : t.status === 'error' ? 'Websuche nicht möglich' : label}</span></div>`;
  }
  let body = '';
  const a = t.args || {};
  if (t.status === 'pending') {
    if (t.name === 'write_file') {
      body += `<details open><summary>Inhalt (${formatBytes(new Blob([a.content || '']).size)})</summary><pre>${escapeHtml(String(a.content || '').slice(0, 6000))}${String(a.content || '').length > 6000 ? '\n…' : ''}</pre></details>`;
      if (t.exists) body += `<div class="tool-warn">⚠ Datei existiert bereits und wird überschrieben.</div>`;
    }
    if (t.name === 'run_command') body += `<pre>${escapeHtml(a.command || '')}</pre>${a.cwd ? `<div class="progress-text">Ordner: ${escapeHtml(a.cwd)}</div>` : ''}`;
    if (t.name === 'delete_model') body += `<div class="tool-warn">Das Modell wird von deinem Rechner gelöscht.</div>`;
    body += `<div class="tool-actions">
      <button class="btn btn-sm btn-primary" data-approve="${t.id}">${icon('check')} Erlauben</button>
      <button class="btn btn-sm" data-deny="${t.id}">Ablehnen</button>
      <button class="btn btn-sm btn-ghost" data-approve-chat="${t.id}" title="In diesem Chat nicht mehr nachfragen">Immer erlauben (dieser Chat)</button></div>`;
  } else if (t.status === 'running') {
    body += `${progressHtml(t.progress?.pct ?? null)}<div class="progress-text">${escapeHtml(t.progress?.text || 'Läuft …')}</div>`;
  } else if (t.display) {
    const long = t.display.length > 200 || t.display.includes('\n');
    body += long ? `<details><summary>Ergebnis anzeigen</summary><pre>${escapeHtml(t.display.slice(0, 20000))}</pre></details>` : `<div class="progress-text" style="font-size:13px">${escapeHtml(t.display)}</div>`;
    if (t.path && t.status === 'done') body += `<div class="tool-actions"><button class="btn btn-sm" data-open-path="${escapeHtml(t.path)}">${icon('external')} Öffnen</button></div>`;
  }
  const failed = t.status === 'done' && t.failedRun;
  return `<div class="msg tool" id="m-${t.id}" data-id="${t.id}"><div class="tool-card ${t.status}" style="flex:1">
    <div class="tool-head"><div class="t-icon">${icon(meta.icon)}</div><div class="t-label" title="${escapeHtml(meta.label(a))}">${escapeHtml(meta.label(a))}</div>
    ${t.reused ? '<span class="badge accent" title="Vorhandener Code wurde übernommen statt neu geschrieben">übernommener Code</span>' : ''}<span class="tool-status ${failed ? 'error' : t.status}">${failed ? 'Mit Fehler beendet' : STATUS_TEXT[t.status] || t.status}</span></div>
    ${body ? `<div class="tool-body">${body}</div>` : ''}</div></div>`;
}

function updateMessageEl(m) {
  const chat = currentChat();
  if (!chat || !chat.messages.includes(m)) return;
  const node = document.getElementById(`m-${m.id}`);
  if (!node) { renderMessages(); return; }
  const i = chat.messages.indexOf(m);
  const lastAi = [...chat.messages].reverse().find((x) => x.role === 'assistant');
  const html = messageHtml(m, i, chat, m === lastAi);
  if (!html) { node.remove(); return; }
  // Offenen Gedankengang beim Aktualisieren erhalten
  const wasOpen = node.querySelector('details.thinking')?.open;
  const scrolls = saveCodeScroll(node.parentNode);
  node.outerHTML = html;
  restoreCodeScroll(el.inner, scrolls);
  hydratePreviews();
  if (wasOpen != null) {
    const d = document.querySelector(`#m-${m.id} details.thinking`);
    if (d) d.open = wasOpen;
  }
}

// Streaming flüssig darstellen (max. 1x pro Frame)
let rafPending = false;
function scheduleStreamRender(m) {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    const node = document.getElementById(`m-${m.id}`);
    if (!node) { if (currentChat()?.messages.includes(m)) renderMessages(); return; }
    if (busy?.msgId !== m.id) { updateMessageEl(m); return; } // Streaming schon beendet
    const parts = splitThink(m.content);
    const text = shown(m, parts.text);
    const thinking = shown(m, (m.thinking || '') + (parts.think ? '\n' + parts.think : ''), false);
    const body = node.querySelector('.msg-body');
    let det = body.querySelector('details.thinking');
    if (thinking && !det) {
      body.insertAdjacentHTML('afterbegin', thinkingHtml(thinking, !text));
    } else if (det) {
      det.querySelector('.think-body').textContent = thinking;
      // Nur bei echtem Wechsel neu setzen – sonst startet die Animation bei jedem Wort neu
      const sum = det.querySelector('summary');
      const want = text ? 'done' : 'active';
      if (sum.dataset.state !== want) {
        sum.dataset.state = want;
        sum.innerHTML = text ? 'Gedankengang anzeigen' : '<span class="ti-label">Denkt nach</span>';
      }
      if (text && det.dataset.auto !== 'done') { det.open = false; det.dataset.auto = 'done'; }
    }
    // Nur Geändertes aktualisieren – so bleiben Scroll-Positionen (z. B. im Code-Fenster) erhalten
    patchChildren(node.querySelector('.md'), bodyHtml(text, true, m));
    scrollToBottom();
  });
}

function patchChildren(parent, html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const next = [...tpl.content.childNodes];
  const cur = [...parent.childNodes];
  next.forEach((n, i) => {
    const c = cur[i];
    if (!c) { parent.appendChild(n); return; }
    if (c.isEqualNode(n)) return;
    // Denk-Anzeige behalten (Animation läuft weiter), nur den Text anpassen
    if (c.nodeType === 1 && n.nodeType === 1 && c.classList.contains('think-ind') && n.classList.contains('think-ind')) {
      const a = c.querySelector('.ti-label');
      const b = n.querySelector('.ti-label');
      if (a && b && a.textContent !== b.textContent) a.textContent = b.textContent;
      return;
    }
    if (c.nodeType === 1 && n.nodeType === 1 && c.classList.contains('code-block') && n.classList.contains('code-block')) {
      updateCodeBlock(c, n);
      return;
    }
    parent.replaceChild(n, c);
  });
  for (let i = next.length; i < cur.length; i++) cur[i].remove();
}

// Code-Block an Ort und Stelle weiterschreiben: unten -> mitlaufen, sonst Position halten
function updateCodeBlock(c, n) {
  c.className = n.className;
  for (const a of ['data-path', 'data-lang']) {
    if (n.hasAttribute(a)) c.setAttribute(a, n.getAttribute(a)); else c.removeAttribute(a);
  }
  const ch = c.querySelector('.code-head > span');
  const nh = n.querySelector('.code-head > span');
  if (ch && nh && ch.innerHTML !== nh.innerHTML) ch.innerHTML = nh.innerHTML;
  const pre = c.querySelector('pre');
  const code = c.querySelector('code');
  const text = n.querySelector('code').textContent;
  if (!pre || !code) { c.replaceWith(n); return; }
  const atBottom = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 24;
  const left = pre.scrollLeft;
  if (code.textContent !== text) code.textContent = text;
  if (atBottom) pre.scrollTop = pre.scrollHeight;
  pre.scrollLeft = left;
}

// Scroll-Positionen der Code-Fenster über ein Neuzeichnen hinweg merken
function saveCodeScroll(root) {
  const map = new Map();
  root.querySelectorAll('[data-id]').forEach((msgEl) => {
    msgEl.querySelectorAll('.code-block pre').forEach((pre, i) => {
      if (pre.scrollTop || pre.scrollLeft) map.set(`${msgEl.dataset.id}:${i}`, [pre.scrollTop, pre.scrollLeft]);
    });
  });
  return map;
}
function restoreCodeScroll(root, map) {
  if (!map.size) return;
  root.querySelectorAll('[data-id]').forEach((msgEl) => {
    msgEl.querySelectorAll('.code-block pre').forEach((pre, i) => {
      const v = map.get(`${msgEl.dataset.id}:${i}`);
      if (v) { pre.scrollTop = v[0]; pre.scrollLeft = v[1]; }
    });
  });
}

// Mitlaufen beim Schreiben: hört auf, sobald du hochscrollst, und geht unten wieder weiter
let followStream = true;
let lastScrollTop = 0;
el.messages.addEventListener('scroll', () => {
  const sc = el.messages;
  const atBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 40;
  if (atBottom) followStream = true;
  else if (sc.scrollTop < lastScrollTop - 2) followStream = false;
  lastScrollTop = sc.scrollTop;
}, { passive: true });
el.messages.addEventListener('wheel', (e) => { if (e.deltaY < 0) followStream = false; }, { passive: true });
el.messages.addEventListener('touchmove', () => { followStream = false; }, { passive: true });
el.messages.addEventListener('keydown', (e) => { if (['ArrowUp', 'PageUp', 'Home'].includes(e.key)) followStream = false; });

function scrollToBottom(force = false) {
  if (force) followStream = true;
  if (!followStream) return;
  el.messages.scrollTop = el.messages.scrollHeight;
  lastScrollTop = el.messages.scrollTop;
}

// Klicks in Nachrichten
el.inner.addEventListener('click', async (e) => {
  const sug = e.target.closest('[data-suggest]');
  if (sug) { el.input.value = sug.dataset.suggest; autoGrow(); el.input.focus(); return; }

  const zoom = e.target.closest('[data-zoom]');
  if (zoom) {
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = `<img src="${zoom.src}" alt="">`;
    lb.onclick = () => lb.remove();
    document.body.appendChild(lb);
    return;
  }

  const copyCode = e.target.closest('[data-copy-code]');
  if (copyCode) {
    copyText(copyCode.closest('.code-block').querySelector('code').textContent);
    copyCode.textContent = 'Kopiert ✓';
    setTimeout(() => { copyCode.textContent = 'Kopieren'; }, 1500);
    return;
  }

  const pvBtn = e.target.closest('[data-preview-code]');
  if (pvBtn) {
    const block = pvBtn.closest('.code-block');
    const msgId = pvBtn.closest('[data-id]')?.dataset.id;
    const chat = currentChat();
    const m = chat?.messages.find((x) => x.id === msgId);
    const idx = [...pvBtn.closest('.md').querySelectorAll('.code-block')].indexOf(block);
    openPreviewFor(chat, m, idx, true);
    return;
  }

  const saveCode = e.target.closest('[data-save-code]');
  if (saveCode) { saveCodeBlock(saveCode.closest('.code-block')); return; }

  const openPath = e.target.closest('[data-open-path]');
  if (openPath) { localFs.open(openPath.dataset.openPath).catch((err) => toast(err.message, 'error')); return; }

  for (const [attr, value] of [['approve', 'once'], ['approveChat', 'chat'], ['deny', false]]) {
    const b = e.target.closest(`[data-${attr.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}]`);
    if (b) {
      const id = b.dataset[attr];
      if (value === 'chat') { const chat = currentChat(); if (chat) { chat.autoApprove = true; persist(chat); } }
      approvals.get(id)?.(value !== false);
      return;
    }
  }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const msgEl = btn.closest('[data-id]');
  const chat = currentChat();
  const m = chat?.messages.find((x) => x.id === msgEl?.dataset.id);
  if (!m) return;
  const action = btn.dataset.action;
  if (action === 'copy') copyText(m.role === 'assistant' ? splitThink(m.content).text.trim() : m.content);
  if (action === 'speak') {
    if (speaker.currentId === m.id) speaker.stop();
    else speaker.speak(splitThink(m.content).text, m.id);
  }
  if (action === 'regen') regenerate(chat, m);
  if (action === 'edit') startEdit(chat, m, msgEl);
});

async function saveCodeBlock(block) {
  const code = block.querySelector('code').textContent;
  const extMap = { javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts', python: 'py', py: 'py', html: 'html', css: 'css', json: 'json', bash: 'sh', sh: 'sh', shell: 'sh', powershell: 'ps1', batch: 'bat', bat: 'bat', cmd: 'bat', java: 'java', c: 'c', cpp: 'cpp', csharp: 'cs', cs: 'cs', go: 'go', rust: 'rs', php: 'php', ruby: 'rb', sql: 'sql', markdown: 'md', md: 'md', yaml: 'yml', yml: 'yml', xml: 'xml', jsx: 'jsx', tsx: 'tsx' };
  const lang = (block.dataset.lang || '').toLowerCase();
  const suggested = block.dataset.path || `Desktop/KI-Projekte/datei.${extMap[lang] || 'txt'}`;
  const p = await promptDialog('Code als Datei speichern', suggested, { label: 'Speicherort', hint: 'Relative Pfade landen auf dem Desktop. Ordner werden automatisch angelegt.' });
  if (!p) return;
  try {
    const r = await localFs.write(p, code.endsWith('\n') ? code : code + '\n');
    toast(`Gespeichert: ${r.path}`);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function startEdit(chat, m, msgEl) {
  if (busy) return toast('Bitte warte, bis die Antwort fertig ist.');
  const col = msgEl.querySelector('.msg-col');
  col.innerHTML = `<div class="edit-box"><textarea>${escapeHtml(m.content)}</textarea>
    <div class="edit-actions"><button class="btn btn-sm" data-edit-cancel>Abbrechen</button><button class="btn btn-sm btn-primary" data-edit-save>Senden</button></div></div>`;
  const ta = col.querySelector('textarea');
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
  col.querySelector('[data-edit-cancel]').onclick = () => renderMessages();
  col.querySelector('[data-edit-save]').onclick = () => {
    const text = ta.value.trim();
    if (!text && !m.images?.length) return;
    m.content = text;
    chat.messages = chat.messages.slice(0, chat.messages.indexOf(m) + 1);
    persist(chat);
    renderMessages();
    generate(chat);
  };
}

function regenerate(chat, m) {
  if (busy) return;
  const idx = chat.messages.indexOf(m);
  let u = idx;
  while (u >= 0 && chat.messages[u].role !== 'user') u--;
  if (u < 0) return;
  chat.messages = chat.messages.slice(0, u + 1);
  persist(chat);
  renderMessages();
  generate(chat);
}

// ---------------------------------------------------------------------------
// Eingabe & Anhänge
// ---------------------------------------------------------------------------
function autoGrow() {
  el.input.style.height = 'auto';
  el.input.style.height = Math.min(el.input.scrollHeight, 240) + 'px';
  updateComposer();
}
el.input.addEventListener('input', autoGrow);
el.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && (settings.sendOnEnter || e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    send();
  }
});
el.composer.addEventListener('submit', (e) => {
  e.preventDefault();
  if (busy && busy.chatId === currentChatId) stop();
  else send();
});

function updateComposer() {
  const chat = currentChat();
  const isBusy = !!busy && !!chat && busy.chatId === chat.id;
  el.sendBtn.classList.toggle('stop', isBusy);
  el.sendBtn.innerHTML = icon(isBusy ? 'stop' : 'send');
  el.sendBtn.title = isBusy ? 'Stoppen (Esc)' : 'Senden (Enter)';
  const hasContent = el.input.value.trim() || pending.some((p) => !p.loading);
  el.sendBtn.disabled = !isBusy && (!hasContent || !!busy);
  const model = chat ? chat.model : draft.model;
  el.hint.textContent = busy && !isBusy ? 'Ein anderer Chat antwortet gerade …' : model ? '' : online ? 'Bitte zuerst ein Modell laden' : '';
}

function renderAttachments() {
  el.attachments.innerHTML = pending.map((p, i) => p.kind === 'image'
    ? `<div class="att"><img src="${p.dataUrl}" alt=""><button type="button" class="att-x" data-remove="${i}">✕</button></div>`
    : `<div class="att ${p.loading ? 'loading' : ''}">${p.loading ? `<div class="file-chip"><div class="fc-icon">${icon('loader')}</div><div class="fc-text"><span class="fc-name">${escapeHtml(p.name)}</span><span class="fc-size">Wird gelesen …</span></div></div>` : fileChip(p)}<button type="button" class="att-x" data-remove="${i}">✕</button></div>`).join('');
  updateComposer();
}
el.attachments.addEventListener('click', (e) => {
  const b = e.target.closest('[data-remove]');
  if (b) { pending.splice(+b.dataset.remove, 1); renderAttachments(); }
});

async function addFiles(files) {
  for (const file of files) {
    const placeholder = { kind: 'text', name: file.name, size: file.size, loading: true };
    pending.push(placeholder);
    renderAttachments();
    try {
      const att = await readAttachment(file);
      pending[pending.indexOf(placeholder)] = att;
    } catch (err) {
      pending.splice(pending.indexOf(placeholder), 1);
      toast(err.message, 'error');
    }
    renderAttachments();
  }
}

$('#attachBtn').addEventListener('click', () => el.fileInput.click());
el.fileInput.addEventListener('change', () => { addFiles([...el.fileInput.files]); el.fileInput.value = ''; });
el.input.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])];
  if (files.length) { e.preventDefault(); addFiles(files); }
});

let dragDepth = 0;
const dropOverlay = $('#dropOverlay');
window.addEventListener('dragenter', (e) => {
  if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
  dragDepth++;
  dropOverlay.classList.add('show');
});
window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) dropOverlay.classList.remove('show'); });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  dropOverlay.classList.remove('show');
  if (e.dataTransfer?.files?.length) addFiles([...e.dataTransfer.files]);
});

// Spracheingabe
const micBtn = $('#micBtn');
let dictBase = '';
let dictFinal = '';
const dictation = new Dictation((finalText, interim) => {
  dictFinal += finalText;
  el.input.value = dictBase + dictFinal + interim;
  autoGrow();
}, (active, err) => {
  micBtn.classList.toggle('recording', active);
  if (err && err !== 'no-speech' && err !== 'aborted') toast(err === 'not-allowed' ? 'Mikrofon-Zugriff wurde verweigert.' : `Spracheingabe: ${err}`, 'error');
});
micBtn.addEventListener('click', () => {
  if (!dictation.supported) return toast('Spracheingabe wird von diesem Browser nicht unterstützt (am besten Chrome oder Edge).', 'error');
  if (!dictation.active) {
    dictBase = el.input.value ? el.input.value.replace(/\s*$/, ' ') : '';
    dictFinal = '';
  }
  dictation.toggle();
});

// ---------------------------------------------------------------------------
// Senden & Generieren
// ---------------------------------------------------------------------------
async function send() {
  if (busy) {
    toast(busy.chatId === currentChatId ? 'Die KI antwortet noch – Esc oder ■ zum Stoppen.' : 'Ein anderer Chat antwortet gerade.');
    return;
  }
  if (pending.some((p) => p.loading)) return toast('Anhänge werden noch gelesen …');
  const text = el.input.value.trim();
  if (!text && !pending.length) return;
  let chat = currentChat();
  const model = chat ? chat.model : draft.model;
  if (!online) return toast('Ollama ist nicht verbunden.', 'error');
  if (!model) { toast('Bitte zuerst ein Modell herunterladen.', 'error'); openModels(); return; }
  if (dictation.active) dictation.abort(); // sonst schreibt das Diktat den Text nachträglich wieder ins Feld
  dictBase = '';
  dictFinal = '';

  if (!chat) {
    chat = {
      id: uid(), title: 'Neuer Chat', assistantId: draft.assistantId, model, messages: [],
      createdAt: Date.now(), updatedAt: Date.now(), pinned: false,
    };
    chats.push(chat);
    currentChatId = chat.id;
  }
  const images = pending.filter((p) => p.kind === 'image');
  const files = pending.filter((p) => p.kind === 'text').map(({ kind, name, size, text: t, truncated }) => ({ kind, name, size, text: t, truncated }));
  chat.messages.push({ id: uid(), role: 'user', content: text, images: images.map((p) => p.base64), files, createdAt: Date.now() });
  if (chat.title === 'Neuer Chat') chat.title = (text || files[0]?.name || 'Bild').replace(/\s+/g, ' ').slice(0, 48);
  chat.updatedAt = Date.now();
  pending = [];
  el.input.value = '';
  autoGrow();
  renderAttachments();
  renderSidebar();
  renderMessages();
  scrollToBottom(true);
  persist(chat, true);
  generate(chat);
}

function stop() {
  busy?.controller.abort();
}

const INFO_TOOLS = new Set(['web_search', 'fetch_webpage', 'run_command', 'read_file', 'list_directory', 'list_models', 'running_models']);

async function generate(chat) {
  if (busy) return;
  const controller = new AbortController();
  busy = { chatId: chat.id, controller, msgId: null };
  updateComposer();
  renderSidebar();
  const isFirst = chat.messages.filter((m) => m.role === 'user').length === 1;
  // Merkt sich, was in dieser Antwort schon ausgeführt wurde (Schutz vor Endlosschleifen)
  const turn = { done: new Set() };
  await refreshSkills(); // neue/geänderte .skill-Dateien sofort nutzen
  try {
    const lastUser = [...chat.messages].reverse().find((m) => m.role === 'user');
    if (lastUser?.content && MEMORY_INTENT.test(lastUser.content) && chats.length > 1) {
      const act = { name: 'search_chats', args: { query: lastUser.content } };
      turn.done.add(`${act.name}:${JSON.stringify(act.args)}`);
      await runAction(chat, act, controller.signal);
    }
    // Klingt die Frage nach aktuellen Infos? Dann selbst suchen – auch Modelle ohne Werkzeuge bekommen echte Ergebnisse
    if (settings.webSearch && lastUser?.content && needsWeb(lastUser.content) && !controller.signal.aborted) {
      const act = { name: 'web_search', args: { query: makeQuery(lastUser.content) } };
      turn.done.add(`${act.name}:${JSON.stringify(act.args)}`);
      await runAction(chat, act, controller.signal);
    }
    for (let round = 0; round < 6; round++) {
      const again = await generateRound(chat, controller.signal, turn);
      if (!again || controller.signal.aborted) break;
    }
  } finally {
    // Offene Erlaubnis-Anfragen schließen
    for (const m of chat.messages) {
      if (m.role === 'tool' && (m.status === 'pending' || m.status === 'running')) {
        m.status = 'cancelled';
        approvals.get(m.id)?.(false);
      }
    }
    busy = null;
    chat.updatedAt = Date.now();
    persist(chat, true);
    if (currentChatId === chat.id) renderMessages();
    renderSidebar();
    updateComposer();
  }
  if (isFirst && settings.autoTitle) makeTitle(chat);
}

async function generateRound(chat, signal, turn = { done: new Set() }) {
  const assistant = getAssistant(chat.assistantId);
  const model = chat.model;
  const caps = await getCaps(model);
  const agentOn = settings.agent && assistant.agent !== false;
  const webOn = settings.webSearch;
  const wantsTools = true; // Gedächtnis-Werkzeuge gibt es immer
  const useTools = wantsTools && !noTools.has(model) && (!caps || caps.includes('tools'));
  const tools = !useTools ? null : TOOL_DEFS.filter((t) => {
    const n = t.function.name;
    if (n === 'web_search' || n === 'fetch_webpage') return webOn;
    if (n === 'search_chats' || n === 'remember') return true;
    return agentOn;
  });

  if (!sysInfo && agentOn) sysInfo = await localFs.info().catch(() => null);
  const lastUser = [...chat.messages].reverse().find((m) => m.role === 'user');
  const intent = wantsExecution(lastUser?.content);
  const activeSkills = selectSkills(skills, lastUser?.content, settings.disabledSkills);
  const codeBlocks = collectCodeBlocks(chat.messages);
  const reuseIntent = agentOn && codeBlocks.length && wantsReuse(lastUser?.content);
  const messages = [{ role: 'system', content: systemPrompt({ assistant, sys: sysInfo, nativeTools: useTools, agent: agentOn, webSearch: webOn, model, memory: settings.memory, recentChats: recentChatList(chat), skills: activeSkills, codeBlocks }) }];
  const vision = !caps || caps.includes('vision');
  let droppedImages = false;
  for (const m of chat.messages) {
    if (m.role === 'user') {
      const o = { role: 'user', content: buildContent(m.content, m.files) || '(Bild)' };
      if (m.images?.length) { if (vision) o.images = m.images; else droppedImages = true; }
      messages.push(o);
    } else if (m.role === 'assistant') {
      if (m.error && !m.content) continue;
      const o = { role: 'assistant', content: splitThink(m.content).text };
      if (useTools && m.tool_calls?.length) o.tool_calls = m.tool_calls;
      else if (m.tool_calls?.length && !o.content) continue;
      messages.push(o);
    } else if (m.role === 'tool') {
      const content = m.output || STATUS_TEXT[m.status] || '';
      if (useTools && m.native) messages.push({ role: 'tool', content, tool_name: m.name });
      else if (m.name === 'search_chats' || m.name === 'web_search') messages.push({ role: 'user', content: `[${m.name === 'web_search' ? 'Ergebnis der Websuche' : 'Erinnerungen aus früheren Chats'}]\n${content}` });
      else {
        messages.push({ role: 'user', content: `[Echtes Ergebnis der Aktion „${(TOOL_META[m.name]?.label(m.args || {})) || m.name}“]\n${content}\n\n(Diese Aktion ist erledigt – wiederhole sie NICHT. Antworte dem Nutzer jetzt mit dem echten Ergebnis oder mache einen neuen, anderen Schritt.)` });
      }
    }
  }
  // Unsichtbarer Sprach-Hinweis direkt an der letzten Nutzer-Nachricht (wirkt bei Qwen & Co. am zuverlässigsten)
  for (let k = messages.length - 1; k > 0; k--) {
    if (messages[k].role === 'user') {
      const translate = /(übersetz|translate|auf (englisch|spanisch|französisch|italienisch|türkisch|polnisch|russisch|arabisch|deutsch)|wie sagt man)/i.test(lastUser?.content || '');
      const reminder = translate
        ? '\n\n(Die Übersetzung selbst in der gewünschten Zielsprache, deine Erklärungen auf Deutsch – keine chinesischen Schriftzeichen, außer Chinesisch ist die Zielsprache.)'
        : LANGUAGE_REMINDER[detectLanguage(lastUser?.content)];
      messages[k] = { ...messages[k], content: messages[k].content + reminder };
      break;
    }
  }
  if (droppedImages && !chat.warnedVision) {
    chat.warnedVision = true;
    toast(`${model} kann keine Bilder sehen – nimm z. B. gemma3 oder llava.`, 'error');
  }

  const msg = { id: uid(), role: 'assistant', lang: /[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/.test(lastUser?.content || '') ? 'other' : 'de', content: '', thinking: '', assistantId: assistant.id, model, createdAt: Date.now(), skills: activeSkills.filter((x) => !x.always).map((x) => x.name) };
  chat.messages.push(msg);
  busy.msgId = msg.id;
  if (currentChatId === chat.id) { renderMessages(); scrollToBottom(); }

  const body = { model, messages, keep_alive: '30m', options: { temperature: Number(assistant.temperature ?? 0.7) } };
  if (Number(assistant.numCtx) > 0) body.options.num_ctx = Number(assistant.numCtx);
  if (tools) body.tools = tools;
  if (settings.think && caps?.includes('thinking') && !noThink.has(model)) body.think = true;

  const auto = settings.tts.auto && speaker.supported;
  if (auto) speaker.beginStream(msg.id);
  const toolCalls = [];
  // Eigener Abbruch pro Runde: Nach einem Befehl-/Such-Block wird sofort angehalten,
  // damit die KI kein Ergebnis erfindet, sondern auf das echte wartet.
  const roundCtrl = new AbortController();
  const onAbort = () => roundCtrl.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    for await (const ev of ollama.chat(body, roundCtrl.signal)) {
      if (ev.message?.content) msg.content += ev.message.content;
      if (ev.message?.thinking) msg.thinking += ev.message.thinking;
      if (ev.message?.content || ev.message?.thinking) msg.liveTokens = (msg.liveTokens || 0) + 1;
      if (ev.message?.tool_calls?.length) toolCalls.push(...ev.message.tool_calls);
      if (ev.done) {
        msg.stats = { eval_count: ev.eval_count, eval_duration: ev.eval_duration, total_duration: ev.total_duration, prompt_eval_count: ev.prompt_eval_count };
        countTokens(chat, (ev.prompt_eval_count || 0) + (ev.eval_count || 0));
        msg.liveTokens = 0;
      }
      // Schreibt die KI vorhandenen Code nur ab? Dann abbrechen und den fertigen Code übernehmen
      if (reuseIntent && !toolCalls.length) {
        const { text } = splitThink(msg.content);
        const rw = detectRewrite(text, codeBlocks);
        if (rw) {
          const off = msg.content.length - text.length;
          msg.content = `${msg.content.slice(0, off + rw.start)}${rw.code}\n\`\`\``;
          msg.reusedCode = rw.n;
          roundCtrl.abort();
          if (currentChatId === chat.id) scheduleStreamRender(msg);
          break;
        }
      }
      if (!toolCalls.length && (agentOn || webOn)) {
        const { text } = splitThink(msg.content);
        const end = findStopBlock(text, { agent: agentOn, webSearch: webOn, intent });
        if (end > 0) {
          msg.content = msg.content.slice(0, msg.content.length - text.length + end);
          roundCtrl.abort();
          if (currentChatId === chat.id) scheduleStreamRender(msg);
          break;
        }
      }
      if (currentChatId === chat.id) scheduleStreamRender(msg);
      if (/```/.test(msg.content)) livePreview(chat, msg);
      if (auto) speaker.feed(splitThink(msg.content).text);
      persist(chat);
    }
    if (auto) speaker.feed(splitThink(msg.content).text, true);
  } catch (err) {
    if (err.name === 'AbortError' && !signal.aborted) {
      // Selbst angehalten, weil eine Aktion gefunden wurde – kein Fehler
    } else if (err.name === 'AbortError') {
      msg.stopped = true;
      busy.msgId = null;
      return false;
    } else if (/does not support tools/i.test(err.message) && !noTools.has(model)) {
      // Modell kann keine Tools/Thinking -> ohne erneut versuchen
      noTools.add(model);
      chat.messages.splice(chat.messages.indexOf(msg), 1);
      return true;
    } else if (/does not support think/i.test(err.message) && !noThink.has(model)) {
      noThink.add(model);
      chat.messages.splice(chat.messages.indexOf(msg), 1);
      return true;
    } else {
      msg.error = /not found/i.test(err.message) ? `Modell „${model}“ ist nicht installiert. Lade es unter „Modelle“ herunter.` : err.message;
      busy.msgId = null;
      return false;
    }
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
  busy.msgId = null;
  if (/```/.test(msg.content)) livePreview(chat, msg);
  if (toolCalls.length) msg.tool_calls = toolCalls;
  if (currentChatId === chat.id) updateMessageEl(msg);

  // Aktionen bestimmen: native Tool-Aufrufe oder Codeblöcke im Text
  let actions;
  if (toolCalls.length) {
    actions = toolCalls.map((tc) => {
      let args = tc.function?.arguments || {};
      if (typeof args === 'string') { try { args = JSON.parse(args); } catch { args = {}; } }
      return { name: tc.function?.name, args, native: true };
    });
  } else {
    actions = parseTextActions(splitThink(msg.content).text, { agent: agentOn, webSearch: webOn, intent, codeBlocks });
  }
  // Schon ausgeführte Aktionen nicht wiederholen
  const key = (a) => `${a.name}:${JSON.stringify(a.args || {})}`;
  actions = actions.filter((a) => !turn.done.has(key(a)));
  if (!actions.length) return false;

  let gotInfo = false;
  let anyRan = false;
  for (const act of actions) {
    if (signal.aborted) return false;
    turn.done.add(key(act));
    const ran = await runAction(chat, act, signal);
    if (ran) { anyRan = true; if (INFO_TOOLS.has(act.name)) gotInfo = true; }
  }
  // Native Tools: immer weiter (KI reagiert auf Ergebnisse). Text-Aktionen: nur wenn neue Infos da sind.
  // Nach übernommenem Code darf die KI weitermachen (z. B. die Datei öffnen)
  return toolCalls.length ? true : (gotInfo && anyRan) || (!!msg.reusedCode && anyRan);
}

async function runAction(chat, act, signal) {
  const t = { id: uid(), role: 'tool', name: act.name, args: act.args || {}, native: !!act.native, status: 'running', createdAt: Date.now(), reused: !!act.reused };
  if (t.name === 'write_file') {
    const ref = resolveCodeRef(t.args.content, t.args.path, collectCodeBlocks(chat.messages));
    if (ref != null) { t.args = { ...t.args, content: ref + '\n' }; t.reused = true; }
  }
  if (!TOOL_META[t.name]) {
    t.status = 'error';
    t.output = `Unbekanntes Werkzeug: ${t.name}`;
    t.display = t.output;
    chat.messages.push(t);
    if (currentChatId === chat.id) renderMessages();
    return false;
  }
  chat.messages.push(t);
  const show = () => { if (currentChatId === chat.id) { updateMessageEl(t); scrollToBottom(); } };

  if (needsApproval(t.name, settings.autoApprove) && !chat.autoApprove) {
    t.status = 'pending';
    if (t.name === 'write_file') {
      const st = await localFs.stat(t.args.path).catch(() => null);
      t.exists = st?.exists;
    }
    if (currentChatId === chat.id) { renderMessages(); scrollToBottom(); }
    const ok = await new Promise((resolve) => {
      approvals.set(t.id, resolve);
      signal.addEventListener('abort', () => resolve(false), { once: true });
    });
    approvals.delete(t.id);
    if (!ok) {
      t.status = signal.aborted ? 'cancelled' : 'denied';
      t.output = 'Der Nutzer hat diese Aktion abgelehnt.';
      show();
      return false;
    }
    t.status = 'running';
  }
  if (currentChatId === chat.id) { renderMessages(); scrollToBottom(); }

  try {
    let lastShow = 0;
    const r = await executeTool(t.name, t.args, {
      signal,
      searchEngine: settings.searchEngine,
      searchKeys: settings.searchKeys,
      visibleTerminal: settings.visibleTerminal,
      memory: { search: (q) => memory.search(q, { skip: [...chat.messages].reverse().find((m) => m.role === 'user') }), remember: (f) => memory.remember(f) },
      question: [...chat.messages].reverse().find((m) => m.role === 'user')?.content || '',
      progress: (text, pct) => {
        t.progress = { text, pct };
        if (Date.now() - lastShow > 200) { lastShow = Date.now(); show(); }
      },
    });
    Object.assign(t, { status: 'done', output: r.output, display: r.display, sources: r.sources, path: r.path, failedRun: !!r.failed, hits: r.hits });
    if (r.modelsChanged) refreshModels();
  } catch (err) {
    t.status = signal.aborted ? 'cancelled' : 'error';
    t.output = `Fehler: ${err.message}`;
    t.display = err.message;
  }
  delete t.progress;
  show();
  persist(chat);
  return t.status === 'done';
}

function countTokens(chat, n) {
  if (!n) return;
  chat.usage = (chat.usage || 0) + n;
  sessionTokens += n;
  renderStatus();
}

async function makeTitle(chat) {
  const first = chat.messages.find((m) => m.role === 'user');
  if (!first?.content) return;
  try {
    const r = await ollama.chatOnce({
      model: chat.model,
      messages: [
        { role: 'system', content: 'Du erstellst kurze Chat-Titel. Antworte NUR mit dem Titel: 2 bis 5 Wörter, ohne Anführungszeichen, ohne Punkt.' },
        { role: 'user', content: `Titel für diese Nachricht:\n\n${first.content.slice(0, 600)}` },
      ],
      think: false,
      keep_alive: '30m',
      // gleiche Kontextgröße wie im Chat, sonst lädt Ollama das Modell neu (langsam!)
      options: { temperature: 0.3, num_predict: 30, ...(Number(getAssistant(chat.assistantId).numCtx) > 0 ? { num_ctx: Number(getAssistant(chat.assistantId).numCtx) } : {}) },
    }).catch(async (e) => {
      if (/think/i.test(e.message)) {
        const ctx = Number(getAssistant(chat.assistantId).numCtx);
        return ollama.chatOnce({ model: chat.model, keep_alive: '30m', messages: [{ role: 'user', content: `Gib nur einen kurzen Titel (2-5 Wörter) für: ${first.content.slice(0, 600)}` }], options: { num_predict: 30, ...(ctx > 0 ? { num_ctx: ctx } : {}) } });
      }
      throw e;
    });
    let t = splitThink(r.message?.content || '').text.replace(/<\/?think>/g, '').trim().split('\n').filter(Boolean).pop() || '';
    t = t.replace(/^(titel|title)\s*:\s*/i, '').replace(/^["'„“*#\s]+|["'“”*.\s]+$/g, '').slice(0, 60);
    if (t.length > 1) {
      chat.title = t;
      persist(chat, true);
      renderSidebar();
    }
  } catch { /* Titel bleibt */ }
}

// ---------------------------------------------------------------------------
// Code-Vorschau rechts (wie ein Mini-Browser, Breite ziehbar)
// ---------------------------------------------------------------------------
const pv = { el: $('#preview'), frame: $('#pvFrame'), code: $('#pvCode'), title: $('#pvTitle'), msgId: null, idx: -1, tab: 'preview', src: '', lang: '', dismissed: new Set(), lastLoad: 0, timer: null };
const PREVIEWABLE = /^(html?|svg|xml)$/i;

// Codeblöcke einer Nachricht (auch der noch offene beim Schreiben)
function messageBlocks(content) {
  const out = [];
  const re = /```[ \t]*([^\n`]*)\n([\s\S]*?)(```|$)/g;
  let m;
  while ((m = re.exec(content))) {
    const info = m[1].trim();
    const file = info.match(/^(?:[\w+#.-]+\s+)?(?:datei|file)\s*[:=]\s*(.+)$/i);
    const path = file ? file[1].trim() : '';
    const lang = (path ? path.split('.').pop() : info.split(/\s+/)[0] || '').toLowerCase();
    out.push({ info, path, lang, code: m[2], open: !m[3] });
    if (!m[3]) break;
  }
  return out;
}

// HTML mit CSS/JS-Dateien aus dem Chat zusammensetzen (style.css / script.js werden eingebettet)
function bundleHtml(html, chat) {
  const files = new Map();
  for (const x of chat.messages) {
    if (x.role !== 'assistant' || !x.content) continue;
    for (const b of messageBlocks(splitThink(x.content).text)) if (b.path) files.set(b.path.split(/[\\/]/).pop().toLowerCase(), b.code);
  }
  return html
    .replace(/<link[^>]+href=["']([^"']+\.css)["'][^>]*>/gi, (t, href) => (files.has(href.split('/').pop().toLowerCase()) ? `<style>\n${files.get(href.split('/').pop().toLowerCase())}\n</style>` : t))
    .replace(/<script([^>]*)\ssrc=["']([^"']+\.js)["']([^>]*)>\s*<\/script>/gi, (t, a, src, b) => (files.has(src.split('/').pop().toLowerCase()) ? `<script${a}${b}>\n${files.get(src.split('/').pop().toLowerCase())}\n</script>` : t));
}

function setPreviewWidth(w) {
  // Der Chat behält immer mindestens 420 px
  const sidebarW = el.app.classList.contains('sidebar-hidden') || isMobile() ? 0 : el.sidebar.offsetWidth;
  const max = Math.max(320, innerWidth - sidebarW - 420);
  settings.previewWidth = Math.round(Math.min(max, Math.max(320, w)));
  el.app.style.setProperty('--pv-w', `${settings.previewWidth}px`);
}

function showPreviewTab(tab) {
  pv.tab = PREVIEWABLE.test(pv.lang) ? tab : 'code';
  $$('[data-pv-tab]').forEach((b) => {
    b.classList.toggle('on', b.dataset.pvTab === pv.tab);
    b.disabled = b.dataset.pvTab === 'preview' && !PREVIEWABLE.test(pv.lang);
  });
  pv.frame.hidden = pv.tab !== 'preview';
  pv.code.hidden = pv.tab !== 'code';
}

function loadPreviewFrame(force = false) {
  if (!PREVIEWABLE.test(pv.lang)) return;
  if (!force && pv.frame.dataset.src === pv.src) return;
  pv.frame.dataset.src = pv.src;
  // Die Vorschau ist abgeschottet (kein Zugriff aufs Dashboard). localStorage gibt es dort nicht –
  // damit Spiele mit Highscore usw. trotzdem laufen, bekommen sie einen Speicher im Arbeitsspeicher.
  const shim = '<script>(function(){function m(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}try{window.localStorage.length}catch(e){try{Object.defineProperty(window,"localStorage",{value:m(),configurable:true});Object.defineProperty(window,"sessionStorage",{value:m(),configurable:true})}catch(_){}}})();<\/script>';
  pv.frame.srcdoc = pv.lang === 'svg' ? `<body style="margin:0;display:grid;place-items:center;min-height:100vh">${pv.src}</body>` : shim + pv.src;
  pv.lastLoad = Date.now();
}

function openPreviewFor(chat, m, idx = -1, manual = false) {
  if (!chat || !m) return;
  const blocks = messageBlocks(shown(m, splitThink(m.content).text));
  if (!blocks.length) return;
  let b = blocks[idx];
  if (!b) b = [...blocks].reverse().find((x) => PREVIEWABLE.test(x.lang)) || blocks[blocks.length - 1];
  // @code-Verweis -> echter Code
  const ref = resolveCodeRef(b.code, b.path || `x.${b.lang}`, collectCodeBlocks(chat.messages.filter((x) => x !== m)));
  const code = ref ?? b.code;
  pv.msgId = m.id;
  pv.idx = blocks.indexOf(b);
  pv.lang = b.lang === 'htm' ? 'html' : b.lang;
  pv.src = pv.lang === 'html' ? bundleHtml(code, chat) : code;
  pv.title.textContent = b.path || (pv.lang ? `${pv.lang.toUpperCase()}-Code` : 'Code');
  pv.code.querySelector('code').textContent = code;
  if (manual) pv.dismissed.delete(m.id);
  if (pv.el.hidden) {
    pv.el.hidden = false;
    el.app.classList.add('with-preview');
    showPreviewTab(PREVIEWABLE.test(pv.lang) ? 'preview' : 'code');
  } else showPreviewTab(manual && PREVIEWABLE.test(pv.lang) ? 'preview' : pv.tab);
  // Beim Live-Schreiben nicht ständig neu laden (flackert) – höchstens alle 1,5 s
  if (manual || b.open === false || Date.now() - pv.lastLoad > 1500) loadPreviewFrame(manual);
  if (b.open) { clearTimeout(pv.timer); pv.timer = setTimeout(() => loadPreviewFrame(), 1600); }
}

function closePreview() {
  if (pv.msgId) pv.dismissed.add(pv.msgId);
  pv.el.hidden = true;
  el.app.classList.remove('with-preview');
  pv.frame.srcdoc = '';
  pv.frame.dataset.src = '';
}

// Während die KI HTML schreibt: Vorschau automatisch öffnen und live mitlaufen lassen
function livePreview(chat, m) {
  if (!settings.autoPreview || pv.dismissed.has(m.id) || currentChatId !== chat.id) return;
  const blocks = messageBlocks(splitThink(m.content).text);
  const html = blocks.find((b) => /^html?$/.test(b.lang) && (b.code.length > 200 || !b.open));
  if (!html) return;
  openPreviewFor(chat, m, blocks.indexOf(html));
}

pv.el.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-pv-tab]');
  if (tab && !tab.disabled) { showPreviewTab(tab.dataset.pvTab); if (pv.tab === 'preview') loadPreviewFrame(); return; }
  const act = e.target.closest('[data-pv]')?.dataset.pv;
  if (act === 'close') closePreview();
  if (act === 'reload') loadPreviewFrame(true);
  if (act === 'copy') copyText(pv.code.textContent);
  if (act === 'open') {
    const url = URL.createObjectURL(new Blob([pv.src], { type: PREVIEWABLE.test(pv.lang) ? (pv.lang === 'svg' ? 'image/svg+xml' : 'text/html') : 'text/plain' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
});

// Breite per Ziehen ändern
$('#pvResizer').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const handle = e.currentTarget;
  handle.setPointerCapture(e.pointerId);
  el.app.classList.add('pv-dragging');
  const move = (ev) => setPreviewWidth(innerWidth - ev.clientX);
  const up = () => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', up);
    el.app.classList.remove('pv-dragging');
    saveSettings();
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
});
$('#pvResizer').addEventListener('dblclick', () => { setPreviewWidth(560); saveSettings(); });
addEventListener('resize', () => { if (!pv.el.hidden) setPreviewWidth(settings.previewWidth); });

// ---------------------------------------------------------------------------
// Gedächtnis: frühere Chats durchsuchen & Infos über den Nutzer merken
// ---------------------------------------------------------------------------
const MEMORY_INTENT = /(erinner|weißt du noch|weisst du noch|letzte[ns]? mal|vorhin|vorher|früher|gestern|anderen chat|anderer chat|letzten chat|haben wir|hatten wir|worüber|was habe ich|was hab ich|gechattet|besprochen|gesagt hatte|unser(em)? (gespräch|chat))/i;
const MEM_STOP = new Set('und oder aber der die das den dem des ein eine einen einer mit von zu im in am an auf aus bei für über was wie wer wo wann haben hatten habe hast hat wir ihr ich du mir mich dir dich noch mal bitte weißt weisst erinnerst erinnern gesagt gechattet besprochen chat chats anderen letzten letztes vorhin gestern früher worüber'.split(' '));

const memory = {
  search(query, { skip } = {}) {
    const terms = String(query).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !MEM_STOP.has(w));
    const fmtDate = (t) => new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hits = [];
    for (const c of chats) {
      for (const m of c.messages) {
        if (m === skip || (m.role !== 'user' && m.role !== 'assistant') || !m.content) continue;
        const text = splitThink(m.content).text.replace(/```[\s\S]*?```/g, '[Code]').replace(/\s+/g, ' ').trim();
        const low = text.toLowerCase();
        let score = 0;
        let first = -1;
        for (const t of terms) {
          const i = low.indexOf(t);
          if (i >= 0) { score += 1; if (first < 0 || i < first) first = i; }
        }
        if (!score) continue;
        const start = Math.max(0, first - 120);
        hits.push({ score: score + (m.role === 'user' ? 0.2 : 0) + c.updatedAt / 1e15, chat: c.title, date: fmtDate(m.createdAt || c.updatedAt), who: m.role === 'user' ? 'Nutzer' : 'KI', text: (start ? '…' : '') + text.slice(start, start + 360) + (text.length > start + 360 ? '…' : '') });
      }
    }
    if (hits.length) return hits.sort((a, b) => b.score - a.score).slice(0, 6);
    // Allgemeine Frage ("worüber haben wir gesprochen?") -> Überblick über die letzten Chats
    return [...chats].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6).map((c) => {
      const u = c.messages.find((m) => m.role === 'user' && m !== skip);
      return u ? { chat: c.title, date: fmtDate(c.updatedAt), who: 'Nutzer', text: u.content.replace(/\s+/g, ' ').slice(0, 240) } : null;
    }).filter(Boolean);
  },
  remember(fact) {
    if (!settings.memory.some((f) => f.toLowerCase() === fact.toLowerCase())) {
      settings.memory.push(fact);
      saveSettings();
    }
  },
};

// ---------------------------------------------------------------------------
// Skills (.skill-Dateien im Ordner "skills")
// ---------------------------------------------------------------------------
let skills = [];
let skillsDir = '';
async function refreshSkills() {
  try {
    const r = await skillsApi.list();
    skills = r.skills || [];
    skillsDir = r.dir || '';
  } catch { /* Server alt oder offline */ }
  return skills;
}

function recentChatList(chat) {
  return chats.filter((c) => c.id !== chat.id && c.messages.length)
    .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6)
    .map((c) => `- „${c.title}“ (${new Date(c.updatedAt).toLocaleDateString('de-DE')})`);
}

// ---------------------------------------------------------------------------
// Tokens zählen (Chat & ganze Sitzung)
// ---------------------------------------------------------------------------
let sessionTokens = 0;
const fmtTokens = (n) => (n >= 10000 ? `${(n / 1000).toFixed(1).replace('.', ',')}k` : n.toLocaleString('de-DE'));

// Live-Anzeige (Sekunden + Tokens) neben der Denk-Animation
setInterval(() => {
  if (!busy) return;
  const chat = chats.find((c) => c.id === busy.chatId);
  const m = chat?.messages.find((x) => x.id === busy.msgId);
  if (!m) return;
  const secs = Math.max(0, Math.round((Date.now() - (m.createdAt || Date.now())) / 1000));
  const text = `${secs} s · ${fmtTokens((chat.usage || 0) + (m.liveTokens || 0))} Tokens im Chat`;
  $$('[data-ti]').forEach((e) => { e.textContent = text; });
}, 500);

// ---------------------------------------------------------------------------
// Kopfzeilen-Schalter: Agent, Web, Vorlesen
// ---------------------------------------------------------------------------
function renderToggles() {
  const ag = $('#toggleAgent');
  ag.className = `chip-toggle ${settings.agent ? 'on' : ''}`;
  ag.innerHTML = `${icon('zap')}<span class="ct-label">Agent</span>`;
  const w = $('#toggleWeb');
  w.className = `chip-toggle ${settings.webSearch ? 'on' : ''}`;
  w.innerHTML = `${icon('globe')}<span class="ct-label">Web</span>`;
  const t = $('#toggleTts');
  t.className = `chip-toggle ${settings.tts.auto ? 'on' : ''} ${speaker.speaking ? 'speaking' : ''}`;
  t.innerHTML = `${icon(settings.tts.auto ? 'volume' : 'volumeOff')}<span class="ct-label">Vorlesen</span>`;
}
$('#toggleAgent').addEventListener('click', () => {
  settings.agent = !settings.agent;
  saveSettings();
  renderToggles();
  toast(settings.agent ? 'Agent-Modus an: KI darf (mit Erlaubnis) auf deinem PC handeln' : 'Agent-Modus aus');
});
$('#toggleWeb').addEventListener('click', () => {
  settings.webSearch = !settings.webSearch;
  saveSettings();
  renderToggles();
  toast(settings.webSearch ? 'Websuche an' : 'Websuche aus');
});
$('#toggleTts').addEventListener('click', () => {
  if (!speaker.supported) return toast('Sprachausgabe wird von diesem Browser nicht unterstützt.', 'error');
  settings.tts.auto = !settings.tts.auto;
  if (!settings.tts.auto) speaker.stop();
  saveSettings();
  renderToggles();
  toast(settings.tts.auto ? 'Antworten werden automatisch vorgelesen' : 'Vorlesen aus');
});
speaker.onstate = (speaking, id) => {
  renderToggles();
  $$('[data-action="speak"]').forEach((b) => {
    const mid = b.closest('[data-id]')?.dataset.id;
    b.innerHTML = icon(speaking && mid === id ? 'volumeOff' : 'volume');
  });
};

// ---------------------------------------------------------------------------
// Dialog: Modelle
// ---------------------------------------------------------------------------
function openModels() {
  openModal({ title: 'KI-Modelle', body: '<div id="modelsModal"></div>', onMount: () => renderModelsModal() });
}

async function renderModelsModal() {
  const box = $('#modelsModal');
  if (!box) return;
  let running = [];
  if (online) running = await ollama.running().catch(() => []);
  const runningNames = new Set(running.map((r) => r.name));
  const installed = new Set(models.map((m) => m.name));
  box.innerHTML = `
    <div class="list-item" style="background:var(--bg-soft)">
      <div class="li-main"><div class="li-title"><span class="state-dot ${online ? 'on' : ''}"></span>${online ? 'Ollama läuft' : 'Ollama ist aus'} ${ollamaVersion && online ? `<span class="badge">v${escapeHtml(ollamaVersion)}</span>` : ''}</div>
      <div class="li-sub">${online ? `${models.length} Modelle installiert · ${running.length} aktiv im Speicher` : 'Starte Ollama, um Modelle zu nutzen'}</div></div>
      <div class="li-actions">${online ? `<button class="btn btn-sm" data-ollama="stop">${icon('power')} Beenden</button>` : `<button class="btn btn-sm btn-primary" data-ollama="start">${icon('power')} Starten</button>`}</div>
    </div>
    <div>
      <div class="section-title">Neue KI herunterladen</div>
      <div class="row"><input class="input grow" id="pullName" placeholder="Modellname, z. B. llama3.2 oder qwen2.5:7b"><button class="btn btn-primary" id="pullBtn">${icon('download')} Laden</button></div>
      <p class="hint" style="font-size:12.5px;color:var(--text-faint);margin:6px 0 10px">Alle Modelle findest du auf <a href="https://ollama.com/library" target="_blank" rel="noopener">ollama.com/library</a>.</p>
      <div class="chips">${RECOMMENDED.map((r) => `<button class="chip" data-pull="${r.name}" ${installed.has(r.name) || installed.has(r.name + ':latest') ? 'disabled style="opacity:.5"' : ''}><b>${r.name}</b><small>${r.desc} · ${r.size}</small></button>`).join('')}</div>
    </div>
    <div id="downloadsBox" class="list">${downloadsHtml()}</div>
    <div>
      <div class="section-title">Installiert</div>
      <div class="list">${models.length ? models.map((m) => `<div class="list-item">
        <div class="li-main"><div class="li-title">${escapeHtml(m.name)} ${runningNames.has(m.name) ? '<span class="badge ok">aktiv</span>' : ''} <span class="caps" data-caps="${escapeHtml(m.name)}"></span></div>
        <div class="li-sub">${[formatBytes(m.size), m.details?.parameter_size, m.details?.quantization_level, m.details?.family].filter(Boolean).join(' · ')}</div></div>
        <div class="li-actions">
          ${runningNames.has(m.name)
            ? `<button class="btn btn-sm" data-unload="${escapeHtml(m.name)}" title="Aus dem Arbeitsspeicher entladen">${icon('stop')} Stoppen</button>`
            : `<button class="btn btn-sm" data-load="${escapeHtml(m.name)}" title="In den Arbeitsspeicher laden">${icon('play')} Starten</button>`}
          <button class="btn btn-sm" data-use="${escapeHtml(m.name)}">Nutzen</button>
          <button class="icon-btn" data-delete-model="${escapeHtml(m.name)}" title="Löschen">${icon('trash')}</button>
        </div></div>`).join('') : `<div class="empty-state">${online ? 'Noch keine Modelle installiert.' : 'Ollama ist nicht verbunden.'}</div>`}</div>
    </div>`;

  const pullInput = $('#pullName', box);
  const doPull = () => { if (pullInput.value.trim()) { pullModel(pullInput.value); pullInput.value = ''; } };
  $('#pullBtn', box).onclick = doPull;
  pullInput.onkeydown = (e) => { if (e.key === 'Enter') doPull(); };

  // Fähigkeiten nachladen
  for (const m of models) {
    getCaps(m.name).then((caps) => {
      const c = box.querySelector(`[data-caps="${CSS.escape(m.name)}"]`);
      if (!c || !caps) return;
      const labels = { vision: 'Bilder', tools: 'Agent', thinking: 'Denkt nach' };
      c.innerHTML = caps.filter((x) => labels[x]).map((x) => `<span class="badge accent">${labels[x]}</span>`).join(' ');
    });
  }
}

el.modalRoot.addEventListener('click', async (e) => {
  const t = e.target;
  const pull = t.closest('[data-pull]');
  if (pull) { pullModel(pull.dataset.pull); return; }
  const cancel = t.closest('[data-cancel-dl]');
  if (cancel) { downloads.get(cancel.dataset.cancelDl)?.ctrl.abort(); return; }
  const load = t.closest('[data-load]');
  if (load) {
    load.disabled = true;
    load.innerHTML = `${icon('loader')} Lädt …`;
    try { await ollama.keepAlive(load.dataset.load, '30m'); toast(`${load.dataset.load} ist aktiv`); } catch (err) { toast(err.message, 'error'); }
    renderModelsModal();
    return;
  }
  const unload = t.closest('[data-unload]');
  if (unload) {
    try { await ollama.keepAlive(unload.dataset.unload, 0); toast('Entladen'); } catch (err) { toast(err.message, 'error'); }
    setTimeout(renderModelsModal, 400);
    return;
  }
  const use = t.closest('[data-use]');
  if (use) {
    const chat = currentChat();
    if (chat) { chat.model = use.dataset.use; persist(chat); } else draft.model = use.dataset.use;
    settings.lastModel = use.dataset.use;
    saveSettings();
    renderModelSelect();
    toast(`Nutze jetzt ${use.dataset.use}`);
    return;
  }
  const del = t.closest('[data-delete-model]');
  if (del) {
    const name = del.dataset.deleteModel;
    if (!(await confirmDialog(`Das Modell <b>${escapeHtml(name)}</b> wird von deinem Rechner gelöscht.`, { title: 'Modell löschen?', ok: 'Löschen', danger: true }))) return;
    try { await ollama.remove(name); toast('Gelöscht'); } catch (err) { toast(err.message, 'error'); }
    capsCache.delete(name);
    refreshModels();
    return;
  }
  const oc = t.closest('[data-ollama]');
  if (oc) {
    oc.disabled = true;
    oc.innerHTML = `${icon('loader')} …`;
    try {
      const r = oc.dataset.ollama === 'start' ? await local.startOllama() : await local.stopOllama();
      if (!r.ok) toast(r.error || 'Hat nicht geklappt', 'error');
    } catch (err) { toast(err.message, 'error'); }
    await checkStatus();
    renderModelsModal();
  }
});

// ---------------------------------------------------------------------------
// Dialog: Assistenten
// ---------------------------------------------------------------------------
function openAssistants() {
  const m = openModal({
    title: 'Deine Assistenten',
    body: '<div id="assistantsBox"></div>',
    foot: `<button class="btn btn-primary" id="addAssistant">${icon('plus')} Neuer Assistent</button>`,
  });
  const render = () => {
    $('#assistantsBox', m.el).innerHTML = `<p style="margin:0 0 14px;color:var(--text-soft);font-size:14px">Jeder Assistent hat eigene Persönlichkeit, eigenes Modell und eigene Einstellungen – wie viele verschiedene KIs.</p>
      <div class="list">${assistants.map((a) => `<div class="list-item">${avatarHtml(a)}
        <div class="li-main"><div class="li-title">${escapeHtml(a.name)} ${a.agent !== false ? '<span class="badge accent">Agent</span>' : ''}</div>
        <div class="li-sub">${escapeHtml(a.model || 'Standardmodell')} · ${escapeHtml((a.systemPrompt || 'Allgemeiner Assistent').slice(0, 80))}</div></div>
        <div class="li-actions"><button class="btn btn-sm" data-chat-with="${a.id}">Chatten</button>
        <button class="icon-btn" data-edit-assistant="${a.id}" title="Bearbeiten">${icon('edit')}</button>
        ${assistants.length > 1 ? `<button class="icon-btn" data-del-assistant="${a.id}" title="Löschen">${icon('trash')}</button>` : ''}</div></div>`).join('')}</div>
      <div style="margin-top:18px"><div class="section-title">Vorlagen</div><div class="chips">${TEMPLATES.map((t, i) => `<button class="chip" data-template="${i}"><b>${t.name}</b><small>Hinzufügen</small></button>`).join('')}</div></div>`;
  };
  render();
  m.el.addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit-assistant]');
    if (ed) editAssistant(getAssistant(ed.dataset.editAssistant), render);
    const del = e.target.closest('[data-del-assistant]');
    if (del) {
      const a = getAssistant(del.dataset.delAssistant);
      if (!(await confirmDialog(`Assistent „${escapeHtml(a.name)}“ löschen? Bestehende Chats bleiben erhalten.`, { ok: 'Löschen', danger: true }))) return;
      assistants = assistants.filter((x) => x.id !== a.id);
      saveAssistants();
      render();
      renderAssistantPicker();
    }
    const tpl = e.target.closest('[data-template]');
    if (tpl) {
      const t = TEMPLATES[+tpl.dataset.template];
      assistants.push({ id: uid(), model: '', numCtx: 8192, agent: true, ...t });
      saveAssistants();
      render();
      toast(`${t.name} hinzugefügt`);
    }
    const cw = e.target.closest('[data-chat-with]');
    if (cw) { m.close(); newChat(); selectAssistant(cw.dataset.chatWith); }
  });
  $('#addAssistant', m.el).onclick = () => editAssistant(null, render);
}

function editAssistant(a = null, onSaved) {
  const isNew = !a;
  const data = a ? { ...a } : { id: uid(), name: '', color: COLORS[assistants.length % COLORS.length], model: '', systemPrompt: '', temperature: 0.7, numCtx: 8192, agent: true };
  const m = openModal({
    title: isNew ? 'Neuer Assistent' : 'Assistent bearbeiten',
    body: `
      <div class="row"><div id="aAvatar">${avatarHtml(data)}</div>
        <div class="field grow"><label>Name</label><input class="input" id="aName" value="${escapeHtml(data.name)}" placeholder="z. B. Mathe-Genie"></div></div>
      <div class="field"><span class="field-label">Farbe</span><div class="swatches">${COLORS.map((c) => `<button type="button" class="swatch ${c === data.color ? 'sel' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}</div></div>
      <div class="field"><label>Modell</label><select class="input" id="aModel"><option value="">Standard (aktuell gewähltes Modell)</option>
        ${models.map((x) => `<option value="${escapeHtml(x.name)}" ${x.name === data.model ? 'selected' : ''}>${escapeHtml(x.name)}</option>`).join('')}
        ${data.model && !models.some((x) => x.name === data.model) ? `<option value="${escapeHtml(data.model)}" selected>${escapeHtml(data.model)} (nicht installiert)</option>` : ''}</select></div>
      <div class="field"><label>Persönlichkeit / Anweisungen (System-Prompt)</label>
        <textarea class="input" id="aPrompt" placeholder="z. B. Du bist ein freundlicher Mathe-Nachhilfelehrer, der alles Schritt für Schritt erklärt.">${escapeHtml(data.systemPrompt)}</textarea></div>
      <div class="grid-2">
        <div class="field"><label>Kreativität: <span id="aTempVal">${data.temperature}</span></label><input type="range" id="aTemp" min="0" max="1.5" step="0.1" value="${data.temperature}"><span class="hint">Niedrig = präzise, hoch = kreativ</span></div>
        <div class="field"><label>Gedächtnis (Kontext)</label><select class="input" id="aCtx">
          ${[[0, 'Ollama-Standard'], [4096, '4K – sparsam'], [8192, '8K – empfohlen'], [16384, '16K – lange Dateien'], [32768, '32K – sehr lang']].map(([v, l]) => `<option value="${v}" ${Number(data.numCtx) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      </div>
      <div class="switch-row"><div class="sr-text"><b>Agent-Fähigkeiten</b><span>Darf mit deiner Erlaubnis Dateien speichern, Befehle ausführen und Ollama steuern</span></div>
        <label class="switch"><input type="checkbox" id="aAgent" ${data.agent !== false ? 'checked' : ''}><span></span></label></div>`,
    foot: `<button class="btn" data-close>Abbrechen</button><button class="btn btn-primary" id="aSave">Speichern</button>`,
  });
  m.el.addEventListener('click', (e) => {
    const sw = e.target.closest('[data-color]');
    if (sw) { data.color = sw.dataset.color; $$('.swatch', m.el).forEach((s) => s.classList.toggle('sel', s === sw)); $('#aAvatar', m.el).innerHTML = avatarHtml(data); }
  });
  $('#aTemp', m.el).oninput = (e) => { $('#aTempVal', m.el).textContent = e.target.value; };
  $('#aSave', m.el).onclick = () => {
    data.name = $('#aName', m.el).value.trim() || 'Assistent';
    data.model = $('#aModel', m.el).value;
    data.systemPrompt = $('#aPrompt', m.el).value.trim();
    data.temperature = Number($('#aTemp', m.el).value);
    data.numCtx = Number($('#aCtx', m.el).value);
    data.agent = $('#aAgent', m.el).checked;
    if (isNew) assistants.push(data);
    else assistants[assistants.findIndex((x) => x.id === data.id)] = data;
    saveAssistants();
    m.close();
    onSaved?.();
    renderAssistantPicker();
    renderSidebar();
    if (isNew && !onSaved) selectAssistant(data.id);
    toast(isNew ? `${data.name} ist bereit` : 'Gespeichert');
  };
}

// ---------------------------------------------------------------------------
// Dialog: Einstellungen
// ---------------------------------------------------------------------------
function openSettings() {
  const voices = speaker.voices();
  const sw = (id, checked, title, sub) => `<div class="switch-row"><div class="sr-text"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div><label class="switch"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''}><span></span></label></div>`;
  const k = settings.searchKeys;
  const m = openModal({
    title: 'Einstellungen',
    body: `
      <div><div class="section-title">Verbindung</div>
        <div class="field"><label>Ollama-Adresse</label><div class="row"><input class="input grow" id="sUrl" value="${escapeHtml(settings.ollamaUrl)}" placeholder="Standard: http://127.0.0.1:11434"><button class="btn" id="sTest">Testen</button></div>
        <span class="hint">Leer lassen für die lokale Standard-Installation.</span></div></div>

      <div><div class="section-title">Darstellung & Chat</div>
        <div class="field"><label>Design</label><select class="input" id="sTheme">
          <option value="system" ${settings.theme === 'system' ? 'selected' : ''}>Wie System</option>
          <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Hell</option>
          <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dunkel</option></select></div>
        ${sw('sEnter', settings.sendOnEnter, 'Mit Enter senden', 'Shift+Enter für neue Zeile')}
        ${sw('sTitle', settings.autoTitle, 'Automatische Chat-Titel', 'Die KI gibt jedem Chat einen passenden Namen')}
        ${sw('sThink', settings.think, 'Nachdenken erlauben', 'Für Modelle wie qwen3 oder deepseek-r1 – Gedankengang wird eingeklappt angezeigt')}</div>

      <div><div class="section-title">Agent (Zugriff auf deinen PC)</div>
        ${sw('sAgent', settings.agent, 'Agent-Modus', 'KI darf Dateien/Ordner anlegen, Befehle ausführen und Ollama steuern')}
        ${sw('sPreview', settings.autoPreview, 'Code-Vorschau automatisch öffnen', 'Programmiert die KI eine Webseite oder ein Spiel, erscheint rechts sofort eine Live-Vorschau')}
        ${sw('sTerm', settings.visibleTerminal, 'Sichtbares KI-Terminal', 'Befehle laufen in einem echten Terminal-Fenster auf deinem Bildschirm – die KI tippt sie dort selbst ein')}
        <div><button class="btn btn-sm" id="sTermOpen">${icon('terminal')} KI-Terminal jetzt öffnen</button></div>
        <div class="field"><label>Erlaubnis</label><select class="input" id="sApprove">
          <option value="none" ${settings.autoApprove === 'none' ? 'selected' : ''}>Bei jeder Aktion fragen (empfohlen)</option>
          <option value="safe" ${settings.autoApprove === 'safe' ? 'selected' : ''}>Ollama-Aktionen & Lesen automatisch, Schreiben/Terminal fragen</option>
          <option value="all" ${settings.autoApprove === 'all' ? 'selected' : ''}>Alles automatisch erlauben (nur wenn du der KI voll vertraust)</option></select></div></div>

      <div><div class="section-title">Websuche</div>
        ${sw('sWeb', settings.webSearch, 'Websuche erlauben', 'Wenn die KI etwas nicht weiß, recherchiert sie selbst im Internet')}
        <div class="field"><label>Suchanbieter</label><select class="input" id="sEngine">
          ${Object.entries(SEARCH_ENGINES).map(([key, e]) => `<option value="${key}" ${settings.searchEngine === key ? 'selected' : ''}>${e.label}</option>`).join('')}</select>
          <span class="hint">Klappt ein Anbieter nicht, wird automatisch ein anderer kostenloser genutzt.</span></div>
        <div class="grid-2" data-engine-fields="google_api">
          <div class="field"><label>Google API-Key</label><input class="input" id="kGoogleKey" type="password" value="${escapeHtml(k.googleKey)}"></div>
          <div class="field"><label>Suchmaschinen-ID (cx)</label><input class="input" id="kGoogleCx" value="${escapeHtml(k.googleCx)}"></div>
          <span class="hint" style="grid-column:1/-1">Kostenlos erstellen: <a href="https://programmablesearchengine.google.com/" target="_blank" rel="noopener">Programmable Search Engine</a> + API-Key in der <a href="https://console.cloud.google.com/apis/library/customsearch.googleapis.com" target="_blank" rel="noopener">Google Cloud Console</a>.</span>
        </div>
        <div class="field" data-engine-fields="tavily"><label>Tavily API-Key</label><input class="input" id="kTavily" type="password" value="${escapeHtml(k.tavilyKey)}"><span class="hint">Kostenloses Konto auf <a href="https://tavily.com" target="_blank" rel="noopener">tavily.com</a>.</span></div>
        <div class="field" data-engine-fields="searxng"><label>SearXNG-Adresse</label><input class="input" id="kSearx" value="${escapeHtml(k.searxngUrl)}"><span class="hint">Eigene Instanz mit aktiviertem JSON-Format, z. B. per Docker.</span></div>
        <div class="row"><input class="input grow" id="sSearchTest" placeholder="Suche testen, z. B. Wetter Berlin"><button class="btn" id="sSearchBtn">Testen</button></div>
        <div id="sSearchResult" class="hint" style="font-size:12.5px;color:var(--text-faint)"></div></div>

      <div><div class="section-title">Skills</div>
        <p class="hint" style="font-size:12.5px;color:var(--text-faint);margin:0 0 8px">Anleitungen für die KI als <b>.skill</b>-Dateien. Passende Skills werden automatisch geladen, je nachdem worum es in deiner Nachricht geht. Eigene Skills einfach in den Ordner legen (Vorlage: README.md im Ordner).</p>
        <div class="list" id="skillList"><div class="empty-state" style="padding:8px">Lade …</div></div>
        <div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn btn-sm" id="skillOpen">${icon('folder')} Skills-Ordner öffnen</button><button class="btn btn-sm" id="skillReload">${icon('refresh')} Neu laden</button></div>
        <span class="hint" id="skillDir" style="font-size:12px;color:var(--text-faint)"></span></div>

      <div><div class="section-title">Gedächtnis</div>
        <p class="hint" style="font-size:12.5px;color:var(--text-faint);margin:0 0 8px">Das weiß die KI dauerhaft über dich. Sie merkt sich Dinge selbst oder wenn du „Merk dir …“ sagst. Frühere Chats durchsucht sie automatisch, wenn du dich darauf beziehst.</p>
        <div class="list" id="memList"></div>
        <div class="row" style="margin-top:8px"><input class="input grow" id="memAdd" placeholder="z. B. Ich heiße Alex und programmiere gern in Python"><button class="btn" id="memAddBtn">Hinzufügen</button></div></div>

      <div><div class="section-title">Sprachausgabe</div>
        ${sw('sTts', settings.tts.auto, 'Antworten automatisch vorlesen', 'Liest schon während die KI schreibt')}
        <div class="field"><label>Stimme</label><select class="input" id="sVoice"><option value="">Automatisch (Systemsprache)</option>
          ${voices.map((v) => `<option value="${escapeHtml(v.voiceURI)}" ${v.voiceURI === settings.tts.voiceURI ? 'selected' : ''}>${escapeHtml(v.name)} (${escapeHtml(v.lang)})</option>`).join('')}</select>
          ${voices.length ? '' : '<span class="hint">Keine Stimmen gefunden – dein Browser/System stellt evtl. keine bereit.</span>'}</div>
        <div class="grid-2">
          <div class="field"><label>Tempo: <span id="sRateVal">${settings.tts.rate}</span></label><input type="range" id="sRate" min="0.5" max="2" step="0.1" value="${settings.tts.rate}"></div>
          <div class="field"><label>Tonhöhe: <span id="sPitchVal">${settings.tts.pitch}</span></label><input type="range" id="sPitch" min="0.5" max="2" step="0.1" value="${settings.tts.pitch}"></div>
        </div>
        <div><button class="btn btn-sm" id="sTtsTest">${icon('volume')} Stimme testen</button></div></div>

      <div><div class="section-title">Daten</div>
        <div class="row" style="flex-wrap:wrap"><button class="btn btn-sm" id="sExport">${icon('download')} Alles exportieren</button>
        <button class="btn btn-sm" id="sImport">Importieren</button>
        <button class="btn btn-sm btn-danger" id="sClear">${icon('trash')} Alle Chats löschen</button></div>
        <span class="hint" style="font-size:12.5px;color:var(--text-faint)">Alles wird nur lokal in deinem Browser gespeichert.</span></div>`,
    foot: '<button class="btn btn-primary" data-close>Fertig</button>',
  });
  const q = (s) => $(s, m.el);
  const showEngineFields = () => $$('[data-engine-fields]', m.el).forEach((f) => { f.style.display = f.dataset.engineFields === q('#sEngine').value ? '' : 'none'; });
  showEngineFields();

  const bind = (sel, fn, ev = 'change') => q(sel).addEventListener(ev, (e) => { fn(e.target); saveSettings(); renderToggles(); });
  bind('#sUrl', (t) => { settings.ollamaUrl = t.value.trim(); setOllamaUrl(settings.ollamaUrl); capsCache.clear(); models = []; checkStatus(); });
  bind('#sTheme', (t) => { settings.theme = t.value; applyTheme(); });
  bind('#sEnter', (t) => { settings.sendOnEnter = t.checked; });
  bind('#sTitle', (t) => { settings.autoTitle = t.checked; });
  bind('#sThink', (t) => { settings.think = t.checked; });
  bind('#sAgent', (t) => { settings.agent = t.checked; });
  bind('#sTerm', (t) => { settings.visibleTerminal = t.checked; });
  bind('#sPreview', (t) => { settings.autoPreview = t.checked; });
  q('#sTermOpen').onclick = async () => {
    try { const r = await local.openTerminal(); toast(r.ok ? 'KI-Terminal ist offen' : 'Kein Terminal-Fenster möglich', r.ok ? '' : 'error'); } catch (err) { toast(err.message, 'error'); }
  };
  bind('#sApprove', async (t) => {
    if (t.value === 'all' && !(await confirmDialog('Die KI kann dann <b>ohne Nachfrage</b> Dateien überschreiben und Terminal-Befehle ausführen. Wirklich?', { title: 'Alles automatisch erlauben?', ok: 'Ja, erlauben', danger: true }))) {
      t.value = settings.autoApprove;
      return;
    }
    settings.autoApprove = t.value;
    saveSettings();
  });
  bind('#sWeb', (t) => { settings.webSearch = t.checked; });
  bind('#sEngine', (t) => { settings.searchEngine = t.value; showEngineFields(); });
  bind('#kGoogleKey', (t) => { settings.searchKeys.googleKey = t.value.trim(); }, 'input');
  bind('#kGoogleCx', (t) => { settings.searchKeys.googleCx = t.value.trim(); }, 'input');
  bind('#kTavily', (t) => { settings.searchKeys.tavilyKey = t.value.trim(); }, 'input');
  bind('#kSearx', (t) => { settings.searchKeys.searxngUrl = t.value.trim(); }, 'input');
  bind('#sTts', (t) => { settings.tts.auto = t.checked; if (!t.checked) speaker.stop(); });
  bind('#sVoice', (t) => { settings.tts.voiceURI = t.value; });
  bind('#sRate', (t) => { settings.tts.rate = Number(t.value); q('#sRateVal').textContent = t.value; }, 'input');
  bind('#sPitch', (t) => { settings.tts.pitch = Number(t.value); q('#sPitchVal').textContent = t.value; }, 'input');
  const renderSkills = async () => {
    await refreshSkills();
    q('#skillDir').textContent = skillsDir ? `Ordner: ${skillsDir}` : '';
    q('#skillList').innerHTML = skills.length ? skills.map((sk) => `<div class="list-item"><div class="li-main">
        <div class="li-title">${escapeHtml(sk.name)} ${sk.always ? '<span class="badge accent">immer</span>' : ''}</div>
        <div class="li-sub" title="${escapeHtml(sk.triggers.join(', '))}">${escapeHtml(sk.description || sk.file)}${sk.triggers.length ? ` · Auslöser: ${escapeHtml(sk.triggers.slice(0, 6).join(', '))}${sk.triggers.length > 6 ? ' …' : ''}` : ''}</div></div>
        <label class="switch" title="Skill an/aus"><input type="checkbox" data-skill="${escapeHtml(sk.id)}" ${settings.disabledSkills.includes(sk.id) ? '' : 'checked'}><span></span></label></div>`).join('')
      : '<div class="empty-state" style="padding:8px">Keine Skills gefunden. Lege .skill-Dateien in den Skills-Ordner.</div>';
  };
  renderSkills();
  q('#skillList').addEventListener('change', (e) => {
    const id = e.target.dataset?.skill;
    if (!id) return;
    settings.disabledSkills = settings.disabledSkills.filter((x) => x !== id);
    if (!e.target.checked) settings.disabledSkills.push(id);
    saveSettings();
  });
  q('#skillReload').onclick = async () => { await renderSkills(); toast(`${skills.length} Skills geladen`); };
  q('#skillOpen').onclick = () => skillsApi.openFolder().catch((err) => toast(err.message, 'error'));

  const renderMem = () => {
    q('#memList').innerHTML = settings.memory.length
      ? settings.memory.map((f, i) => `<div class="list-item"><div class="li-main" style="font-size:14px">${escapeHtml(f)}</div><div class="li-actions"><button class="icon-btn" data-mem-del="${i}" title="Vergessen">${icon('trash')}</button></div></div>`).join('')
      : '<div class="empty-state" style="padding:8px">Noch nichts gemerkt.</div>';
  };
  renderMem();
  q('#memList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mem-del]');
    if (b) { settings.memory.splice(+b.dataset.memDel, 1); saveSettings(); renderMem(); }
  });
  const addMem = () => { const v = q('#memAdd').value.trim(); if (v) { memory.remember(v); q('#memAdd').value = ''; renderMem(); } };
  q('#memAddBtn').onclick = addMem;
  q('#memAdd').onkeydown = (e) => { if (e.key === 'Enter') addMem(); };
  q('#sTtsTest').onclick = () => speaker.speak('Hallo! So klinge ich, wenn ich dir deine Antworten vorlese.', 'test');

  q('#sTest').onclick = async () => {
    settings.ollamaUrl = q('#sUrl').value.trim();
    setOllamaUrl(settings.ollamaUrl);
    saveSettings();
    try { const v = await ollama.version(); toast(`Verbunden ✓ Ollama v${v.version}`); } catch (err) { toast(`Keine Verbindung: ${err.message}`, 'error'); }
    checkStatus();
  };
  const runSearchTest = async () => {
    const query = q('#sSearchTest').value.trim() || 'Ollama';
    const out = q('#sSearchResult');
    out.textContent = 'Suche …';
    try {
      const r = await web.search(query, settings.searchEngine, settings.searchKeys, 0);
      out.innerHTML = `✓ ${r.results.length} Treffer über <b>${escapeHtml(r.engine)}</b>: ${r.results.slice(0, 3).map((x) => escapeHtml(x.title)).join(' · ')}`;
    } catch (err) {
      out.textContent = `✗ ${err.message}`;
    }
  };
  q('#sSearchBtn').onclick = runSearchTest;
  q('#sSearchTest').onkeydown = (e) => { if (e.key === 'Enter') runSearchTest(); };

  q('#sExport').onclick = () => download(`ollama-dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 1, chats, assistants, settings }, null, 2));
  q('#sImport').onclick = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'application/json,.json';
    inp.onchange = async () => {
      try {
        const data = JSON.parse(await inp.files[0].text());
        if (Array.isArray(data.assistants)) {
          for (const a of data.assistants) if (!assistants.some((x) => x.id === a.id)) assistants.push(a);
          saveAssistants();
        }
        let n = 0;
        for (const c of data.chats || []) {
          if (!c.id || !Array.isArray(c.messages)) continue;
          chats = chats.filter((x) => x.id !== c.id);
          chats.push(c);
          await chatsDb.put(c);
          n++;
        }
        renderAll();
        toast(`${n} Chats importiert`);
      } catch (err) {
        toast('Import fehlgeschlagen: ' + err.message, 'error');
      }
    };
    inp.click();
  };
  q('#sClear').onclick = async () => {
    if (!(await confirmDialog('Alle Chats werden unwiderruflich gelöscht.', { title: 'Alles löschen?', ok: 'Alles löschen', danger: true }))) return;
    busy?.controller.abort();
    await chatsDb.clear();
    chats = [];
    newChat();
    toast('Alle Chats gelöscht');
  };
}

// ---------------------------------------------------------------------------
// Tastatur & Start
// ---------------------------------------------------------------------------
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (el.menuRoot.innerHTML) return closeMenu();
    const modals = $$('.modal-backdrop');
    if (modals.length) { modals[modals.length - 1].querySelector('[data-close]')?.click(); return; }
    if (busy) stop();
    else if (speaker.speaking) speaker.stop();
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') { e.preventDefault(); newChat(); }
});

$('#newChat').innerHTML = `${icon('plus')} Neuer Chat`;
$('#newChat').addEventListener('click', newChat);
$('#openAssistants').innerHTML = `${icon('users')} Assistenten`;
$('#openAssistants').addEventListener('click', openAssistants);
$('#openModels').innerHTML = `${icon('cpu')} Modelle`;
$('#openModels').addEventListener('click', openModels);
$('#openSettings').innerHTML = `${icon('settings')} Einstellungen`;
$('#openSettings').addEventListener('click', openSettings);
$('#toggleSidebar').innerHTML = icon('sidebar');
$('#closeSidebar').innerHTML = icon('x');
$('.search-icon').innerHTML = icon('search');
$('#attachBtn').innerHTML = icon('clip');
micBtn.innerHTML = icon('mic');
$('[data-pv="reload"]').innerHTML = icon('refresh');
$('[data-pv="open"]').innerHTML = icon('external');
$('[data-pv="copy"]').innerHTML = icon('copy');
$('[data-pv="close"]').innerHTML = icon('x');
setPreviewWidth(settings.previewWidth || 560);
el.status.addEventListener('click', openModels);
el.status.style.cursor = 'pointer';

async function init() {
  applyTheme();
  setOllamaUrl(settings.ollamaUrl);
  if (settings.sidebarHidden && !isMobile()) el.app.classList.add('sidebar-hidden');
  renderToggles();
  try {
    chats = (await chatsDb.all()) || [];
    // Unterbrochene Aktionen aus einer früheren Sitzung aufräumen
    for (const c of chats) for (const m of c.messages) if (m.role === 'tool' && (m.status === 'pending' || m.status === 'running')) m.status = 'cancelled';
  } catch (err) {
    toast('Chats konnten nicht geladen werden: ' + err.message, 'error');
  }
  newChat();
  refreshSkills();
  await checkStatus();
  renderAll();
}
init();
