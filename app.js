/* GovTech-Marktradar · wendet die gespeicherten Modelle im Browser an. */
"use strict";
const I = window.INHALT;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pct = (x, d = 0) => (x * 100).toFixed(d).replace(".", ",") + " %";
const zahl = (x, d = 0) => Number(x).toFixed(d).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, "'");
const chf = (k) => "CHF " + zahl(Math.round(k) * 1000);
// Typ-Kennzeichnung: Farbpunkt plus Text, damit die Information nie nur an der Farbe hängt
const chip = (typ, lang = false) => { const t = I.typen[typ];
  return `<span class="chip" title="${esc(t.name)}"><i style="background:${t.farbe}" aria-hidden="true"></i>${typ} · ${esc(lang ? t.name : t.kurz)}</span>`; };
// Einfache Sprache: Chance in Worten, Beträge wie im Alltag
const chanceWort = (c) => c >= 0.5 ? "hoch" : c >= 0.25 ? "mittel" : "tief";
const chanceText = (c) => `${pct(c)} · ${chanceWort(c)}`;
const rundCHF = (k) => { const f = k * 1000, schritt = f >= 100000 ? 10000 : 5000; return "rund CHF " + zahl(Math.max(schritt, Math.round(f / schritt) * schritt)); };
const chanceBalken = (c) => `<div class="chance chance-${chanceWort(c)}"><span class="spur" aria-hidden="true"><i style="width:${Math.max(3, Math.round(c * 100))}%"></i></span><span>${chanceText(c)}</span></div>`;
const info = (text, label) => `<span class="info" tabindex="0" role="button" aria-label="${esc(label)}" data-info="${esc(text)}">?</span>`;

let M, GEM, GEM_BFS;            // Modell, Gemeinden
let quartal = { name: "", quelle: "", rows: [] };
let zustand = leerZustand();     // pro Quartal: Entscheide der Account Manager, Status, Pilot-Einstellungen
function leerZustand() { return { over: {}, am: {}, erg: {}, frist: {}, notiz: {}, kap: 80, entd: 10, pilot: false, phase: "vorauswahl", abgabe: {}, log: [] }; }

// Status einer Offerte auf der Liste (gespeichert in zustand.erg)
const STATUS = [
  ["", "Geplant"], ["bearbeitung", "In Bearbeitung"], ["offeriert", "Offeriert – Entscheid offen"],
  ["gewonnen", "Gewonnen"], ["verloren", "Verloren"],
];
const STATUS_NAME = Object.fromEntries(STATUS);
const STATUS_FARBE = { "": "#c5ced8", bearbeitung: "#c9962b", offeriert: "#2a78d6", gewonnen: "#1a8a5f", verloren: "#b3261e" };
const normStatus = (s) => (s === "offen" ? "offeriert" : s || "");

// Speicher: Quartale bleiben im Browser erhalten. Ohne Speicher (privates Fenster) läuft alles im Arbeitsspeicher.
const ERSATZ = new Map();
const lies = (k) => { try { const v = localStorage.getItem(k); if (v !== null) return JSON.parse(v); } catch (e) { /* egal */ } return ERSATZ.has(k) ? JSON.parse(ERSATZ.get(k)) : null; };
const schreib = (k, v) => { const s = JSON.stringify(v); ERSATZ.set(k, s); try { localStorage.setItem(k, s); } catch (e) { /* nur im Arbeitsspeicher */ } };
const register = () => lies("radar:quartale") || [];
function zustandVon(name) {
  const gespeichert = lies("radar:" + name) || {};
  const z = { ...leerZustand(), ...gespeichert };
  for (const k in z.erg) z.erg[k] = normStatus(z.erg[k]);
  // ältere Stände ohne Phase: mit eingetragenem Status gelten sie als freigegeben
  if (!gespeichert.phase && Object.keys(z.erg).length) z.phase = "freigegeben";
  return z;
}

// ------------------------------------------------------------ Rollen (Stufe A: simuliert, ohne Login)
let rolle = lies("radar:rolle") || { typ: "vl", am: "" };
const REGION_VON = Object.fromEntries(I.regionen.flatMap(([n, k]) => k.map((x) => [x, n])));
const zustaendig = (r) => (r.einwohner > I.keyAccountAb ? "Key Account" : REGION_VON[r.kanton] || "Key Account");
const rolleText = () => rolle.typ === "am" ? `AM ${rolle.am}` : I.rollen[rolle.typ];
const istMeins = (r) => rolle.typ !== "am" || zustaendig(r) === rolle.am;
// Wer darf was? (im Betrieb übernimmt das das Login mit Rechten – Stufe B)
function darf(aktion, r, z = zustand) {
  const t = rolle.typ, ph = z.phase;
  switch (aktion) {
    case "einstellen": return t === "vl" && ph === "vorauswahl";
    case "freigeben": return t === "vl" && ph === "vorauswahl";
    case "abschliessen": return t === "vl" && ph === "freigegeben";
    case "hochladen": return t === "vl";
    case "vorauswahl": return t === "am" && ph === "vorauswahl" && !z.abgabe[rolle.am] && (!r || istMeins(r));
    case "reinraus": return ph !== "abgeschlossen" && (t === "vl" || (t === "am" && ph === "vorauswahl" && (!r || istMeins(r))));
    case "status": return ph === "freigegeben" && (t === "ot" || t === "vl" || (t === "am" && (!r || istMeins(r))));
    default: return false;
  }
}
// Verlauf: wer hat wann was geändert (Audit-Trail)
function protokolliere(z, was, text = "", id = "") {
  z.log = z.log || [];
  z.log.push({ t: new Date().toISOString(), n: Date.now(), wer: rolleText(), was, text, id });
  if (z.log.length > 2000) z.log.splice(0, z.log.length - 2000);
}
// AM sieht die Liste erst nach seiner Vorauswahl
const listeGesperrt = () => rolle.typ === "am" && zustand.phase === "vorauswahl" && !zustand.abgabe[rolle.am];
const PFLICHT = ["gemeindename", "einwohner", "produktlinie", "quelle", "verfahren", "bestandskunde", "kontakte_12m", "sprachregion"];
const WERTE = {
  gemeindetyp: ["A", "B", "C", "D"],
  produktlinie: ["Fiskal", "Schalter", "Campus"],
  quelle: ["simap-Ausschreibung", "Anfrage der Gemeinde", "Account Manager", "Partner oder Messe"],
  verfahren: ["freihändig", "Einladung", "offen"],
  bestandskunde: ["ja", "nein"],
  sprachregion: ["Deutsch", "Französisch", "Italienisch"],
};

// ------------------------------------------------------------ Laden
async function start() {
  // Datenhinweis nur noch klein in der Fusszeile und im Gemeinde-Profil (Vorgabe Projektfile)
  $("#tool-satz").textContent = I.gruppe.toolSatz;
  $("#tool-satz-2").textContent = I.gruppe.toolSatz;
  $("#fuss").textContent = "GovTech-Marktradar · MVP · Leistungsnachweis 2, CAS AI in Product Management HS 26 · " + I.datenhinweis;
  try {
    const [m, g, demo] = await Promise.all([
      fetch("daten/modell.json").then((r) => r.json()),
      fetch("daten/gemeinden.json").then((r) => r.json()),
      fetch("daten/demo_quartal_2027Q1.csv").then((r) => r.text()),
    ]);
    M = m; GEM = g; GEM_BFS = new Map(g.map((x) => [x.bfs, x]));
    const reg = register();
    if (!reg.length) ladeQuartal(demo, "Q1/2027", "Demo: 320 Beispiel-Opportunitäten aus bisherigen Offerten");
    else zeigeQuartal(lies("radar:aktiv") && reg.some((q) => q.name === lies("radar:aktiv")) ? lies("radar:aktiv") : reg[0].name);
  } catch (e) {
    meldung("fehler", "Die Daten konnten nicht geladen werden. Die Seite muss über einen Webserver geöffnet werden (z. B. GitHub Pages).");
    return;
  }
  baueGemeinden(); baueRueckblick(); baueHerleitung(); zeigeCockpit();
}

function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const erste = text.split(/\r?\n/)[0];
  const tr = (erste.match(/;/g) || []).length > (erste.match(/,/g) || []).length ? ";" : ",";
  const zeilen = [];
  let feld = "", zeile = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { feld += '"'; i++; }
      else if (c === '"') inQ = false;
      else feld += c;
    } else if (c === '"') inQ = true;
    else if (c === tr) { zeile.push(feld); feld = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      zeile.push(feld); feld = "";
      if (zeile.some((f) => f.trim() !== "")) zeilen.push(zeile);
      zeile = [];
    } else feld += c;
  }
  zeile.push(feld);
  if (zeile.some((f) => f.trim() !== "")) zeilen.push(zeile);
  const kopf = zeilen.shift().map((h) => h.trim());
  return zeilen.map((z) => Object.fromEntries(kopf.map((h, i) => [h, (z[i] ?? "").trim()])));
}

function ladeQuartal(text, name, quelle) {
  $("#meldungen").innerHTML = "";
  let roh;
  try { roh = parseCSV(text); } catch (e) { meldung("fehler", "Die Datei lässt sich nicht lesen."); return; }
  if (!roh.length) { meldung("fehler", "Die Datei enthält keine Zeilen."); return; }
  const fehlt = PFLICHT.filter((s) => !(s in roh[0]));
  if (!("gemeindetyp" in roh[0]) && !("bfs_nr" in roh[0])) fehlt.push("gemeindetyp oder bfs_nr");
  if (fehlt.length) { meldung("fehler", "Es fehlen Spalten: " + fehlt.join(", ") + ". Ladet die Vorlage herunter, um das Format zu sehen."); return; }

  const probleme = [];
  const rows = [];
  roh.forEach((r, i) => {
    if (!r.gemeindetyp && r.bfs_nr) r.gemeindetyp = GEM_BFS.get(+r.bfs_nr)?.typ || "";
    const falsch = Object.keys(WERTE).filter((s) => !WERTE[s].includes(r[s]));
    const ew = Number(String(r.einwohner).replace(/'/g, "")), ko = Number(r.kontakte_12m);
    if (falsch.length || !isFinite(ew) || !isFinite(ko)) {
      probleme.push(`Zeile ${i + 2} (${r.gemeindename || "?"}): ${falsch.length ? "unbekannter Wert in " + falsch.join(", ") : "Zahl fehlt"}`);
      return;
    }
    rows.push({ ...r, id: r.offerte_id || r.id || "Z" + String(i + 1).padStart(4, "0"), einwohner: ew, kontakte_12m: ko });
  });
  if (!rows.length) { meldung("fehler", "Keine gültige Zeile gefunden."); return; }
  // Das Quartal merken: Rohdaten (ohne Personendaten) und Bearbeitungsstand bleiben im Browser
  const SP = ["id", "bfs_nr", "gemeindename", "kanton", "sprachregion", "gemeindetyp", "einwohner", "produktlinie", "quelle", "verfahren", "bestandskunde", "kontakte_12m"];
  schreib("radar:rows:" + name, rows.map((r) => Object.fromEntries(SP.map((s) => [s, r[s] ?? ""]))));
  const reg = register().filter((q) => q.name !== name);
  reg.push({ name, quelle }); reg.sort((a, b) => sortQ(a.name) - sortQ(b.name) || a.name.localeCompare(b.name));
  schreib("radar:quartale", reg);
  // Lernkreislauf: Eine exportierte Liste mit eingetragenem Stand kann wieder geladen werden.
  const z = zustandVon(name);
  let zurueck = 0;
  rows.forEach((r) => {
    if (["rein", "raus"].includes(r.am_entscheid)) { z.over[r.id] = r.am_entscheid; if (r.am_grund) z.over[r.id + ":grund"] = r.am_grund; }
    if (r.am_haette_gewaehlt === "ja") z.am[r.id] = 1;
    if (/^\d{4}-\d{2}-\d{2}$/.test(r.frist || "")) z.frist[r.id] = r.frist;
    const st = normStatus(r.status || r.ergebnis);
    if (st && STATUS_NAME[st]) { z.erg[r.id] = st; zurueck++; }
  });
  schreib("radar:" + name, z);
  zeigeQuartal(name);
  if (probleme.length) meldung("warn", `${probleme.length} Zeile(n) übersprungen: ` + probleme.slice(0, 5).map(esc).join(" · ") + (probleme.length > 5 ? " …" : ""));
  if (zurueck) meldung("ok", `Bearbeitungsstand von ${zurueck} Offerten übernommen – er fliesst ins Cockpit und in die Pilot-Auswertung.`);
}
// «Q3/2027» → 20273, damit Quartale zeitlich sortiert werden
function sortQ(n) { const m = /Q([1-4])\D*(\d{4})/i.exec(n); return m ? +m[2] * 10 + +m[1] : 99999; }

// Ein gemerktes Quartal öffnen
function zeigeQuartal(name) {
  const roh = lies("radar:rows:" + name) || [];
  const eintrag = register().find((q) => q.name === name) || { quelle: "" };
  quartal = { name, quelle: eintrag.quelle, rows: roh.map(rechne) };
  zustand = zustandVon(name);
  schreib("radar:aktiv", name);
  $("#meldungen").innerHTML = "";
  $("#kap").value = zustand.kap; $("#entd").value = zustand.entd; $("#pilotmodus").checked = !!zustand.pilot;
  $("#quartal-titel").textContent = "Offertliste · " + name;
  $("#quartal-quelle").textContent = `${roh.length} Opportunitäten · ${eintrag.quelle}`;
  $("#quartal-wahl").innerHTML = register().map((q) => `<option ${q.name === name ? "selected" : ""}>${esc(q.name)}</option>`).join("");
  pruefeMix(quartal.rows);
  zeigeListe();
}

function speichere() { schreib("radar:" + quartal.name, zustand); }

// ------------------------------------------------------------ Modelle anwenden
function rechne(r) {
  const k = M.klassifikation;
  const x = k.spalten.map((s) => {
    if (s === "bestandskunde_n") return r.bestandskunde === "ja" ? 1 : 0;
    if (s === "kontakte_12m") return r.kontakte_12m;
    const pos = s.indexOf("_"); const spalte = s.slice(0, pos), w = s.slice(pos + 1);
    return r[spalte] === w ? 1 : 0;
  });
  let z = k.achse;
  x.forEach((v, i) => { z += ((v - k.mittel[i]) / k.streuung[i]) * k.koeff[i]; });
  const chance = 1 / (1 + Math.exp(-z));

  const g = M.regression;
  const xr = { einwohner_1000: r.einwohner / 1000, produktlinie_Fiskal: r.produktlinie === "Fiskal" ? 1 : 0,
    produktlinie_Schalter: r.produktlinie === "Schalter" ? 1 : 0, bestandskunde_n: r.bestandskunde === "ja" ? 1 : 0, kontakte_12m: r.kontakte_12m };
  let wert = g.start; g.spalten.forEach((s, i) => { wert += xr[s] * g.koeff[i]; });
  wert = Math.max(0, wert);
  return { ...r, chance, wert, unten: Math.max(0, wert + g.band_unten), oben: wert + g.band_oben, erwartet: chance * wert,
    stadt: r.einwohner > 50000 };
}

// «etwa jede zweite» / «etwa jede 23.» – so wie in unseren Wenn-dann-Sätzen
const jedeN = (anteil) => anteil >= 0.45 ? "etwa jede zweite" : `etwa jede ${Math.round(1 / anteil)}.`;
// Begründung wie auf unserer Ergebnisseite: «Bestandskunde, Anfrage der Gemeinde, Typ C, Fiskal.»
const kurzGrund = (r) => `${r.bestandskunde === "ja" ? "Bestandskunde" : "Neukunde"}, ${r.quelle}, Typ ${r.typ || r.gemeindetyp}, ${r.produkt || r.produktlinie}.`;

function grund(r) {
  const anfrage = r.quelle === "Anfrage der Gemeinde";
  const k = M.kombi[`${r.bestandskunde}|${anfrage ? "anfrage" : "andere"}`];
  const t = {
    "ja|true": "Bestandskunde fragt selbst an", "ja|false": "Bestandskunde",
    "nein|true": "Neukunde, aber eigene Anfrage", "nein|false": "Neukunde ohne eigene Anfrage",
  }[`${r.bestandskunde}|${anfrage}`];
  const teile = [`${t}: ${jedeN(k.ja)} gewonnen (${pct(k.ja)})`];
  if (r.gemeindetyp === "C") teile.push(`Typ C gewinnt ${pct(M.anteile.gemeindetyp.C.ja)}`);
  if (r.quelle === "simap-Ausschreibung") teile.push(`simap nur ${pct(M.anteile.quelle["simap-Ausschreibung"].ja)}`);
  return teile.join(" · ");
}

function hinweise(r) {
  const h = [];
  if (r.sprachregion === "Italienisch") h.push("Tessin: nur 75 bisherige Offerten – Chance nicht deuten, mit Partner prüfen");
  if (r.gemeindetyp === "C") h.push(`Offertwert bei Typ C eher höher (im Mittel +${zahl(M.regression.verzerrung.C)}'000)`);
  if (r.stadt) h.push("Über 50'000 Einwohner: eigene Informatik, wir offerieren nicht");
  return h;
}

function weg(r) {
  if (r.stadt) return I.wege.stadt;
  if (r.sprachregion === "Italienisch" || r.quelle === "Partner oder Messe") return I.wege.partner;
  if (r.produktlinie === "Fiskal" && r.verfahren === "freihändig" && r.einwohner < 5000) return I.wege.standard;
  if (r.quelle === "simap-Ausschreibung" && r.chance < 0.05) return I.wege.nein;
  return I.wege.spaeter;
}

// ------------------------------------------------------------ Auswahl
// Aktuelles Quartal mit den Einstellungen aus der Steuerleiste
function auswahl() {
  zustand.kap = Math.max(1, +$("#kap").value || 80);
  zustand.entd = Math.min(zustand.kap, Math.max(0, +$("#entd").value || 0));
  zustand.pilot = $("#pilotmodus").checked;
  return auswahlFuer(quartal.rows, zustand);
}
// Dieselbe Auswahl für ein beliebiges Quartal (fürs Cockpit). Logik unverändert.
function auswahlFuer(rows, zustand) {
  const kap = Math.max(1, +zustand.kap || 80);
  const entd = Math.min(kap, Math.max(0, +zustand.entd || 0));
  const sortiert = [...rows].sort((a, b) => b.chance - a.chance || a.id.localeCompare(b.id));
  sortiert.forEach((r, i) => { r.rang = i + 1; r.status = "unter"; });
  const frei = sortiert.filter((r) => !r.stadt && zustand.over[r.id] !== "raus");
  sortiert.forEach((r) => { if (r.stadt) r.status = "stadt"; else if (zustand.over[r.id] === "raus") r.status = "raus"; });
  let n = 0;
  frei.filter((r) => zustand.over[r.id] === "rein").forEach((r) => { r.status = "am"; n++; });
  for (const r of frei) { if (n >= kap - entd) break; if (r.status === "unter") { r.status = "liste"; n++; } }
  for (const r of frei) { if (n >= kap) break; if (r.status === "unter" && r.bestandskunde === "nein") { r.status = "entd"; n++; } }
  for (const r of frei) { if (n >= kap) break; if (r.status === "unter") { r.status = "liste"; n++; } }

  // Pilotmodus: Damit «Liste gegen AM» messbar wird, müssen beide Seiten offeriert werden.
  // Fälle, die beide wählen, kommen zuerst; die übrigen Plätze teilen sich Liste und AM je zur Hälfte.
  // Die Entdeckungsplätze bleiben reserviert und laufen ausserhalb des Vergleichs Liste gegen AM.
  if (zustand.pilot && Object.keys(zustand.am).length) {
    const alleDrin = sortiert.filter((r) => DRIN.has(r.status)), ids = new Set(alleDrin.map((r) => r.id));
    const entdeckung = alleDrin.filter((r) => r.status === "entd");
    const liste = alleDrin.filter((r) => r.status !== "entd");
    const beide = liste.filter((r) => zustand.am[r.id]);
    const nurL = liste.filter((r) => !zustand.am[r.id]);
    const nurA = frei.filter((r) => zustand.am[r.id] && !ids.has(r.id));
    liste.forEach((r) => { r.status = "unter"; });
    beide.forEach((r) => { r.status = "beide"; });
    const rest = Math.max(0, kap - entdeckung.length - beide.length);
    let nl = Math.ceil(rest / 2), na = rest - nl;
    if (nurA.length < na) { nl += na - nurA.length; na = nurA.length; }
    if (nurL.length < nl) { na = Math.min(nurA.length, na + nl - nurL.length); nl = nurL.length; }
    nurL.slice(0, nl).forEach((r) => { r.status = "pl"; });
    nurA.slice(0, na).forEach((r) => { r.status = "pa"; });
  }
  return { sortiert, kap, frei };
}
const DRIN = new Set(["liste", "entd", "am", "beide", "pl", "pa"]);
const PLATZ = {
  liste: ["liste", "Liste"], entd: ["entd", "Platz für Neukunden"], am: ["am", "vom AM hinzugefügt"],
  beide: ["liste", "Liste + AM"], pl: ["liste", "Vergleich: Liste"], pa: ["am", "Vergleich: AM"],
};

// ------------------------------------------------------------ Offertliste zeigen
function zeigeListe() {
  zeigePhase();
  // Steuerung nach Rolle und Phase
  for (const id of ["#kap", "#entd", "#pilotmodus"]) $(id).disabled = !darf("einstellen");
  $("#hochladen").disabled = !darf("hochladen");
  document.body.classList.toggle("gesperrt", listeGesperrt());
  if (listeGesperrt()) { zeigeVorauswahl(); return; }
  const { sortiert, kap, frei } = auswahl();
  const drin = sortiert.filter((r) => DRIN.has(r.status));
  const naechste = frei.filter((r) => r.status === "unter");
  const erwAuf = drin.reduce((s, r) => s + r.chance, 0);
  const zufall = (frei.reduce((s, r) => s + r.chance, 0) / Math.max(1, frei.length)) * drin.length;
  const erwWert = drin.reduce((s, r) => s + r.erwartet, 0);
  const nk = drin.filter((r) => r.bestandskunde === "nein").length;
  const n10 = naechste.slice(0, 10);
  const plus10 = n10.reduce((s, r) => s + r.chance, 0), plus10w = n10.reduce((s, r) => s + r.erwartet, 0);
  const amRein = Object.entries(zustand.over).filter(([k, v]) => !k.includes(":") && v === "rein").length;
  const amRaus = Object.entries(zustand.over).filter(([k, v]) => !k.includes(":") && v === "raus").length;

  $("#kpis").innerHTML = `
    <div class="kpi haupt"><b>≈ ${zahl(erwAuf)} Aufträge</b><span>erwartet laut Modell – statt ≈ ${zahl(zufall)} bei zufälliger Auswahl</span></div>
    <div class="kpi"><b>${drin.length} von ${quartal.rows.length}</b><span>Opportunitäten auf der Liste (Kapazität ${kap})</span></div>
    <div class="kpi"><b>${chf(erwWert)}</b><span>erwarteter Auftragswert (5 Jahre) der Liste</span></div>
    <div class="kpi"><b>${nk}</b><span>Neukunden auf der Liste, davon ${sortiert.filter((r) => r.status === "entd").length} auf Plätzen für Neukunden</span></div>
    <div class="kpi gold"><b>+ ${zahl(plus10, 1)} Aufträge</b><span>brächten 10 Offerten mehr (≈ ${chf(plus10w)} erwarteter Wert) – Grundlage für die Frage nach mehr Kapazität ${info("Summe der Gewinnchancen der nächsten 10 Opportunitäten unter dem Schnitt. So sieht man, was eine grössere Kapazität im Offert-Team bringen würde.", "Erklärung Kapazität")}</span></div>
    <div class="kpi"><b>${amRein} / ${amRaus}</b><span>Fälle von Account Managern hinzugefügt / herausgenommen – zeigt, wo Erfahrung und Liste auseinandergehen</span></div>`;

  // Fortschritt des Quartals: wo stehen die Offerten auf der Liste?
  const zaehl = Object.fromEntries(STATUS.map(([k]) => [k, drin.filter((r) => normStatus(zustand.erg[r.id]) === k).length]));
  $("#fortschritt").innerHTML = `<div class="fs-kopf"><b>Stand ${esc(quartal.name)}</b>
      <span class="klein">${zaehl.gewonnen + zaehl.verloren} von ${drin.length} entschieden · ${zaehl.gewonnen} gewonnen${zaehl.gewonnen + zaehl.verloren ? ` (${pct(zaehl.gewonnen / (zaehl.gewonnen + zaehl.verloren))} der entschiedenen)` : ""}</span></div>
    ${stapel(zaehl, drin.length)}`;

  const ansicht = $("#ansicht .an").dataset.v, typ = $("#f-typ").value, q = $("#suche").value.trim().toLowerCase();
  const fst = $("#f-status").value, fz = $("#f-zust").value;
  const modus = $("#modus .an").dataset.v, pilot = modus === "voll";
  const passt = (r) => (!typ || r.gemeindetyp === typ) && (!q || r.gemeindename.toLowerCase().includes(q)) &&
    (!fz || zustaendig(r) === (fz === "meine" ? rolle.am : fz)) &&
    (ansicht === "alle" || (ansicht === "liste" ? DRIN.has(r.status) : !DRIN.has(r.status))) &&
    (!fst || (DRIN.has(r.status) && (fst === "ueberfaellig" ? fristInfo(r, zustand).ueber : (normStatus(zustand.erg[r.id]) || "geplant") === fst)));
  const oben = drin.filter(passt), unten = sortiert.filter((r) => !DRIN.has(r.status)).filter(passt);
  const fsort = $("#f-sort").value;
  if (fsort !== "chance") {   // nur die Reihenfolge der Anzeige ändert sich, nicht welche 80 offeriert werden
    const schluessel = fsort === "erwartet" ? (r) => r.erwartet : (r) => r.wert;
    [oben, unten].forEach((liste) => liste.sort((a, b) => schluessel(b) - schluessel(a) || a.rang - b.rang));
  }
  $("#liste-wrap").hidden = modus === "board"; $("#board").hidden = modus !== "board";
  $("#ansicht").hidden = modus === "board";
  if (modus === "board") { zeigeBoard(drin.filter(passt)); return; }
  if (modus === "kompakt") { zeigeKompakt(oben, unten, ansicht, kap); return; }

  const kopf = `<thead><tr><th scope="col">Prio.</th><th scope="col">Gemeinde</th><th scope="col">Typ</th><th scope="col">Produkt · Quelle</th><th scope="col" class="n">Gewinnchance</th>
    <th scope="col" class="n">Offertwert<span class="th-sub">CHF 1'000 · Bandbreite</span></th><th scope="col" class="n">Wert × Chance<span class="th-sub">CHF 1'000</span></th><th scope="col">Warum?</th><th scope="col">Platz / Weg<span class="th-sub">Entscheid Account Manager</span></th>
    <th scope="col">Zuständig</th><th scope="col">Status</th>${pilot ? '<th scope="col">AM hätte gewählt</th>' : ""}</tr></thead>`;
  const zeile = (r) => {
    const platz = PLATZ[r.status] ? `<span class="marke ${PLATZ[r.status][0]}">${PLATZ[r.status][1]}</span>` : `<span class="weg">${esc(weg(r))}</span>`;
    const ov = zustand.over[r.id], name = esc(r.gemeindename);
    const knopf = r.stadt || !darf("reinraus", r) ? "" : DRIN.has(r.status)
      ? `<button class="mini" type="button" data-act="raus" data-id="${esc(r.id)}" aria-label="${name} herausnehmen">herausnehmen</button>`
      : ov === "raus" ? `<button class="mini" type="button" data-act="zurueck" data-id="${esc(r.id)}" aria-label="${name} zurücknehmen">zurücknehmen</button>`
      : `<button class="mini" type="button" data-act="rein" data-id="${esc(r.id)}" aria-label="${name} hinzufügen">hinzufügen</button>`;
    const grundAm = zustand.over[r.id + ":grund"] ? `<span class="warnzeile">Grund: ${esc(zustand.over[r.id + ":grund"])}</span>` : "";
    return `<tr class="${DRIN.has(r.status) ? "" : r.status === "raus" ? "raus" : "unter"}">
      <td class="n nur-gross">${r.rang}</td>
      <td class="voll"><span class="nur-klein klein">Priorität ${r.rang} · </span><button class="link gem-name" type="button" data-detail="${esc(r.id)}">${name}</button> <span class="klein">${esc(r.kanton || "")}</span><span class="meta">${zahl(r.einwohner)} Einw. · ${r.bestandskunde === "ja" ? "Bestandskunde" : "Neukunde"}</span></td>
      <td data-label="Typ">${chip(r.gemeindetyp)}</td>
      <td data-label="Produkt · Quelle">${esc(r.produktlinie)}<span class="meta">${esc(r.quelle)} · ${esc(r.verfahren)}</span></td>
      <td class="n" data-label="Gewinnchance"><div class="balken"><span class="spur" aria-hidden="true"><i style="width:${Math.max(2, Math.round(r.chance * 100))}%"></i></span><b>${pct(r.chance)}</b></div></td>
      <td class="n" data-label="Offertwert (CHF 1'000)">${zahl(r.wert)} <span class="klein">(${zahl(r.unten)}–${zahl(r.oben)})</span></td>
      <td class="n" data-label="Wert × Chance (CHF 1'000)">${zahl(r.erwartet)}</td>
      <td class="begr voll" data-label="Warum?">${esc(grund(r))}${hinweise(r).map((h) => `<span class="warnzeile">⚠ ${esc(h)}</span>`).join("")}</td>
      <td data-label="Platz / Weg" class="platz">${platz}<div class="am-knopf">${knopf}</div>${grundAm}</td>
      <td data-label="Zuständig"><span class="klein">${esc(zustaendig(r))}</span></td>
      <td data-label="Status">${!DRIN.has(r.status) ? '<span class="klein">–</span>' : darf("status", r) ? statusWahl(r.id, name) : statusText(normStatus(zustand.erg[r.id]))}${DRIN.has(r.status) ? fristMarke(r, zustand) : ""}</td>
      ${pilot ? `<td data-label="AM hätte gewählt">${zustand.am[r.id] ? '<span class="marke am">gewählt</span>' : '<span class="klein">–</span>'}</td>` : ""}
    </tr>`;
  };
  const sp = pilot ? 12 : 11;
  const schnitt = `<tr class="schnitt"><td colspan="${sp}"><div>Schnitt bei ${kap} Offerten – darunter bekommt jeder Fall einen Weg, keiner fällt durch</div></td></tr>`;
  const leer = !oben.length && !unten.length
    ? `<tr class="leer"><td colspan="${sp}">Keine Opportunität passt zu diesen Filtern. <button class="mini" type="button" id="filter-zurueck">Filter zurücksetzen</button></td></tr>` : "";
  $("#liste").innerHTML = kopf + "<tbody>" + oben.map(zeile).join("") + (ansicht === "alle" && oben.length && unten.length ? schnitt : "") + unten.map(zeile).join("") + leer + "</tbody>";
}

// Status als Text, wenn die Rolle ihn nicht ändern darf
const statusText = (st) => `<span class="status-text" data-st="${st || "geplant"}">${STATUS_NAME[st || ""]}</span>`;

// Phase des Quartals mit den Aktionen der Vertriebsleitung
function zeigePhase() {
  const z = zustand, abg = Object.keys(z.abgabe || {}).length, n = I.regionen.length;
  const schritte = ["vorauswahl", "freigegeben", "abgeschlossen"];
  const i = schritte.indexOf(z.phase);
  let text = "", knoepfe = "";
  if (z.phase === "vorauswahl") {
    text = `${abg} von ${n} Account Managern haben ihre Vorauswahl abgegeben.`;
    if (rolle.typ === "am") text = z.abgabe[rolle.am] ? `Eure Vorauswahl (${esc(rolle.am)}) ist abgegeben am ${datum(z.abgabe[rolle.am])}. ${text}` : `Wählt zuerst eure Fälle – die Liste ist bis dahin gesperrt.`;
    if (darf("freigeben")) knoepfe = `<button class="knopf" type="button" id="freigeben">Liste freigeben</button>`;
  } else if (z.phase === "freigegeben") {
    const f = (z.log || []).find((l) => l.was === "Freigabe");
    text = `Freigegeben${f ? ` am ${datum(f.t)} von ${esc(f.wer)}` : ""}. Die Liste ist fix; Änderungen nur mit Begründung.`;
    if (darf("abschliessen")) knoepfe = `<button class="knopf sek" type="button" id="abschliessen">Quartal abschliessen</button>`;
  } else text = "Abgeschlossen. Das Quartal ist nur noch lesbar.";
  $("#phase").innerHTML = `<ol class="phasen">${schritte.map((p, k) => `<li class="${k < i ? "fertig" : k === i ? "jetzt" : ""}">${esc(I.phasen[p])}</li>`).join("")}</ol>
    <div class="phase-zeile"><span>${text}</span>${knoepfe}</div>`;
}
const datum = (iso) => new Date(iso).toLocaleDateString("de-CH");

// Vorauswahl der Account Manager – ohne Gewinnchance, Priorität und Begründung
function zeigeVorauswahl() {
  const meine = quartal.rows.filter((r) => istMeins(r) && !r.stadt).sort((a, b) => a.gemeindename.localeCompare(b.gemeindename, "de"));
  const gewaehlt = meine.filter((r) => zustand.am[r.id]).length;
  $("#kpis").innerHTML = `<div class="kpi haupt" style="grid-column:1/-1"><b>Vorauswahl ${esc(quartal.name)} · ${esc(rolle.am)}</b>
    <span>${meine.length} Opportunitäten in eurer Region. Markiert die Fälle, die ihr nach eurer Erfahrung offerieren würdet. Erst nach der Abgabe seht ihr die Liste mit den Gewinnchancen – so bleibt der Vergleich «Liste gegen Erfahrung» fair.</span></div>`;
  $("#fortschritt").innerHTML = `<div class="phase-zeile"><span><b>${gewaehlt}</b> von ${meine.length} gewählt</span>
    <button class="knopf" type="button" id="abgeben" ${gewaehlt ? "" : "disabled"}>Vorauswahl abgeben</button></div>`;
  $("#liste").innerHTML = `<thead><tr><th scope="col">Würde ich offerieren</th><th scope="col">Gemeinde</th><th scope="col">Typ</th><th scope="col">Produkt · Quelle</th><th scope="col">Kunde</th><th scope="col" class="n">Kontakte 12 Mt.</th></tr></thead><tbody>` +
    (meine.length ? meine.map((r) => `<tr><td data-label="Würde ich offerieren"><label class="check"><input type="checkbox" data-vorauswahl="${esc(r.id)}" ${zustand.am[r.id] ? "checked" : ""}> <span class="klein">offerieren</span></label></td>
      <td class="voll"><b class="gem-name">${esc(r.gemeindename)}</b> <span class="klein">${esc(r.kanton || "")}</span><span class="meta">${zahl(r.einwohner)} Einw.</span></td>
      <td data-label="Typ">${chip(r.gemeindetyp)}</td><td data-label="Produkt · Quelle">${esc(r.produktlinie)}<span class="meta">${esc(r.quelle)} · ${esc(r.verfahren)}</span></td>
      <td data-label="Kunde">${r.bestandskunde === "ja" ? "Bestandskunde" : "Neukunde"}</td><td class="n" data-label="Kontakte">${r.kontakte_12m}</td></tr>`).join("")
    : `<tr class="leer"><td colspan="6">In eurer Region gibt es in diesem Quartal keine Opportunität.</td></tr>`) + "</tbody>";
}

// Auswahlfeld für den Status einer Offerte
function statusWahl(id, name) {
  const st = normStatus(zustand.erg[id]);
  return `<select class="mini status-wahl" data-erg="${esc(id)}" data-st="${st || "geplant"}" aria-label="Status ${name}">
    ${STATUS.map(([k, n]) => `<option value="${k}" ${st === k ? "selected" : ""}>${n}</option>`).join("")}</select>`;
}
// Gestapelter Balken nach Status (HTML, skaliert ohne winzige Schrift)
function stapel(zaehl, total, legende = true) {
  const teile = STATUS.filter(([k]) => zaehl[k]).map(([k, n]) =>
    `<i style="flex:${zaehl[k]};background:${STATUS_FARBE[k]}" title="${n}: ${zaehl[k]}"></i>`).join("");
  return `<div class="stapel" role="img" aria-label="${STATUS.map(([k, n]) => `${n} ${zaehl[k] || 0}`).join(", ")}">${total ? teile : '<i style="flex:1;background:var(--linie)"></i>'}</div>
    ${legende ? `<div class="legende">${STATUS.map(([k, n]) => `<span><i style="background:${STATUS_FARBE[k]}"></i>${n} <b>${zaehl[k] || 0}</b></span>`).join("")}</div>` : ""}`;
}

function pruefeMix(rows) {
  if (rows.length < 50) return;   // zu wenige Fälle für einen fairen Vergleich
  const warn = [];
  for (const sp of ["produktlinie", "quelle", "gemeindetyp"]) {
    const n = rows.length;
    for (const [w, anteil] of Object.entries(M.mix[sp])) {
      const jetzt = rows.filter((r) => r[sp] === w).length / n;
      if (Math.abs(jetzt - anteil) > 0.15) warn.push(`${w}: ${pct(jetzt)} statt ${pct(anteil)} wie bisher`);
    }
  }
  if (warn.length) meldung("warn", "<b>Dieses Quartal sieht anders aus als die Daten, aus denen das Modell gelernt hat.</b> " + warn.map(esc).join(" · ") + ". Die Gewinnchancen sind darum unsicherer – nach dem Quartal Ergebnisse eintragen und das Modell neu prüfen.");
}

function meldung(art, html) {
  $("#meldungen").insertAdjacentHTML("beforeend", `<div class="meldung ${art}">${html}</div>`);
}

function exportiere() {
  const { sortiert } = auswahl();
  const sp = ["rang", "id", "bfs_nr", "gemeindename", "kanton", "sprachregion", "gemeindetyp", "einwohner", "produktlinie", "quelle", "verfahren", "bestandskunde", "kontakte_12m",
    "gewinnchance_pct", "offertwert_chf1000", "bandbreite_von", "bandbreite_bis", "erwarteter_wert_chf1000", "platz", "weg", "begruendung",
    "am_entscheid", "am_grund", "am_haette_gewaehlt", "status", "frist"];
  const platzName = { ...Object.fromEntries(Object.entries(PLATZ).map(([k, v]) => [k, v[1]])), unter: "unter dem Schnitt", raus: "vom AM herausgenommen", stadt: "ausgeschlossen" };
  sp[0] = "prioritaet";
  const z = sortiert.map((r) => [r.rang, r.id, r.bfs_nr || "", r.gemeindename, r.kanton || "", r.sprachregion, r.gemeindetyp, r.einwohner, r.produktlinie, r.quelle, r.verfahren, r.bestandskunde, r.kontakte_12m,
    (r.chance * 100).toFixed(1), r.wert.toFixed(0), r.unten.toFixed(0), r.oben.toFixed(0), r.erwartet.toFixed(0), platzName[r.status],
    DRIN.has(r.status) ? "" : weg(r), grund(r), zustand.over[r.id] || "", zustand.over[r.id + ":grund"] || "", zustand.am[r.id] ? "ja" : "", DRIN.has(r.status) ? (normStatus(zustand.erg[r.id]) || "geplant") : "", zustand.frist[r.id] || ""]);
  const csv = "﻿" + [sp, ...z].map((zeile) => zeile.map((f) => /[;"\n]/.test(String(f)) ? `"${String(f).replace(/"/g, '""')}"` : f).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = "offertliste_" + quartal.name.replace(/[^\w]+/g, "_") + ".csv";
  a.click();
}

// ------------------------------------------------------------ Gemeinden
let gZeigen = 100;
function gStatus(g) { return g.produkte.length ? "kunde" : g.offerten ? "offerte" : "nie"; }
function naechstes(g) { return I.typen[g.typ].produkte.find((p) => !g.produkte.includes(p)) || "–"; }

function baueGemeinden() {
  const fuelle = (sel, werte, f = (x) => x) => { sel.insertAdjacentHTML("beforeend", werte.map((w) => `<option value="${esc(w)}">${esc(f(w))}</option>`).join("")); };
  fuelle($("#g-typ"), ["A", "B", "C", "D"], (t) => `${t} · ${I.typen[t].name}`);
  fuelle($("#f-typ"), ["A", "B", "C", "D"], (t) => `${t} · ${I.typen[t].name}`);
  fuelle($("#g-sprache"), ["Deutsch", "Französisch", "Italienisch"]);
  fuelle($("#g-kanton"), [...new Set(GEM.map((g) => g.kanton))].sort());

  // Schulbau-Signal für Campus (Frage von Reto Bürgisser): viele Neubauten UND viele Junge
  const quantil = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(q * (s.length - 1))]; };
  const qNeu = quantil(GEM.map((g) => g.neubau), 0.75), qJung = quantil(GEM.map((g) => g.jung), 0.5);
  GEM.forEach((g) => { g.signal = g.neubau >= qNeu && g.jung >= qJung; });
  $("#signal-regel").textContent = `Schulbau-Signal: mindestens ${zahl(qNeu, 1)} neue Wohnungen pro 1'000 Einwohner (oberstes Viertel) und mindestens ${zahl(qJung, 1)} % Kinder und Jugendliche (obere Hälfte). Ein Hinweis auf Bedarf – kein Wissen über geplante Schulhäuser.`;

  $("#typkarten").innerHTML = ["A", "B", "C", "D"].map((t) => {
    const T = I.typen[t], alle = GEM.filter((g) => g.typ === t);
    const romandie = alle.filter((g) => g.sprache === "Französisch").length / alle.length;
    return `<div class="karte typkarte" style="border-top-color:${T.farbe}"><b class="t">${t} · ${esc(T.name)}</b>
      <div class="zahlen"><span><strong>${zahl(alle.length)}</strong> Gemeinden (${pct(alle.length / GEM.length)})</span>
        <span><strong>${pct(M.mix.gemeindetyp[t])}</strong> unserer Offerten</span><span><strong>${pct(M.anteile.gemeindetyp[t].ja)}</strong> gewonnen</span></div>
      <span class="klein">Romandie ${pct(romandie)} · Produkt zuerst: ${esc(T.produkte[0])} · Schulbau-Signal: ${alle.filter((g) => g.signal).length}</span>
      <p style="margin:8px 0 0">${esc(T.handlung)}</p></div>`;
  }).join("");
  zeigeGemeinden();
}

function zeigeGemeinden() {
  const f = { typ: $("#g-typ").value, sp: $("#g-sprache").value, ka: $("#g-kanton").value, st: $("#g-status").value, q: $("#g-suche").value.trim().toLowerCase() };
  const liste = GEM.filter((g) => (!f.typ || g.typ === f.typ) && (!f.sp || g.sprache === f.sp) && (!f.ka || g.kanton === f.ka) &&
    (!f.st || gStatus(g) === f.st) && (!f.q || g.name.toLowerCase().includes(f.q)))
    .sort((a, b) => a.typ.localeCompare(b.typ) || (b.signal - a.signal) || a.name.localeCompare(b.name, "de"));
  $("#g-anzahl").textContent = `${zahl(liste.length)} Gemeinden · davon ${zahl(liste.filter((g) => g.signal).length)} mit Schulbau-Signal (zuoberst je Typ)`;
  const st = { kunde: "Kundin", offerte: "Offerte ohne Auftrag", nie: "noch nie offeriert" };
  $("#gemeinden").innerHTML = `<thead><tr><th scope="col">Gemeinde</th><th scope="col">Kanton</th><th scope="col">Sprache</th><th scope="col">Typ</th><th scope="col">Status</th><th scope="col">Hat</th><th scope="col">Nächstes Produkt</th><th scope="col">Schulbau-Signal</th><th scope="col">Handlung</th></tr></thead><tbody>` +
    (liste.length ? liste.slice(0, gZeigen).map((g) => {
      const T = I.typen[g.typ];
      return `<tr><td class="voll"><button class="link gem-name" type="button" data-profil="${g.bfs}">${esc(g.name)}</button>${g.einwohner ? `<span class="meta">${zahl(g.einwohner)} Einw.</span>` : ""}</td>
      <td data-label="Kanton">${esc(g.kanton)}</td><td data-label="Sprache">${esc(g.sprache)}</td>
      <td data-label="Typ">${chip(g.typ)}</td><td data-label="Status">${st[gStatus(g)]}</td>
      <td data-label="Hat">${g.produkte.map(esc).join(", ") || "–"}</td><td data-label="Nächstes Produkt"><b>${esc(naechstes(g))}</b></td>
      <td data-label="Schulbau-Signal">${g.signal ? `<span class="marke entd">ja</span><span class="meta">${zahl(g.neubau, 1)} Neubauten/1'000 · ${zahl(g.jung, 1)} % Junge</span>` : "–"}</td>
      <td class="begr voll" data-label="Handlung">${esc(T.handlung)}</td></tr>`;
    }).join("") : `<tr class="leer"><td colspan="9">Keine Gemeinde passt zu diesen Filtern. <button class="mini" type="button" id="g-zurueck">Filter zurücksetzen</button></td></tr>`) + "</tbody>";
  $("#g-mehr").style.display = liste.length > gZeigen ? "" : "none";
}

// ------------------------------------------------------------ Rückblick & Pilot
function baueRueckblick() {
  const k = M.kennzahlen, lk = k.lernkosten, nu = k.nutzen, G = I.gruppe;
  const max = Math.max(k.auftraege_liste, 40);
  const bahn = (wert, farbe) => `<span class="bahn"><i style="width:${(wert / max) * 75}%;background:${farbe}"></i><b>${zahl(wert)}</b></span>`;
  // Gewinnkurve: Text in SVG-Einheiten gross genug, damit er auch bei 320 px Breite lesbar bleibt
  const pk = k.gewinnkurve.map((v, i) => `${50 + i * 14},${200 - v * 170}`).join(" ");
  $("#rueckblick").innerHTML = `
    <div class="zwei">
      <div class="karte"><b class="t">80 Offerten pro Quartal bringen</b>
        <div class="vergleich" role="img" aria-label="Rund ${zahl(k.auftraege_liste)} Aufträge mit der Liste, ${zahl(k.auftraege_zufall)} bei zufälliger Auswahl">
          <span class="lbl">mit der Liste</span>${bahn(k.auftraege_liste, "var(--blau)")}
          <span class="lbl">bei zufälliger Auswahl</span>${bahn(k.auftraege_zufall, "#8a96a3")}</div>
        <p>Rund <b>${zahl(k.auftraege_liste)} statt ${zahl(k.auftraege_zufall)} Aufträge</b> pro Quartal – je nach Aufteilung der Daten ${zahl(k.spanne[0])} bis ${zahl(k.spanne[1])}. Darum nennen wir eine Spanne.</p>
        <p class="klein">${k.treffer_top225} Treffer unter den obersten 225 von ${k.test_n} Prüf-Offerten, umgerechnet × 80/225.</p></div>
      <div class="karte kurve"><b class="t">Gewinnkurve</b>
        <svg viewBox="0 0 360 240" role="img" aria-label="Wer die obersten 25 Prozent der Liste offeriert, findet ${pct(k.gewinnkurve[5])} aller Aufträge">
          <line x1="50" y1="200" x2="330" y2="200" stroke="var(--linie-stark)"/><line x1="50" y1="30" x2="50" y2="200" stroke="var(--linie-stark)"/>
          <polyline points="50,200 330,30" fill="none" stroke="#8a96a3" stroke-width="2" stroke-dasharray="5 5"/>
          <polyline points="${pk}" fill="none" stroke="var(--blau)" stroke-width="3" stroke-linejoin="round"/>
          <line x1="120" y1="30" x2="120" y2="200" stroke="var(--gold)" stroke-width="1.5"/>
          <circle cx="120" cy="${200 - k.gewinnkurve[5] * 170}" r="5" fill="var(--gold)"/>
          <text x="128" y="${206 - k.gewinnkurve[5] * 170 + 22}" style="fill:var(--gold);font-weight:700">25 % → ${pct(k.gewinnkurve[5])}</text>
          <text x="50" y="226">0 %</text><text x="330" y="226" text-anchor="end">100 % offeriert</text>
          <text x="50" y="20">Anteil aller Aufträge gefunden</text>
        </svg><p class="klein">Blau: nach Liste offeriert. Grau gestrichelt: zufällige Auswahl.</p></div>
    </div>

    <h3>Warum das geht</h3>
    <p>${esc(G.warumSatz)}</p>
    <div class="tabelle-wrap"><table class="t"><thead><tr><th scope="col">Gemeindetyp</th><th scope="col" class="n">Anteil an den Offerten</th><th scope="col" class="n">Anteil an allen Gemeinden</th><th scope="col" class="n">Anteil gewonnen<span class="th-sub">Prüf-Offerten</span></th></tr></thead><tbody>
      ${k.zusammensetzung.map((z) => `<tr><td class="voll">${chip(z.typ, true)}</td>
        <td class="n" data-label="Anteil an den Offerten">${pct(z.anteil_offerten, 1)}</td><td class="n" data-label="Anteil an allen Gemeinden">${pct(z.anteil_gemeinden, 1)}</td>
        <td class="n" data-label="Anteil gewonnen"><b>${pct(z.ja_anteil, 1)}</b></td></tr>`).join("")}
    </tbody></table></div>

    <h3>Unsere Liste</h3>
    <p class="klein"><i>Geprüft an Offerten aus der Vergangenheit – ab 2027 stehen hier die neuen Opportunitäten (siehe Offertliste).</i></p>
    <div class="tabelle-wrap"><table class="t"><thead><tr><th scope="col" class="n">Rang</th><th scope="col">Gemeinde · Offerte</th><th scope="col">Typ</th><th scope="col" class="n">Gewinnchance</th><th scope="col">Begründung</th></tr></thead><tbody>
      ${k.top10.map((r, i) => `<tr><td class="n nur-gross">${i + 1}</td><td class="voll"><span class="nur-klein klein">Rang ${i + 1} · </span><b class="gem-name">${esc(r.gemeinde)}</b> <span class="meta">${esc(r.id)}</span></td>
        <td data-label="Typ">${chip(r.typ)}</td><td class="n" data-label="Gewinnchance"><b>${pct(r.chance)}</b></td><td class="voll" data-label="Begründung">${esc(kurzGrund(r))}</td></tr>`).join("")}
    </tbody></table></div>
    <p style="margin-top:16px">Zusammensetzung der obersten 225 von 900 Prüf-Offerten. <b>${esc(G.verschiebung)}</b></p>
    <div class="tabelle-wrap"><table class="t"><thead><tr><th scope="col">Gemeindetyp</th><th scope="col" class="n">In den obersten 225</th><th scope="col" class="n">Anteil an der Liste</th><th scope="col" class="n">Alle Prüf-Offerten des Typs</th><th scope="col" class="n">Anteil des Typs auf der Liste</th></tr></thead><tbody>
      ${k.zusammensetzung.map((z) => `<tr><td class="voll">${chip(z.typ, true)}</td>
        <td class="n" data-label="In den obersten 225">${z.auf_liste}</td><td class="n" data-label="Anteil an der Liste">${pct(z.anteil_an_liste)}</td>
        <td class="n" data-label="Alle Prüf-Offerten">${z.test}</td><td class="n" data-label="Anteil des Typs auf der Liste"><b>${pct(z.anteil_auf_liste)}</b></td></tr>`).join("")}
    </tbody></table></div>

    <h3>Woran man gute Chancen erkennt</h3>
    <div class="zwei">
      <div class="karte"><b class="t">Unsere drei wichtigsten Merkmale</b>
        <table class="t"><thead><tr><th scope="col">Merkmal</th><th scope="col" class="n">Anteil gewonnen</th><th scope="col" class="n">zum Vergleich</th></tr></thead><tbody>
        ${G.merkmale.map(([name, sp, w, vName, vW]) => `<tr><td class="voll"><b>${esc(name)}</b></td>
          <td class="n" data-label="Anteil gewonnen"><b>${pct(M.anteile[sp][w].ja)}</b></td><td class="n" data-label="${esc(vName)}">${esc(vName)}: ${pct(M.anteile[sp][vW].ja)}</td></tr>`).join("")}
        </tbody></table></div>
      <div class="karte"><b class="t">Ja-Anteil nach Bestandskunde und Quelle</b>
        <table class="t"><thead><tr><th scope="col"></th><th scope="col" class="n">Anfrage der Gemeinde</th><th scope="col" class="n">Andere Quellen</th></tr></thead><tbody>
        ${[["ja", "Bestandskunde"], ["nein", "Neukunde"]].map(([bk, n]) => `<tr><td class="voll"><b>${n}</b></td>
          ${["anfrage", "andere"].map((q) => `<td class="n" data-label="${q === "anfrage" ? "Anfrage der Gemeinde" : "Andere Quellen"}"><b>${pct(M.kombi[bk + "|" + q].ja, 1)}</b><span class="meta">${zahl(M.kombi[bk + "|" + q].n)} Offerten</span></td>`).join("")}</tr>`).join("")}
        </tbody></table></div>
    </div>
    <div class="merke">${G.wennDann.map(([w, d]) => `<b>Wenn</b> ${esc(w)}, <b>dann</b> ${esc(d)}.`).join("<br>")}</div>
    <div class="merke"><b>Plätze für Neukunden: was sie kosten, was sie bringen.</b> Mit ${lk.liste_plaetze} Listenplätzen und ${lk.entdeckung_plaetze} Plätzen für Neukunden
      werden es im Schnitt <b>${zahl(lk.auftraege_mit_entdeckung, 1)} statt ${zahl(lk.auftraege_nur_liste, 1)} Aufträge</b> pro Quartal
      (Unterschied je nach Aufteilung ${zahl(lk.kosten_spanne[0], 1)} bis ${zahl(lk.kosten_spanne[1], 1)}).
      Dafür offerieren wir <b>${zahl(lk.neukunden_mit_entdeckung)} statt ${zahl(lk.neukunden_nur_liste)} Neukunden</b> pro Quartal – und das Modell lernt Fälle kennen, die es bisher nie gesehen hat.</div>
    <h3>Was das in Franken heisst</h3>
    <div class="zwei">
      <div class="karte"><b class="t">Mehrumsatz gegenüber zufälliger Auswahl</b>
        <div class="grosszahl">CHF ${zahl(nu.pro_jahr_chf1000[0] / 1000, 1)} bis ${zahl(nu.pro_jahr_chf1000[1] / 1000, 1)} Mio. pro Jahr</div>
        <p>Die Liste bringt ${zahl(nu.plus_auftraege_q[0])} bis ${zahl(nu.plus_auftraege_q[1])} Aufträge mehr pro Quartal. Diese zusätzlichen Aufträge sind <b>kleiner als der Durchschnitt</b>
        (rund ${chf(nu.wert_zusatzauftrag)} statt ${chf(nu.wert_durchschnitt)} über 5 Jahre): Hohe Gewinnchance und grosser Auftrag gehen auseinander.
        Weil die Verträge 5 Jahre laufen, verteilen wir den Wert auf 5 Jahre – das ist der Mehrumsatz pro Jahr und Offert-Jahrgang (Umsatz 2025: CHF 64 Mio.).</p></div>
      <div class="karte" style="border-left:4px solid var(--gold)"><b class="t">Ehrlich bleiben</b>
        <ul style="margin:4px 0;padding-left:20px">
          <li>Verglichen wird mit <b>Zufall</b>. Gegenüber der heutigen Auswahl nach Erfahrung ist der Gewinn vermutlich kleiner – genau das misst der Pilot.</li>
          <li>Bestandskunden gewinnen auch ohne Liste oft. Diesen Vorsprung schreiben wir nicht dem Modell gut.</li>
          <li>Die Spanne kommt aus sechs verschiedenen Aufteilungen der Daten. Eine einzelne Zahl wäre genauer, als wir es wissen.</li>
        </ul></div>
    </div>`;
}

// ------------------------------------------------------------ Cockpit Pilotjahr
// Alle gemerkten Quartale mit ihrer Liste und ihrem Bearbeitungsstand
function jahrDaten() {
  return register().map((q) => {
    const z = q.name === quartal.name ? zustand : zustandVon(q.name);
    const rows = (lies("radar:rows:" + q.name) || []).map(rechne);
    const { sortiert } = auswahlFuer(rows, z);
    const drin = sortiert.filter((r) => DRIN.has(r.status)).map((r) => ({ ...r, q: q.name, z, st: normStatus(z.erg[r.id]), amWahl: !!z.am[r.id] }));
    return { name: q.name, z, sortiert, drin };
  });
}
const zaehle = (rows) => Object.fromEntries(STATUS.map(([k]) => [k, rows.filter((r) => r.st === k).length]));
const quote = (g, v) => (g + v ? pct(g / (g + v)) : "–");
let cZeigen = 25;

function zeigeCockpit() {
  if (!M) return;
  const Q = jahrDaten(), alle = Q.flatMap((q) => q.drin), z = zaehle(alle);
  const entsch = alle.filter((r) => r.st === "gewonnen" || r.st === "verloren");
  const erwEntsch = entsch.reduce((s, r) => s + r.chance, 0), zufall = entsch.length * M.kennzahlen.ja_anteil;
  const prognose = alle.reduce((s, r) => s + r.chance, 0);
  const gewonnen = alle.filter((r) => r.st === "gewonnen");
  const wertGew = gewonnen.reduce((s, r) => s + r.wert, 0);
  const plan = Q.reduce((s, q) => s + (+q.z.kap || 80), 0);
  const ueber = alle.filter((r) => fristInfo(r, r.z).ueber).length;
  const stand = lies("radar:stand");

  // Liste gegen Erfahrung über das ganze Jahr (nur offerierte Fälle haben ein Ergebnis)
  const gruppe = (r) => r.status === "entd" ? "Plätze für Neukunden" : (r.status === "pa" || r.status === "am") ? "nur AM" : r.amWahl ? "Liste und AM" : "nur Liste";
  const gruppen = ["Liste und AM", "nur Liste", "nur AM", "Plätze für Neukunden"].map((n) => [n, alle.filter((r) => gruppe(r) === n)]);
  // Entscheidungsregel: Gewinnquote «nur Liste» gegen «nur AM»
  const gq = (n) => { const rs = gruppen.find((g) => g[0] === n)[1]; const g = rs.filter((r) => r.st === "gewonnen").length, v = rs.filter((r) => r.st === "verloren").length; return { q: g + v ? g / (g + v) : null, n: g + v }; };
  const L = gq("nur Liste"), A = gq("nur AM");
  const pp = (x) => (x * 100).toFixed(1).replace(".", ",");
  const regel = L.q === null || A.q === null ? { farbe: "#8a96a3", text: "Noch kein Vergleich möglich" }
    : L.n < 30 || A.n < 30 ? { farbe: "#c9962b", text: `Zwischenstand: Liste ${pp(L.q - A.q)} Prozentpunkte vor AM – noch zu wenige entschiedene Fälle (${L.n} / ${A.n})` }
    : L.q - A.q >= I.entscheidRegel.vorsprung ? { farbe: "#1a8a5f", text: `Zwischenstand erfüllt: Liste ${pp(L.q - A.q)} Prozentpunkte vor AM` }
    : { farbe: "#b3261e", text: `Zwischenstand nicht erfüllt: Liste ${pp(L.q - A.q)} Prozentpunkte gegenüber AM` };
  // Ampel: gewonnen gegenüber Erwartung laut Modell (für die entschiedenen Offerten)
  const verh = erwEntsch ? z.gewonnen / erwEntsch : null;
  const ampel = verh === null ? null : verh >= 0.9 ? ["#3fcf8e", "im Plan"] : verh >= 0.75 ? ["#f0c04a", "knapp unter Plan"] : ["#ff7b72", "unter Plan"];
  const fz = $("#c-zust")?.value ?? (rolle.typ === "am" ? "meine" : "");
  const verlauf = Q.flatMap((q) => (q.z.log || []).map((l) => ({ ...l, q: q.name }))).sort((a, b) => (b.n || 0) - (a.n || 0) || b.t.localeCompare(a.t)).slice(0, 40);
  const zeileErg = (n, rs, klasse = "") => { const g = rs.filter((r) => r.st === "gewonnen").length, v = rs.filter((r) => r.st === "verloren").length;
    return `<tr class="${klasse}"><td class="voll"><b>${n}</b></td><td class="n" data-label="offeriert">${rs.length}</td><td class="n" data-label="gewonnen">${g}</td><td class="n" data-label="verloren">${v}</td><td class="n" data-label="Gewinnquote"><b>${quote(g, v)}</b></td></tr>`; };

  const fst = $("#c-status")?.value ?? "offen";
  const laufend = alle.filter((r) => !fz || zustaendig(r) === (fz === "meine" ? rolle.am : fz)).filter((r) => fst === "offen" ? (r.st === "bearbeitung" || r.st === "offeriert") : fst === "alle" ? true : (r.st || "geplant") === fst)
    .sort((a, b) => sortQ(a.q) - sortQ(b.q) || b.chance - a.chance);

  if (rolle.typ === "am" || !Q.length) { $("#cockpit").innerHTML = ""; return; }
  $("#cockpit").innerHTML = `
    <div class="cockpit-kopf"><h3>Pilotjahr im Detail</h3>
      <button class="knopf sek klein-k" type="button" id="bericht">Bericht für die Geschäftsleitung drucken</button></div>
    <div class="tabelle-wrap"><table class="t"><thead><tr><th scope="col">Quartal</th><th scope="col">Phase</th><th scope="col">Stand</th>
      ${STATUS.map(([, n]) => `<th scope="col" class="n">${n.replace(" – Entscheid offen", "")}</th>`).join("")}<th scope="col" class="n">Gewinnquote</th><th scope="col" class="n">Erwartet<span class="th-sub">laut Modell</span></th><th scope="col"></th></tr></thead><tbody>
      ${Q.map((q) => { const zz = zaehle(q.drin);
        return `<tr><td class="voll"><b class="gem-name">${esc(q.name)}</b>${q.z.pilot ? ' <span class="marke am">Vergleich Liste/AM</span>' : ""}</td>
          <td data-label="Phase"><span class="klein">${esc(I.phasen[q.z.phase])}${q.z.phase === "vorauswahl" ? ` · ${Object.keys(q.z.abgabe || {}).length}/${I.regionen.length} AM` : ""}</span></td>
          <td class="voll" style="min-width:180px">${stapel(zz, q.drin.length, false)}</td>
          ${STATUS.map(([k, n]) => `<td class="n" data-label="${n.replace(" – Entscheid offen", "")}">${zz[k]}</td>`).join("")}
          <td class="n" data-label="Gewinnquote"><b>${quote(zz.gewonnen, zz.verloren)}</b></td>
          <td class="n" data-label="Erwartet laut Modell">≈ ${zahl(q.drin.reduce((s, r) => s + r.chance, 0))}</td>
          <td>${rolle.typ === "gl" ? "" : `<button class="mini" type="button" data-oeffne="${esc(q.name)}">Liste öffnen</button>`}</td></tr>`; }).join("")}
    </tbody></table></div>
    ${stapel(z, alle.length, true).replace(/^<div class="stapel"[^]*?<\/div>/, "")}

    <div class="zwei" style="margin-top:20px">
      <div class="karte"><b class="t">Liste gegen Erfahrung – ganzes Pilotjahr</b>
        <table class="t"><thead><tr><th scope="col">Offeriert, weil …</th><th scope="col" class="n">offeriert</th><th scope="col" class="n">gewonnen</th><th scope="col" class="n">verloren</th><th scope="col" class="n">Gewinnquote</th></tr></thead><tbody>
        ${gruppen.map(([n, rs]) => zeileErg(n, rs, n.startsWith("Plätze") ? "unter" : "")).join("")}</tbody></table>
        <div class="regel" style="border-left-color:${regel.farbe}"><b>Entscheidungsregel:</b> ${esc(I.entscheidRegel.text)}<br><span style="color:${regel.farbe};font-weight:700">● ${esc(regel.text)}</span></div>
        <p class="klein">${Q.some((q) => !q.z.pilot) ? "Quartale ohne Vergleich liefern für «nur AM» kein Ergebnis. " : ""}Die Plätze für Neukunden laufen ausserhalb des Vergleichs.</p></div>
      <div class="karte"><b class="t">Gewinnquote nach Gemeindetyp</b>
        <table class="t"><thead><tr><th scope="col">Typ</th><th scope="col" class="n">offeriert</th><th scope="col" class="n">gewonnen</th><th scope="col" class="n">verloren</th><th scope="col" class="n">Gewinnquote</th></tr></thead><tbody>
        ${["A", "B", "C", "D"].map((t) => zeileErg(chip(t), alle.filter((r) => r.gemeindetyp === t))).join("")}</tbody></table>
        <p class="klein" style="margin-top:12px">Geschätzter Wert der gewonnenen Aufträge: <b>${chf(wertGew)}</b> über 5 Jahre (≈ ${chf(wertGew / 5)} pro Jahr), davon ${gewonnen.filter((r) => r.bestandskunde === "nein").length} Neukunden.</p></div>
    </div>

    <h3>Verlauf: wer hat wann was geändert</h3>
    <div class="karte">${verlauf.length ? `<ul class="verlauf">${verlauf.map((l) => `<li><span class="klein">${new Date(l.t).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short" })} · ${esc(l.q)} · ${esc(l.wer)}</span><br><b>${esc(l.was)}</b> ${esc(l.text)}</li>`).join("")}</ul>` : '<p class="klein" style="margin:0">Noch keine Änderungen protokolliert.</p>'}</div>`;
}
// Status-Auswahl im Cockpit: gilt für das Quartal der Zeile
function statusWahlQ(r) {
  return `<select class="mini status-wahl" data-cq="${esc(r.q)}" data-cid="${esc(r.id)}" data-st="${r.st || "geplant"}" aria-label="Status ${esc(r.gemeindename)}">
    ${STATUS.map(([k, n]) => `<option value="${k}" ${r.st === k ? "selected" : ""}>${n}</option>`).join("")}</select>`;
}
function setzeStatus(qName, id, st, r) {
  const z = qName === quartal.name ? zustand : zustandVon(qName);
  if (!darf("status", r, z)) return;
  const alt = normStatus(z.erg[id]);
  if (st) z.erg[id] = st; else delete z.erg[id];
  protokolliere(z, "Status", `${r.gemeindename}: ${STATUS_NAME[alt]} → ${STATUS_NAME[st]}`, id);
  schreib("radar:" + qName, z);
}

// Demo: ganzes Pilotjahr mit simuliertem Stand laden
const zufallVon = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 10000) / 10000; };
const DEMO_STAENDE = [
  ["2026-12-22", "Pilotstart", "Vorauswahl Q1 läuft"],
  ["2027-03-31", "31. März", "Q1 läuft"],
  ["2027-06-30", "30. Juni", "Zwischenbilanz"],
  ["2027-09-30", "30. September", "Q3 läuft, Q4 in der Vorauswahl"],
  ["2027-12-31", "31. Dezember", "Jahresbilanz, Q4 läuft noch"],
];
function entferne(k) { ERSATZ.delete(k); try { localStorage.removeItem(k); } catch (e) { /* egal */ } }
// Löscht Quartale und Bearbeitungsstand – Rolle, Einführung und Darstellung bleiben
function loescheStand() {
  register().forEach((q) => { entferne("radar:rows:" + q.name); entferne("radar:" + q.name); });
  ["radar:quartale", "radar:stand", "radar:aktiv", "radar:demo"].forEach(entferne);
}
async function ladeDemoJahr(standIso = "2027-09-30") {
  const d = await fetch("daten/demo_pilotjahr_2027.json").then((r) => r.json());
  loescheStand();
  const TAG = 86400000, S = Date.parse(standIso + "T00:00:00Z");
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const iso = (ms, h = 9) => new Date(Math.min(ms, S + 17 * 3600000) + h * 3600000).toISOString();
  const reg = [];
  d.quartale.forEach((q, qi) => {
    const qs = Date.UTC(2027, qi * 3, 1), vorStart = qs - 14 * TAG, freigabe = qs + 4 * TAG;
    if (S < vorStart) return;   // dieses Quartal hat noch nicht begonnen
    const roh = q.rows.map((r) => ({ ...r, id: r.offerte_id }));
    const SP = ["id", "bfs_nr", "gemeindename", "kanton", "sprachregion", "gemeindetyp", "einwohner", "produktlinie", "quelle", "verfahren", "bestandskunde", "kontakte_12m"];
    schreib("radar:rows:" + q.name, roh.map((r) => Object.fromEntries(SP.map((k) => [k, r[k]]))));
    reg.push({ name: q.name, quelle: "Demo-Pilotjahr: 320 bisherige Offerten als Opportunitäten" });
    const z = { ...leerZustand(), pilot: true };
    let nr = qi * 1000;   // Demo-Einträge: kleine Nummern, echte Änderungen stehen darüber
    const inVorauswahl = S < freigabe, e = (S - freigabe) / TAG, fertig = !inVorauswahl && e >= 170;
    const regionen = I.regionen.map(([n]) => n);
    const abgegeben = inVorauswahl ? regionen.slice(0, Math.min(11, 3 + Math.floor((S - vorStart) / TAG))) : regionen;
    abgegeben.forEach((n, k) => { z.abgabe[n] = iso(vorStart + (k % 9 + 1) * TAG, k % 8); z.log.push({ t: z.abgabe[n], n: ++nr, wer: "AM " + n, was: "Vorauswahl abgegeben", text: n, id: "" }); });
    // Vorauswahl der Account Manager wie heute: Bestandskunden zuerst, dann grosse Gemeinden
    roh.filter((r) => r.einwohner <= 50000).sort((a, b) => (b.bestandskunde === "ja") - (a.bestandskunde === "ja") || b.einwohner - a.einwohner)
      .slice(0, 80).filter((r) => abgegeben.includes(zustaendig(r))).forEach((r) => { z.am[r.id] = 1; });
    z.phase = inVorauswahl ? "vorauswahl" : fertig ? "abgeschlossen" : "freigegeben";
    if (!inVorauswahl) {
      z.log.push({ t: iso(freigabe), n: ++nr, wer: I.rollen.vl, was: "Freigabe", text: `${q.name}: 80 Offerten, Kapazität 80, Plätze für Neukunden 10, Vergleich Liste/AM`, id: "" });
      // Fortschritt nach Tagen seit Freigabe: zuerst bearbeitet, dann offeriert, dann entschieden
      const entschieden = fertig ? 1 : clamp((e - 40) / 110) * 0.95, offeriert = clamp((e - 15) / 90), bearbeitet = clamp(e / 30);
      const ausgang = Object.fromEntries(roh.map((r) => [r.id, r._ergebnis === "ja" ? "gewonnen" : "verloren"]));
      auswahlFuer(roh.map(rechne), z).sortiert.filter((r) => DRIN.has(r.status)).forEach((r) => {
        const p = zufallVon(r.id);
        const st = p < entschieden ? ausgang[r.id] : p < offeriert ? "offeriert" : p < bearbeitet ? "bearbeitung" : "";
        if (st) z.erg[r.id] = st;
        z.frist[r.id] = new Date(freigabe + (21 + Math.floor(zufallVon(r.id + "f") * 60)) * TAG).toISOString().slice(0, 10);
      });
      const n = Object.keys(z.erg).length;
      if (n) z.log.push({ t: iso(S, 7), n: qi * 1000 + 800, wer: I.rollen.ot, was: "Status nachgeführt", text: `${n} Offerten (Demo)`, id: "" });
      if (fertig) z.log.push({ t: iso(freigabe + 170 * TAG), n: qi * 1000 + 900, wer: I.rollen.vl, was: "Abschluss", text: q.name, id: "" });
    }
    schreib("radar:" + q.name, z);
  });
  schreib("radar:quartale", reg);
  const [j, m, t] = standIso.split("-");
  schreib("radar:stand", `${t}.${m}.${j}`);
  schreib("radar:demo", standIso);
  const aktiv = [...reg].reverse().find((q) => zustandVon(q.name).phase === "freigegeben") || reg[reg.length - 1];
  zeigeQuartal(aktiv.name);
  zeigeCockpit();
}
// Zurück zum Anfang: leeres Demo-Quartal Q1 ohne Bearbeitungsstand
async function setzeZurueck() {
  if (!confirm("Den ganzen Stand zurücksetzen? Alle Quartale, Statusangaben, Notizen und der Verlauf in diesem Browser werden gelöscht. Danach ist wieder das leere Demo-Quartal Q1 geladen.")) return false;
  loescheStand();
  const demo = await fetch("daten/demo_quartal_2027Q1.csv").then((r) => r.text());
  ladeQuartal(demo, "Q1/2027", "Demo: 320 Beispiel-Opportunitäten aus bisherigen Offerten");
  return true;
}
// Gemeinsamer Stand für Team und Geschäftsleitung: als Datei weitergeben
function exportiereJahr() {
  const daten = { version: 1, exportiert: new Date().toISOString(), stand: lies("radar:stand"), quartale: register().map((q) => ({
    ...q, rows: lies("radar:rows:" + q.name) || [], zustand: q.name === quartal.name ? zustand : zustandVon(q.name) })) };
  ladeHerunter(new Blob([JSON.stringify(daten)], { type: "application/json" }), "marktradar_pilotjahr_" + new Date().toISOString().slice(0, 10) + ".json");
}
function importiereJahr(datei) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d.quartale)) throw new Error();
      d.quartale.forEach((q) => { schreib("radar:rows:" + q.name, q.rows); schreib("radar:" + q.name, q.zustand); });
      schreib("radar:quartale", d.quartale.map(({ name, quelle }) => ({ name, quelle })).sort((a, b) => sortQ(a.name) - sortQ(b.name)));
      schreib("radar:stand", d.stand || null);
      zeigeQuartal(d.quartale[d.quartale.length - 1].name); zeigeCockpit();
    } catch (e) { alert("Diese Datei ist kein exportiertes Pilotjahr des Marktradars."); }
  };
  r.readAsText(datei, "utf-8");
}
function ladeHerunter(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
}

// ------------------------------------------------------------ Herleitung
function baueHerleitung() {
  const sp = ["Analyseergebnis", "Element im Marktradar", "Was wir ohne die Daten falsch gebaut hätten"];
  $("#herleitung").innerHTML = `<thead><tr>${sp.map((s) => `<th scope="col">${s}</th>`).join("")}</tr></thead><tbody>` +
    I.herleitung.map((z) => `<tr>${z.map((c, i) => `<td class="voll" data-label="${sp[i]}">${i === 1 ? `<b>${esc(c)}</b>` : esc(c)}</td>`).join("")}</tr>`).join("") + "</tbody>";
  $("#grenzen").innerHTML = I.grenzen.map((g) => `<li>${esc(g)}</li>`).join("");
  $("#pilot-hintergrund").innerHTML = `
    <h2 style="margin-top:40px">So messen wir im Pilot</h2>
    <div class="karte"><ol style="margin:4px 0;padding-left:20px">${I.pilotSchritte.map((x) => `<li>${x}</li>`).join("")}</ol></div>
    <h3>Unsere offenen Punkte aus Block 3 – und was der Radar dazu zeigt</h3>
    <div class="tabelle-wrap"><table class="t"><thead><tr><th scope="col">Offener Punkt</th><th scope="col">Antwort im Radar</th></tr></thead><tbody>
      ${I.gruppe.offenePunkte.map(([f, a]) => `<tr><td class="voll"><b>${esc(f)}</b></td><td class="voll" data-label="Antwort im Radar">${esc(a)}</td></tr>`).join("")}
    </tbody></table></div>
    <h3>Was wir von der Geschäftsleitung brauchen</h3>
    <div class="merke"><ol style="margin:0;padding-left:20px">${I.antrag.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>`;
  const g = M.regression;
  $("#reg-text").textContent = `Im Schnitt liegt die Schätzung ${zahl(g.mae)}'000 Franken daneben; 8 von 10 Fehlern liegen zwischen ${zahl(g.band_unten)}'000 und +${zahl(g.band_oben)}'000.`;
}

// ------------------------------------------------------------ Bedienung
function waehleTab(b, fokus) {
  $$("#tabs button").forEach((x) => { const an = x === b; x.setAttribute("aria-selected", an); x.tabIndex = an ? 0 : -1; });
  $$(".tab").forEach((t) => t.classList.toggle("aktiv", t.id === "tab-" + b.dataset.tab));
  if (fokus) b.focus();
  b.scrollIntoView({ block: "nearest", inline: "nearest" });
  if (b.dataset.tab === "pilotjahr" && M) zeigeCockpit();
  if (b.dataset.tab === "start" && M) zeigeStart();
  try { localStorage.setItem("radar:tab", b.dataset.tab); } catch (err) { /* egal */ }
}
$("#tabs").addEventListener("click", (e) => { const b = e.target.closest("button[data-tab]"); if (b) waehleTab(b); });
$("#tabs").addEventListener("keydown", (e) => {   // Pfeiltasten wie bei Registerkarten üblich
  const alle = $$("#tabs button"), i = alle.indexOf(document.activeElement);
  const ziel = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: alle.length - 1 }[e.key];
  if (ziel === undefined || i < 0) return;
  e.preventDefault(); waehleTab(alle[(ziel + alle.length) % alle.length], true);
});
$("#ansicht").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  $$("#ansicht button").forEach((x) => { x.classList.toggle("an", x === b); x.setAttribute("aria-pressed", x === b); }); zeigeListe();
});
["#kap", "#entd", "#f-typ", "#suche", "#pilotmodus", "#f-status", "#f-sort"].forEach((s) => $(s).addEventListener("input", () => { if (!quartal.rows.length) return; zeigeListe(); speichere(); }));
$("#quartal-wahl").addEventListener("change", (e) => zeigeQuartal(e.target.value));
["#kap", "#entd", "#pilotmodus"].forEach((s) => $(s).addEventListener("change", () => {
  if (!darf("einstellen")) return;
  protokolliere(zustand, "Einstellung", `Kapazität ${zustand.kap}, Plätze für Neukunden ${zustand.entd}, Vergleich Liste/AM ${zustand.pilot ? "an" : "aus"}`);
  speichere();
}));
["#f-zust"].forEach((s) => $(s).addEventListener("input", () => quartal.rows.length && zeigeListe()));

// Rolle wechseln («Ansicht als») – im Betrieb ergibt sich die Rolle aus dem Login
function baueRollenwahl() {
  $("#rolle-wahl").innerHTML = `<optgroup label="Leitung und Team">${["vl", "ot", "gl"].map((t) => `<option value="${t}">${I.rollen[t]}</option>`).join("")}</optgroup>
    <optgroup label="Account Manager">${I.regionen.map(([n]) => `<option value="am:${esc(n)}">AM ${esc(n)}</option>`).join("")}</optgroup>`;
  $("#rolle-wahl").value = rolle.typ === "am" ? "am:" + rolle.am : rolle.typ;
  $("#f-zust").innerHTML = `<option value="">Alle Regionen</option>${rolle.typ === "am" ? `<option value="meine">Meine Region (${esc(rolle.am)})</option>` : ""}
    ${I.regionen.map(([n]) => `<option value="${esc(n)}">${esc(n)}</option>`).join("")}`;
  $("#f-zust").value = rolle.typ === "am" ? "meine" : "";
  document.body.dataset.rolle = rolle.typ;
  // Register pro Rolle: Die Geschäftsleitung braucht die Arbeitsliste nicht
  $("#t-liste").hidden = rolle.typ === "gl";
  if (rolle.typ === "gl" && $("#t-liste").getAttribute("aria-selected") === "true") waehleTab($("#t-start"));
}
$("#rolle-wahl").addEventListener("change", (e) => {
  const v = e.target.value;
  rolle = v.startsWith("am:") ? { typ: "am", am: v.slice(3) } : { typ: v, am: "" };
  schreib("radar:rolle", rolle);
  baueRollenwahl();
  if (quartal.rows.length) zeigeListe();
  zeigeCockpit(); zeigeStart(); zeigeHilfe(false);
});
baueRollenwahl();

// Begründung für AM-Entscheide: eigener Dialog statt Browser-Prompt
function frageGrund(text) {
  const d = $("#grund-dialog");
  if (typeof d.showModal !== "function") {   // sehr alte Browser
    const g = prompt(text); return Promise.resolve(g === null ? null : g);
  }
  $("#grund-titel").textContent = text; $("#grund-text").value = "";
  d.showModal(); $("#grund-text").focus();
  return new Promise((ok) => d.addEventListener("close", () => ok(d.returnValue === "ok" ? $("#grund-text").value : null), { once: true }));
}
$("#liste").addEventListener("click", async (e) => {
  if (e.target.id === "filter-zurueck") { $("#suche").value = ""; $("#f-typ").value = ""; $('#ansicht button[data-v="alle"]').click(); return; }
  const b = e.target.closest("button[data-act]"); if (!b) return;
  const id = b.dataset.id, act = b.dataset.act;
  const r = quartal.rows.find((x) => x.id === id);
  if (!r || !darf("reinraus", r)) return;
  if (act === "zurueck") { delete zustand.over[id]; delete zustand.over[id + ":grund"]; protokolliere(zustand, "Zurückgenommen", r.gemeindename, id); }
  else {
    $("#grund-fall").textContent = `${r.gemeindename} · ${r.produktlinie} · Gewinnchance ${pct(r.chance)}`;
    const grund = await frageGrund(act === "raus" ? "Warum nehmt ihr diesen Fall heraus?" : "Warum soll dieser Fall auf die Liste?");
    if (grund === null) { b.focus(); return; }
    zustand.over[id] = act; if (grund.trim()) zustand.over[id + ":grund"] = grund.trim();
    protokolliere(zustand, act === "raus" ? "Herausgenommen" : "Hinzugefügt", `${r.gemeindename}${grund.trim() ? " – " + grund.trim() : ""}`, id);
  }
  speichere(); zeigeListe();
});
$("#hochladen").addEventListener("click", () => $("#datei").click());
$("#liste").addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.vorauswahl) {   // Vorauswahl eines AM
    if (!darf("vorauswahl")) return;
    if (t.checked) zustand.am[t.dataset.vorauswahl] = 1; else delete zustand.am[t.dataset.vorauswahl];
    speichere(); zeigeListe(); $(`input[data-vorauswahl="${CSS.escape(t.dataset.vorauswahl)}"]`)?.focus(); return;
  }
  if (!t.dataset.erg) return;
  const r = quartal.rows.find((x) => x.id === t.dataset.erg);
  if (!r || !darf("status", r)) return;
  const alt = normStatus(zustand.erg[r.id]);
  if (t.value) zustand.erg[r.id] = t.value; else delete zustand.erg[r.id];
  protokolliere(zustand, "Status", `${r.gemeindename}: ${STATUS_NAME[alt]} → ${STATUS_NAME[t.value]}`, r.id);
  speichere(); zeigeListe(); $(`select[data-erg="${CSS.escape(r.id)}"]`)?.focus();
});
// Vorauswahl abgeben, Liste freigeben, Quartal abschliessen
document.addEventListener("click", (e) => {
  const id = e.target.id;
  if (id === "abgeben" && darf("vorauswahl")) {
    const n = quartal.rows.filter((r) => istMeins(r) && zustand.am[r.id]).length;
    if (!confirm(`Vorauswahl mit ${n} Fällen abgeben? Danach seht ihr die Liste, könnt die Vorauswahl aber nicht mehr ändern.`)) return;
    zustand.abgabe[rolle.am] = new Date().toISOString();
    protokolliere(zustand, "Vorauswahl abgegeben", `${rolle.am}: ${n} Fälle`);
    speichere(); zeigeListe(); zeigeCockpit();
  } else if (id === "freigeben" && darf("freigeben")) {
    const fehlen = I.regionen.length - Object.keys(zustand.abgabe).length;
    if (!confirm(`${quartal.name} freigeben?${fehlen ? ` ${fehlen} Account Manager haben ihre Vorauswahl noch nicht abgegeben.` : ""} Danach ist die Liste fix.`)) return;
    zustand.phase = "freigegeben";
    protokolliere(zustand, "Freigabe", `${quartal.name}: ${auswahl().sortiert.filter((r) => DRIN.has(r.status)).length} Offerten, Kapazität ${zustand.kap}, Plätze für Neukunden ${zustand.entd}${zustand.pilot ? ", Vergleich Liste/AM" : ""}`);
    speichere(); zeigeListe(); zeigeCockpit();
  } else if (id === "abschliessen" && darf("abschliessen")) {
    const offen = auswahl().sortiert.filter((r) => DRIN.has(r.status) && !["gewonnen", "verloren"].includes(normStatus(zustand.erg[r.id]))).length;
    if (!confirm(`${quartal.name} abschliessen?${offen ? ` ${offen} Offerten sind noch nicht entschieden.` : ""} Danach ist das Quartal nur noch lesbar.`)) return;
    zustand.phase = "abgeschlossen";
    protokolliere(zustand, "Abschluss", quartal.name);
    speichere(); zeigeListe(); zeigeCockpit();
  }
});
// Cockpit: Filter, Status ändern, Quartal öffnen
$("#cockpit").addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "c-status" || t.id === "c-zust") { cZeigen = 25; zeigeCockpit(); $("#" + t.id).focus(); return; }
  if (t.dataset.cq) {
    const zq = jahrDaten().find((q) => q.name === t.dataset.cq);
    setzeStatus(t.dataset.cq, t.dataset.cid, t.value, zq?.drin.find((r) => r.id === t.dataset.cid));
    if (t.dataset.cq === quartal.name) zeigeListe();
    zeigeCockpit(); $(`select[data-cid="${CSS.escape(t.dataset.cid)}"]`)?.focus();
  }
});
$("#cockpit").addEventListener("click", (e) => {
  const q = e.target.closest("[data-oeffne]");
  if (q) { zeigeQuartal(q.dataset.oeffne); waehleTab($("#t-liste")); scrollTo(0, 0); return; }
  if (e.target.id === "c-mehr") { cZeigen += 50; zeigeCockpit(); }
  const d = e.target.closest("[data-cdetail]"); if (d) oeffneDetail(d.dataset.dq, d.dataset.cdetail);
  if (e.target.id === "bericht") { document.body.classList.add("druck-cockpit"); print(); document.body.classList.remove("druck-cockpit"); }
});
$("#jahr-export").addEventListener("click", exportiereJahr);
$("#jahr-laden").addEventListener("click", () => $("#jahr-datei").click());
$("#jahr-datei").addEventListener("change", (e) => { if (e.target.files[0]) importiereJahr(e.target.files[0]); e.target.value = ""; });
$("#export").addEventListener("click", exportiere);
$("#datei").addEventListener("change", (e) => leseDatei(e.target.files[0]));
function leseDatei(f) {
  if (!f) return;
  const r = new FileReader();
  // Quartal aus dem Dateinamen erkennen, z. B. «opportunitaeten_Q2_2027.csv» → «Q2/2027»
  const m = /q([1-4])\D{0,3}(20\d\d)/i.exec(f.name);
  const name = m ? `Q${m[1]}/${m[2]}` : f.name.replace(/\.csv$/i, "");
  r.onload = () => ladeQuartal(r.result, name, "hochgeladen am " + new Date().toLocaleDateString("de-CH"));
  r.readAsText(f, "utf-8");
}
let zieh = 0;
addEventListener("dragenter", (e) => { e.preventDefault(); zieh++; document.body.classList.add("ziehen"); });
addEventListener("dragleave", () => { if (--zieh <= 0) { zieh = 0; document.body.classList.remove("ziehen"); } });
addEventListener("dragover", (e) => e.preventDefault());
addEventListener("drop", (e) => { e.preventDefault(); zieh = 0; document.body.classList.remove("ziehen");
  if (!darf("hochladen")) { meldung("warn", "Neue Quartale lädt die Vertriebsleitung hoch."); return; }
  leseDatei(e.dataTransfer.files[0]); });
["#g-typ", "#g-sprache", "#g-kanton", "#g-status", "#g-suche"].forEach((s) => $(s).addEventListener("input", () => { gZeigen = 100; zeigeGemeinden(); }));
$("#g-mehr").addEventListener("click", () => { gZeigen += 200; zeigeGemeinden(); });
const gFilter = (typ, status) => { $("#g-typ").value = typ; $("#g-status").value = status; $("#g-sprache").value = ""; $("#g-kanton").value = ""; $("#g-suche").value = ""; gZeigen = 100; zeigeGemeinden(); };
$("#kampagne").addEventListener("click", () => gFilter("C", "nie"));
$("#crosssell").addEventListener("click", () => gFilter("", "kunde"));
$("#gemeinden").addEventListener("click", (e) => { if (e.target.id === "g-zurueck") gFilter("", ""); });
// Info-Hinweise: Maus, Tippen (Handy) und Tastatur
function zeigeTip(i) {
  const tip = $("#tip");
  if (!i) { tip.style.display = "none"; return; }
  tip.textContent = i.dataset.info; tip.style.display = "block";
  const r = i.getBoundingClientRect(), b = Math.min(300, innerWidth - 16);
  tip.style.maxWidth = b + "px";
  tip.style.left = Math.max(8, Math.min(r.left - 12, innerWidth - b - 8)) + "px";
  const unten = r.bottom + 8, hoehe = tip.offsetHeight;
  tip.style.top = (unten + hoehe > innerHeight - 8 ? Math.max(8, r.top - hoehe - 8) : unten) + "px";
}
document.addEventListener("mouseover", (e) => { if (!document.activeElement?.classList?.contains("info")) zeigeTip(e.target.closest(".info")); });
document.addEventListener("click", (e) => {
  const i = e.target.closest(".info");
  if (i) e.preventDefault();   // sonst löst das umgebende <label> einen zweiten Klick aus
  zeigeTip(i);
});
document.addEventListener("focusin", (e) => zeigeTip(e.target.closest?.(".info")));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") zeigeTip(null);
  if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("info")) { e.preventDefault(); zeigeTip(e.target); }
});
addEventListener("scroll", () => zeigeTip(null), { passive: true });
try { const t = localStorage.getItem("radar:tab"); const b = t && $(`#tabs button[data-tab="${t}"]:not([hidden])`); if (b) waehleTab(b); } catch (e) { /* egal */ }
// start() ruft ansichten.js auf, sobald alle Ansichten geladen sind
