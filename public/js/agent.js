// Agent: Werkzeuge, mit denen die KI Ollama, Dateien, Terminal und Websuche nutzen kann.
// Jede Aktion mit Auswirkungen braucht die Erlaubnis des Nutzers.

import { ollama } from './ollama.js';
import { local, localFs, web } from './local.js';
import { formatBytes } from './files.js';

const fn = (name, description, properties = {}, required = []) => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required } },
});
const str = (description) => ({ type: 'string', description });

export const TOOL_DEFS = [
  fn('web_search', 'Sucht im Internet und liefert Treffer mit Seiteninhalten. Nutze das, wenn du etwas nicht sicher weißt oder aktuelle Informationen brauchst.', { query: str('Suchbegriff') }, ['query']),
  fn('fetch_webpage', 'Liest den Text einer Webseite.', { url: str('Vollständige URL') }, ['url']),
  fn('write_file', 'Speichert eine Datei auf dem Computer (Ordner werden automatisch angelegt). Relative Pfade landen auf dem Desktop.', { path: str('z. B. Desktop/mein-projekt/index.html'), content: str('Vollständiger Dateiinhalt') }, ['path', 'content']),
  fn('create_folder', 'Legt einen Ordner an.', { path: str('z. B. Desktop/mein-projekt') }, ['path']),
  fn('read_file', 'Liest eine Textdatei.', { path: str('Dateipfad') }, ['path']),
  fn('list_directory', 'Zeigt den Inhalt eines Ordners.', { path: str('Ordnerpfad, z. B. Desktop') }, ['path']),
  fn('open_path', 'Öffnet eine Datei oder einen Ordner mit dem Standardprogramm.', { path: str('Pfad') }, ['path']),
  fn('run_command', 'Führt einen Terminal-Befehl auf dem Computer aus und gibt die Ausgabe zurück.', { command: str('Der Befehl'), cwd: str('Arbeitsordner (optional)') }, ['command']),
  fn('list_models', 'Listet die installierten Ollama-KI-Modelle.'),
  fn('running_models', 'Zeigt, welche Modelle gerade im Arbeitsspeicher geladen sind.'),
  fn('pull_model', 'Lädt ein neues KI-Modell aus der Ollama-Bibliothek herunter (z. B. llama3.2, qwen2.5:7b, gemma3).', { name: str('Modellname') }, ['name']),
  fn('delete_model', 'Löscht ein installiertes Modell.', { name: str('Modellname') }, ['name']),
  fn('load_model', 'Lädt ein Modell in den Arbeitsspeicher (startet es).', { name: str('Modellname') }, ['name']),
  fn('unload_model', 'Entlädt ein Modell aus dem Arbeitsspeicher (stoppt es).', { name: str('Modellname') }, ['name']),
  fn('start_ollama', 'Startet den Ollama-Server.'),
  fn('stop_ollama', 'Beendet den Ollama-Server.'),
];

// Berechtigungsstufen: auto = ohne Nachfrage, ollama/read = je nach Einstellung, write/command = Nachfrage
export const TOOL_META = {
  web_search: { level: 'auto', icon: 'globe', label: (a) => `Websuche: ${a.query}` },
  fetch_webpage: { level: 'auto', icon: 'globe', label: (a) => `Webseite lesen: ${a.url}` },
  list_models: { level: 'auto', icon: 'cpu', label: () => 'Installierte Modelle abfragen' },
  running_models: { level: 'auto', icon: 'cpu', label: () => 'Laufende Modelle abfragen' },
  load_model: { level: 'auto', icon: 'play', label: (a) => `Modell starten: ${a.name}` },
  unload_model: { level: 'auto', icon: 'stop', label: (a) => `Modell stoppen: ${a.name}` },
  pull_model: { level: 'ollama', icon: 'download', label: (a) => `KI herunterladen: ${a.name}` },
  delete_model: { level: 'ollama', icon: 'trash', label: (a) => `Modell löschen: ${a.name}` },
  start_ollama: { level: 'ollama', icon: 'power', label: () => 'Ollama starten' },
  stop_ollama: { level: 'ollama', icon: 'power', label: () => 'Ollama beenden' },
  read_file: { level: 'read', icon: 'file', label: (a) => `Datei lesen: ${a.path}` },
  list_directory: { level: 'read', icon: 'folder', label: (a) => `Ordner ansehen: ${a.path}` },
  open_path: { level: 'read', icon: 'external', label: (a) => `Öffnen: ${a.path}` },
  create_folder: { level: 'write', icon: 'folderPlus', label: (a) => `Ordner anlegen: ${a.path}` },
  write_file: { level: 'write', icon: 'save', label: (a) => `Datei speichern: ${a.path}` },
  run_command: { level: 'command', icon: 'terminal', label: (a) => `Terminal: ${a.command}` },
};

export function needsApproval(name, autoApprove) {
  const level = TOOL_META[name]?.level || 'command';
  if (level === 'auto') return false;
  if (autoApprove === 'all') return false;
  if (autoApprove === 'safe' && (level === 'ollama' || level === 'read')) return false;
  return true;
}

export function systemPrompt({ assistant, sys, nativeTools, agent, webSearch }) {
  const now = new Date().toLocaleString('de-DE', { dateStyle: 'full', timeStyle: 'short' });
  const os = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[sys?.platform] || 'unbekannt';
  const parts = [];
  if (assistant?.systemPrompt?.trim()) parts.push(assistant.systemPrompt.trim());
  else parts.push(`Du bist ${assistant?.name || 'ein KI-Assistent'}, ein hilfreicher, kluger KI-Assistent.`);
  parts.push(`Du läufst komplett lokal auf dem Computer des Nutzers. Datum: ${now}. Antworte in der Sprache des Nutzers, klar, freundlich und gut formuliert. Nutze Markdown für Struktur und Codeblöcke für Code.`);

  if (agent) {
    parts.push(`Du kannst direkt auf dem Computer handeln (Betriebssystem: ${os}${sys?.desktop ? `, Desktop: ${sys.desktop}` : ''}). Der Nutzer bestätigt jede Aktion per Klick – erkläre also nicht nur, sondern erledige Aufgaben selbst, wenn er darum bittet.`);
    const blocks = [
      'Datei speichern – Codeblock mit Pfad als Kopfzeile, vollständiger Inhalt, ein Block pro Datei:\n```datei:Desktop/mein-projekt/index.html\n<!DOCTYPE html>\n...\n```',
      'Ordner anlegen:\n```ordner\nDesktop/mein-projekt\n```',
      `Terminal-Befehl ausführen (${os === 'Windows' ? 'Windows-cmd' : 'Shell'}):\n\`\`\`befehl\n...\n\`\`\``,
      'Ollama steuern (pull NAME, rm NAME, load NAME, unload NAME, list, ps, start, stop):\n```ollama\npull llama3.2\n```',
    ];
    if (webSearch) blocks.unshift('Im Internet suchen – wenn du etwas nicht sicher weißt oder es um aktuelle Dinge geht (danach aufhören, du bekommst die Ergebnisse):\n```suche\nSuchbegriff\n```');
    if (nativeTools) {
      parts.push('Dafür hast du Werkzeuge (Funktionen). Alternativ funktionieren auch diese Blöcke:\n\n' + blocks.join('\n\n'));
    } else {
      parts.push('Dafür schreibst du spezielle Codeblöcke, die die App automatisch ausführt:\n\n' + blocks.join('\n\n'));
    }
    parts.push('Wenn der Nutzer z. B. sagt „programmiere mir X“, lege einen passenden Projektordner auf dem Desktop an und speichere alle Dateien vollständig mit datei:-Blöcken. Nutze die Blöcke nur, wenn wirklich etwas auf dem Computer passieren soll oder du Informationen brauchst – normale Fragen beantwortest du einfach.');
  } else if (webSearch) {
    parts.push('Wenn du etwas nicht sicher weißt oder es um aktuelle Dinge geht, suche im Internet – mit dem Werkzeug web_search oder mit einem Block:\n```suche\nSuchbegriff\n```\nDanach aufhören, du bekommst die Ergebnisse.');
  }
  if (webSearch) parts.push('Wenn du Suchergebnisse bekommst: Formuliere eine eigene, gut verständliche Antwort daraus (nicht einfach abschreiben) und nenne am Ende kurz die wichtigsten Quellen als Links.');
  return parts.join('\n\n');
}

// Aktionen aus Codeblöcken lesen (funktioniert auch mit kleinen Modellen ohne Tool-Support)
export function parseTextActions(content, { agent, webSearch }) {
  const actions = [];
  const re = /```[ \t]*([^\n`]*)\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(content))) {
    const info = m[1].trim();
    const body = m[2].replace(/\n$/, '');
    const file = info.match(/^(?:[\w+#.-]+\s+)?(?:datei|file)\s*[:=]\s*(.+)$/i);
    const kind = info.toLowerCase();
    if (file && agent) {
      actions.push({ name: 'write_file', args: { path: file[1].trim(), content: body + '\n' } });
    } else if (kind === 'suche' || kind === 'search') {
      if (webSearch && body.trim()) actions.push({ name: 'web_search', args: { query: body.trim().split('\n')[0] } });
    } else if (!agent) {
      continue;
    } else if (kind === 'ordner' || kind === 'folder') {
      body.split('\n').map((l) => l.trim()).filter(Boolean).forEach((p) => actions.push({ name: 'create_folder', args: { path: p } }));
    } else if (kind === 'befehl' || kind === 'terminal' || kind === 'command') {
      const lines = body.split('\n').map((l) => l.trim()).filter((l) => l && !/^(#|rem\s|::)/i.test(l));
      if (lines.length) actions.push({ name: 'run_command', args: { command: lines.join(' && ') } });
    } else if (kind === 'ollama') {
      for (const line of body.split('\n').map((l) => l.trim()).filter(Boolean)) {
        const [cmd, ...rest] = line.replace(/^ollama\s+/, '').split(/\s+/);
        const name = rest.join(' ');
        const map = { pull: 'pull_model', rm: 'delete_model', delete: 'delete_model', load: 'load_model', run: 'load_model', unload: 'unload_model', stop: name ? 'unload_model' : 'stop_ollama', list: 'list_models', ls: 'list_models', ps: 'running_models', start: 'start_ollama', serve: 'start_ollama' };
        const tool = map[cmd?.toLowerCase()];
        if (tool) actions.push({ name: tool, args: name ? { name } : {} });
      }
    }
  }
  return actions;
}

// Führt ein Werkzeug aus. ui.progress(text, pct) zeigt Fortschritt, signal bricht ab.
// Rückgabe: { output: Text für die KI, display: Text für den Nutzer, sources? }
export async function executeTool(name, args = {}, { progress = () => {}, signal, searchEngine = 'google', searchKeys = {} } = {}) {
  switch (name) {
    case 'web_search': {
      const r = await web.search(String(args.query || ''), searchEngine, searchKeys);
      if (!r.results.length) return { output: 'Keine Treffer gefunden.', display: 'Keine Treffer.' };
      const output = r.results.map((x, i) =>
        `[${i + 1}] ${x.title}\nURL: ${x.url}\n${x.snippet}${x.content ? `\nInhalt: ${x.content}` : ''}`).join('\n\n');
      return {
        output: `Suchergebnisse für „${r.query}“:\n\n${output}`,
        display: `${r.results.length} Treffer (${r.engine})`,
        sources: r.results.slice(0, 6).map((x) => ({ title: x.title, url: x.url })),
      };
    }
    case 'fetch_webpage': {
      const r = await web.fetch(String(args.url || ''));
      return { output: `${r.title}\n${r.url}\n\n${r.text}`, display: r.title || r.url, sources: [{ title: r.title || r.url, url: r.url }] };
    }
    case 'write_file': {
      const r = await localFs.write(args.path, args.content ?? '');
      return { output: `Gespeichert: ${r.path} (${formatBytes(r.bytes)})`, display: `${r.overwritten ? 'Überschrieben' : 'Gespeichert'}: ${r.path}`, path: r.path };
    }
    case 'create_folder': {
      const r = await localFs.mkdir(args.path);
      return { output: `Ordner angelegt: ${r.path}`, display: `Angelegt: ${r.path}`, path: r.path };
    }
    case 'read_file': {
      const r = await localFs.read(args.path);
      return { output: `Inhalt von ${r.path}${r.truncated ? ' (gekürzt)' : ''}:\n${r.content}`, display: `${r.path} (${formatBytes(r.size)})`, path: r.path };
    }
    case 'list_directory': {
      const r = await localFs.list(args.path || 'Desktop');
      const list = r.entries.map((e) => (e.dir ? `📁 ${e.name}/` : `📄 ${e.name}`)).join('\n') || '(leer)';
      return { output: `Inhalt von ${r.path}:\n${list}`, display: list, path: r.path };
    }
    case 'open_path': {
      const r = await localFs.open(args.path);
      return { output: `Geöffnet: ${r.path}`, display: `Geöffnet: ${r.path}` };
    }
    case 'run_command': {
      progress('Läuft …');
      const r = await local.exec(String(args.command || ''), 300, args.cwd);
      const text = [r.stdout, r.stderr].filter((x) => x && x.trim()).join('\n').trim() || '(keine Ausgabe)';
      return { output: `Exit-Code ${r.code}\n${text.slice(0, 12000)}`, display: text, code: r.code, failed: r.code !== 0 };
    }
    case 'list_models': {
      const ms = await ollama.models();
      const list = ms.map((m) => `${m.name} (${formatBytes(m.size)}${m.details?.parameter_size ? ', ' + m.details.parameter_size : ''})`);
      return { output: list.length ? 'Installierte Modelle:\n' + list.join('\n') : 'Keine Modelle installiert.', display: list.join('\n') || 'Keine Modelle' };
    }
    case 'running_models': {
      const ms = await ollama.running();
      const list = ms.map((m) => `${m.name} (${formatBytes(m.size_vram || m.size)} im Speicher)`);
      return { output: list.length ? 'Geladen:\n' + list.join('\n') : 'Gerade ist kein Modell geladen.', display: list.join('\n') || 'Keins geladen' };
    }
    case 'pull_model': {
      const model = String(args.name || '').trim();
      let last = '';
      for await (const ev of ollama.pull(model, signal)) {
        const pct = ev.total ? Math.round((ev.completed || 0) / ev.total * 100) : null;
        const text = ev.total ? `${ev.status} – ${formatBytes(ev.completed || 0)} / ${formatBytes(ev.total)}` : ev.status;
        if (text !== last) { progress(text, pct); last = text; }
      }
      return { output: `Modell ${model} wurde heruntergeladen und ist bereit.`, display: `${model} ist bereit`, modelsChanged: true };
    }
    case 'delete_model': {
      await ollama.remove(String(args.name || '').trim());
      return { output: `Modell ${args.name} gelöscht.`, display: 'Gelöscht', modelsChanged: true };
    }
    case 'load_model': {
      progress('Wird geladen …');
      await ollama.keepAlive(String(args.name || '').trim(), '30m');
      return { output: `Modell ${args.name} ist geladen und bereit.`, display: 'Geladen' };
    }
    case 'unload_model': {
      await ollama.keepAlive(String(args.name || '').trim(), 0);
      return { output: `Modell ${args.name} wurde entladen.`, display: 'Entladen' };
    }
    case 'start_ollama': {
      progress('Starte Ollama …');
      const r = await local.startOllama();
      if (!r.ok) throw new Error(r.error || 'Start fehlgeschlagen');
      return { output: 'Ollama läuft.', display: r.already ? 'Lief bereits' : `Gestartet (v${r.version})` };
    }
    case 'stop_ollama': {
      const r = await local.stopOllama();
      return { output: r.ok ? 'Ollama wurde beendet.' : 'Ollama konnte nicht beendet werden.', display: r.ok ? 'Beendet' : 'Fehlgeschlagen' };
    }
    default:
      throw new Error(`Unbekanntes Werkzeug: ${name}`);
  }
}
