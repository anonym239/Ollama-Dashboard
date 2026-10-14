## ✦ Ollama Dashboard

Dein modernes KI-Chat-Dashboard für **lokale KIs mit Ollama**: komplett offline, ohne Cloud und ohne API-Keys.

### Download

| Datei | Beschreibung |
|---|---|
| `OllamaDashboard-Setup-*.exe` | **Windows-Installer** (empfohlen): Startmenü, Desktop-Verknüpfung, Deinstallation, keine Adminrechte nötig |
| `OllamaDashboard-Portable-*-win-x64.zip` | Portable Version: entpacken und `OllamaDashboard.exe` starten |
| `SHA256SUMS.txt` | Prüfsummen |

> Voraussetzung ist [Ollama](https://ollama.com/download). Fehlt es, hilft dir die App beim Installieren und Starten.
> Windows SmartScreen kann bei unsignierten Programmen warnen: Klicke dann auf **„Weitere Informationen“** und danach auf **„Trotzdem ausführen“**.

### Neu in 1.3

- **Skills**: Anleitungen für die KI als `.skill`-Dateien im Ordner `skills`. Passende Skills werden automatisch geladen, je nachdem worum es geht. Mitgeliefert sind Skills für **Websuche, Programmieren, Terminal & CMD, Dateien & Ordner, Ollama & Modelle, Gedächtnis** und **Gut antworten**. Eigene Skills legst du einfach in den Ordner (Anleitung: `skills/README.md`). In den Einstellungen kannst du sie an- und ausschalten.
- **Stabileres KI-Terminal unter Windows**: Kein Fehler mehr, wenn das Dashboard die Statusdatei liest, während das Terminal sie schreibt.

### Neu in 1.2.1

- **Scrollen beim Schreiben**: Während die KI Code schreibt, kannst du im Code-Fenster und im Chat frei scrollen, ohne dass es zurückspringt. Bist du ganz unten, läuft die Anzeige automatisch mit, wie in einem Terminal.

### Neu in 1.2

- **Viel bessere Websuche**: Unpassende Treffer (z. B. Nachrichtenseiten bei Technikfragen) werden aussortiert, offizielle Seiten bevorzugt und mehrere Suchmaschinen kombiniert. Die KI liest auf bis zu 4 Seiten **genau die Textstellen, die zur Frage passen**, nicht mehr nur den Seitenanfang.
- **Gedächtnis**: Die KI sieht automatisch in früheren Chats nach, wenn du dich darauf beziehst („Erinnerst du dich …?“), und merkt sich wichtige Infos über dich dauerhaft. Du kannst sie in den Einstellungen ansehen und löschen.
- **Schneller**: Das Modell bleibt geladen, und der Prompt wird nicht mehr jede Minute komplett neu eingelesen. Der KI-Terminal-Text wird schneller getippt.
- **Terminal hängt nicht mehr**: `start …` blockiert nicht mehr, und „öffne ein CMD“ nutzt das vorhandene KI-Terminal.
- **Neue Denk-Animation** mit Live-Anzeige von Sekunden und verbrauchten Tokens, dazu Tokens pro Antwort und für die ganze Sitzung.

### Neu in 1.1

- **Sichtbares KI-Terminal**: Die KI öffnet ein echtes CMD-Fenster, platziert es auf deinem Bildschirm, tippt Befehle selbst ein und nutzt die echte Ausgabe.
- **Schlauer bei Windows-Befehlen**: `mkdir -p`, `ls`, `cat`, `Desktop/ordner` und OneDrive-Desktops werden automatisch korrigiert. Ordner und Dateien landen zuverlässig auf dem Desktop.
- **Keine erfundenen Ergebnisse mehr**: Nach einem Befehl wartet die KI auf das echte Ergebnis.
- **Keine Endlosschleifen**: Gleiche Aktionen werden in einer Antwort nur einmal ausgeführt.
- **Eingabefeld** wird nach dem Senden zuverlässig geleert, auch bei Spracheingabe.
- **Schlichteres Design**: App-Logo statt Emojis, Chatliste wie bei Claude.

### Highlights

- 💬 Echter KI-Chat mit Streaming, Markdown, Code und Chatverlauf
- 🤖 Beliebig viele Assistenten mit eigenem Modell und eigener Persönlichkeit
- ⚡ Agent-Modus: Die KI legt **mit deiner Erlaubnis** Ordner und Dateien an, führt Befehle aus und steuert Ollama
- 🌐 Websuche ohne API-Key (Google als Standard, DuckDuckGo, Bing, Brave und optional kostenlose API-Anbieter)
- 📎 Bilder, PDFs und Code-Dateien schicken
- 🔊 Automatisches Vorlesen und 🎤 Spracheingabe
- 🔌 Startet Ollama mit einem Klick, wenn es nicht läuft
