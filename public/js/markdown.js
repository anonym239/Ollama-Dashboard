// Kleiner, sicherer Markdown-Renderer (escaped HTML zuerst, kommt mit Streaming klar).

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inline(text) {
  // Inline-Code zuerst herausnehmen, damit darin nichts formatiert wird
  const codes = [];
  let s = text.replace(/`([^`\n]+)`/g, (_, c) => {
    codes.push(c);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = escapeHtml(s);
  s = s.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img alt="$1" src="$2" loading="lazy">');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(codes[+i])}</code>`);
  return s;
}

const ACTION_LABELS = { ordner: 'Ordner anlegen', folder: 'Ordner anlegen', befehl: 'Terminal-Befehl', terminal: 'Terminal-Befehl', command: 'Terminal-Befehl', ollama: 'Ollama-Aktion' };

function codeBlock(info, code, open) {
  info = (info || '').trim();
  const kind = info.toLowerCase();
  // Such-Blöcke sind interne Anweisungen der KI – unauffällig darstellen
  if (kind === 'suche' || kind === 'search') {
    return `<div class="search-hint">Recherchiere im Web: ${escapeHtml(code.trim())}</div>`;
  }
  const file = info.match(/^(?:[\w+#.-]+\s+)?(?:datei|file)\s*[:=]\s*(.+)$/i);
  const label = file ? `Datei: ${escapeHtml(file[1].trim())}` : ACTION_LABELS[kind] || escapeHtml(info.split(/\s+/)[0] || 'code');
  const path = file ? ` data-path="${escapeHtml(file[1].trim())}"` : '';
  const lang = file ? '' : ` data-lang="${escapeHtml(info.split(/\s+/)[0] || '')}"`;
  return `<div class="code-block${open ? ' streaming' : ''}${file ? ' file-block' : ''}"${path}${lang}><div class="code-head"><span>${label}</span>` +
    `<span class="code-btns">${/^(html?|svg|xml)$/i.test(file ? (file[1].split('.').pop() || '') : (info.split(/\s+/)[0] || '')) ? '<button class="code-btn" type="button" data-preview-code title="Rechts als Vorschau anzeigen">Vorschau</button>' : ''}<button class="code-btn" type="button" data-save-code title="Als Datei speichern">Speichern</button>` +
    `<button class="code-btn" type="button" data-copy-code>Kopieren</button></span></div>` +
    `<pre><code>${escapeHtml(code)}</code></pre></div>`;
}

function splitRow(line) {
  let l = line.trim();
  if (l.startsWith('|')) l = l.slice(1);
  if (l.endsWith('|')) l = l.slice(0, -1);
  return l.split('|').map((c) => c.trim());
}

export function renderMarkdown(src) {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Codeblock (auch unvollständig während Streaming)
    const fence = line.match(/^\s*(```+|~~~+)\s*([^`]*)$/);
    if (fence) {
      const marker = fence[1];
      const buf = [];
      i++;
      let closed = false;
      while (i < lines.length) {
        if (lines[i].trim().startsWith(marker)) { closed = true; i++; break; }
        buf.push(lines[i]);
        i++;
      }
      out.push(codeBlock(fence[2], buf.join('\n'), !closed));
      continue;
    }

    if (!line.trim()) { i++; continue; }

    // Überschrift
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
      i++;
      continue;
    }

    // Trennlinie
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    // Tabelle
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const head = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((c) =>
        c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : '');
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const al = (k) => (aligns[k] ? ` style="text-align:${aligns[k]}"` : '');
      out.push('<div class="table-wrap"><table><thead><tr>' +
        head.map((c, k) => `<th${al(k)}>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
        rows.map((r) => '<tr>' + head.map((_, k) => `<td${al(k)}>${inline(r[k] || '')}</td>`).join('') + '</tr>').join('') +
        '</tbody></table></div>');
      continue;
    }

    // Zitat
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${renderMarkdown(buf.join('\n'))}</blockquote>`);
      continue;
    }

    // Listen (mit einfacher Verschachtelung)
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      out.push(renderList(lines, i, (next) => { i = next; }));
      continue;
    }

    // Absatz
    const buf = [];
    while (
      i < lines.length && lines[i].trim() &&
      !/^\s*(```|~~~|#{1,6}\s|>|([-*+]|\d+[.)])\s+)/.test(lines[i]) &&
      !(lines[i].includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1]))
    ) {
      buf.push(lines[i]);
      i++;
    }
    if (!buf.length) { buf.push(lines[i]); i++; }
    out.push(`<p>${buf.map(inline).join('<br>')}</p>`);
  }
  return out.join('\n');
}

function renderList(lines, start, setIndex) {
  const indentOf = (l) => l.match(/^\s*/)[0].length;
  const baseIndent = indentOf(lines[start]);
  const ordered = /^\s*\d+[.)]/.test(lines[start]);
  const firstNum = ordered ? parseInt(lines[start].trim(), 10) : 1;
  const items = [];
  let i = start;

  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) {
      // Leerzeile: Liste geht weiter, wenn danach wieder ein Listenpunkt kommt
      if (i + 1 < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i + 1]) && indentOf(lines[i + 1]) >= baseIndent) { i++; continue; }
      break;
    }
    const ind = indentOf(l);
    const m = l.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
    if (m && ind === baseIndent) {
      let text = m[2];
      let cls = '';
      const task = text.match(/^\[([ xX])\]\s+(.*)$/);
      if (task) {
        cls = ' class="task"';
        text = `<input type="checkbox" disabled${task[1] !== ' ' ? ' checked' : ''}> ${inline(task[2])}`;
      } else text = inline(text);
      items.push({ html: text, cls, sub: [] });
      i++;
    } else if (ind > baseIndent && items.length) {
      if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
        let next = i;
        items[items.length - 1].sub.push(renderList(lines, i, (n) => { next = n; }));
        i = next;
      } else {
        items[items.length - 1].html += '<br>' + inline(l.trim());
        i++;
      }
    } else if (!m && ind <= baseIndent && items.length && !/^\s*(```|#|>)/.test(l)) {
      // Fortsetzungszeile ohne Einrückung
      items[items.length - 1].html += ' ' + inline(l.trim());
      i++;
    } else break;
  }
  setIndex(i);
  const tag = ordered ? 'ol' : 'ul';
  const startAttr = ordered && firstNum !== 1 ? ` start="${firstNum}"` : '';
  return `<${tag}${startAttr}>` + items.map((it) => `<li${it.cls}>${it.html}${it.sub.join('')}</li>`).join('') + `</${tag}>`;
}

// Für Sprachausgabe: Markdown in gesprochenen Text verwandeln
export function toSpeech(md) {
  let s = String(md || '');
  s = s.replace(/<think>[\s\S]*?(<\/think>|$)/g, ' ');
  // Unvollständigen Codeblock am Ende komplett weglassen
  const fences = s.match(/```/g);
  if (fences && fences.length % 2 === 1) s = s.slice(0, s.lastIndexOf('```'));
  s = s.replace(/```[ \t]*(suche|search|ordner|befehl|terminal|ollama)\b[\s\S]*?```/gi, ' ');
  s = s.replace(/```[\s\S]*?```/g, '. Codebeispiel. ');
  s = s.replace(/`([^`]+)`/g, '$1');
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  s = s.replace(/https?:\/\/\S+/g, 'Link');
  s = s.replace(/^\s*#{1,6}\s+(.*)$/gm, '$1.');
  s = s.replace(/^\s*>\s?/gm, '');
  s = s.replace(/^\s*([-*+]|\d+[.)])\s+/gm, '');
  s = s.replace(/^\s*\|?\s*:?-{2,}.*$/gm, '');
  s = s.replace(/\|/g, ', ');
  s = s.replace(/(\*\*|__|\*|_|~~)/g, '');
  s = s.replace(/^\s*[-*_]{3,}\s*$/gm, '');
  return s;
}
