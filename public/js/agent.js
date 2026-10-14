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
  fn('run_command', 'Tippt einen Befehl sichtbar in ein echtes Terminal-Fenster auf dem Bildschirm des Nutzers, führt ihn aus und gibt die echte Ausgabe zurück. Unter Windows ist das cmd.', { command: str('Der Befehl') }, ['command']),
  fn('open_terminal', 'Öffnet das sichtbare KI-Terminal-Fenster auf dem Bildschirm des Nutzers.'),
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
  open_terminal: { level: 'auto', icon: 'terminal', label: () => 'KI-Terminal öffnen' },
};

export function needsApproval(name, autoApprove) {
  const level = TOOL_META[name]?.level || 'command';
  if (level === 'auto') return false;
  if (autoApprove === 'all') return false;
  if (autoApprove === 'safe' && (level === 'ollama' || level === 'read')) return false;
  return true;
}

export function systemPrompt({ assistant, sys, nativeTools, agent, webSearch, model }) {
  const now = new Date().toLocaleString('de-DE', { dateStyle: 'full', timeStyle: 'short' });
  const win = sys?.platform === 'win32';
  const os = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[sys?.platform] || 'unbekannt';
  const desk = sys?.desktop || (win ? 'C:\\Users\\<Name>\\Desktop' : '~/Desktop');
  const parts = [];
  if (assistant?.systemPrompt?.trim()) parts.push(assistant.systemPrompt.trim());
  else parts.push(`Du bist ${assistant?.name || 'ein KI-Assistent'}, ein hilfreicher, kluger KI-Assistent.`);
  parts.push(`Du läufst komplett lokal auf dem Computer des Nutzers${model ? ` (KI-Modell: ${model})` : ''}. Datum: ${now}. Antworte in der Sprache des Nutzers, klar, freundlich und gut formuliert. Nutze Markdown für Struktur und Codeblöcke für Code.`);

  if (agent) {
    parts.push(`## Handeln auf dem Computer
Betriebssystem: ${os}. Desktop-Ordner: ${desk}. Home-Ordner: ${sys?.home || '~'}.
Du kannst direkt auf dem Computer handeln. Der Nutzer bestätigt jede Aktion per Klick – erkläre also nicht nur, sondern erledige Aufgaben selbst. Dafür schreibst du spezielle Codeblöcke, die die App ausführt${nativeTools ? ' (oder du nutzt deine Werkzeuge/Funktionen)' : ''}:

1. Ordner anlegen (immer so, nie per Terminal):
\`\`\`ordner
Desktop/mein-projekt
\`\`\`

2. Datei speichern (immer so, nie per echo; vollständiger Inhalt, ein Block pro Datei):
\`\`\`datei:Desktop/mein-projekt/index.html
<!DOCTYPE html>
...
\`\`\`

3. Befehl im sichtbaren Terminal ausführen – der Nutzer sieht ein echtes ${win ? 'CMD-' : ''}Terminal-Fenster, in das du tippst:
\`\`\`befehl
${win ? 'systeminfo' : 'uname -a'}
\`\`\`
${win ? `Es ist die Windows-Eingabeaufforderung (cmd), KEIN Linux: Pfade mit Backslash \\ und in Anführungszeichen, z. B. dir "${desk}". Das Terminal startet im Desktop-Ordner. Programme/Ordner/Webseiten sichtbar öffnen: start notepad, start "" "${desk}", start https://beispiel.de` : `Das Terminal startet im Desktop-Ordner. Ordner/Programme öffnen: ${os === 'macOS' ? 'open' : 'xdg-open'} PFAD`}

4. Ollama steuern (pull NAME, rm NAME, load NAME, unload NAME, list, ps, start, stop):
\`\`\`ollama
pull llama3.2
\`\`\`
${webSearch ? `
5. Im Internet suchen, wenn du etwas nicht sicher weißt oder es um Aktuelles geht:
\`\`\`suche
Suchbegriff
\`\`\`
` : ''}
WICHTIG:
- Nach einem befehl-, ollama- oder suche-Block hörst du SOFORT auf zu schreiben. Die App führt ihn aus und gibt dir das echte Ergebnis. Erfinde NIEMALS Ausgaben oder Ergebnisse.
- Ordner und Dateien IMMER mit ordner- und datei:-Blöcken anlegen – das funktioniert zuverlässig, Terminal-Befehle dafür nicht.
- Relative Pfade wie Desktop/projekt beziehen sich auf den Desktop des Nutzers.
- Nutze die Blöcke nur, wenn etwas auf dem Computer passieren soll. Normale Fragen beantwortest du einfach.

Beispiel – Nutzer: „Erstelle auf dem Desktop einen Ordner Test mit einer Datei hallo.txt, in der Hallo steht, und öffne ihn.“
Deine Antwort:
Klar, mache ich!
\`\`\`ordner
Desktop/Test
\`\`\`
\`\`\`datei:Desktop/Test/hallo.txt
Hallo
\`\`\`
\`\`\`befehl
${win ? 'start "" "Test"' : 'xdg-open Test'}
\`\`\`

Beispiel – Nutzer: „Wie ist meine IP-Adresse?“
Deine Antwort:
Ich schaue nach.
\`\`\`befehl
${win ? 'ipconfig' : 'ip addr'}
\`\`\`

Wenn der Nutzer „programmiere mir X“ sagt: lege einen Projektordner auf dem Desktop an, speichere alle Dateien vollständig mit datei:-Blöcken und öffne das Ergebnis danach mit einem befehl-Block.`);
  } else if (webSearch) {
    parts.push('Wenn du etwas nicht sicher weißt oder es um aktuelle Dinge geht, suche im Internet – mit dem Werkzeug web_search oder mit einem Block:\n```suche\nSuchbegriff\n```\nDanach sofort aufhören, du bekommst die echten Ergebnisse. Erfinde nichts.');
  }
  if (webSearch) parts.push('Wenn du Suchergebnisse bekommst: Formuliere eine eigene, gut verständliche Antwort daraus (nicht einfach abschreiben) und nenne am Ende kurz die wichtigsten Quellen als Links.');
  return parts.join('\n\n');
}

// Will der Nutzer, dass etwas ausgeführt wird? (Dann zählen auch ```cmd/```bash-Blöcke als Befehl)
export function wantsExecution(text) {
  return /(führ|ausführ|starte|start |öffne|öffnen|mach |erstell|anleg|lösch|install|terminal|cmd|konsole|befehl|run\b|execute|open\b|create|zeig mir|check|prüf|teste)/i.test(String(text || ''));
}

const SHELL_LANGS = new Set(['cmd', 'bat', 'batch', 'powershell', 'ps1', 'pwsh', 'bash', 'sh', 'shell', 'zsh', 'console']);
const STOP_KINDS = new Set(['befehl', 'terminal', 'command', 'suche', 'search', 'ollama']);

function blockKind(info, intent) {
  const kind = info.trim().toLowerCase();
  if (SHELL_LANGS.has(kind)) return intent ? 'befehl' : '';
  return kind;
}

// Erster vollständiger Block, nach dem die KI auf ein echtes Ergebnis warten muss (Ende-Index)
export function findStopBlock(content, { agent, webSearch, intent }) {
  const re = /```[ \t]*([^\n`]*)\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(content))) {
    const kind = blockKind(m[1], intent);
    if (!STOP_KINDS.has(kind)) continue;
    if ((kind === 'suche' || kind === 'search') ? webSearch : agent) return m.index + m[0].length;
  }
  return -1;
}

function shellCommand(kind, body) {
  const lines = body.split('\n').map((l) => l.trim()).filter((l) => l && !/^(#|rem\s|::)/i.test(l));
  if (!lines.length) return '';
  if (['powershell', 'ps1', 'pwsh'].includes(kind)) {
    return `powershell -NoProfile -Command "${lines.join('; ').replace(/"/g, '\\"')}"`;
  }
  // Prompt-Zeichen entfernen, falls die KI "C:\> dir" oder "$ ls" schreibt
  return lines.map((l) => l.replace(/^(?:[A-Za-z]:\\[^>]*>|\$|>)\s*/, '')).join(' && ');
}

// Aktionen aus Codeblöcken lesen (funktioniert auch mit kleinen Modellen ohne Tool-Support)
export function parseTextActions(content, { agent, webSearch, intent = false }) {
  const actions = [];
  const re = /```[ \t]*([^\n`]*)\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(content))) {
    const info = m[1].trim();
    const body = m[2].replace(/\n$/, '');
    const file = info.match(/^(?:[\w+#.-]+\s+)?(?:datei|file)\s*[:=]\s*(.+)$/i);
    const raw = info.toLowerCase();
    const kind = blockKind(info, intent);
    if (file && agent) {
      actions.push({ name: 'write_file', args: { path: file[1].trim(), content: body + '\n' } });
    } else if (kind === 'suche' || kind === 'search') {
      if (webSearch && body.trim()) actions.push({ name: 'web_search', args: { query: body.trim().split('\n')[0] } });
    } else if (!agent) {
      continue;
    } else if (kind === 'ordner' || kind === 'folder') {
      body.split('\n').map((l) => l.trim().replace(/^["']|["']$/g, '')).filter(Boolean).forEach((p) => actions.push({ name: 'create_folder', args: { path: p } }));
    } else if (kind === 'befehl' || kind === 'terminal' || kind === 'command') {
      const command = shellCommand(raw, body);
      if (command) actions.push({ name: 'run_command', args: { command } });
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
export async function executeTool(name, args = {}, { progress = () => {}, signal, searchEngine = 'google', searchKeys = {}, visibleTerminal = true } = {}) {
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
      const list = r.entries.map((e) => (e.dir ? `${e.name}/` : e.name)).join('\n') || '(leer)';
      return { output: `Inhalt von ${r.path}:\n${list}`, display: list, path: r.path };
    }
    case 'open_path': {
      const r = await localFs.open(args.path);
      return { output: `Geöffnet: ${r.path}`, display: `Geöffnet: ${r.path}` };
    }
    case 'run_command': {
      const command = String(args.command || '');
      let r;
      if (visibleTerminal && !args.cwd) {
        progress('Läuft im KI-Terminal …');
        r = await local.terminal(command, 600);
      } else {
        progress('Läuft …');
        r = await local.exec(command, 300, args.cwd);
      }
      const text = [r.stdout, r.stderr].filter((x) => x && x.trim()).join('\n').trim() || '(keine Ausgabe)';
      const ran = r.command && r.command !== command ? `Ausgeführt als: ${r.command}\n` : '';
      return {
        output: `${ran}Exit-Code ${r.code}${r.code === 0 ? ' (Erfolg)' : ' (Fehler)'}\n${text.slice(0, 12000)}`,
        display: text, code: r.code, failed: r.code !== 0, visible: r.visible,
      };
    }
    case 'open_terminal': {
      const r = await local.openTerminal();
      return { output: r.ok ? 'Das KI-Terminal-Fenster ist offen und sichtbar.' : 'Konnte kein Terminal-Fenster öffnen.', display: r.ok ? 'Terminal geöffnet' : 'Nicht möglich' };
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
