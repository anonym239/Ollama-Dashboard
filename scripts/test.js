#!/usr/bin/env node
// Selbsttest: Pfad-Korrektur, Dateizugriff und das sichtbare KI-Terminal (Windows & Linux/macOS).
//   node scripts/test.js
process.env.OD_NO_LISTEN = '1';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const srv = require('../server.js');

const IS_WIN = process.platform === 'win32';
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✔ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✘ ${name}\n    ${e.stack || e.message}`);
  }
}

(async () => {
  console.log('\nPfad-Korrektur (Windows-Befehle)');
  const D = 'C:\\Users\\Alex\\OneDrive\\Desktop';
  const H = 'C:\\Users\\Alex';
  const fix = (c, d = D) => srv.fixWindowsCommand(c, d, H);
  await test('mkdir Desktop/ordner', () => assert.strictEqual(fix('mkdir Desktop/test_folder'), `if not exist ${D}\\test_folder mkdir ${D}\\test_folder`));
  await test('echo > Desktop\\datei', () => assert.strictEqual(fix('echo hi > Desktop\\a\\b.txt'), `echo hi > ${D}\\a\\b.txt`));
  await test('cd Desktop', () => assert.strictEqual(fix('cd Desktop'), `cd /d ${D}`));
  await test('URLs bleiben unverändert', () => assert.strictEqual(fix('start https://ollama.com/library'), 'start https://ollama.com/library >nul 2>&1'));
  await test('Desktop mit Leerzeichen wird gequotet', () => assert.strictEqual(fix('mkdir Desktop/x', 'C:\\Users\\A\\OneDrive - Firma\\Desktop'), 'if not exist "C:\\Users\\A\\OneDrive - Firma\\Desktop\\x" mkdir "C:\\Users\\A\\OneDrive - Firma\\Desktop\\x"'));
  await test('Schalter wie /d bleiben', () => assert.strictEqual(fix('dir /b'), 'dir /b'));
  await test('mkdir -p (Linux) wird übersetzt', () => assert.strictEqual(fix('mkdir -p Desktop/test_folder'), `if not exist ${D}\\test_folder mkdir ${D}\\test_folder`));
  await test('ls / cat / touch werden übersetzt', () => assert.strictEqual(fix('ls -la && cat a.txt && touch b.txt'), 'dir && type a.txt && type nul >> b.txt'));
  await test('rm -rf wird übersetzt', () => assert.strictEqual(fix('rm -rf alt'), 'rmdir /s /q alt'));
  await test('start wird von der Ausgabe abgekoppelt', () => assert.strictEqual(fix('start notepad && echo ok'), 'start notepad >nul 2>&1 && echo ok'));
  await test('"öffne ein CMD" nutzt das vorhandene KI-Terminal', () => assert.match(fix('start cmd /k'), /^echo /));
  await test('"cat" in Texten bleibt', () => assert.strictEqual(fix('echo concat category'), 'echo concat category'));

  console.log('\nSkills');
  await test('Mitgelieferte Skills lassen sich lesen', () => {
    const list = srv.loadSkills();
    assert.ok(list.length >= 6, `nur ${list.length} Skills`);
    for (const sk of list) {
      assert.ok(sk.name && sk.content.length > 100, `${sk.file} ist leer`);
      assert.ok(sk.always || sk.triggers.length, `${sk.file} hat keine Auslöser`);
    }
  });
  await test('Skill-Kopfbereich wird erkannt (auch mit BOM und CRLF)', () => {
    const sk = srv.parseSkill('x.skill', '\ufeff---\r\nname: Test\r\ntriggers: a, b c\r\nalways: true\r\n---\r\nInhalt');
    assert.deepStrictEqual([sk.name, sk.triggers, sk.always, sk.content], ['Test', ['a', 'b c'], true, 'Inhalt']);
  });

  console.log('\nDateizugriff');
  const desk = await srv.desktopDir();
  fs.mkdirSync(desk, { recursive: true });
  const rel = `Desktop/od_selftest_${Date.now()}`;
  await test('Ordner + Datei auf dem Desktop anlegen', async () => {
    await srv.fsAction('mkdir', { path: rel });
    const w = await srv.fsAction('write', { path: `${rel}/test.txt`, content: 'Hallo äöü ✓' });
    assert.ok(w.path.startsWith(desk), `${w.path} liegt nicht in ${desk}`);
    const r = await srv.fsAction('read', { path: `${rel}/test.txt` });
    assert.strictEqual(r.content, 'Hallo äöü ✓');
  });

  console.log('\nSichtbares KI-Terminal');
  // Wie das echte Fenster, nur ohne Bildschirm: Skript direkt starten
  fs.rmSync(srv.TERM_DIR, { recursive: true, force: true });
  fs.mkdirSync(srv.TERM_DIR, { recursive: true });
  let child;
  if (IS_WIN) {
    const script = path.join(srv.TERM_DIR, 'ki-terminal.ps1');
    fs.writeFileSync(script, '\ufeff' + srv.PS_TERMINAL.replace(/\r?\n/g, '\r\n'), 'utf8');
    child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-QueueDir', srv.TERM_DIR, '-StartDir', desk], { stdio: ['ignore', 'pipe', 'pipe'] });
  } else {
    const script = path.join(srv.TERM_DIR, 'ki-terminal.sh');
    fs.writeFileSync(script, srv.SH_TERMINAL, { mode: 0o755 });
    child = spawn('bash', [script, srv.TERM_DIR, desk], { stdio: ['ignore', 'pipe', 'pipe'] });
  }
  let window = '';
  child.stdout.on('data', (d) => { window += d; });
  child.stderr.on('data', (d) => { window += d; });
  for (let i = 0; i < 60 && !srv.termAlive(); i++) await new Promise((r) => setTimeout(r, 250));

  await test('Terminal-Sitzung startet', () => assert.ok(srv.termAlive(), 'session.pid fehlt'));
  const name = `od_term_${Date.now()}`;
  await test('Ordner per Befehl anlegen (so wie kleine KIs es schreiben)', async () => {
    const r = await srv.terminalRun(IS_WIN ? `mkdir Desktop/${name}` : `mkdir -p ~/Desktop/${name}`, { timeout: 60_000 });
    assert.strictEqual(r.code, 0, JSON.stringify(r));
    assert.ok(fs.existsSync(path.join(desk, name)), 'Ordner wurde nicht angelegt');
  });
  await test('Datei schreiben und Ausgabe zurückbekommen', async () => {
    const cmd = IS_WIN
      ? `echo Hallo Welt> Desktop\\${name}\\test.txt && type Desktop\\${name}\\test.txt`
      : `echo "Hallo Welt" > ~/Desktop/${name}/test.txt && cat ~/Desktop/${name}/test.txt`;
    const r = await srv.terminalRun(cmd, { timeout: 60_000 });
    assert.strictEqual(r.code, 0, JSON.stringify(r));
    assert.ok(r.stdout.includes('Hallo Welt'), `Ausgabe: ${JSON.stringify(r.stdout)}`);
  });
  await test('Umlaute in der Ausgabe', async () => {
    const r = await srv.terminalRun('echo Grüße äöü', { timeout: 60_000 });
    assert.ok(r.stdout.includes('Grüße äöü'), `Ausgabe: ${JSON.stringify(r.stdout)}`);
  });
  await test('cd bleibt für den nächsten Befehl erhalten', async () => {
    await srv.terminalRun(IS_WIN ? `cd Desktop\\${name}` : `cd ~/Desktop/${name}`, { timeout: 60_000 });
    const r = await srv.terminalRun(IS_WIN ? 'cd' : 'pwd', { timeout: 60_000 });
    assert.ok(r.stdout.trim().endsWith(name), `Ausgabe: ${JSON.stringify(r.stdout)}`);
  });
  await test('Fehler-Code wird erkannt', async () => {
    const r = await srv.terminalRun(IS_WIN ? 'dir Z:\\gibt_es_nicht_123' : 'ls /gibt_es_nicht_123', { timeout: 60_000 });
    assert.notStrictEqual(r.code, 0, JSON.stringify(r));
  });
  await test('Befehl wurde sichtbar ins Fenster getippt', () => assert.ok(window.includes('mkdir'), window.slice(0, 500)));

  child.kill();
  fs.rmSync(path.join(desk, name), { recursive: true, force: true });
  fs.rmSync(path.join(desk, path.basename(rel)), { recursive: true, force: true });

  console.log(failed ? `\n${failed} Test(s) fehlgeschlagen\n` : '\nAlle Tests bestanden\n');
  process.exit(failed ? 1 : 0);
})();
