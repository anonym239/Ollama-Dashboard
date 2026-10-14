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
