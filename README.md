# ✦ Ollama Dashboard

Ein modernes, cleanes KI-Chat-Dashboard für deine **lokalen KIs mit [Ollama](https://ollama.com)**, ähnlich wie ChatGPT, aber **komplett auf deinem Rechner**: keine Cloud, kein Konto, keine API-Keys.

## Funktionen

- 💬 **Echter KI-Chat** mit Streaming, Markdown, Tabellen, Code-Blöcken (Kopieren/Speichern), Chatverlauf, Suche, Anheften, Export
- 🤖 **Viele KIs**: beliebig viele **Assistenten** mit eigenem Namen, Emoji, Modell, Persönlichkeit, Kreativität und Gedächtnisgröße. Du kannst mitten im Chat die KI wechseln.
- 🧠 **Modelle verwalten**: KIs herunterladen (mit Fortschritt), starten, stoppen und löschen, direkt in der App
- ⚡ **Agent-Modus**: Die KI kann **mit deiner Erlaubnis** auf deinem PC handeln:
  - Ordner auf dem Desktop anlegen, Dateien speichern und lesen (z. B. „Programmiere mir Snake“, dann landet ein fertiges Projekt auf dem Desktop)
  - **Sichtbares KI-Terminal**: Die KI öffnet ein echtes CMD- bzw. Terminal-Fenster auf deinem Bildschirm, **tippt Befehle selbst ein** und arbeitet mit der echten Ausgabe weiter, ohne Ergebnisse zu erfinden.
  - Typische Fehler kleiner Modelle werden automatisch korrigiert, z. B. `mkdir -p Desktop/ordner`, falsche Schrägstriche oder ein OneDrive-Desktop.
  - Ollama steuern: Modelle herunterladen, starten, stoppen, Ollama starten oder beenden
  - Jede Aktion erscheint als Karte mit **Erlauben / Ablehnen**
  - Funktioniert auch mit **kleinen KIs**: Modelle ohne Tool-Support nutzen einfache Code-Blöcke wie ` ```datei:Desktop/projekt/index.html `
- 🌐 **Websuche ohne API-Key**: Weiß die KI etwas nicht, recherchiert sie selbst im Internet, liest die besten Seiten und formuliert daraus eine eigene Antwort mit Quellen.
  - Anbieter wählbar: **Google (Standard)**, DuckDuckGo, Bing, Brave. Klappt einer nicht, wird automatisch der nächste genommen.
  - Optional mit kostenlosem Kontingent: Google Custom Search API, Tavily oder eine eigene SearXNG-Instanz
- 🖥️ **Code-Vorschau**: Webseiten und Spiele, die die KI programmiert, erscheinen rechts als Live-Vorschau. Die Breite lässt sich ziehen.
- ▶️ **YouTube & Vorschau-Karten**: Gefundene Videos und Seiten erscheinen als Karten mit Bild, Titel und Kanal.
- 📘 **Skills**: Anleitungen für die KI als `.skill`-Dateien im Ordner `skills`, z. B. wie sie richtig im Web sucht, programmiert oder das Terminal nutzt. Passende Skills werden automatisch geladen. Eigene kannst du einfach dazulegen, siehe [`skills/README.md`](skills/README.md).
- 🧠 **Gedächtnis & Wissensspeicher**: Die KI erinnert sich an frühere Chats und merkt sich Infos über dich. Mit „merk dir das“ speichert sie auch lange Texte, Dateien, Webseiten oder ihre letzte Antwort dauerhaft, verfügbar in allen Chats.
- 📎 **Dateien schicken**: Bilder (für Vision-Modelle wie `gemma3`, `llava`), PDFs, Text- und Code-Dateien, per Klick, Drag & Drop oder Einfügen
- 🔊 **Automatisches Vorlesen** (Text-to-Speech), schon während die KI schreibt. Stimme, Tempo und Tonhöhe sind einstellbar.
- 🎤 **Spracheingabe** (Diktieren)
- 💭 **Denk-Modelle** (z. B. `qwen3`, `deepseek-r1`): Der Gedankengang wird eingeklappt angezeigt.
- 🔌 **Ollama aus?** Die App zeigt einen Hinweis und startet Ollama mit einem Klick. Ist Ollama nicht installiert, hilft sie auch dabei.
- 🌙 Hell- und Dunkelmodus, läuft auch am Handy oder Tablet

## Installation

### Windows (empfohlen): Installer

1. Lade unter [**Releases**](https://github.com/anonym239/Ollama-Dashboard/releases/latest) die Datei `OllamaDashboard-Setup-x.y.z.exe` herunter.
2. Starte das Setup. Es braucht keine Administratorrechte und erstellt Startmenü- und Desktop-Verknüpfungen.
3. Starte **Ollama Dashboard**. Der Browser öffnet sich automatisch.
4. Falls Ollama fehlt, klicke in der App auf **„Automatisch installieren“** oder lade es von [ollama.com/download](https://ollama.com/download).

> **Hinweis:** Weil der Installer nicht kostenpflichtig signiert ist, kann Windows SmartScreen warnen. Klicke dann auf **„Weitere Informationen“** und danach auf **„Trotzdem ausführen“**.
> Das kleine Konsolenfenster ist der lokale Server. Lass es offen, solange du das Dashboard nutzt.

**Updates:** Erscheint eine neue Version, zeigt die App oben „Update verfügbar“. Ein Klick auf **„Jetzt installieren“** reicht: Sie lädt das Setup, prüft die Prüfsumme, installiert und startet neu (ab Version 1.9.0).

Alternativ gibt es eine **portable ZIP-Version** zum Entpacken und Starten, ohne Installation.

### Aus dem Quellcode (Windows, macOS, Linux)

Voraussetzungen: [Node.js](https://nodejs.org) ab Version 18 und [Ollama](https://ollama.com/download).

```bash
git clone https://github.com/anonym239/Ollama-Dashboard.git
cd Ollama-Dashboard
npm start
```

Unter Windows kannst du auch einfach `start.bat` doppelklicken, unter Linux und macOS `./start.sh` ausführen.
Es müssen **keine Pakete installiert** werden.

Danach öffnet sich [http://localhost:3000](http://localhost:3000).

## Erste Schritte

1. Lade unter **Modelle** eine KI herunter. Für den Anfang eignen sich:
   - `llama3.2`: schnell und gut für den Alltag (ca. 2 GB)
   - `qwen2.5:3b` oder `qwen3:4b`: klein und gut als **Agent** (Tool-Support)
   - `gemma3:4b`: versteht **Bilder**
   - `qwen2.5-coder:7b`: zum **Programmieren**
2. Schreib einfach los, zum Beispiel:
   - „Programmiere mir das Spiel Snake und speichere es auf meinem Desktop.“
   - „Was gibt es Neues bei Ollama? Recherchiere im Internet.“
   - „Lade das Modell gemma3:4b herunter.“
3. Oben rechts schaltest du **Agent**, **Web** und **Vorlesen** an oder aus.

## Sicherheit & Datenschutz

- Alles läuft **lokal**. Chats, Assistenten und Einstellungen liegen nur in deinem Browser (IndexedDB/localStorage).
- Der Server lauscht nur auf `127.0.0.1` und ist im Netzwerk nicht erreichbar.
- Zugriffe auf deinen PC (Dateien, Terminal) sind durch einen **geheimen Sitzungsschlüssel** sowie Host- und Origin-Prüfungen geschützt. Andere Webseiten können sie also nicht auslösen.
- Standardmäßig fragt die KI **vor jeder Aktion** um Erlaubnis. Das lässt sich in den Einstellungen anpassen.
- Ins Internet geht nur die **Websuche**, und nur wenn sie eingeschaltet ist. Die Suchanfragen gehen an den gewählten Suchanbieter.
- Die **Update-Prüfung** fragt bei GitHub nach der neuesten Version (abschaltbar unter Einstellungen → Updates). Updates werden nur nach deinem Klick installiert und vorher per SHA-256-Prüfsumme geprüft.

## Einstellungen (Umgebungsvariablen)

| Variable     | Standard                 | Bedeutung                                   |
|--------------|--------------------------|---------------------------------------------|
| `PORT`       | `3000`                   | Port des Dashboards                         |
| `HOST`       | `127.0.0.1`              | Adresse (`0.0.0.0` = im Netzwerk erreichbar, **dann ist auch der PC-Zugriff im Netzwerk erreichbar!**) |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Adresse des Ollama-Servers                  |
| `NO_OPEN`    | –                        | `1` = Browser nicht automatisch öffnen      |

## Selbst bauen

```bash
npm run build          # erzeugt dist/app/OllamaDashboard(.exe) – eigenständig, ohne Node.js
iscc /DMyAppVersion=1.0.0 installer/setup.iss   # Windows-Installer (Inno Setup 6)
```

Releases entstehen automatisch per GitHub Actions (Windows-Installer, portable ZIP und Prüfsummen):

- **Version in `package.json` erhöhen und pushen**: Dann wird ein Release `vX.Y.Z` gebaut, sofern es noch nicht existiert, oder
- einen Tag pushen: `git tag v1.0.1 && git push origin v1.0.1`

## Lizenz

MIT. Mitgeliefert wird [pdf.js](https://mozilla.github.io/pdf.js/) (Apache-2.0) zum Lesen von PDFs.
