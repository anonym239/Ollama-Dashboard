# Skills – Anleitungen für deine KI

Ein **Skill** ist eine Textdatei mit der Endung **`.skill`** in diesem Ordner. Darin steht eine Anleitung, wie die KI eine bestimmte Sache richtig macht.
Bei jeder Nachricht **schaut die KI selbst in diesen Ordner**. Sie liest **Name und Beschreibung** aller Skills, wählt die passenden aus und nutzt deren Anleitung. Die **Auslöse-Wörter** dienen nur noch als Ersatz, falls die Auswahl einmal nicht klappt, oder wenn du in den Einstellungen „Nur über Auslöse-Wörter“ wählst.

> **Wichtig:** Schreib eine **klare Beschreibung**: Wofür ist der Skill da, bei welchen Fragen hilft er? Daran erkennt die KI, wann sie ihn braucht.

## Eigenen Skill anlegen

1. Neue Textdatei in diesem Ordner anlegen, z. B. `email.skill` (Editor: Notepad reicht).
2. Oben den Kopfbereich einfügen, darunter die Anleitung:

```
---
name: E-Mails schreiben
description: Freundliche, professionelle E-Mails formulieren
triggers: email, e-mail, mail, anschreiben, bewerbung
always: false
---
## So schreibst du E-Mails
- Betreff vorschlagen
- Anrede passend zum Empfänger (Sie/du)
- Kurz und klar, höchstens 3 Absätze
- Freundlicher Gruß am Ende
```

3. Im Dashboard unter **Einstellungen → Skills** auf **„Neu laden“** klicken. Fertig.

## Felder im Kopfbereich

| Feld | Bedeutung |
|---|---|
| `name` | Anzeigename |
| `description` | **Wofür der Skill da ist** – danach wählt die KI ihn aus (z. B. „Freundliche, professionelle E-Mails und Briefe formulieren“) |
| `triggers` | Ersatz-Auslöser: Komma-getrennte Wörter oder Wortanfänge (`programmier` passt auch auf „programmiere“) |
| `always` | `true` = Skill wird **immer** geladen (sparsam nutzen, kostet Platz im Gedächtnis der KI) |
| `priority` | Optional, Standard `1`. Höherer Wert = wird bei mehreren passenden Skills bevorzugt (z. B. `3`) |

## Tipps

- **Kurz halten.** Kleine Modelle haben wenig Kontext. Mehr als etwa 2.000 Zeichen pro Skill sind selten sinnvoll.
- **Beispiele helfen** kleinen Modellen am meisten. Zeig genau, wie die Antwort aussehen soll.
- Die mitgelieferten Skills werden bei einem Update überschrieben. Willst du einen davon anpassen, speichere ihn unter **neuem Dateinamen** (z. B. `mein-websuche.skill`) und schalte das Original in den Einstellungen aus.
