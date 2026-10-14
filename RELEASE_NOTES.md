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

### Neu in 1.6

- **Wissensspeicher**: Sag „merk dir das“, und die App speichert dauerhaft, **in allen Chats verfügbar**:
  - eingefügte Texte (auch aus der vorigen Nachricht),
  - angehängte Dateien und PDFs,
  - Links (die Seite wird gelesen),
  - oder die letzte Antwort der KI („genau, merk dir das“).
- In jedem Chat bekommt die KI automatisch die **passenden Stellen** aus dem Wissen zu deiner Frage. Die Themenliste kennt sie immer.
- **Einstellungen → Gedächtnis**: Gespeichertes Wissen ansehen, von Hand hinzufügen oder löschen. Es ist im Export/Import enthalten.

### Neu in 1.5.1

- **Erkennt Themenwechsel**: Stellst du eine neue Frage, die nichts mit dem bisherigen Gespräch zu tun hat, bezieht die KI sie nicht mehr auf das alte Thema. Nur das aktuelle Thema geht an die KI, und im Chat erscheint ein dezenter Trenner „Neues Thema“. Kommst du auf ein früheres Thema zurück, wird der ganze Chat wieder genutzt. Kurze Rückfragen wie „erklär das genauer“ bleiben im Zusammenhang.
- **„Merk dir das“** funktioniert zuverlässiger: Die KI speichert die wichtigsten Punkte, statt ihre Antwort zu wiederholen.

### Neu in 1.5

- **Code-Vorschau rechts**: Programmiert die KI eine Webseite oder ein Spiel, erscheint rechts eine **Live-Vorschau**, schon während sie schreibt. Die Breite lässt sich mit der Maus ziehen, dazu gibt es die Reiter Vorschau und Code, Neu laden, In neuem Tab öffnen und Kopieren. CSS- und JS-Dateien aus dem Chat werden automatisch eingebunden.
- **YouTube & Vorschau-Karten**: Die Websuche findet YouTube-Videos und bei Kanälen die **neuesten Uploads**. Videos und Webseiten erscheinen als Karten mit Vorschaubild, Titel, Kanal, Datum und Aufrufen, auch für YouTube-Links in Antworten.
- **Sucht von selbst**: Klingt eine Frage nach aktuellen Infos (YouTube, News, Preise, neueste Version …), sucht die App automatisch. Das klappt auch bei Modellen ohne Werkzeuge wie deepseek-r1.
- **Dateien lesen & überschreiben**: Die KI kann vorhandene Dateien lesen und Ordner ansehen und Dateien gezielt überarbeiten, mit Warnung vor dem Überschreiben.
- **Skills per Chat erstellen**: „Mach aus dieser .txt eine .skill-Datei“. Die KI schreibt den Skill direkt in ihren Skill-Ordner (`@skills/`) und zeigt dir ein Beispiel mit Auslöse-Wörtern.
- **10 neue Skills**: Skills erstellen, Mathe, Texte schreiben, Erklären & Lernen, Übersetzen, Fehlersuche, Zusammenfassen, Daten & Tabellen und mehr. Skills können jetzt eine **Priorität** haben.
- **Keine chinesischen Zeichen mehr**, auch nicht im Gedankengang. Sie werden bei der Anzeige ausgeblendet, Code bleibt unverändert.
- **Ruhigere Denk-Animation**: Sie startet nicht mehr bei jedem Wort neu, die Farben sind sauberer.
- **Bessere Skill-Auswahl**: „Programmieren“ wird nicht mehr bei Video-Fragen geladen.

### Neu in 1.4

- **Code wird nicht doppelt geschrieben**: Soll vorhandener Code nur gespeichert werden, nutzt die KI einen Verweis (`@code`), und die App setzt den Code ein. Fängt die KI trotzdem an, ihn neu abzutippen, erkennt die App das nach wenigen Zeilen und übernimmt den fertigen Code sofort. Das spart viel Zeit und Leistung.
- **100 % in deiner Sprache**: Neuer Skill „Sprache“ plus ein automatischer Hinweis an jede Nachricht. Modelle wie Qwen mischen keine chinesischen Zeichen mehr in deutsche Antworten.
- **Neue Denk-Animation**: Kleine Kugeln drehen sich im Kreis und pulsieren versetzt.
- **Neue Skills**: „Code wiederverwenden“ und „Sprache“.

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
