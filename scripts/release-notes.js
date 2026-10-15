#!/usr/bin/env node
// Release-Text für GitHub: Kopf (Download-Tabelle …) + nur der Abschnitt der aktuellen Version.
//   node scripts/release-notes.js 2.1.0 > dist/RELEASE_BODY.md
const fs = require('fs');
const path = require('path');

const version = process.argv[2] || require('../package.json').version;
const text = fs.readFileSync(path.join(__dirname, '..', 'RELEASE_NOTES.md'), 'utf8').replace(/\r\n?/g, '\n');
const first = text.search(/^### Neu in /m);
const head = (first >= 0 ? text.slice(0, first) : text).trimEnd();
const esc = version.replace(/\./g, '\\.');
const m = text.match(new RegExp(`^### Neu in v?${esc}\\s*\\n([\\s\\S]*?)(?=^### Neu in |(?![\\s\\S]))`, 'm'));
const section = m ? `### Neu in ${version}\n\n${m[1].trim()}` : `### Neu in ${version}\n\nKleinere Verbesserungen und Fehlerbehebungen.`;
process.stdout.write(`${head}\n\n${section}\n`);
