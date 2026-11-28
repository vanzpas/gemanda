# GovTech-Marktradar · Gemanda AG (MVP)

Leistungsnachweis 2 · CAS AI in Product Management HS 26 · Gruppe 3 (Hunkeler, Suelzle, Vanz)

**Live:** https://vanzpas.github.io/gemanda/

> Kennzahlen für den Unterricht verändert – keine Aussagen über einzelne Gemeinden.
> Gemanda AG und alle Offerten sind frei erfunden.

## Was das Tool macht

| Ansicht | Zweck |
|---|---|
| Übersicht | Startseite pro Rolle: ein Fazit-Satz mit Ampel; für die GL drei Zahlen und «Was braucht einen Entscheid?», für die Vertriebsleitung Freigaben, Verzug und Einwände, für das Offert-Team Überfälliges und Fälliges, für Account Manager «Meine Aufgaben». Gemeinde-Suche öffnet das Gemeinde-Profil. |
| Offertliste | Welche 80 von 320 Opportunitäten offerieren wir? Rangliste nach Gewinnchance, 70 Listen- + 10 Entdeckungsplätze, Begründung pro Fall, Weg für jeden Fall unter dem Schnitt, Account Manager können Fälle mit Grund hinzufügen oder herausnehmen, Export. |
| Pilotjahr | Cockpit für Team und Geschäftsleitung: vier Quartale à 80 Offerten, Status jeder Offerte (geplant, in Bearbeitung, offeriert, gewonnen, verloren), Fortschritt pro Quartal, Gewinnquote, Liste gegen Account Manager. Stand als Datei exportieren und laden; «Demo-Pilotjahr laden» zeigt einen simulierten Stand per 30.09.2027. |
| Rollen | «Ansicht als» Vertriebsleitung, Offert-Team, Geschäftsleitung (nur lesen) oder einer von 11 Account Managern (Regionen, Key Account ab 20'000 Einwohnern). Quartalsablauf: blinde Vorauswahl der AM → Freigabe durch die Vertriebsleitung → Abschluss; jede Änderung im Verlauf protokolliert. Stufe A: Rollen im Browser simuliert – im Betrieb kommen sie aus dem Login (SSO) und einer gemeinsamen Datenbank bzw. dem CRM. |
| Gemeinden | Alle 2'172 Gemeinden mit Typ, Kundenstatus, nächstem Produkt, Schulbau-Signal und Handlung. Filter «Kampagne: Typ C ohne Offerte» und «Kundinnen: nächstes Produkt». |
| Rückblick & Pilot | Was die Liste auf 900 Prüf-Offerten gebracht hätte (≈ 34 statt 14 Aufträge, CHF 1,7–2,2 Mio. Mehrumsatz pro Jahr gegenüber Zufall), Kosten der Entdeckungsplätze, Pilotmodus (Streitfälle je zur Hälfte nach Liste und nach AM), Auswertung und Antrag an die Geschäftsleitung. Exportierte Listen mit Ergebnissen lassen sich wieder hochladen. |
| So rechnet der Radar | Tabelle «Von der Analyse zum Tool», Modelle, Grenzen. |

## Aufbau

```
index.html, style.css, app.js   Webtool (statisch, läuft auf GitHub Pages) – Fachlogik
ansichten.js                    Übersicht, kompakte Liste, Board, Detailansicht, Gemeinde-Profil, Einführung
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
