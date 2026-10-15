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
  fn('fetch_webpage', 'Öffnet eine Webseite und liest die zur Frage passenden Textstellen.', { url: str('Vollständige URL'), query: str('Worum es geht (optional)') }, ['url']),
  fn('search_chats', 'Durchsucht alle bisherigen Chats mit dem Nutzer (auch andere Chats), um sich an frühere Gespräche zu erinnern.', { query: str('Wonach gesucht wird') }, ['query']),
  fn('remember', 'Merkt sich dauerhaft eine wichtige Info über den Nutzer (z. B. Name, Vorlieben, Projekte).', { fact: str('Die Info in einem kurzen Satz') }, ['fact']),
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
  search_chats: { level: 'auto', icon: 'search', label: (a) => `Erinnern: ${a.query}` },
  remember: { level: 'auto', icon: 'save', label: (a) => `Merken: ${a.fact}` },
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

// Was will der Nutzer? Danach richtet sich, wie viel Anleitung die KI bekommt.
// Kleine Modelle werden mit langen Prompts deutlich schlechter – bei "Hallo, wie geht's?" bekommen sie deshalb fast nichts.
const COMPUTER_INTENT = /(ordner|datei|dateien|desktop|schreibtisch|terminal|\bcmd\b|konsole|eingabeaufforderung|befehl|powershell|batch|\.bat\b|öffne|öffnen|starte\b|starten|installier|deinstallier|lösch|erstell|anleg|speicher|programmier|skript|script|projekt|ausführ|führ\S* (das |es |den |die )?\S* ?aus|auf meinem (pc|computer|rechner|laptop)|mein(em|en)? (pc|computer|rechner|laptop|system)|festplatte|speicherplatz|arbeitsspeicher|ip-?adresse|meine ip\b|ipconfig|ping\b|prozess|taskmanager|meine grafikkarte|welche grafikkarte (hab|habe)|systeminfo|ollama|modell(e)? (laden|herunterladen|löschen|entladen|starten|stoppen)|lade \S+ herunter|\b(pull|herunterladen)\b|\.(txt|html?|css|js|py|json|md|csv|bat|cmd|ps1)\b|code (für|in|schreiben)|schreib\S* (mir )?(ein|einen|eine) (code|programm|spiel|webseite|website|app))/i;
export function needsComputer(text) {
  return COMPUTER_INTENT.test(String(text || ''));
}
const REMEMBER_HINT = /\b(merk|merke|merken|vergiss|ich heiße|ich heisse|mein name|ich bin \d|ich wohne|ich mag|ich liebe|lieblings)/i;
const SMALLTALK = /^(hallo|hi|hey|moin|servus|grüß dich|guten (morgen|tag|abend)|na\b|wie geht'?s|wie geht es|was geht|danke|vielen dank|dankeschön|gute nacht|tschüss|bis später)/i;
const RECALL_HINT = /(weißt du noch|weisst du noch|erinner|letztes mal|letzte mal|vorhin|vorher|gestern|früher|anderen chat|haben wir|hatten wir|hab ich (dir )?(gesagt|erzählt|geschrieben|gefragt)|habe ich (dir )?(gesagt|erzählt|geschrieben|gefragt)|was hab(e)? ich|meine (erste|letzte|vorige|vorherige|alte|frühere)n? (nachricht|frage)|meine nachrichten|was ich (gesagt|geschrieben|gefragt)|du hast (gesagt|geschrieben)|was hast du (gesagt|geschrieben)|weiter oben|wie (oben|gesagt)|was weißt du über mich|wiederhol)/i;

const WIN_CMD = `### Windows-CMD richtig benutzen
Das Terminal ist die Windows-Eingabeaufforderung (cmd.exe) – KEIN Linux, KEINE PowerShell.
- Pfade mit Backslash \\ und mit Leerzeichen immer in "Anführungszeichen". Laufwerk wechseln: cd /d "D:\\Ordner".
- Mehrere Befehle: mit && verbinden oder je Zeile einer.
- Variablen: %USERPROFILE%, %USERNAME%, %CD% (nicht ~ oder $HOME).
- KEINE Linux-Befehle: statt ls → dir, cat → type, rm → del, rm -r → rmdir /s /q, cp → copy, mv → move, touch → type nul > datei, grep → findstr, clear → cls, pwd → cd, which → where, sudo gibt es nicht.
- Nützliche Befehle:
  - dir /b "Ordner" (Inhalt), tree "Ordner" /f (alles), type "datei.txt" (anzeigen)
  - copy "a.txt" "b.txt", move "a.txt" "Ordner\\", ren "alt.txt" "neu.txt", del "datei.txt"
  - ipconfig (IP-Adresse), ping -n 4 google.com, systeminfo, ver, whoami, hostname
  - tasklist (Programme), taskkill /im notepad.exe /f (beenden)
  - Grafikkarte: powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object Name, DriverVersion"
  - Speicherplatz: powershell -NoProfile -Command "Get-PSDrive -PSProvider FileSystem"
  - Programm öffnen: start notepad, start "" "C:\\Pfad\\Datei.pdf", Webseite: start https://beispiel.de
  - Code ausführen: python "datei.py", node "datei.js", Pakete: pip install NAME, winget install NAME
- wmic ist veraltet – nimm die PowerShell-Zeilen oben.
- Schlägt ein Befehl fehl, lies die Fehlermeldung und schreibe einen ANDEREN, korrigierten Befehl. Wiederhole nie denselben Befehl.`;

export function systemPrompt({ assistant, sys, nativeTools, agent, webSearch, model, memory = [], recentChats = [], codeBlocks = [], knowledge = null, intent = {}, learned = [], userMessages = [] }) {
  // Nur das Datum (ohne Uhrzeit): So bleibt der Prompt gleich und Ollama muss ihn nicht jedes Mal neu einlesen
  const now = new Date().toLocaleDateString('de-DE', { dateStyle: 'full' });
  const win = sys?.platform === 'win32';
  const os = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[sys?.platform] || 'unbekannt';
  const desk = sys?.desktop || (win ? 'C:\\Users\\<Name>\\Desktop' : '~/Desktop');
  const computer = agent && intent.computer;
  const parts = [];
  if (assistant?.systemPrompt?.trim()) parts.push(assistant.systemPrompt.trim());
  else parts.push(`Du bist ${assistant?.name || 'ein KI-Assistent'}, ein hilfreicher, kluger KI-Assistent.`);
  parts.push(`Du läufst lokal auf dem Computer des Nutzers${model ? ` (Modell: ${model})` : ''}. Heute ist ${now}.

So antwortest du:
- Beantworte genau die Frage, die gestellt wurde – direkt, verständlich, ohne Umschweife. Bleib beim Thema.
- Smalltalk wie „Hallo, wie geht es dir?“ beantwortest du kurz, natürlich und freundlich (1–2 Sätze) und fragst, wobei du helfen kannst.
- Bei Wissensfragen: zuerst die Antwort, dann nur so viel Erklärung wie nötig.
- Erfinde nichts. Weißt du etwas nicht sicher (z. B. Neuigkeiten nach deinem Wissensstand), sag das ehrlich.
- Antworte immer in der Sprache des Nutzers (meist Deutsch) – nie mit chinesischen oder anderen fremden Schriftzeichen.
- Markdown nur, wo es hilft (Listen, Code in Codeblöcken).`);

  if (memory.length) parts.push(`## Was du über den Nutzer weißt (nur nutzen, wenn es passt)\n${memory.map((f) => `- ${f}`).join('\n')}`);
  if (knowledge?.passages?.length) {
    parts.push(`## Gespeichertes Wissen zur Frage (vom Nutzer gemerkt – genauer als dein allgemeines Wissen)\n\n${knowledge.passages.map((p) => `### ${p.title}\n${p.text}`).join('\n\n')}`);
  }
  if (intent.recall && recentChats.length) parts.push(`## Frühere Chats mit dem Nutzer\n${recentChats.join('\n')}\nBrauchst du Details daraus, schreibe:\n\`\`\`erinnern\nSuchbegriff\n\`\`\`\nund hör dann auf – du bekommst die passenden Stellen.`);
  if (intent.recall && userMessages.length) {
    parts.push(`## Alle bisherigen Nachrichten des Nutzers in DIESEM Chat (älteste zuerst)\n${userMessages.map((t, i) => `${i + 1}. ${t}`).join('\n')}\nFragt der Nutzer nach etwas, das er vorher geschrieben hat, antworte genau daraus.`);
  }
  if (intent.remember) parts.push('Erzählt der Nutzer etwas Wichtiges über sich, merke es dir dauerhaft:\n```merken\nDer Nutzer heißt Alex.\n```');

  if (computer) {
    parts.push(`## Handeln auf dem Computer
Betriebssystem: ${os}. Desktop: ${desk}. Der Nutzer bestätigt jede Aktion per Klick. Erledige Aufgaben selbst mit diesen Blöcken${nativeTools ? ' (oder deinen Werkzeugen)' : ''}:

Ordner anlegen:
\`\`\`ordner
Desktop/mein-projekt
\`\`\`
Datei speichern (vollständiger Inhalt, ein Block pro Datei):
\`\`\`datei:Desktop/mein-projekt/index.html
<!DOCTYPE html>
...
\`\`\`
Befehl im sichtbaren Terminal (startet im Desktop-Ordner):
\`\`\`befehl
${win ? 'ipconfig' : 'ip addr'}
\`\`\`
Datei lesen / Ordner ansehen:
\`\`\`lesen
Desktop/projekt/index.html
\`\`\`
\`\`\`liste
Desktop/projekt
\`\`\`
Ollama steuern (pull NAME, rm NAME, load NAME, unload NAME, list, ps, start, stop):
\`\`\`ollama
pull llama3.2
\`\`\`

Regeln:
- Nach einem befehl-, lesen-, liste- oder ollama-Block SOFORT aufhören. Du bekommst das echte Ergebnis. Erfinde nie Ausgaben.
- Ordner und Dateien immer mit ordner-/datei:-Blöcken anlegen, nicht per Terminal.
- Es gibt schon ein sichtbares Terminal-Fenster – öffne kein weiteres (kein "start cmd").
- Vorhandene Datei ändern: erst lesen, dann die komplette neue Fassung mit datei: speichern.
- „Programmiere mir X“: Projektordner auf dem Desktop, alle Dateien vollständig speichern, danach öffnen.${webSearch ? `
- Weißt du einen Befehl nicht GANZ sicher, suche ihn zuerst im Internet (z. B. \`\`\`suche\n${win ? 'Windows CMD' : 'Terminal'} Befehl Speicherplatz anzeigen\n\`\`\`) statt zu raten. Erfundene Befehle gibt es nicht.` : ''}`);
    if (learned.length) {
      parts.push(`## Befehle, die auf diesem Computer schon funktioniert haben (selbst gelernt)\n${learned.map((l) => `- ${l.task}: ${l.command}`).join('\n')}\nPasst einer zur Aufgabe, nimm ihn.`);
    }
    parts.push(win ? WIN_CMD : `### Terminal\nEs ist ${os === 'macOS' ? 'macOS (zsh)' : 'Linux (bash)'}. Öffnen mit ${os === 'macOS' ? 'open' : 'xdg-open'} PFAD. Schlägt ein Befehl fehl, schreibe einen ANDEREN, korrigierten Befehl.`);
    if (codeBlocks.length) {
      const list = codeBlocks.slice(-6).map((b) => `- @code ${b.n}: ${b.path || b.lang || 'Code'} (${b.code.split('\n').length} Zeilen) – beginnt mit: ${b.code.trim().split('\n')[0].slice(0, 60)}`);
      parts.push(`## Code, der schon im Chat steht
${list.join('\n')}
Soll so ein Code unverändert gespeichert werden, schreibe ihn NICHT neu ab, sondern nur den Verweis:
\`\`\`datei:Desktop/projekt/index.html
@code ${codeBlocks[codeBlocks.length - 1].n}
\`\`\`
Nur wenn er geändert werden soll, schreibst du die neue, vollständige Fassung.`);
    }
  }
  if (webSearch && intent.web) {
    parts.push(`## Websuche
Du bekommst echte Textstellen aus dem Internet. So nutzt du sie:
- Beantworte die Frage NUR mit Infos aus Textstellen, die wirklich zur Frage passen. Unpassende Treffer ignorierst du komplett und nennst sie auch nicht als Quelle.
- Nenne konkrete Details (Namen, Modelle, Zahlen, Daten) genau so, wie sie in den Textstellen stehen.
- Passt kein Treffer, sag das ehrlich und suche einmal neu mit besseren, kurzen Begriffen:
\`\`\`suche
kurzer genauer Suchbegriff
\`\`\`
- Am Ende kurz die passenden Quellen als Links.`);
  } else if (webSearch) {
    parts.push('Geht es um Aktuelles, das du nicht sicher weißt, kannst du im Internet suchen:\n```suche\nkurzer Suchbegriff\n```\nDanach aufhören, du bekommst die Ergebnisse.');
  }
  return parts.join('\n\n');
}

// ---------- Code wiederverwenden statt neu schreiben ----------
const ACTION_KINDS = new Set(['befehl', 'terminal', 'command', 'suche', 'search', 'ollama', 'erinnern', 'merken', 'ordner', 'folder', 'lesen', 'liste']);

// Alle Code-Blöcke aus früheren KI-Antworten (nummeriert ab 1)
export function collectCodeBlocks(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role !== 'assistant' || !m.content) continue;
    const re = /```[ \t]*([^\n`]*)\n([\s\S]*?)```/g;
    let x;
    while ((x = re.exec(m.content))) {
      const info = x[1].trim();
      const kind = info.toLowerCase();
      if (ACTION_KINDS.has(kind)) continue;
      const code = x[2].replace(/\n$/, '');
      if (/^@code\b/i.test(code.trim()) || code.trim().length < 20) continue;
      const file = info.match(/^(?:[\w+#.-]+\s+)?(?:datei|file)\s*[:=]\s*(.+)$/i);
      const lang = file ? (file[1].split('.').pop() || '').toLowerCase() : kind.split(/\s+/)[0];
      out.push({ n: out.length + 1, lang, path: file ? file[1].trim() : '', code });
    }
  }
  return out;
}

const EXT_LANG = { htm: 'html', js: 'javascript', mjs: 'javascript', py: 'python', ts: 'typescript', md: 'markdown', sh: 'bash', bat: 'batch', ps1: 'powershell' };
const sameLang = (a, b) => a && b && (a === b || EXT_LANG[a] === b || EXT_LANG[b] === a || EXT_LANG[a] === EXT_LANG[b]);

// "@code", "@code 2" oder "@code letzte" -> echter Code; passend zur Dateiendung, wenn keine Nummer
export function resolveCodeRef(content, path, blocks) {
  const m = String(content || '').trim().match(/^@code(?:\s*#?\s*(\d+))?\s*$/i);
  if (!m || !blocks.length) return null;
  if (m[1]) return blocks[Number(m[1]) - 1]?.code ?? null;
  const ext = (String(path || '').split('.').pop() || '').toLowerCase();
  const match = [...blocks].reverse().find((b) => sameLang(b.lang, ext) || (b.path && b.path.split('.').pop().toLowerCase() === ext));
  return (match || blocks[blocks.length - 1]).code;
}

// Will der Nutzer vorhandenen Code nur speichern/einfügen (nicht ändern)?
export function wantsReuse(text) {
  const t = String(text || '');
  return /(speicher|einfüg|füg\S* .*ein|nimm|übernimm|verwende|benutz|pack|kopier|in (die|eine) datei|in den ordner|datei (erstell|anleg)|erstell\S* (die|eine) datei)/i.test(t)
    && !/(änder|fix|reparier|verbesser|erweiter|hinzufüg|umschreib|neu schreib|anders|bug|fehler|optimier|mach .* besser|füge? .* hinzu)/i.test(t);
}

// Schreibt die KI gerade denselben Code noch einmal ab? Dann Ende des offenen datei:-Blocks + vollständiger alter Code
export function detectRewrite(text, blocks) {
  const open = text.match(/```[ \t]*((?:[\w+#.-]+\s+)?(?:datei|file)\s*[:=]\s*[^\n`]+)\n([\s\S]*)$/i);
  if (!open || /```/.test(open[2])) return null;
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const body = norm(open[2]);
  if (body.length < 160) return null;
  for (const b of [...blocks].reverse()) {
    if (norm(b.code).startsWith(body.slice(0, 400))) {
      return { start: text.length - open[2].length, code: b.code, n: b.n };
    }
  }
  return null;
}

// Sprache der Nachricht grob erkennen (für den unsichtbaren Sprach-Hinweis an das Modell)
export function detectLanguage(text) {
  const t = ` ${String(text || '').toLowerCase()} `;
  const count = (words) => words.reduce((n, w) => n + (t.includes(` ${w} `) ? 1 : 0), 0);
  const de = count(['der', 'die', 'das', 'und', 'ist', 'nicht', 'ich', 'du', 'bitte', 'mit', 'mir', 'mein', 'ein', 'eine', 'wie', 'was', 'kannst', 'auf', 'für', 'mach', 'den', 'dem', 'zu', 'es', 'wir']) + (/[äöüß]/.test(t) ? 2 : 0);
  const en = count(['the', 'and', 'is', 'not', 'i', 'you', 'please', 'with', 'my', 'a', 'how', 'what', 'can', 'for', 'make', 'to', 'it', 'we', 'of', 'this']);
  if (de === 0 && en === 0) return 'de';
  return de >= en ? 'de' : 'en';
}

export const LANGUAGE_REMINDER = {
  de: '\n\n(Denke und antworte ausschließlich auf Deutsch – ohne chinesische oder andere fremde Schriftzeichen.)',
  en: '\n\n(Think and answer only in English – no Chinese or other foreign characters.)',
};

// Chinesische/japanische/koreanische Zeichen aus der Anzeige entfernen (nur außerhalb von Codeblöcken)
const CJK = /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]+/g;
export function stripForeign(text, keepCode = true) {
  const clean = (t) => t.replace(CJK, (m, i, all) => {
    const before = all[i - 1] || ' ';
    const after = all[i + m.length] || ' ';
    return /\s/.test(before) || /\s/.test(after) || /[.,!?:;)]/.test(after) ? '' : ' ';
  });
  if (!keepCode) return clean(String(text || ''));
  return String(text || '').split(/(```[\s\S]*?(?:```|$))/).map((part, i) => (i % 2 ? part : clean(part))).join('');
}

// Braucht die Frage aktuelle Infos aus dem Netz? Dann sucht die App selbst – auch für Modelle ohne Werkzeuge
export function needsWeb(text) {
  const t = String(text || '');
  if (t.length > 1500 || /```/.test(t)) return false;
  return /(youtube|youtuber|video|kanal|channel|tiktok|instagram|twitch|twitter|reddit|neu\p{L}{0,3}ste?[nrs]?|neute[nrs]?|upload|hochgeladen|letzte[nrs]? (video|folge|beitrag|post)|aktuell|heute|gerade|news|nachrichten|preis|kostet|kosten|wetter|wer ist|wer war|was ist (neu|los|passiert)|release|changelog|version|update|such\S* (im|nach|mal)|recherch|im internet|im web|google|online nach|link zu|wo finde|202[4-9])/iu.test(t)
    && !/(programmier|schreib\S* (mir )?(ein|einen|eine) (code|skript|programm)|erstell\S* (einen|eine) (ordner|datei))/i.test(t);
}

// Suchbegriff aus einer Frage machen (Füllwörter und Bitten wie "recherchiere im Internet" raus)
const QUERY_STOP = /^(kannst|könntest|kann|du|dir|mir|mich|bitte|mal|doch|einfach|was|ist|sind|war|das|die|der|den|dem|des|ein|eine|einen|einem|und|oder|wie|wo|wer|wann|welche|welcher|welches|zeig|zeige|sag|sage|erklär|erkläre|im|in|auf|internet|web|netz|online|google|nach|für|über|mit|zu|zum|zur|es|gibt|heißt|gerade|ich|will|möchte|wissen|weißt|hey|hallo|okay|ok|also|link|links|danke|aktuell|momentan|derzeit|denn|eigentlich|überhaupt|noch|schon|da|von|vom)$/i;
const QUERY_VERB = /^(recherch|such|guck|schau|find|nachseh|nachschau|herausfind|informier|check)/i;
export function makeQuery(text, now = new Date()) {
  const words = String(text || '').replace(/[?!.,;:„“"()]/g, ' ').split(/\s+/).filter((w) => w && !QUERY_STOP.test(w) && !QUERY_VERB.test(w));
  let q = (words.length ? words : String(text).split(/\s+/)).slice(0, 10).join(' ');
  // "neueste/aktuell" ohne Jahreszahl -> aktuelles Jahr dazu, damit keine alten Seiten kommen
  if (/\b(neu\p{L}*ste?[nrs]?|neute[nrs]?|aktuell\p{L}*|latest|newest)\b/iu.test(text) && !/\b20\d{2}\b/.test(q) && !/(video|youtube|kanal|channel|upload|folge|tiktok|instagram)/i.test(text)) q += ` ${now.getFullYear()}`;
  return q;
}

// Nachfrage zu einer vorherigen Suche ("und das allerneueste vom Upload?") – enthält kein eigenes Thema.
// Dann wird der vorige Suchbegriff wiederverwendet statt nach "aller neute upload" zu suchen.
const GENERIC_WEB = /^(aller\p{L}*|neu\p{L}*|neute\p{L}*|letzt\p{L}*|aktuell\p{L}*|upload\p{L}*|hochgeladen\p{L}*|video\p{L}*|folge|folgen|beitrag|post|posts|news|infos?|information\p{L}*|nochmal|wirklich|richtig|eigentlich|denn|überhaupt|davon|dazu|darüber|stand|erste\p{L}*|zweite\p{L}*|dritte\p{L}*|anderes?|andere\p{L}*|weitere\p{L}*|mehr|genauer|zuletzt|kürzlich|seit|gestern|morgen|woche|monat|titel|heißt|heisst|sagt|sagen|kommt|kam|wann)$/iu;
export function webQuery(text, prevQuery = '') {
  if (prevQuery && !topicTerms(text).some((w) => !GENERIC_WEB.test(w))) return prevQuery;
  return makeQuery(text);
}

// ---------- Themenwechsel erkennen ----------
// Kleine Modelle beziehen jede neue Frage auf das letzte Thema. Hier wird erkannt,
// ob die neue Nachricht wirklich daran anknüpft.
const TOPIC_STOP = new Set(('ich du er sie es wir ihr mir mich dir dich uns euch sich mein meine meinem meinen meiner dein deine '
  + 'der die das den dem des ein eine einen einem einer und oder aber auch noch schon nur sehr mehr mal bitte doch einfach '
  + 'ist sind war waren bin bist hat habe hast haben hatte kann kannst könnte konnte soll sollte will willst möchte würde wird werden '
  + 'was wie wer wo wann warum welche welcher welches wieso weshalb nicht kein keine nichts alles alle viel viele etwas '
  + 'mit von zu zum zur im in am an auf aus bei für über unter um nach vor durch gegen ohne bis seit '
  + 'weiß weiss gibt geht machen mache macht mach gut gute guten okay hey hallo danke super cool genau also halt so dann jetzt heute '
  + 'idee ideen frage fragen tipp tipps sagen sag zeig zeige erklär erkläre').split(' '));

function topicTerms(text) {
  return [...new Set(String(text || '').toLowerCase()
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 3 && !TOPIC_STOP.has(w)))];
}

const overlaps = (a, b) => a.some((x) => b.some((y) => x === y || (x.length > 5 && y.length > 5 && x.slice(0, 5) === y.slice(0, 5))));
// "das"/"dies" nur als Verweis ("merk dir das", "erklär das genauer"), nicht als Artikel ("das Wetter")
const PRONOUN_REF = /\b(das|dies|dieses|es)\b\s*(?=$|[?.!,]|noch|nochmal|genauer|bitte|auch|mal|für|in|als|zu|an|ab|um)/i;
// Aufforderungen, etwas am Bisherigen zu ändern ("mach die Schlange grün"), sind immer Fortsetzungen
const EDIT_VERBS = /^\s*(bitte\s+)?(mach|mache|ändere|änder|füge|füg|ergänze|entferne|lösch|lösche|verbessere|fixe|fix|korrigiere|erweitere|bau|baue|setz|setze|nimm|stell|stelle|pass|passe)\b/i;
// Anschluss-Wörter am Anfang ("ok und …", "aber was …", "und jetzt …") – fast immer Nachfragen
const FOLLOW_OPENER = /^\s*(ok(ay)?|oke|und|aber|also|jetzt|noch|achso|ach so|aha|ah|gut|alles klar|stimmt|hm+)\b/i;
const BACKREF = /\b(diese|diesen|dazu|davon|darüber|damit|dafür|daran|darin|daraus|dabei|ihn|ihm|oben|vorhin|eben|vorher|deine antwort|dein code|der code|weiter|nochmal|noch mal|genauer|mehr dazu|beispiel|beispiele|zusammen|fass|übersetz|korrigier|verbesser|änder)\b/i;

// 'same' = gleiches Thema, 'new' = neues Thema, 'old' = zurück zu einem früheren Thema
export function topicShift(text, windowTexts, olderTexts) {
  if (!windowTexts.length) return 'same';
  const terms = topicTerms(text);
  if (terms.length < 2 || String(text).length < 20) return 'same'; // kurze Rückfrage wie "und auf Englisch?"
  if (overlaps(terms, topicTerms(windowTexts.join(' ')))) return 'same';
  if (olderTexts.length && overlaps(terms, topicTerms(olderTexts.join(' ')))) return 'old';
  if (BACKREF.test(text) || PRONOUN_REF.test(text) || EDIT_VERBS.test(text) || FOLLOW_OPENER.test(text)) return 'same'; // "erklär das genauer", "ok und …"
  // Nur klare, eigenständige Fragen mit eigenem Thema zählen als neu
  if (!terms.some((w) => !GENERIC_WEB.test(w))) return 'same';
  return 'new';
}

// Unsichtbare Zusatz-Hinweise je nach Absicht (wirken bei kleinen Modellen besser als lange Regeln)
export function intentHints(text, { newTopic = false } = {}) {
  const t = String(text || '');
  const hints = [];
  if (newTopic) hints.push('Das ist eine NEUE, eigenständige Frage. Beantworte sie allgemein und für sich – beziehe sie NICHT auf vorherige Themen.');
  if (/\b(merk|merke|merken|behalt|vergiss nicht|speicher dir|notier dir)\b/i.test(t)) {
    hints.push('Der Nutzer möchte, dass du dir etwas merkst: Schreibe einen ```merken```-Block mit 1–3 kurzen Sätzen (das Wichtigste, worauf er sich bezieht) und bestätige in einem Satz. Wiederhole NICHT deine vorige Antwort.');
  }
  return hints.length ? `\n\n(${hints.join(' ')})` : '';
}

// Will der Nutzer, dass etwas ausgeführt wird? (Dann zählen auch ```cmd/```bash-Blöcke als Befehl)
export function wantsExecution(text) {
  return /(führ|ausführ|starte|start |öffne|öffnen|mach |erstell|anleg|lösch|install|terminal|cmd|konsole|befehl|run\b|execute|open\b|create|zeig mir|check|prüf|teste)/i.test(String(text || ''));
}

const SHELL_LANGS = new Set(['cmd', 'bat', 'batch', 'powershell', 'ps1', 'pwsh', 'bash', 'sh', 'shell', 'zsh', 'console']);
const STOP_KINDS = new Set(['befehl', 'terminal', 'command', 'suche', 'search', 'ollama', 'erinnern', 'lesen', 'liste']);

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
    if (kind === 'erinnern' || ((kind === 'suche' || kind === 'search') ? webSearch : agent)) return m.index + m[0].length;
  }
  return -1;
}

// Kleine Modelle schreiben manchmal das Wort aus der Anleitung statt eines echten Befehls ("@befehl", "BEFEHL", "dein Befehl")
const PLACEHOLDER_CMD = /^(@?\s*(be+fe+hl\w*|befehle?|command|cmd-befehl|@code\s*\d*|code)|(dein|der|ein|hier (der|dein)) befehl.*|\.\.\.|…|<[^>]+>|\[[^\]]+\])$/i;
function shellCommand(kind, body) {
  const lines = body.split('\n').map((l) => l.trim()).filter((l) => l && !/^(#|rem\s|::)/i.test(l))
    .map((l) => l.split(/\s*&&\s*/).filter((part) => !PLACEHOLDER_CMD.test(part.trim())).join(' && ')).filter(Boolean);
  if (!lines.length) return '';
  if (['powershell', 'ps1', 'pwsh'].includes(kind)) {
    return `powershell -NoProfile -Command "${lines.join('; ').replace(/"/g, '\\"')}"`;
  }
  // Prompt-Zeichen entfernen, falls die KI "C:\> dir" oder "$ ls" schreibt
  return lines.map((l) => l.replace(/^(?:[A-Za-z]:\\[^>]*>|\$|>)\s*/, '')).join(' && ');
}

// Aktionen aus Codeblöcken lesen (funktioniert auch mit kleinen Modellen ohne Tool-Support)
export function parseTextActions(content, { agent, webSearch, intent = false, codeBlocks = [] }) {
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
      const ref = resolveCodeRef(body, file[1].trim(), codeBlocks);
      actions.push({ name: 'write_file', args: { path: file[1].trim(), content: (ref ?? body) + '\n' }, reused: ref != null });
    } else if (kind === 'suche' || kind === 'search') {
      if (webSearch && body.trim()) actions.push({ name: 'web_search', args: { query: body.trim().split('\n')[0] } });
    } else if (kind === 'erinnern') {
      if (body.trim()) actions.push({ name: 'search_chats', args: { query: body.trim().split('\n')[0] } });
    } else if (kind === 'merken') {
      body.split('\n').map((l) => l.trim().replace(/^[-*]\s*/, '')).filter(Boolean).forEach((fact) => actions.push({ name: 'remember', args: { fact } }));
    } else if (!agent) {
      continue;
    } else if (kind === 'lesen' || kind === 'read') {
      body.split('\n').map((l) => l.trim().replace(/^["']|["']$/g, '')).filter(Boolean).forEach((p) => actions.push({ name: 'read_file', args: { path: p } }));
    } else if (kind === 'liste' || kind === 'ordnerinhalt') {
      body.split('\n').map((l) => l.trim().replace(/^["']|["']$/g, '')).filter(Boolean).forEach((p) => actions.push({ name: 'list_directory', args: { path: p } }));
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

// Gespeicherte Suchergebnisse: Fällt das Internet aus, kann die KI trotzdem auf Gelerntes zurückgreifen
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const cacheTerms = (q) => String(q).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !/^20\d{2}$/.test(w));
export const webCache = {
  KEY: 'od.webcache',
  save(r) {
    if (!r?.results?.length) return;
    const entry = { query: r.query, engine: r.engine, channel: r.channel || null, savedAt: Date.now(),
      results: r.results.slice(0, 6).map((x) => ({ ...x, content: String(x.content || '').slice(0, 1500) })) };
    let list = lsGet(this.KEY, []).filter((e) => e.query.toLowerCase() !== r.query.toLowerCase());
    list.unshift(entry);
    list = list.slice(0, 40);
    while (list.length && !lsSet(this.KEY, list)) list.pop(); // Speicher voll -> älteste weg
  },
  find(query) {
    const terms = cacheTerms(query);
    if (!terms.length) return null;
    let best = null;
    for (const e of lsGet(this.KEY, [])) {
      const et = cacheTerms(e.query);
      const hit = terms.filter((t) => et.some((x) => x === t || (x.length > 4 && t.length > 4 && x.slice(0, 5) === t.slice(0, 5)))).length / terms.length;
      if (hit >= 0.6 && (!best || hit > best.hit)) best = { hit, e };
    }
    return best?.e || null;
  },
};

// Führt ein Werkzeug aus. ui.progress(text, pct) zeigt Fortschritt, signal bricht ab.
// Rückgabe: { output: Text für die KI, display: Text für den Nutzer, sources? }
export async function executeTool(name, args = {}, { progress = () => {}, signal, searchEngine = 'google', searchKeys = {}, visibleTerminal = true, memory, question = '', webSearch = true, sys = '' } = {}) {
  switch (name) {
    case 'search_chats': {
      const hits = memory?.search(String(args.query || '')) || [];
      if (!hits.length) return { output: 'In früheren Chats nichts Passendes gefunden.', display: 'Nichts gefunden', hits: 0 };
      return {
        output: `Passende Stellen aus früheren Chats:\n\n${hits.map((h) => `[${h.chat} – ${h.date}] ${h.who}: ${h.text}`).join('\n\n')}`,
        display: `${hits.length} Stellen gefunden`, hits: hits.length,
      };
    }
    case 'remember': {
      const fact = String(args.fact || '').trim();
      if (fact) memory?.remember(fact);
      return { output: `Gemerkt: ${fact}`, display: fact };
    }
    case 'web_search': {
      let r;
      let offline = false;
      try {
        r = await web.search(String(args.query || ''), searchEngine, searchKeys);
        webCache.save(r);
      } catch (err) {
        // Kein Internet? Dann aus früheren Suchen antworten
        r = webCache.find(String(args.query || ''));
        if (!r) throw err;
        offline = true;
      }
      if (!r.results.length) return { output: 'Keine Treffer gefunden.', display: 'Keine Treffer.' };
      const output = r.results.map((x, i) =>
        `### Quelle ${i + 1}: ${x.title}\nURL: ${x.url}\n${x.content ? `Textstellen von der Seite:\n${x.content}` : `Kurzbeschreibung: ${x.snippet}`}`).join('\n\n');
      return {
        output: `${offline ? `(Keine Internetverbindung – das sind gespeicherte Ergebnisse einer früheren Suche vom ${new Date(r.savedAt).toLocaleDateString('de-DE')}. Sag dem Nutzer, dass sie veraltet sein können.)\n\n` : ''}Websuche nach „${r.query}“ – echte Inhalte von ${r.results.length} Quellen:\n\n${r.channel ? `Gefundener YouTube-Kanal: ${r.channel.name} (https://www.youtube.com${r.channel.url}). Die ersten Videos unten sind seine NEUESTEN Uploads.\n\n` : ''}${output}\n\nBeantworte jetzt die Frage des Nutzers aus diesen Inhalten (mit konkreten Details) und nenne die Quellen als Links. Bei Videos: Titel, Kanal, Datum und Link nennen – die App zeigt automatisch eine Vorschau.`,
        display: offline ? `${r.results.length} Treffer aus dem Speicher (offline)` : `${r.results.length} Treffer (${r.engine})`,
        sources: r.results.slice(0, 8).map((x) => ({ title: x.title, url: x.url, type: x.type || 'page', image: x.image || '', site: x.site || '', description: x.description || x.snippet || '', channel: x.channel || '', published: x.published || '', views: x.views || '', videoId: x.videoId || '' })),
      };
    }
    case 'fetch_webpage': {
      const r = await web.fetch(String(args.url || ''), String(args.query || question || ''));
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
      return { output: `Inhalt von ${r.path}${r.truncated ? ' (gekürzt)' : ''}:\n${r.content}`, display: `${r.path} (${formatBytes(r.size)})`, path: r.path, content: r.truncated ? null : r.content };
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
        r = await local.terminal(command, 120);
      } else {
        progress('Läuft …');
        r = await local.exec(command, 300, args.cwd);
      }
      const text = [r.stdout, r.stderr].filter((x) => x && x.trim()).join('\n').trim() || '(keine Ausgabe)';
      const ran = r.command && r.command !== command ? `Ausgeführt als: ${r.command}\n` : '';
      let help = '';
      if (r.code !== 0 && !r.running) {
        const unknown = /(nicht als interner oder externer befehl|is not recognized as an internal or external command|command not found|wird nicht erkannt|befehl nicht gefunden)/i.test(text);
        const goal = makeQuery(question).replace(/\b20\d{2}\b/, '').trim();
        help = `\n\nDer Befehl hat NICHT funktioniert.${unknown ? ' Diesen Befehl gibt es so nicht.' : ''} Rate nicht weiter und wiederhole ihn nicht.`
          + (webSearch ? ` Suche im Internet nach dem richtigen Befehl:\n\`\`\`suche\n${sys === 'win32' ? 'Windows CMD' : 'Terminal'} Befehl ${goal || command.split(' ')[0]}\n\`\`\`\noder schreibe einen anderen, korrigierten Befehl.` : ' Schreibe einen anderen, korrigierten Befehl.');
      }
      return {
        output: `${ran}Exit-Code ${r.code}${r.code === 0 ? ' (Erfolg)' : ' (Fehler)'}\n${text.slice(0, 12000)}${help}`,
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

// Wie viel Anleitung braucht die KI für diese Nachricht?
// recentComputer: Im aktuellen Thema wurde gerade am Computer gearbeitet (dann zählen Nachfragen wie "ja mach" mit)
export function promptIntent(text, { recentComputer = false, web = false } = {}) {
  const t = String(text || '');
  // Reiner Smalltalk ("Hallo, wie geht's?") braucht keine Computer-Anleitung
  const smalltalk = t.length < 80 && SMALLTALK.test(t.trim()) && !needsComputer(t);
  return {
    computer: !smalltalk && (needsComputer(t) || recentComputer),
    web,
    remember: REMEMBER_HINT.test(t),
    recall: RECALL_HINT.test(t),
  };
}

// ---------- Schutz vor Endlosschleifen beim Schreiben ----------
// Kleine Modelle geraten manchmal in eine Schleife und schreiben immer wieder dasselbe
// (z. B. zig gleiche Codeblöcke). Gibt die Stelle zurück, ab der abgeschnitten wird, sonst -1.
export function findRepetition(text) {
  const t = String(text || '');
  if (t.length < 80) return -1;
  // 1) Gleiche Codeblöcke: derselbe Block 3×, oder die letzten 6 Blöcke bestehen aus höchstens 2 verschiedenen
  const blocks = [...t.matchAll(/```[ \t]*([^\n`]*)\n([\s\S]*?)```/g)].map((m) => ({ key: `${m[1].trim().toLowerCase()}|${m[2].trim()}`, index: m.index }));
  const seen = new Map();
  for (const b of blocks) {
    const n = (seen.get(b.key) || 0) + 1;
    seen.set(b.key, n);
    if (n === 3) return b.index;
  }
  if (blocks.length >= 6 && new Set(blocks.slice(-6).map((b) => b.key)).size <= 2) return blocks[blocks.length - 5].index;
  // 2) Gleiche Textzeile (außerhalb von Code) 5× oder öfter
  const prose = t.replace(/```[\s\S]*?(```|$)/g, (m) => ' '.repeat(m.length));
  const lines = new Map();
  let pos = 0;
  for (const line of prose.split('\n')) {
    const k = line.trim();
    if (k.length > 8) {
      const e = lines.get(k) || { n: 0, third: -1 };
      e.n++;
      if (e.n === 3) e.third = pos;
      if (e.n >= 5) return e.third;
      lines.set(k, e);
    }
    pos += line.length + 1;
  }
  // 3) Das Ende des Textes kam schon mehrmals vor (Schleife ohne Zeilenumbrüche)
  if (t.length > 800) {
    const tail = t.slice(-160);
    let count = 0;
    let i = -1;
    let second = -1;
    while ((i = t.indexOf(tail, i + 1)) !== -1) { count++; if (count === 2) second = i; }
    if (count >= 4) return second;
  }
  return -1;
}

// Gleicher Befehl, nur anders geschrieben?
export const commandKey = (c) => String(c || '').toLowerCase().replace(/\s+/g, ' ').replace(/["']/g, '').trim();
