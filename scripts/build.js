#!/usr/bin/env node
// Baut eine eigenständige Programmdatei (Node "Single Executable Application").
// Ergebnis: dist/app/OllamaDashboard(.exe) + dist/app/public/ – kein Node.js beim Nutzer nötig.
//
//   node scripts/build.js
//
// Auf Windows wird zusätzlich das App-Icon gesetzt (rcedit).

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const app = path.join(dist, 'app');
const isWin = process.platform === 'win32';
const exeName = isWin ? 'OllamaDashboard.exe' : 'OllamaDashboard';
const exe = path.join(app, exeName);
const pkg = require(path.join(root, 'package.json'));

const run = (cmd, args, opts = {}) => {
  console.log(`> ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { stdio: 'inherit', cwd: root, shell: isWin, ...opts });
};

fs.rmSync(app, { recursive: true, force: true });
fs.mkdirSync(app, { recursive: true });

// 1) Oberfläche & Dateien kopieren
fs.cpSync(path.join(root, 'public'), path.join(app, 'public'), { recursive: true });
fs.cpSync(path.join(root, 'skills'), path.join(app, 'skills'), { recursive: true });
for (const f of ['README.md', 'LICENSE']) {
  if (fs.existsSync(path.join(root, f))) fs.copyFileSync(path.join(root, f), path.join(app, f));
}
fs.copyFileSync(path.join(root, 'build', 'icon.ico'), path.join(app, 'icon.ico'));

// 2) SEA-Blob erzeugen
const seaConfig = path.join(dist, 'sea-config.json');
const blob = path.join(dist, 'sea-prep.blob');
fs.writeFileSync(seaConfig, JSON.stringify({
  main: path.join(root, 'server.js'),
  output: blob,
  disableExperimentalSEAWarning: true,
  useCodeCache: false,
}, null, 2));
run(process.execPath, ['--experimental-sea-config', seaConfig], { shell: false });

// 3) Node-Programm kopieren
fs.copyFileSync(process.execPath, exe);
fs.chmodSync(exe, 0o755);

if (isWin) {
  // Signatur entfernen (wird durch das Einbetten ohnehin ungültig)
  const kits = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin';
  let signtool = null;
  if (fs.existsSync(kits)) {
    for (const v of fs.readdirSync(kits).sort().reverse()) {
      const p = path.join(kits, v, 'x64', 'signtool.exe');
      if (fs.existsSync(p)) { signtool = p; break; }
    }
  }
  if (signtool) {
    try { run(`"${signtool}"`, ['remove', '/s', `"${exe}"`]); } catch { console.warn('signtool remove fehlgeschlagen – weiter'); }
  }
  // Icon & Versionsinfos setzen (vor dem Einbetten)
  try {
    const tools = path.join(dist, 'tools');
    run('npm', ['install', '--prefix', `"${tools}"`, '--no-save', '--no-audit', '--no-fund', 'rcedit@4.0.1']);
    const rcedit = path.join(tools, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe');
    execFileSync(rcedit, [exe,
      '--set-icon', path.join(root, 'build', 'icon.ico'),
      '--set-version-string', 'ProductName', 'Ollama Dashboard',
      '--set-version-string', 'FileDescription', 'Ollama Dashboard',
      '--set-version-string', 'CompanyName', 'Ollama Dashboard',
      '--set-file-version', pkg.version,
      '--set-product-version', pkg.version], { stdio: 'inherit' });
  } catch (e) {
    console.warn('rcedit fehlgeschlagen – Icon wird nur über die Verknüpfung gesetzt:', e.message);
  }
}

// 4) Blob einbetten
const postjectArgs = ['--yes', 'postject@1.0.0-alpha.6', isWin ? `"${exe}"` : exe, 'NODE_SEA_BLOB', isWin ? `"${blob}"` : blob,
  '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'];
if (process.platform === 'darwin') postjectArgs.push('--macho-segment-name', 'NODE_SEA');
run('npx', postjectArgs);

if (process.platform === 'darwin') {
  try { run('codesign', ['--sign', '-', exe]); } catch { /* optional */ }
}

console.log(`\n✔ Fertig: ${exe}`);
