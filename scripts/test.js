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
  await test('PowerShell-Befehle laufen über powershell', () => assert.strictEqual(fix('Get-CimInstance Win32_VideoController | Select-Object Name'), 'powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object Name"'));
  await test('"cat" in Texten bleibt', () => assert.strictEqual(fix('echo concat category'), 'echo concat category'));

  console.log('\nWebsuche & Vorschau');
  await test('YouTube-Daten werden gelesen (inkl. Klammern in Titeln)', () => {
    const html = '<script>var ytInitialData = {"a":[{"channelRenderer":{"channelId":"UC1","title":{"simpleText":"Kanal"},"navigationEndpoint":{"browseEndpoint":{"canonicalBaseUrl":"/@kanal"}}}},{"videoRenderer":{"videoId":"abcdefghijk","title":{"runs":[{"text":"Video {1} \\"Test\\""}]},"ownerText":{"runs":[{"text":"Kanal"}]},"publishedTimeText":{"simpleText":"vor 1 Tag"}}},{"lockupViewModel":{"contentId":"zyxwvutsrqp","contentType":"LOCKUP_CONTENT_TYPE_VIDEO","metadata":{"lockupMetadataViewModel":{"title":{"content":"Neues Format"}}}}}]};</script>';
    const r = srv.ytCollect(srv.ytInitialData(html));
    assert.deepStrictEqual(r.videos.map((v) => [v.videoId, v.title]), [['abcdefghijk', 'Video {1} "Test"'], ['zyxwvutsrqp', 'Neues Format']]);
    assert.strictEqual(r.channels[0].url, '/@kanal');
  });
  await test('Vorschau-Infos (Open Graph) einer Seite', () => {
    const m = srv.pageMeta('<meta property="og:title" content="Titel &amp; mehr"><meta property="og:image" content="/bild.png">', 'https://ollama.com/blog/x');
    assert.deepStrictEqual([m.title, m.image], ['Titel & mehr', 'https://ollama.com/bild.png']);
  });
  await test('Unpassende Treffer werden aussortiert', () => {
    const t = srv.keyTerms('neueste Funktionen Ollama');
    const a = srv.anchorTerms('neueste Funktionen Ollama', t);
    assert.ok(srv.scoreResult({ title: 'Nachrichten', snippet: 'Aktuelles', url: 'https://www.n-tv.de/' }, t, a) < 0.75);
    assert.ok(srv.scoreResult({ title: 'Ollama', snippet: 'Run models', url: 'https://ollama.com/' }, t, a) >= 0.75);
  });

  await test('"neuste RTX Grafikkarte" findet keine Duden-Seite', () => {
    const q = 'neuste RTX Graftikkarte 2026';
    const t = srv.keyTerms(q);
    const a = srv.anchorTerms(q, t);
    const st = srv.strongTerms(q);
    assert.strictEqual(srv.scoreResult({ title: 'Neuste Duden Wörterbuch-Suchergebnisse', snippet: 'Suchtreffer für NEUSTE', url: 'https://www.duden.de/suchen/dudenonline/neuste' }, t, a, st), 0);
    assert.strictEqual(srv.scoreResult({ title: 'AMD Radeon RX 7700 XT', snippet: 'Grafikkarte', url: 'https://www.amd.com/' }, t, a, st), 0);
    assert.ok(srv.scoreResult({ title: 'NVIDIA GeForce RTX 5090', snippet: 'Die neue Grafikkarte', url: 'https://www.nvidia.com/de-de/geforce/' }, t, a, st) >= 0.75);
  });

  await test('Ollama-Bibliothek wird gelesen', () => {
    const html = '<ul><li x-test-model class="flex"><a href="/library/qwen3"><div x-test-model-title title="qwen3"><h2><span x-test-search-response-title>qwen3</span></h2>'
      + '<p class="max-w-lg break-words text-neutral-800 text-md">Qwen3 &amp; more</p></div><div><span x-test-capability class="x">tools</span><span x-test-size class="x">8b</span><span x-test-size>14b</span></div>'
      + '<p><span x-test-pull-count>12.3M</span> Pulls <span x-test-updated>2 weeks ago</span></p></a></li></ul>';
    const [m] = srv.parseOllamaLibrary(html);
    assert.deepStrictEqual([m.name, m.desc, m.caps, m.sizes, m.pulls], ['qwen3', 'Qwen3 & more', ['tools'], ['8b', '14b'], '12.3M']);
    assert.strictEqual(srv.parseOllamaLibrary('<a href="/library/gemma3">x</a>')[0].name, 'gemma3');
  });
  await test('Systemdaten werden gelesen', async () => {
    const sp = await srv.systemSpecs();
    assert.ok(sp.ramGB > 0 && sp.cores > 0, JSON.stringify(sp));
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

  console.log('\nUpdates');
  await test('Versionen vergleichen', () => {
    assert.ok(srv.newerVersion('1.10.0', '1.9.9'));
    assert.ok(srv.newerVersion('v2.0.0', '1.99.0'));
    assert.ok(!srv.newerVersion('1.8.2', '1.8.2'));
    assert.ok(!srv.newerVersion('1.8.1', '1.8.2'));
  });
  await test('Nur neue Abschnitte der Release-Notes', () => {
    const body = '## Titel\n\n### Neu in 1.9.0\n- neu A\n\n### Neu in 1.8.2\n- neu B\n\n### Neu in 1.8\n- alt\n';
    const n = srv.notesSince(body, '1.8.2');
    assert.ok(n.includes('neu A') && !n.includes('neu B') && !n.includes('alt'), n);
  });
  await test('Version wird mitgeliefert', () => assert.match(srv.APP_VERSION, /^\d+\.\d+\.\d+$/));
  if (IS_WIN) {
    console.log('\nOllama starten');
    await test('Start über unsichtbare Konsole, nur einmal bei Doppelklick', async () => {
      // Ersatz für ollama.exe: ein harmloses Windows-Programm
      const fake = fs.mkdtempSync(path.join(os.tmpdir(), 'od-ollama-'));
      fs.mkdirSync(path.join(fake, 'Programs', 'Ollama'), { recursive: true });
      fs.copyFileSync(path.join(process.env.SystemRoot, 'System32', 'whoami.exe'), path.join(fake, 'Programs', 'Ollama', 'ollama.exe'));
      const old = process.env.LOCALAPPDATA;
      process.env.LOCALAPPDATA = fake;
      try {
        const a = srv.startOllama();
        const b = srv.startOllama();
        assert.strictEqual(a, b, 'zweiter Klick startet erneut');
        const r = await a;
        // Das Ersatzprogramm antwortet natürlich nicht – aber der Start selbst muss geklappt haben
        assert.ok(!/ließ sich nicht starten/.test(r.error || ''), r.error);
      } finally {
        process.env.LOCALAPPDATA = old;
      }
    });
  }

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
