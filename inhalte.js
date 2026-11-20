// =====================================================================
// Alle Texte des Marktradars an einem Ort.
// Hier könnt ihr Namen, Handlungen und Sätze in euren eigenen Worten
// anpassen, ohne den Code anzufassen. Stand: Formulierungen aus den
// Musterlösungen 2–4 – ersetzt sie durch eure eigenen Deutungen.
// =====================================================================
window.INHALT = {
  datenhinweis:
    "Kennzahlen für den Unterricht verändert – keine Aussagen über einzelne Gemeinden. " +
    "Gemeindename, BFS-Nummer, Kanton und Sprachgebiet sind echt; Gemanda AG und alle Offerten sind frei erfunden.",

  typen: {
    A: {
      name: "Zentrums- und Agglomerationsgemeinden",
      kurz: "Zentrum/Agglo",
      farbe: "#2a78d6",
      produkte: ["Schalter", "Fiskal", "Campus"],
      handlung: "Schalter mit E-ID zeigen. Die Konkurrenz ist hier am stärksten – nur bei Anfrage oder Bestandskunde gross investieren.",
    },
    B: {
      name: "Landwirtschaftsdörfer",
      kurz: "Landwirtschaft",
      farbe: "#eb6834",
      produkte: ["Fiskal", "Schalter", "Campus"],
      handlung: "Fiskal als fertiges Paket anbieten – kleine Verwaltung, wenig Zeit für Ausschreibungen.",
    },
    C: {
      name: "Wachsende Familiengemeinden",
      kurz: "Familien",
      farbe: "#1baf7a",
      produkte: ["Campus", "Schalter", "Fiskal"],
      handlung: "Bei Schulhausprojekten früh mit Campus vorsprechen; Schalter für die wachsende Einwohnerzahl. Gut die Hälfte liegt in der Romandie.",
    },
    D: {
      name: "Berg- und Tourismusgemeinden",
      kurz: "Berg/Tourismus",
      farbe: "#4a3aa7",
      produkte: ["Fiskal", "Schalter", "Campus"],
      handlung: "Fiskal mit Kurtaxen und Zweitwohnungsabgaben – schwankende Bevölkerung braucht flexible Gebühren.",
    },
  },

  // Wege für Opportunitäten unter dem Schnitt («Kein Fall fällt durch»)
  wege: {
    standard: "Standardpaket anbieten",
    partner: "Mit Partner prüfen",
    nein: "Bewusst nicht offerieren",
    spaeter: "Wiedervorlage nächstes Quartal",
    stadt: "Ausgeschlossen – eigene Informatik",
  },

  // Tabelle «Von der Analyse zum Tool» – Entwurf, in euren Worten anpassen
  herleitung: [
    ["Vier Gemeindetypen (Block 2: PCA und k-means)",
     "Typ in jeder Zeile; Ansicht «Gemeinden» mit Produktempfehlung und Handlung pro Typ",
     "Produkt nach Grösse oder Bauchgefühl empfehlen – an allen Gemeinden dasselbe verkaufen"],
    ["Typ C: 28 % aller Gemeinden, aber nur 11 % der Offerten – und 32 % gewonnen; gut die Hälfte in der Romandie",
     "Filter «Kampagne: Typ C ohne Offerte» und Hinweis Romandie",
     "Weiter vor allem in Zentrums- und Agglomerationsgemeinden offerieren, wo wir seltener gewinnen"],
    ["Gewinnchance pro Fall (Schritt 5): mit der Liste ≈ 34 statt ≈ 14 Aufträge aus 80 Offerten",
     "Offertliste, sortiert nach Gewinnchance, Schnitt bei 80 Offerten",
     "Nach Eingang offerieren, bis das Team voll ist – oder nach Offertwert, obwohl grosse Aufträge seltener gewonnen werden"],
    ["Treiber: Bestandskunde fragt selbst an 51 %, Neukunde ohne eigene Anfrage 4 %, simap 2 %",
     "Eine Zeile Begründung pro Fall; Weg für jeden Fall unter dem Schnitt",
     "Eine Liste ohne Erklärung, der die Account Manager nicht folgen; viel Aufwand für simap"],
    ["Offertwert-Schätzung (Schritt 6): 8 von 10 Fehlern zwischen −42 und +43 (CHF 1'000); Typ C im Mittel 37 zu tief",
     "Offertwert als Bandbreite, erwarteter Auftragswert, Hinweis «eher höher» bei Typ C",
     "Eine einzelne Zahl, die genauer wirkt, als sie ist"],
    ["Das Modell kennt nur Fälle, bei denen bisher etwas unternommen wurde (Projektfile Schritt 5)",
     "10 von 80 Plätzen für Entdeckung: Neukunden mit der besten Chance unter dem Schnitt",
     "Eine Liste, die sich selbst bestätigt und nie Neues lernt"],
    ["Der Gewinn 34 statt 14 gilt gegenüber Zufall – nicht gegenüber der Erfahrung der Account Manager",
     "Pilot-Spalten: «AM hätte gewählt» und «Ergebnis»; Auswertung Liste gegen AM",
     "Einen Nutzen versprechen, der gegenüber heute vermutlich kleiner ist"],
    ["Vergangenheit ist nicht Zukunft: ab 2027 kommen wegen E-ID andere Opportunitäten",
     "Warnung, wenn der Mix eines Quartals stark von den Trainingsdaten abweicht",
     "Das Modell blind weiterverwenden, obwohl sich der Markt verschoben hat"],
  ],

  grenzen: [
    "Eine Gewinnchance von 70 % heisst: Unter vielen solchen Fällen wird etwa bei sieben von zehn ein Auftrag daraus – keine Vorhersage für den einzelnen Fall.",
    "Das Modell zeigt Zusammenhänge, keine Ursachen: Mehr Kontakte gehen mit mehr Aufträgen einher, aber mehr Anrufe bringen nicht nachweislich mehr Aufträge.",
    "Im Tessin gibt es nur 75 bisherige Offerten – dort deuten wir die Zahlen nicht und zeigen nur einen Hinweis.",
    "Die Offertwert-Schätzung kennt den Gemeindetyp nicht; bei Typ C liegt sie im Mittel CHF 37'000 zu tief.",
    "Der Radar vergibt eine Priorität für unsere interne Planung. Gemeinden sehen nie eine Zahl.",
  ],
};
