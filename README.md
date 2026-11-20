# GovTech-Marktradar · Gemanda AG (MVP)

Leistungsnachweis 2 · CAS AI in Product Management HS 26 · Gruppe 3 (Hunkeler, Suelzle, Vanz)

**Live:** https://vanzpas.github.io/gemanda/

> Kennzahlen für den Unterricht verändert – keine Aussagen über einzelne Gemeinden.
> Gemanda AG und alle Offerten sind frei erfunden.

## Was das Tool macht

| Ansicht | Zweck |
|---|---|
| Offertliste | Welche 80 von 320 Opportunitäten offerieren wir? Rangliste nach Gewinnchance, 70 Listen- + 10 Entdeckungsplätze, Begründung pro Fall, Weg für jeden Fall unter dem Schnitt, Account Manager können Fälle mit Grund hinzufügen oder herausnehmen, Export. |
| Gemeinden | Alle 2'172 Gemeinden mit Typ, Kundenstatus, nächstem Produkt und Handlung. Filter «Kampagne: Typ C ohne Offerte». |
| Rückblick & Pilot | Was die Liste auf 900 Prüf-Offerten gebracht hätte (≈ 34 statt 14 Aufträge), Kosten der Entdeckungsplätze, Pilotdesign und Auswertung Liste gegen AM. |
| So rechnet der Radar | Tabelle «Von der Analyse zum Tool», Modelle, Grenzen. |

## Aufbau

```
index.html, style.css, app.js   Webtool (statisch, läuft auf GitHub Pages)
inhalte.js                      alle Texte – hier eigene Formulierungen eintragen
daten/                          gespeicherte Modelle, Demo-Quartal, Gemeindeliste
analyse/trainieren.py           rechnet alles einmal nach den Vorgaben im Projektfile
analyse/rohdaten/               Datensätze von Moodle (nicht im Repo)
```

## Modelle neu rechnen

```bash
pip install pandas scikit-learn numpy
python analyse/trainieren.py
```

Das Skript druckt eine Prüftabelle mit den Kontrollwerten der Musterlösungen.
Hochgeladene Quartalsdateien bleiben im Browser und werden nirgends hingeschickt.
