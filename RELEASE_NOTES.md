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

### Neu in 2.1.0

- **Update per Klick neu gebaut:** Das Dashboard bleibt beim Herunterladen offen. Danach startet das Setup sichtbar mit Fortschrittsfenster. Erst unmittelbar vor dem Installieren schließt es das Dashboard, installiert und startet die neue Version selbst. Bricht das Setup ab, läuft das Dashboard einfach weiter und zeigt den Grund an.
- **Normale Antworten:** Die KI bekommt fast keine Zusatz-Anweisungen mehr und antwortet wie ohne Dashboard. Websuche, Zugriff auf den PC und Gedächtnis kommen nur dazu, wenn du sie brauchst.
- **Websuche nur bei echtem Bedarf:** Wörter wie „heute“, „gerade“ oder „Update“ lösen keine Suche mehr aus. Gesucht wird, wenn du darum bittest oder nach Neuem fragst (z. B. „Was ist die neueste …?“).
- **Websuche zuverlässiger:**
  - Die App nutzt jetzt auch die Windows-Zertifikate. Dadurch klappt die Suche auch mit Virenscannern, die HTTPS prüfen.
  - Fehlermeldungen sagen ehrlich, ob die Suchanbieter nicht erreichbar sind oder nur nichts Passendes gefunden wurde. Kein falsches „keine Internetverbindung“ mehr.
- **Gedächtnis:**
  - Die KI sieht den ganzen Chat und vergisst frühere Nachrichten nicht mehr.
  - Was du über dich erzählst („ich heiße …“, „ich wohne in …“, „mein Lieblingsspiel ist …“), merkt sich die App automatisch für alle Chats.
- **Schlichtes Design:** neutrale Grautöne statt Farbverläufen, Antworten ohne großes Symbol davor, ruhige Knöpfe.

### Neu in 2.0.5

- **Anzahl wird beachtet:** „Führ eins davon aus“, „einen zufälligen“, „zwei davon“ oder „alle“ führt genau so viele Befehle aus.
  - Bei „den Befehl“ ist es einer.
  - Zufällig gewählt werden lieber Befehle ohne (womöglich erfundene) Pfade.
  - Linux-Befehle wie `free` oder `journalctl` und Befehle ohne Angaben (z. B. ein nacktes `copy`) werden unter Windows übersprungen.
- **Keine Wiederholungen:** Die KI schreibt Listen und Antworten, die schon im Chat stehen, nicht noch einmal. Nach dem Ausführen erklärt sie nur kurz das Ergebnis.
- **„Zeig mir 3 Sachen“** liefert genau 3 Sachen.

### Neu in 2.0.4

- **Klassischer Lade-Kreis:** Wenn die KI überlegt, dreht sich jetzt ein schlichter Ring mit farbigem Bogen statt der vielen Punkte.

### Neu in 2.0.3

- **„Führ das aus“ funktioniert:** Sagst du nach einer Antwort mit Code „führ den Befehl aus“, „starte das Skript“ oder „teste den Code“, führt die App den vorhandenen Code selbst aus, statt die KI ihn neu schreiben zu lassen:
  - CMD-, Batch- und PowerShell-Befehle laufen direkt im Terminal.
  - Python- und JavaScript-Code wird in `Desktop/KI-Skripte` gespeichert und gestartet.
  - Webseiten werden im Browser geöffnet.
  - Die KI erklärt danach nur noch das Ergebnis.
- **Vorhandenen Code ändern statt neu schreiben:** Soll Code verbessert werden, nimmt die KI den Code aus dem Chat als Grundlage und ändert nur, was nötig ist.

### Neu in 2.0.2

- **Update per Klick repariert:** Das Setup lief bisher unsichtbar im Hintergrund. Wartete Windows z. B. auf eine Bestätigung, hing das Update endlos. Jetzt:
  - Ein kleines Setup-Fenster zeigt den Fortschritt.
  - Nach spätestens 5 Minuten wird abgebrochen, und die App startet auf jeden Fall wieder.
  - Der Download zeigt MB an und bricht ab, wenn 30 Sekunden keine Daten kommen.
  - Nach dem Neustart siehst du, ob das Update geklappt hat. Wenn nicht, öffnet „Setup selbst öffnen“ das heruntergeladene Setup.
- **Klassische Denk-Animation ist zurück:** Kugeln im Kreis. Neu: Am Ende jeder Runde springt eine Kugel unten heraus und hüpft links wieder hinein. Dazu kurze Stichworte wie „Denkt nach“, „Liest Suchergebnisse“ oder „Wertet Ausgabe aus“.
- **Lade-Symbole drehen sich durchgehend**, statt bei jedem neuen Textstück neu anzufangen.
- Text ohne Programmiersprache (z. B. ASCII-Kunst) bleibt im Chat sichtbar und wird nicht als „Code.txt“ eingepackt.
- **Die KI schaut selbst im Web nach:**
  - Schlägt ein Befehl fehl, sucht die App sofort nach dem richtigen Befehl.
  - Sagt die KI „weiß ich nicht“ oder „nicht sicher“, sucht die App kurz, und die KI antwortet mit den echten Infos.
  - Alles wird für offline gespeichert.
- PowerShell-Befehle (z. B. `Get-CimInstance`, `Select-Object`) laufen jetzt automatisch über PowerShell statt im CMD zu scheitern.
- **Besseres Deutsch:** klare Regeln und ein Beispiel für natürliche Antworten. Bei Modellen, die kaum Deutsch können (z. B. deepseek-r1), gibt es einmal einen Tipp für bessere Modelle.

### Neu in 2.0.1

- **Die KI zeigt in Stichworten, was sie gerade tut:**
  - Beim Nachdenken steht der aktuelle Gedanke als Kurztext da, z. B. „Der Nutzer fragt nach der neuesten RTX Grafikkarte …“.
  - Nach einer Aktion steht da, womit sie weitermacht, z. B. „Liest die Ergebnisse zu „neueste RTX Grafikkarte 2026“ …“, „Wertet die Terminal-Ausgabe aus …“ oder „Befehl ging schief – sucht eine Lösung …“.
  - Beim Code-Schreiben läuft live „Schreibt Datei: index.html +46 −0“ bzw. „Ändert Datei: …“ mit den hinzugefügten und gelöschten Zeilen.
- Der Gedankengang bleibt beim Nachdenken eingeklappt, weil der Kurztext schon das Wichtigste zeigt.

### Neu in 2.0.0

- **Normale, passende Antworten:** Die KI bekommt nur noch die Anleitung, die zur Nachricht passt. Bei „Hallo, wie geht's?“ antwortet sie kurz und natürlich, ohne Terminal-Regeln und Werkzeuge im Hinterkopf. Computer-Anleitung, Websuche und Erinnerungen kommen nur dazu, wenn du danach fragst.
- **Skills entfernt:** Der Skill-Ordner und die Skill-Auswahl sind weg. Sie haben kleine Modelle eher verwirrt. Beim Update wird der alte Ordner gelöscht.
- **Bessere Websuche:** Bitten wie „recherchiere bitte im Internet“ landen nicht mehr im Suchbegriff. Treffer müssen das eigentliche Thema enthalten (z. B. „RTX“), sonst fliegen sie raus. Keine Duden-Seiten mehr bei „neuste RTX Grafikkarte“. Bei „neueste …“ wird die aktuelle Jahreszahl mitgesucht.
- **Mehr CMD-Wissen:** Eine kompakte Windows-CMD-Anleitung mit den richtigen Befehlen (statt Linux-Befehlen). Schlägt ein Befehl fehl oder gibt es ihn nicht, sucht die KI den richtigen Befehl im Web, statt zu raten.
- **Lernt dazu, auch für offline:** Befehle, die nach einem Fehler oder einer Websuche geklappt haben, merkt sich die App und nutzt sie wieder. Suchergebnisse werden gespeichert: Fällt das Internet aus, antwortet die KI aus früheren Suchen. Beides steht unter Einstellungen → Gedächtnis.
- **Merkfunktion im Chat:** Fragst du „was hab ich vorhin geschrieben?“, bekommt die KI den ganzen Chat und alle deine Nachrichten.
- **Spam-Schutz:** Schreibt die KI in einer Schleife immer wieder dasselbe, wird die Antwort sofort gestoppt. Pro Antwort gibt es höchstens 5 Terminal-Befehle, und derselbe Befehl läuft nur einmal. Platzhalter wie „@befehl“ werden nie ausgeführt. Dazu kommt eine Wiederholungsstrafe für das Modell.
- **Ollama starten öffnet keine CMD-Fenster mehr:** Ollama läuft mit einer unsichtbaren Konsole, und ein Doppelklick startet es nur einmal.
- **Neue Denk-Animation:** eine leuchtende, sich verformende Energiekugel mit kreisenden Lichtpunkten, wechselnde Statustexte und Wellen-Balken.
- **Schimmer-Effekt:** Was gerade läuft (Nachdenken, Websuche, Terminal), schimmert hell von links nach rechts.

### Neu in 1.9.0

- **Automatische Updates:** Gibt es eine neue Version, erscheint oben „Update verfügbar“. Ein Klick auf **„Jetzt installieren“** reicht: Die App lädt das Setup herunter, prüft die Prüfsumme, installiert still im Hintergrund, startet neu und lädt die Seite selbst neu.
- „Was ist neu?“ zeigt nur die Neuerungen seit deiner Version.
- **Einstellungen → Updates:** installierte Version, „Nach Updates suchen“ und automatische Prüfung an/aus (beim Start und alle 6 Stunden).
- Die Portable-Version zeigt einen Download-Knopf, weil sie sich nicht selbst installieren kann.
- **Chat-Blasen:** Kurze Nachrichten wie „hallo“ stehen wieder in einer Zeile. Der Text geht erst in die Breite und bricht erst bei längeren Texten um.

> Automatische Updates gibt es ab Version 1.9.0. Diese Version einmal von Hand installieren, danach geht es per Klick.

### Neu in 1.8.2

- **„Skills gelesen“ steht jetzt direkt unter dem Namen des Assistenten**, nicht mehr als eigene Zeile darüber. Während die KI im Skill-Ordner nachsieht, erscheint der Assistent sofort mit „Sieht im Skill-Ordner nach …“. Braucht sie keinen Skill, wird keine Zeile angezeigt.

### Neu in 1.8.1

- **Nachfragen werden richtig verstanden:** „ok, und was ist das allerneueste vom Upload?“ gilt jetzt als Nachfrage und nicht mehr als neues Thema. Suchbegriffe und gefundene Treffer (z. B. YouTube-Videos) zählen mit zum Gesprächsthema.
- **Nachfragen zu einer Suche** verwenden den vorigen Suchbegriff wieder (z. B. den Kanalnamen), statt nach einzelnen Wörtern zu suchen. Die KI bekommt so echte Ergebnisse statt zu raten.
- Die Trennlinie „Neues Thema“ wird nicht mehr angezeigt. Die Erkennung läuft nur noch unsichtbar im Hintergrund und ist vorsichtiger.

### Neu in 1.8

- **Code kompakt im Chat**: Schreibt die KI Dateien oder längeren Code, erscheint statt langer Code-Blöcke eine Karte **„N Dateien bearbeitet“** mit **+hinzugefügten / −gelöschten Zeilen** pro Datei und in der Summe.
- **Änderungen ansehen**: Ein Klick auf eine Datei zeigt rechts, was sich geändert hat. Gelöschte Zeilen sind rot, neue grün, mit Zeilennummern alt/neu, und unveränderte Bereiche sind eingeklappt. Dazu gibt es die Reiter **Code** (mit Zeilennummern) und **Vorschau** (bei HTML) sowie Kopieren, Speichern und In neuem Tab öffnen.
- Verglichen wird mit der vorigen Fassung im Chat oder mit der Datei, die vor dem Überschreiben auf deinem PC lag. Neue Dateien sind komplett grün.
- Gespeicherte Dateien erscheinen nur noch als kleine Zeile mit „Öffnen“.
- „Mach die Schlange grün“ und ähnliche Änderungswünsche gelten nicht mehr fälschlich als neues Thema.

### Neu in 1.7

- **Die KI wählt ihre Skills selbst**: Vor jeder Antwort schaut sie in den Skill-Ordner, liest Titel und Beschreibung aller Skills und nutzt die, die bei deiner Frage wirklich helfen. Das klappt auch ohne passende Auslöse-Wörter, etwa „Wie viel Trinkgeld bei 47 €?“ mit dem Mathe-Skill. Im Chat siehst du „Skills gelesen: …“.
- Klappt die Auswahl einmal nicht, nimmt die App automatisch die Auslöse-Wörter. In den Einstellungen kannst du auch „Nur über Auslöse-Wörter“ wählen (schneller).

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
