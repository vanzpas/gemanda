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
const info = (text, label) => `<span class="info" tabindex="0" role="button" aria-label="${esc(label)}" data-info="${esc(text)}">?</span>`;

let M, GEM, GEM_BFS;            // Modell, Gemeinden
let quartal = { name: "", quelle: "", rows: [] };
let zustand = { over: {}, am: {}, erg: {} };   // Entscheide der Account Manager, Pilot
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
  $("#datenhinweis").textContent = I.datenhinweis;
  $("#fuss").textContent = "GovTech-Marktradar · MVP · Leistungsnachweis 2, CAS AI in Product Management HS 26 · " + I.datenhinweis;
  try {
    const [m, g, demo] = await Promise.all([
      fetch("daten/modell.json").then((r) => r.json()),
      fetch("daten/gemeinden.json").then((r) => r.json()),
      fetch("daten/demo_quartal_2027Q1.csv").then((r) => r.text()),
    ]);
    M = m; GEM = g; GEM_BFS = new Map(g.map((x) => [x.bfs, x]));
    ladeQuartal(demo, "Demo-Quartal Q1/2027", "320 Beispiel-Opportunitäten aus bisherigen Offerten, ohne Ergebnis");
  } catch (e) {
    meldung("fehler", "Die Daten konnten nicht geladen werden. Die Seite muss über einen Webserver geöffnet werden (z. B. GitHub Pages).");
    return;
  }
  baueGemeinden(); baueRueckblick(); baueHerleitung();
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
    rows.push(rechne({ ...r, id: r.offerte_id || r.id || "Z" + String(i + 1).padStart(4, "0"), einwohner: ew, kontakte_12m: ko }));
  });
  if (probleme.length) meldung("warn", `${probleme.length} Zeile(n) übersprungen: ` + probleme.slice(0, 5).map(esc).join(" · ") + (probleme.length > 5 ? " …" : ""));
  quartal = { name, quelle, rows };
  try { zustand = JSON.parse(localStorage.getItem("radar:" + name)) || { over: {}, am: {}, erg: {} }; }
  catch (e) { zustand = { over: {}, am: {}, erg: {} }; }
  // Lernkreislauf: Eine exportierte Liste mit eingetragenen Ergebnissen kann wieder geladen werden.
  let zurueck = 0;
  rows.forEach((r) => {
    if (["rein", "raus"].includes(r.am_entscheid)) { zustand.over[r.id] = r.am_entscheid; if (r.am_grund) zustand.over[r.id + ":grund"] = r.am_grund; }
    if (r.am_haette_gewaehlt === "ja") zustand.am[r.id] = 1;
    if (["gewonnen", "verloren", "offen"].includes(r.ergebnis)) { zustand.erg[r.id] = r.ergebnis; zurueck++; }
  });
  if (zurueck) { meldung("ok", `${zurueck} eingetragene Ergebnisse übernommen – sie fliessen in die Pilot-Auswertung.`); speichere(); }
  $("#quartal-titel").textContent = "Offertliste · " + name;
  $("#quartal-quelle").textContent = `${rows.length} Opportunitäten · ${quelle}`;
  pruefeMix(rows);
  zeigeListe();
}

function speichere() {
  try { localStorage.setItem("radar:" + quartal.name, JSON.stringify(zustand)); } catch (e) { /* ohne Speicher weiter */ }
}

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

function grund(r) {
  const anfrage = r.quelle === "Anfrage der Gemeinde";
  const k = M.kombi[`${r.bestandskunde}|${anfrage ? "anfrage" : "andere"}`];
  const t = {
    "ja|true": "Bestandskunde fragt selbst an", "ja|false": "Bestandskunde",
    "nein|true": "Neukunde, aber eigene Anfrage", "nein|false": "Neukunde ohne eigene Anfrage",
  }[`${r.bestandskunde}|${anfrage}`];
  const teile = [`${t}: ${pct(k.ja)} solcher Fälle gewonnen`];
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
function auswahl() {
  const kap = Math.max(1, +$("#kap").value || 80);
  const entd = Math.min(kap, Math.max(0, +$("#entd").value || 0));
  const sortiert = [...quartal.rows].sort((a, b) => b.chance - a.chance || a.id.localeCompare(b.id));
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
  if ($("#pilotmodus").checked && Object.keys(zustand.am).length) {
    const liste = sortiert.filter((r) => DRIN.has(r.status)), ids = new Set(liste.map((r) => r.id));
    const beide = liste.filter((r) => zustand.am[r.id]);
    const nurL = liste.filter((r) => !zustand.am[r.id]);
    const nurA = frei.filter((r) => zustand.am[r.id] && !ids.has(r.id));
    liste.forEach((r) => { r.status = "unter"; });
    beide.forEach((r) => { r.status = "beide"; });
    const rest = Math.max(0, kap - beide.length);
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
  liste: ["liste", "Liste"], entd: ["entd", "Entdeckung"], am: ["am", "vom AM hinzugefügt"],
  beide: ["liste", "Liste + AM"], pl: ["liste", "Pilot: nach Liste"], pa: ["am", "Pilot: nach AM"],
};

// ------------------------------------------------------------ Offertliste zeigen
function zeigeListe() {
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
    <div class="kpi"><b>${nk}</b><span>Neukunden auf der Liste, davon ${sortiert.filter((r) => r.status === "entd").length} über Entdeckungsplätze</span></div>
    <div class="kpi gold"><b>+ ${zahl(plus10, 1)} Aufträge</b><span>brächten 10 Offerten mehr (≈ ${chf(plus10w)} erwarteter Wert) – Grundlage für die Frage nach mehr Kapazität ${info("Summe der Gewinnchancen der nächsten 10 Opportunitäten unter dem Schnitt. So sieht man, was eine grössere Kapazität im Offert-Team bringen würde.", "Erklärung Kapazität")}</span></div>
    <div class="kpi"><b>${amRein} / ${amRaus}</b><span>Fälle von Account Managern hinzugefügt / herausgenommen – zeigt, wo Erfahrung und Liste auseinandergehen</span></div>`;

  const ansicht = $("#ansicht .an").dataset.v, typ = $("#f-typ").value, q = $("#suche").value.trim().toLowerCase();
  const pilot = $("#pilot-spalten").checked;
  const passt = (r) => (!typ || r.gemeindetyp === typ) && (!q || r.gemeindename.toLowerCase().includes(q)) &&
    (ansicht === "alle" || (ansicht === "liste" ? DRIN.has(r.status) : !DRIN.has(r.status)));
  const oben = drin.filter(passt), unten = sortiert.filter((r) => !DRIN.has(r.status)).filter(passt);

  const kopf = `<thead><tr><th scope="col">Prio.</th><th scope="col">Gemeinde</th><th scope="col">Typ</th><th scope="col">Produkt · Quelle</th><th scope="col" class="n">Gewinnchance</th>
    <th scope="col" class="n">Offertwert<span class="th-sub">CHF 1'000 · Bandbreite</span></th><th scope="col" class="n">Erw. Wert<span class="th-sub">CHF 1'000</span></th><th scope="col">Warum?</th><th scope="col">Platz / Weg<span class="th-sub">Entscheid Account Manager</span></th>
    ${pilot ? '<th scope="col">AM hätte gewählt</th><th scope="col">Ergebnis</th>' : ""}</tr></thead>`;
  const zeile = (r) => {
    const platz = PLATZ[r.status] ? `<span class="marke ${PLATZ[r.status][0]}">${PLATZ[r.status][1]}</span>` : `<span class="weg">${esc(weg(r))}</span>`;
    const ov = zustand.over[r.id], name = esc(r.gemeindename);
    const knopf = r.stadt ? '<span class="klein">–</span>' : DRIN.has(r.status)
      ? `<button class="mini" type="button" data-act="raus" data-id="${esc(r.id)}" aria-label="${name} herausnehmen">herausnehmen</button>`
      : ov === "raus" ? `<button class="mini" type="button" data-act="zurueck" data-id="${esc(r.id)}" aria-label="${name} zurücknehmen">zurücknehmen</button>`
      : `<button class="mini" type="button" data-act="rein" data-id="${esc(r.id)}" aria-label="${name} hinzufügen">hinzufügen</button>`;
    const grundAm = zustand.over[r.id + ":grund"] ? `<span class="warnzeile">Grund: ${esc(zustand.over[r.id + ":grund"])}</span>` : "";
    return `<tr class="${DRIN.has(r.status) ? "" : r.status === "raus" ? "raus" : "unter"}">
      <td class="n nur-gross">${r.rang}</td>
      <td class="voll"><span class="nur-klein klein">Priorität ${r.rang} · </span><b class="gem-name">${name}</b> <span class="klein">${esc(r.kanton || "")}</span><span class="meta">${zahl(r.einwohner)} Einw. · ${r.bestandskunde === "ja" ? "Bestandskunde" : "Neukunde"}</span></td>
      <td data-label="Typ">${chip(r.gemeindetyp)}</td>
      <td data-label="Produkt · Quelle">${esc(r.produktlinie)}<span class="meta">${esc(r.quelle)} · ${esc(r.verfahren)}</span></td>
      <td class="n" data-label="Gewinnchance"><div class="balken"><span class="spur" aria-hidden="true"><i style="width:${Math.max(2, Math.round(r.chance * 100))}%"></i></span><b>${pct(r.chance)}</b></div></td>
      <td class="n" data-label="Offertwert (CHF 1'000)">${zahl(r.wert)} <span class="klein">(${zahl(r.unten)}–${zahl(r.oben)})</span></td>
      <td class="n" data-label="Erw. Wert (CHF 1'000)">${zahl(r.erwartet)}</td>
      <td class="begr voll" data-label="Warum?">${esc(grund(r))}${hinweise(r).map((h) => `<span class="warnzeile">⚠ ${esc(h)}</span>`).join("")}</td>
      <td data-label="Platz / Weg" class="platz">${platz}<div class="am-knopf">${knopf}</div>${grundAm}</td>
      ${pilot ? `<td data-label="AM hätte gewählt"><label class="check"><input type="checkbox" data-am="${esc(r.id)}" ${zustand.am[r.id] ? "checked" : ""}> <span class="klein">gewählt</span></label></td>
        <td data-label="Ergebnis"><select class="mini" data-erg="${esc(r.id)}" aria-label="Ergebnis ${name}"><option value="">–</option>${["gewonnen", "verloren", "offen"].map((v) => `<option ${zustand.erg[r.id] === v ? "selected" : ""}>${v}</option>`).join("")}</select></td>` : ""}
    </tr>`;
  };
  const sp = pilot ? 11 : 9;
  const schnitt = `<tr class="schnitt"><td colspan="${sp}"><div>Schnitt bei ${kap} Offerten – darunter bekommt jeder Fall einen Weg, keiner fällt durch</div></td></tr>`;
  const leer = !oben.length && !unten.length
    ? `<tr class="leer"><td colspan="${sp}">Keine Opportunität passt zu diesen Filtern. <button class="mini" type="button" id="filter-zurueck">Filter zurücksetzen</button></td></tr>` : "";
  $("#liste").innerHTML = kopf + "<tbody>" + oben.map(zeile).join("") + (ansicht === "alle" && oben.length && unten.length ? schnitt : "") + unten.map(zeile).join("") + leer + "</tbody>";
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
    "am_entscheid", "am_grund", "am_haette_gewaehlt", "ergebnis"];
  const platzName = { ...Object.fromEntries(Object.entries(PLATZ).map(([k, v]) => [k, v[1]])), unter: "unter dem Schnitt", raus: "vom AM herausgenommen", stadt: "ausgeschlossen" };
  sp[0] = "prioritaet";
  const z = sortiert.map((r) => [r.rang, r.id, r.bfs_nr || "", r.gemeindename, r.kanton || "", r.sprachregion, r.gemeindetyp, r.einwohner, r.produktlinie, r.quelle, r.verfahren, r.bestandskunde, r.kontakte_12m,
    (r.chance * 100).toFixed(1), r.wert.toFixed(0), r.unten.toFixed(0), r.oben.toFixed(0), r.erwartet.toFixed(0), platzName[r.status],
    DRIN.has(r.status) ? "" : weg(r), grund(r), zustand.over[r.id] || "", zustand.over[r.id + ":grund"] || "", zustand.am[r.id] ? "ja" : "", zustand.erg[r.id] || ""]);
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
      return `<tr><td class="voll"><b class="gem-name">${esc(g.name)}</b>${g.einwohner ? `<span class="meta">${zahl(g.einwohner)} Einw.</span>` : ""}</td>
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
  const k = M.kennzahlen, lk = k.lernkosten, nu = k.nutzen;
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
    <h3>Wohin sich die Arbeit verschiebt</h3>
    <div class="tabelle-wrap"><table class="t"><thead><tr><th scope="col">Gemeindetyp</th><th scope="col" class="n">Prüf-Offerten</th><th scope="col" class="n">davon gewonnen</th><th scope="col" class="n">auf der Liste</th><th scope="col" class="n">Anteil des Typs auf der Liste</th></tr></thead><tbody>
      ${k.zusammensetzung.map((z) => `<tr><td class="voll">${chip(z.typ, true)}</td>
        <td class="n" data-label="Prüf-Offerten">${z.test}</td><td class="n" data-label="davon gewonnen">${pct(z.ja_anteil, 1)}</td><td class="n" data-label="auf der Liste">${z.auf_liste}</td><td class="n" data-label="Anteil auf der Liste"><b>${pct(z.anteil_auf_liste, 1)}</b></td></tr>`).join("")}
    </tbody></table></div>
    <div class="merke"><b>Entdeckungsplätze: was sie kosten, was sie bringen.</b> Mit ${lk.liste_plaetze} Listenplätzen und ${lk.entdeckung_plaetze} Plätzen für Neukunden
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
  zeigePilot();
}

function zeigePilot() {
  const { sortiert } = quartal.rows.length ? auswahl() : { sortiert: [] };
  // Nur offerierte Fälle haben ein Ergebnis. Darum zählen die AM-Fälle erst, wenn sie im Pilotmodus auch offeriert werden.
  const gruppen = { "Liste und AM": [], "nur Liste": [], "nur AM": [] };
  let ohneOfferte = 0;
  sortiert.forEach((r) => {
    const off = DRIN.has(r.status), a = !!zustand.am[r.id];
    if (!off) { if (a) ohneOfferte++; return; }
    if (r.status === "pa" || r.status === "am") gruppen["nur AM"].push(r);
    else if (a) gruppen["Liste und AM"].push(r);
    else gruppen["nur Liste"].push(r);
  });
  const eingetragen = Object.values(zustand.erg).filter(Boolean).length;
  $("#pilot").innerHTML = `
    <div class="zwei">
      <div class="karte"><b class="t">So messen wir im Pilot</b><ol style="margin:4px 0;padding-left:20px">
        <li>Vor dem Blick auf die Liste markieren die Account Manager, welche Opportunitäten sie offerieren würden («AM hätte gewählt»).</li>
        <li><b>Pilotmodus</b> einschalten: Fälle, die Liste und AM beide wählen, werden offeriert. Die restlichen Plätze teilen sich <b>je zur Hälfte</b> die besten Fälle «nur Liste» und «nur AM». Nur so gibt es für beide Seiten ein Ergebnis.</li>
        <li>Nach jedem Entscheid der Gemeinde wird das Ergebnis eingetragen – in der Liste oder über den Export und erneuten Upload.</li>
        <li><b>Zwei Quartale</b>, weil 80 Offerten pro Quartal stark schwanken (etwa ±5 Aufträge) und Gemeinden oft erst nach Monaten entscheiden.</li>
        <li>Die Entscheidungszahl wird <b>vorher</b> mit der Geschäftsleitung vereinbart: Gewinnquote «nur Liste» gegen «nur AM».</li></ol></div>
      <div class="karte"><b class="t">Stand im aktuellen Quartal</b>
        <p class="klein">Pilot-Spalten in der Offertliste einschalten, um «AM hätte gewählt» und das Ergebnis einzutragen. ${eingetragen} Ergebnisse eingetragen.</p>
        <table class="t"><thead><tr><th>Offeriert, weil …</th><th>Fälle</th><th>gewonnen</th><th>verloren</th><th>Gewinnquote</th></tr></thead><tbody>
        ${Object.entries(gruppen).map(([n, rs]) => {
          const g = rs.filter((r) => zustand.erg[r.id] === "gewonnen").length, v = rs.filter((r) => zustand.erg[r.id] === "verloren").length;
          return `<tr><td class="voll"><b>${n}</b></td><td class="n" data-label="Fälle">${rs.length}</td><td class="n" data-label="gewonnen">${g}</td><td class="n" data-label="verloren">${v}</td><td class="n" data-label="Gewinnquote">${g + v ? pct(g / (g + v)) : "–"}</td></tr>`;
        }).join("")}</tbody></table>
        <p class="klein">Entscheidend ist «nur Liste» gegen «nur AM»: Dort unterscheiden sich Modell und Erfahrung.
        ${ohneOfferte ? `<br><b>${ohneOfferte} Fälle hätte der AM gewählt, sie werden aber nicht offeriert</b> – ohne Pilotmodus fehlt für sie das Ergebnis.` : ""}</p></div>
    </div>
    <h3>Was wir von der Geschäftsleitung brauchen</h3>
    <div class="merke"><ol style="margin:0;padding-left:20px">${I.antrag.map((a) => `<li>${esc(a)}</li>`).join("")}</ol></div>`;
}

// ------------------------------------------------------------ Herleitung
function baueHerleitung() {
  const sp = ["Analyseergebnis", "Element im Marktradar", "Was wir ohne die Daten falsch gebaut hätten"];
  $("#herleitung").innerHTML = `<thead><tr>${sp.map((s) => `<th scope="col">${s}</th>`).join("")}</tr></thead><tbody>` +
    I.herleitung.map((z) => `<tr>${z.map((c, i) => `<td class="voll" data-label="${sp[i]}">${i === 1 ? `<b>${esc(c)}</b>` : esc(c)}</td>`).join("")}</tr>`).join("") + "</tbody>";
  $("#grenzen").innerHTML = I.grenzen.map((g) => `<li>${esc(g)}</li>`).join("");
  const g = M.regression;
  $("#reg-text").textContent = `Im Schnitt liegt die Schätzung ${zahl(g.mae)}'000 Franken daneben; 8 von 10 Fehlern liegen zwischen ${zahl(g.band_unten)}'000 und +${zahl(g.band_oben)}'000.`;
}

// ------------------------------------------------------------ Bedienung
function waehleTab(b, fokus) {
  $$("#tabs button").forEach((x) => { const an = x === b; x.setAttribute("aria-selected", an); x.tabIndex = an ? 0 : -1; });
  $$(".tab").forEach((t) => t.classList.toggle("aktiv", t.id === "tab-" + b.dataset.tab));
  if (fokus) b.focus();
  b.scrollIntoView({ block: "nearest", inline: "nearest" });
  if (b.dataset.tab === "pilot" && M) zeigePilot();
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
["#kap", "#entd", "#f-typ", "#suche", "#pilot-spalten", "#pilotmodus"].forEach((s) => $(s).addEventListener("input", () => quartal.rows.length && zeigeListe()));

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
  if (act === "zurueck") { delete zustand.over[id]; delete zustand.over[id + ":grund"]; }
  else {
    const r = quartal.rows.find((x) => x.id === id);
    $("#grund-fall").textContent = r ? `${r.gemeindename} · ${r.produktlinie} · Gewinnchance ${pct(r.chance)}` : "";
    const grund = await frageGrund(act === "raus" ? "Warum nehmt ihr diesen Fall heraus?" : "Warum soll dieser Fall auf die Liste?");
    if (grund === null) { b.focus(); return; }
    zustand.over[id] = act; if (grund.trim()) zustand.over[id + ":grund"] = grund.trim();
  }
  speichere(); zeigeListe();
});
$("#hochladen").addEventListener("click", () => $("#datei").click());
$("#liste").addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.am) { if (t.checked) zustand.am[t.dataset.am] = 1; else delete zustand.am[t.dataset.am]; }
  else if (t.dataset.erg) zustand.erg[t.dataset.erg] = t.value;
  else return;
  speichere();
  if (t.dataset.am && $("#pilotmodus").checked) zeigeListe();
});
$("#export").addEventListener("click", exportiere);
$("#datei").addEventListener("change", (e) => leseDatei(e.target.files[0]));
function leseDatei(f) {
  if (!f) return;
  const r = new FileReader();
  r.onload = () => ladeQuartal(r.result, f.name.replace(/\.csv$/i, ""), "hochgeladen am " + new Date().toLocaleDateString("de-CH"));
  r.readAsText(f, "utf-8");
}
let zieh = 0;
addEventListener("dragenter", (e) => { e.preventDefault(); zieh++; document.body.classList.add("ziehen"); });
addEventListener("dragleave", () => { if (--zieh <= 0) { zieh = 0; document.body.classList.remove("ziehen"); } });
addEventListener("dragover", (e) => e.preventDefault());
addEventListener("drop", (e) => { e.preventDefault(); zieh = 0; document.body.classList.remove("ziehen"); leseDatei(e.dataTransfer.files[0]); });
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
try { const t = localStorage.getItem("radar:tab"); if (t) { const b = $(`#tabs button[data-tab="${t}"]`); if (b) waehleTab(b); } } catch (e) { /* egal */ }
start();
