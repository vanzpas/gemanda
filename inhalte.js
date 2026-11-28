// =====================================================================
// Alle Texte des Marktradars an einem Ort.
// Hier könnt ihr Namen, Handlungen und Sätze in euren eigenen Worten
// anpassen, ohne den Code anzufassen. Stand: Formulierungen aus den
// Musterlösungen 2–4 – ersetzt sie durch eure eigenen Deutungen.
// =====================================================================
window.INHALT = {
  // ---------------------------------------------------------------
  // Unsere eigenen Erkenntnisse aus Block 3 (Ergebnis_Block3.html)
  // ---------------------------------------------------------------
  gruppe: {
    toolSatz: "Anfragen von Gemeinden, von Typ C, die Bestandskunden sind, sollen priorisiert werden.",
    warumSatz: "Nicht alle Gemeindetypen gewinnen wir gleich oft. Das Offert-Team steckt am meisten Arbeit in Typ A, aber Typ C ist am erfolgversprechendsten.",
    verschiebung: "Die Arbeit verschiebt sich von Typ A nach Typ C.",
    // Unsere drei wichtigsten Merkmale: [Merkmal, Spalte, Wert, Vergleichsname, Vergleichswert]
    merkmale: [
      ["Bestandskunden", "bestandskunde", "ja", "Neukunden", "nein"],
      ["Anfragen von Gemeinden", "quelle", "Anfrage der Gemeinde", "Account Manager", "Account Manager"],
      ["Typ C", "gemeindetyp", "C", "Typ A", "A"],
    ],
    wennDann: [
      ["eine Bestandskundin selbst bei uns anfragt", "gewinnen wir etwa jede zweite Offerte"],
      ["es eine Neukundin ohne Anfrage der Gemeinde ist", "gewinnen wir nur etwa jede 23. Offerte"],
    ],
    // Offene Punkte aus Block 3 – und wo der Radar sie beantwortet
    offenePunkte: [
      ["Test mit Opportunitäten ausserhalb der Liste: Wie viele Offerten pro Quartal, und wie lange?",
       "10 Entdeckungsplätze pro Quartal (einstellbar) und ein Pilot über ein Jahr (4 Quartale, 320 Offerten). Im Rückblick kostet das im Schnitt 0,6 Aufträge und bringt 15 statt 6 Neukunden pro Quartal."],
      ["Beispiel für den Marktradar (Schritt 6, Regression)",
       "Der Radar zeigt pro Opportunität den Offertwert mit Bandbreite, z. B. Fiskal, 5'000 Einwohner, Neukunde, 1 Kontakt: rund CHF 183'000, wahrscheinlich zwischen 141'000 und 226'000. Als Gruppe noch nachrechnen und bestätigen."],
    ],
  },

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
    ["Gewinnchance pro Fall (Schritt 5): mit der Liste rund 34 statt rund 14 Aufträge aus 80 Offerten, je nach Aufteilung 34 bis 37",
     "Offertliste, sortiert nach Gewinnchance, Schnitt bei 80 Offerten",
     "Nach Eingang offerieren, bis das Team voll ist – oder nach Offertwert, obwohl grosse Aufträge seltener gewonnen werden"],
    ["Unsere drei wichtigsten Merkmale: Bestandskunden 33 % (Neukunden 7 %), Anfragen von Gemeinden 33 % (Account Manager 14 %), Typ C 33 % (Typ A 14 %). Bestandskundin fragt selbst an: etwa jede zweite gewonnen; Neukundin ohne Anfrage: etwa jede 23.",
     "Eine Zeile Begründung pro Fall in unseren Wenn-dann-Worten («etwa jede zweite gewonnen»); Abschnitt «Woran man gute Chancen erkennt»",
     "Eine Liste ohne Erklärung, der die Account Manager nicht folgen"],
    ["240 von 320 Opportunitäten pro Quartal bekommen keine Offerte; kleine Gemeinden haben weder Zeit noch Geld für Ausschreibungen",
     "«Kein Fall fällt durch»: Weg für jeden Fall unter dem Schnitt (Standardpaket, Partner, bewusst nicht, Wiedervorlage)",
     "Still absagen – ein Rufrisiko für eine Firma, die «näher an jeder Gemeinde» sein will"],
    ["Offertwert-Schätzung (Schritt 6): 8 von 10 Fehlern zwischen −42 und +43 (CHF 1'000); Typ C im Mittel 37 zu tief",
     "Offertwert als Bandbreite, erwarteter Auftragswert als Spalte, Hinweis «eher höher» bei Typ C",
     "Eine einzelne Zahl, die genauer wirkt, als sie ist – oder nach Wert sortieren, obwohl grosse Aufträge seltener gewonnen werden"],
    ["Das Modell kennt nur Fälle, bei denen bisher etwas unternommen wurde (Projektfile Schritt 5). Im Rückblick kosten 10 Entdeckungsplätze im Schnitt 0,6 Aufträge und bringen 15 statt 6 Neukunden pro Quartal",
     "10 von 80 Plätzen für Entdeckung: Neukunden mit der besten Chance unter dem Schnitt (einstellbar)",
     "Eine Liste, die sich selbst bestätigt und nie Neues lernt"],
    ["Gewinnchancen der Fälle direkt unter dem Schnitt",
     "Kennzahl «10 Offerten mehr brächten …» als Grundlage für die Kapazitätsfrage",
     "Die 80 als unverrückbar behandeln, statt die Grenze als Entscheid zu zeigen"],
    ["Strategie 2030 «Gesamtpartner»; aus dem CRM: welche Gemeinde welches Produkt schon hat; aus den Typen: was zu ihr passt",
     "«Nächstes Produkt» pro Gemeinde und Filter «Kundinnen: nächstes Produkt»",
     "Jedes Produkt einzeln verkaufen und die Bestandskunden nicht als Gesamtpartner behandeln"],
    ["Der Gewinn 34 statt 14 gilt gegenüber Zufall – nicht gegenüber der Erfahrung der Account Manager. Wert in Franken: CHF 1,7–2,2 Mio. Mehrumsatz pro Jahr, ebenfalls gegenüber Zufall",
     "Pilotjahr mit Cockpit: Status jeder Offerte, Fortschritt pro Quartal, Gewinnquote; Pilotmodus mit blinder AM-Vorauswahl, Streitfälle je zur Hälfte nach Liste und nach AM",
     "Einen Nutzen versprechen, der gegenüber heute vermutlich kleiner ist – und ihn im Pilot nicht messen können"],
    ["Vergangenheit ist nicht Zukunft: ab 2027 kommen wegen E-ID andere Opportunitäten",
     "Warnung, wenn der Mix eines Quartals stark von den Trainingsdaten abweicht",
     "Das Modell blind weiterverwenden, obwohl sich der Markt verschoben hat"],
  ],

  grenzen: [
    "Eine Gewinnchance von 70 % heisst: Unter vielen solchen Fällen wird etwa bei sieben von zehn ein Auftrag daraus – keine Vorhersage für den einzelnen Fall.",
    "Das Modell zeigt Zusammenhänge, keine Ursachen: Mehr Kontakte gehen mit mehr Aufträgen einher, aber mehr Anrufe bringen nicht nachweislich mehr Aufträge.",
    "Im Tessin gibt es nur 75 bisherige Offerten – dort deuten wir die Zahlen nicht und zeigen nur einen Hinweis.",
    "Die Offertwert-Schätzung kennt den Gemeindetyp nicht; bei Typ C liegt sie im Mittel CHF 37'000 zu tief.",
    "Bestandskunden gewinnen auch ohne Liste oft. Diesen Vorsprung schreiben wir nicht dem Modell gut – darum messen wir im Pilot gegen die Auswahl der Account Manager.",
    "Das Schulbau-Signal (viele Neubauten, viele Kinder und Jugendliche) ist ein Hinweis auf Bedarf, kein Wissen über geplante Schulhäuser.",
    "Der Radar vergibt eine Priorität für unsere interne Planung. Gemeinden sehen nie eine Zahl.",
  ],

  // ---------------------------------------------------------------
  // Rollen und Zuständigkeiten (Stufe A: im Browser simuliert, ohne Login)
  // ---------------------------------------------------------------
  rollen: {
    am: "Account Manager",
    ot: "Offert-Team",
    vl: "Vertriebsleitung",
    gl: "Geschäftsleitung",
  },
  // 11 Account Manager wie im Case, davon 2 für die Romandie. Zuständig nach Kanton;
  // grosse Gemeinden betreut der Key Account. Keine Personennamen – Regionen statt Personen.
  keyAccountAb: 20000,
  regionen: [
    ["Key Account", []],
    ["Zürich", ["ZH"]],
    ["Ostschweiz", ["SG", "AR", "AI", "GL"]],
    ["Thurgau und Schaffhausen", ["TG", "SH"]],
    ["Graubünden und Tessin", ["GR", "TI"]],
    ["Zentralschweiz", ["LU", "ZG", "SZ", "UR", "OW", "NW"]],
    ["Aargau", ["AG"]],
    ["Bern", ["BE"]],
    ["Solothurn und Basel", ["SO", "BS", "BL"]],
    ["Romandie West", ["GE", "VD"]],
    ["Romandie Nord", ["NE", "JU", "FR", "VS"]],
  ],
  phasen: {
    vorauswahl: "Vorauswahl der Account Manager",
    freigegeben: "Freigegeben – in Bearbeitung",
    abgeschlossen: "Abgeschlossen",
  },
  // Vorab mit der Geschäftsleitung vereinbarte Entscheidungsregel
  entscheidRegel: {
    vorsprung: 0.05,
    text: "Der Pilot gilt als erfolgreich, wenn die Gewinnquote «nur Liste» nach vier Quartalen mindestens 5 Prozentpunkte über «nur AM» liegt.",
  },

  // Kurze Einführung pro Rolle (erscheint beim ersten Besuch, jederzeit über «So funktioniert's»)
  hilfe: {
    am: ["Account Manager", [
      "<b>Übersicht</b> zeigt eure Aufgaben: offene Vorauswahl, eure Offerten in Arbeit und was zuletzt entschieden wurde.",
      "<b>Vorauswahl:</b> Zu Beginn des Quartals markiert ihr in eurer Region, was ihr offerieren würdet. Die Liste mit den Chancen seht ihr erst danach.",
      "<b>Gemeinde suchen</b> öffnet das Profil: Typ, Produkte, laufende Offerten – ideal vor einem Termin.",
    ]],
    ot: ["Offert-Team", [
      "<b>Übersicht</b> zeigt, was überfällig ist und was in den nächsten zwei Wochen fällig wird.",
      "<b>Board</b> in der Offertliste: eine Karte pro Offerte. Mit «Weiter →» rückt sie in den nächsten Schritt.",
      "<b>Details</b> zu jeder Offerte: Begründung, Offertwert, Frist, Notizen und Verlauf.",
    ]],
    vl: ["Vertriebsleitung", [
      "<b>Übersicht</b> zeigt, was euren Entscheid braucht: Freigaben, Verzug, Einwände der Account Manager.",
      "<b>Offertliste:</b> Kapazität und Plätze für Neukunden einstellen, die Liste freigeben und das Quartal abschliessen.",
      "<b>Pilotjahr:</b> das ausführliche Cockpit mit Entscheidungsregel und Bericht für die Geschäftsleitung.",
    ]],
    gl: ["Geschäftsleitung", [
      "<b>Übersicht:</b> ein Satz, drei Zahlen und eine Ampel – liegt der Pilot im Plan?",
      "<b>Pilotjahr:</b> Fortschritt pro Quartal, Vergleich Liste gegen Erfahrung und der Bericht zum Drucken.",
      "<b>So rechnet der Radar:</b> woher die Zahlen kommen und wo ihre Grenzen liegen.",
    ]],
  },

  // So läuft das Pilotjahr (Cockpit)
  pilotSchritte: [
    "<b>Ein Jahr, vier Quartale:</b> Q1 bis Q4 2027, je 80 Offerten – rund 320 Offerten. Das reicht, damit Zufallsschwankungen (etwa ±5 Aufträge pro Quartal) den Vergleich nicht verdecken, und auch spät entscheidende Gemeinden fliessen ein.",
    "<b>Vorauswahl:</b> Zu Beginn jedes Quartals markiert jeder Account Manager in seiner Region, welche Opportunitäten er offerieren würde. Die Liste mit den Gewinnchancen bleibt für ihn gesperrt, bis er abgegeben hat.",
    "<b>Freigabe:</b> Die Vertriebsleitung gibt die 80 Offerten frei. Danach ist die Liste fix; Änderungen nur mit Begründung, alles wird im Verlauf protokolliert.",
    "<b>Pilotmodus:</b> 10 Entdeckungsplätze für Neukunden bleiben reserviert. Fälle, die Liste und AM beide wählen, werden offeriert; die übrigen Plätze teilen sich je zur Hälfte «nur Liste» und «nur AM».",
    "Jede Offerte hat einen Status: <b>Geplant → In Bearbeitung → Offeriert → Gewonnen oder Verloren</b>. Das Offert-Team pflegt ihn laufend; das Cockpit zeigt den Stand für Team und Geschäftsleitung.",
    "Nach zwei Quartalen Zwischenbilanz, nach vier Quartalen Entscheid über den Betrieb – an der vorab vereinbarten Zahl: Gewinnquote «nur Liste» gegen «nur AM».",
  ],

  // Was wir von der Geschäftsleitung brauchen (Antrag)
  antrag: [
    "Freigabe für einen Pilot über ein Jahr: Q1 bis Q4 2027, je 80 Offerten pro Quartal – Start mitten in der E-ID-Welle.",
    "Zugang zu den CRM-Daten der Opportunitäten und Ergebnissen, ohne Personendaten.",
    "Zeit der Account Manager: Vorauswahl vor dem Blick auf die Liste und Ergebnisse eintragen.",
    "Vorab vereinbart: Entscheidungszahl nach dem Pilotjahr – Gewinnquote der Streitfälle «nach Liste» gegen «nach AM»; nach zwei Quartalen eine Zwischenbilanz im Cockpit.",
  ],
};
