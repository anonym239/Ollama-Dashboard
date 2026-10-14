# Skills – Anleitungen für deine KI

Ein **Skill** ist eine Textdatei mit der Endung **`.skill`** in diesem Ordner. Darin steht eine Anleitung, wie die KI eine bestimmte Sache richtig macht.
Bei jeder Nachricht lädt das Dashboard automatisch die Skills, die zu deiner Nachricht passen (über die **Auslöser-Wörter**), und gibt sie der KI mit.

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
| `description` | Kurze Beschreibung (nur für dich) |
| `triggers` | Komma-getrennte Wörter oder Wortanfänge. Kommt eines davon in deiner Nachricht vor, wird der Skill geladen. `programmier` passt z. B. auch auf „programmiere“. |
| `always` | `true` = Skill wird **immer** geladen (sparsam nutzen, kostet Platz im Gedächtnis der KI) |
| `priority` | Optional, Standard `1`. Höherer Wert = wird bei mehreren passenden Skills bevorzugt (z. B. `3`) |

## Tipps

- **Kurz halten.** Kleine Modelle haben wenig Kontext. Mehr als etwa 2.000 Zeichen pro Skill sind selten sinnvoll.
- **Beispiele helfen** kleinen Modellen am meisten. Zeig genau, wie die Antwort aussehen soll.
- Die mitgelieferten Skills werden bei einem Update überschrieben. Willst du einen davon anpassen, speichere ihn unter **neuem Dateinamen** (z. B. `mein-websuche.skill`) und schalte das Original in den Einstellungen aus.
