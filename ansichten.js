/* GovTech-Marktradar · Ansichten für die tägliche Arbeit:
   Übersicht pro Rolle, kompakte Liste, Board, Detailansicht, Gemeinde-Profil, Einführung.
   Nutzt die Fachlogik aus app.js unverändert. */
"use strict";

// ------------------------------------------------------------ Fristen
// «Heute»: im Demo-Pilotjahr der Demo-Stand, sonst das echte Datum
function heute() {
  const s = lies("radar:stand");
  const m = s && /(\d{2})\.(\d{2})\.(\d{4})/.exec(s);
  const d = m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])) : new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
function fristInfo(r, z) {
  const f = z?.frist?.[r.id];
  if (!f) return {};
  const st = normStatus(z.erg[r.id]), offen = st === "" || st === "bearbeitung";
  const tage = Math.round((Date.parse(f + "T00:00:00Z") - heute()) / 86400000);
  return { f, tage, offen, ueber: offen && tage < 0, bald: offen && tage >= 0 && tage <= 14 };
}
const kurzDatum = (iso) => { const [j, m, t] = iso.split("-"); return `${+t}.${+m}.${j.slice(2)}`; };
function fristMarke(r, z) {
  const i = fristInfo(r, z);
  if (!i.f || !i.offen) return "";
  if (i.ueber) return `<span class="frist rot">überfällig seit ${-i.tage} ${-i.tage === 1 ? "Tag" : "Tagen"}</span>`;
  if (i.bald) return `<span class="frist gelb">fällig ${i.tage === 0 ? "heute" : `in ${i.tage} ${i.tage === 1 ? "Tag" : "Tagen"}`}</span>`;
  return `<span class="frist">Frist ${kurzDatum(i.f)}</span>`;
}

// ------------------------------------------------------------ Nächster Schritt («Weiter →»)
const NAECHSTER = { "": ["bearbeitung", "In Bearbeitung →"], bearbeitung: ["offeriert", "Offeriert →"] };
function weiterKnoepfe(r, z, q) {
  if (!darf("status", r, z)) return "";
  const st = normStatus(z.erg[r.id]), d = `data-wid="${esc(r.id)}" data-wq="${esc(q)}"`;
  if (NAECHSTER[st]) return `<button class="mini weiter" type="button" ${d} data-zu="${NAECHSTER[st][0]}">${NAECHSTER[st][1]}</button>`;
  if (st === "offeriert") return `<button class="mini weiter gruen" type="button" ${d} data-zu="gewonnen">Gewonnen</button><button class="mini weiter rot" type="button" ${d} data-zu="verloren">Verloren</button>`;
  return "";
}
function zeileVon(q, id) {
  const z = q === quartal.name ? zustand : zustandVon(q);
  const rows = q === quartal.name ? quartal.rows : (lies("radar:rows:" + q) || []).map(rechne);
  const { sortiert } = auswahlFuer(rows, z);
  return { z, r: sortiert.find((x) => x.id === id), n: sortiert.length };
}
function aktualisiereAlles() {
  if (quartal.rows.length) zeigeListe();
  zeigeCockpit(); zeigeStart();
  if ($("#detail").open && detailKontext) oeffneDetail(detailKontext.q, detailKontext.id, true);
}

// ------------------------------------------------------------ Kompakte Liste
function zeigeKompakt(oben, unten, ansicht, kap) {
  const zeile = (r) => {
    const drin = DRIN.has(r.status), name = esc(r.gemeindename);
    const platz = PLATZ[r.status] && r.status !== "liste" ? ` <span class="marke ${PLATZ[r.status][0]}">${PLATZ[r.status][1]}</span>` : "";
    const status = drin ? `${darf("status", r) ? statusWahl(r.id, name) : statusText(normStatus(zustand.erg[r.id]))}${fristMarke(r, zustand)}`
      : `<span class="weg">${r.status === "raus" ? "vom AM herausgenommen" : esc(weg(r))}</span>`;
    return `<tr class="${drin ? "" : r.status === "raus" ? "raus" : "unter"}">
      <td class="n nur-gross">${r.rang}</td>
      <td class="voll"><span class="nur-klein klein">Priorität ${r.rang} · </span><button class="link gem-name" type="button" data-detail="${esc(r.id)}">${name}</button> <span class="klein">${esc(r.kanton || "")}</span>${platz}
        <span class="meta">${chip(r.gemeindetyp)} ${esc(r.produktlinie)} · ${r.bestandskunde === "ja" ? "Bestandskunde" : "Neukunde"} · ${esc(zustaendig(r))}</span></td>
      <td data-label="Chance">${chanceBalken(r.chance)}</td>
      <td class="begr voll" data-label="Warum?">${esc(grund(r))}${hinweise(r).length ? `<span class="warnzeile">⚠ ${hinweise(r).length === 1 ? esc(hinweise(r)[0]) : hinweise(r).length + " Hinweise – siehe Details"}</span>` : ""}</td>
      <td class="voll" data-label="Status">${status}</td>
      <td class="nur-gross"><button class="mini" type="button" data-detail="${esc(r.id)}" aria-label="Details ${name}">Details</button></td>
    </tr>`;
  };
  const sp = 6;
  const schnitt = `<tr class="schnitt"><td colspan="${sp}"><div>Schnitt bei ${kap} Offerten – darunter bekommt jeder Fall einen Weg, keiner fällt durch</div></td></tr>`;
  const leer = !oben.length && !unten.length
    ? `<tr class="leer"><td colspan="${sp}">Keine Opportunität passt zu diesen Filtern. <button class="mini" type="button" id="filter-zurueck">Filter zurücksetzen</button></td></tr>` : "";
  $("#liste").classList.add("kompakt");
  $("#liste").innerHTML = `<thead><tr><th scope="col">Prio.</th><th scope="col">Gemeinde</th><th scope="col">Chance</th><th scope="col">Warum?</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Details</span></th></tr></thead><tbody>`
    + oben.map(zeile).join("") + (ansicht === "alle" && oben.length && unten.length ? schnitt : "") + unten.map(zeile).join("") + leer + "</tbody>";
}

// ------------------------------------------------------------ Board
const SPALTEN = [["", "Geplant"], ["bearbeitung", "In Bearbeitung"], ["offeriert", "Offeriert – Entscheid offen"], ["entschieden", "Entschieden"]];
function zeigeBoard(rows) {
  if (zustand.phase === "vorauswahl") {
    $("#board").innerHTML = `<div class="lade" style="animation:none">Das Board startet, sobald die Vertriebsleitung die Liste freigegeben hat.</div>`;
    return;
  }
  const spalte = (r) => { const st = normStatus(zustand.erg[r.id]); return st === "gewonnen" || st === "verloren" ? "entschieden" : st; };
  $("#board").innerHTML = SPALTEN.map(([k, n]) => {
    const karten = rows.filter((r) => spalte(r) === k)
      .sort((a, b) => (fristInfo(b, zustand).ueber ? 1 : 0) - (fristInfo(a, zustand).ueber ? 1 : 0) || b.chance - a.chance);
    return `<section class="board-spalte" aria-label="${n}"><h3><i style="background:${STATUS_FARBE[k === "entschieden" ? "gewonnen" : k]}"></i>${n} <span class="anzahl">${karten.length}</span></h3>
      ${karten.map((r) => { const st = normStatus(zustand.erg[r.id]);
        return `<article class="board-karte${fristInfo(r, zustand).ueber ? " ueber" : ""}">
          <button class="link gem-name" type="button" data-detail="${esc(r.id)}">${esc(r.gemeindename)}</button>
          <div class="meta">${chip(r.gemeindetyp)} ${esc(r.produktlinie)} · ${esc(zustaendig(r))}</div>
          <div class="karte-zeile"><span class="chance-wort chance-${chanceWort(r.chance)}">${chanceText(r.chance)}</span>${fristMarke(r, zustand)}
            ${st === "gewonnen" ? '<span class="marke entd">gewonnen</span>' : st === "verloren" ? '<span class="marke">verloren</span>' : ""}</div>
          <div class="karte-knoepfe">${weiterKnoepfe(r, zustand, quartal.name)}</div>
        </article>`; }).join("") || '<p class="klein leer-spalte">keine</p>'}
    </section>`;
  }).join("");
}

// ------------------------------------------------------------ Detailansicht einer Offerte
let detailKontext = null;
function oeffneDetail(q, id, nurNeu = false) {
  const { z, r, n } = zeileVon(q, id);
  if (!r) return;
  detailKontext = { q, id };
  const drin = DRIN.has(r.status), st = normStatus(z.erg[r.id]), fi = fristInfo(r, z), aktuell = q === quartal.name;
  const T = I.typen[r.gemeindetyp], bfs = r.bfs_nr || GEM.find((g) => g.name === r.gemeindename)?.bfs;
  const notizen = z.notiz?.[r.id] || [], verlauf = (z.log || []).filter((l) => l.id === r.id).slice().reverse();
  const kannNotiz = rolle.typ !== "gl" && z.phase !== "abgeschlossen";
  const amKnopf = !aktuell || r.stadt || !darf("reinraus", r) ? "" : drin
    ? `<button class="knopf sek klein-k" type="button" data-act="raus" data-id="${esc(r.id)}">Herausnehmen …</button>`
    : z.over[r.id] === "raus" ? `<button class="knopf sek klein-k" type="button" data-act="zurueck" data-id="${esc(r.id)}">Zurücknehmen</button>`
    : `<button class="knopf sek klein-k" type="button" data-act="rein" data-id="${esc(r.id)}">Auf die Liste nehmen …</button>`;
  $("#detail-inhalt").innerHTML = `
    <div class="blatt-kopf"><div><p class="klein">${esc(q)} · Priorität ${r.rang} von ${n}</p><h2 id="detail-titel">${esc(r.gemeindename)} <span class="klein">${esc(r.kanton || "")}</span></h2>
      <p class="meta">${chip(r.gemeindetyp, true)} · ${zahl(r.einwohner)} Einwohner · ${r.bestandskunde === "ja" ? "Bestandskunde" : "Neukunde"} · zuständig: ${esc(zustaendig(r))}</p></div>
      <button class="schliessen" type="button" data-schliessen aria-label="Schliessen">×</button></div>
    <div class="blatt-chance">${chanceBalken(r.chance)}<p class="klein">Unter vielen Fällen wie diesem wird etwa bei ${r.chance < 0.05 ? "weniger als 1" : Math.round(r.chance * 10)} von 10 ein Auftrag daraus.</p></div>
    <h3>Warum?</h3><p>${esc(grund(r))}</p>${hinweise(r).map((h) => `<p class="warnzeile">⚠ ${esc(h)}</p>`).join("")}
    <h3>Eckdaten</h3>
    <dl class="fakten">
      <dt>Produkt</dt><dd>${esc(r.produktlinie)}</dd><dt>Quelle</dt><dd>${esc(r.quelle)}</dd><dt>Verfahren</dt><dd>${esc(r.verfahren)}</dd>
      <dt>Kontakte (12 Monate)</dt><dd>${r.kontakte_12m}</dd>
      <dt>Offertwert</dt><dd>${rundCHF(r.wert)} <span class="klein">– wahrscheinlich zwischen CHF ${zahl(Math.round(r.unten) * 1000)} und ${zahl(Math.round(r.oben) * 1000)} (5 Jahre)</span></dd>
      <dt>Wert × Chance</dt><dd>${rundCHF(r.erwartet)}</dd>
      <dt>Platz</dt><dd>${PLATZ[r.status] ? `<span class="marke ${PLATZ[r.status][0]}">${PLATZ[r.status][1]}</span>` : `unter dem Schnitt – Weg: ${esc(weg(r))}`}</dd>
      <dt>Vorauswahl AM</dt><dd>${z.am[r.id] ? "gewählt" : "nicht gewählt"}${z.over[r.id + ":grund"] ? ` · Grund: ${esc(z.over[r.id + ":grund"])}` : ""}</dd>
    </dl>
    ${drin ? `<h3>Stand</h3>
      <div class="stand-zeile">${darf("status", r, z) ? `<select class="feld status-wahl" id="d-status" data-st="${st || "geplant"}" aria-label="Status">${STATUS.map(([k, t]) => `<option value="${k}" ${st === k ? "selected" : ""}>${t}</option>`).join("")}</select>` : statusText(st)}
        ${weiterKnoepfe(r, z, q)}</div>
      <div class="stand-zeile"><label class="klein" for="d-frist">Eingabefrist</label>
        ${darf("status", r, z) ? `<input type="date" class="feld" id="d-frist" value="${fi.f || ""}">` : `<span>${fi.f ? kurzDatum(fi.f) : "–"}</span>`} ${fristMarke(r, z)}</div>` : ""}
    ${amKnopf ? `<div class="stand-zeile">${amKnopf}</div>` : ""}
    <h3>Notizen</h3>
    ${notizen.length ? `<ul class="verlauf">${notizen.slice().reverse().map((x) => `<li><span class="klein">${new Date(x.t).toLocaleDateString("de-CH")} · ${esc(x.wer)}</span><br>${esc(x.text)}</li>`).join("")}</ul>` : '<p class="klein">Noch keine Notizen.</p>'}
    ${kannNotiz ? `<label class="sr-only" for="d-notiz">Neue Notiz</label><textarea id="d-notiz" class="feld" rows="2" maxlength="300" placeholder="Notiz für das Team, z. B. «Gemeinderat entscheidet im März». Keine Personendaten."></textarea>
      <p><button class="knopf klein-k" type="button" id="d-notiz-ok">Notiz speichern</button></p>` : ""}
    <h3>Verlauf dieser Offerte</h3>
    ${verlauf.length ? `<ul class="verlauf">${verlauf.map((l) => `<li><span class="klein">${new Date(l.t).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short" })} · ${esc(l.wer)}</span><br><b>${esc(l.was)}</b> ${esc(l.text)}</li>`).join("")}</ul>` : '<p class="klein">Noch keine Änderungen.</p>'}
    ${bfs ? `<p><button class="knopf sek" type="button" data-profil="${bfs}">Gemeinde-Profil öffnen</button></p>` : ""}`;
  const d = $("#detail");
  if (!d.open) { d.showModal(); if (!nurNeu) d.querySelector("[data-schliessen]").focus(); }
}
$("#detail").addEventListener("change", (e) => {
  if (!detailKontext) return;
  const { q, id } = detailKontext, { z, r } = zeileVon(q, id);
  if (e.target.id === "d-status") { setzeStatus(q, id, e.target.value, r); aktualisiereAlles(); $("#d-status")?.focus(); }
  if (e.target.id === "d-frist" && darf("status", r, z)) {
    if (e.target.value) z.frist[id] = e.target.value; else delete z.frist[id];
    protokolliere(z, "Frist", `${r.gemeindename}: ${e.target.value ? kurzDatum(e.target.value) : "entfernt"}`, id);
    schreib("radar:" + q, z); aktualisiereAlles(); $("#d-frist")?.focus();
  }
});
$("#detail").addEventListener("click", (e) => {
  if (e.target.closest("[data-schliessen]")) { $("#detail").close(); return; }
  if (e.target.id === "d-notiz-ok" && detailKontext) {
    const text = $("#d-notiz").value.trim(); if (!text) return;
    const { q, id } = detailKontext, { z, r } = zeileVon(q, id);
    z.notiz = z.notiz || {}; (z.notiz[id] = z.notiz[id] || []).push({ t: new Date().toISOString(), wer: rolleText(), text });
    protokolliere(z, "Notiz", `${r.gemeindename}: ${text}`, id);
    schreib("radar:" + q, z); oeffneDetail(q, id, true);
  }
  // Herausnehmen / hinzufügen läuft über den bestehenden Dialog mit Begründung
  const b = e.target.closest("button[data-act]");
  if (b) { $("#detail").close(); $("#liste").dispatchEvent(new CustomEvent("am-entscheid", { detail: b })); }
});
$("#detail").addEventListener("close", () => { detailKontext = null; });

// ------------------------------------------------------------ Gemeinde-Profil
function oeffneProfil(bfs) {
  const g = GEM_BFS.get(+bfs); if (!g) return;
  const T = I.typen[g.typ];
  const zust = g.einwohner > I.keyAccountAb ? "Key Account" : REGION_VON[g.kanton] || "–";
  const pilot = register().flatMap((q) => {
    const z = q.name === quartal.name ? zustand : zustandVon(q.name);
    const rows = (lies("radar:rows:" + q.name) || []).filter((r) => +r.bfs_nr === g.bfs);
    if (!rows.length) return [];
    const { sortiert } = auswahlFuer((lies("radar:rows:" + q.name) || []).map(rechne), z);
    return sortiert.filter((r) => +r.bfs_nr === g.bfs).map((r) => ({ q: q.name, r, z }));
  });
  const st = { kunde: "Kundin", offerte: "Offerte, aber noch kein Auftrag", nie: "noch nie offeriert" }[gStatus(g)];
  $("#profil-inhalt").innerHTML = `
    <div class="blatt-kopf"><div><p class="klein">Gemeinde-Profil</p><h2 id="profil-titel">${esc(g.name)} <span class="klein">${esc(g.kanton)}</span></h2>
      <p class="meta">${esc(g.sprache)}${g.einwohner ? ` · ${zahl(g.einwohner)} Einwohner` : ""} · zuständig: ${esc(zust)}</p></div>
      <button class="schliessen" type="button" data-schliessen aria-label="Schliessen">×</button></div>
    <div class="karte typkarte" style="border-top-color:${T.farbe}"><b class="t">Typ ${g.typ} · ${esc(T.name)}</b>${esc(T.handlung)}</div>
    <dl class="fakten">
      <dt>Kundenstatus</dt><dd>${st}</dd>
      <dt>Hat bereits</dt><dd>${g.produkte.map(esc).join(", ") || "noch kein Gemanda-Produkt"}</dd>
      <dt>Nächstes Produkt</dt><dd><b>${esc(naechstes(g))}</b></dd>
      <dt>Schulbau-Signal</dt><dd>${g.signal ? `ja – ${zahl(g.neubau, 1)} neue Wohnungen pro 1'000 Einwohner, ${zahl(g.jung, 1)} % Kinder und Jugendliche` : "nein"}</dd>
      <dt>Bisherige Offerten</dt><dd>${g.offerten} (2017–2025)</dd>
    </dl>
    <h3>Im Pilotjahr</h3>
    ${pilot.length ? `<ul class="verlauf">${pilot.map(({ q, r, z }) => `<li><b>${esc(q)}</b> · ${esc(r.produktlinie)} · ${chanceText(r.chance)}<br>
      ${DRIN.has(r.status) ? `${statusText(normStatus(z.erg[r.id]))} ${fristMarke(r, z)}` : `<span class="klein">nicht auf der Liste – ${esc(weg(r))}</span>`}
      <button class="mini" type="button" data-cdetail="${esc(r.id)}" data-dq="${esc(q)}">Details</button></li>`).join("")}</ul>` : '<p class="klein">Keine Opportunität in den erfassten Quartalen.</p>'}
    <p class="klein">${esc(I.datenhinweis)}</p>`;
  if ($("#detail").open) $("#detail").close();
  const d = $("#profil"); if (!d.open) d.showModal();
  d.querySelector("[data-schliessen]").focus();
}
$("#profil").addEventListener("click", (e) => {
  if (e.target.closest("[data-schliessen]")) $("#profil").close();
  const d = e.target.closest("[data-cdetail]"); if (d) { $("#profil").close(); oeffneDetail(d.dataset.dq, d.dataset.cdetail); }
});

// ------------------------------------------------------------ Übersicht pro Rolle
function jahrKennzahlen(Q) {
  const alle = Q.flatMap((q) => q.drin), z = zaehle(alle);
  const entsch = alle.filter((r) => r.st === "gewonnen" || r.st === "verloren");
  const erw = entsch.reduce((s, r) => s + r.chance, 0);
  const gruppe = (r) => r.status === "entd" ? "neu" : (r.status === "pa" || r.status === "am") ? "am" : r.amWahl ? "beide" : "liste";
  const quoteVon = (g) => { const rs = entsch.filter((r) => gruppe(r) === g), w = rs.filter((r) => r.st === "gewonnen").length; return rs.length ? { q: w / rs.length, n: rs.length } : null; };
  const verh = erw ? z.gewonnen / erw : null;
  return { alle, z, entsch, erw, L: quoteVon("liste"), A: quoteVon("am"), ueber: alle.filter((r) => fristInfo(r, r.z).ueber),
    ampel: verh === null ? null : verh >= 0.9 ? ["#1a8a5f", "im Plan"] : verh >= 0.75 ? ["#c9962b", "knapp unter Plan"] : ["#b3261e", "unter Plan"] };
}
function fazitSatz(k, Q = []) {
  if (!k.alle.length) return "Noch keine Offerte geplant. Sobald ein Quartal erfasst ist, erscheint hier der Stand.";
  if (Q.length && Q.every((q) => q.z.phase === "vorauswahl")) {
    const q = Q[Q.length - 1];
    return `Das Pilotjahr startet: Die Account Manager geben ihre Vorauswahl für ${q.name} ab (${Object.keys(q.z.abgabe || {}).length} von ${I.regionen.length}). Danach gibt die Vertriebsleitung die Liste frei.`;
  }
  if (!k.entsch.length) return `Noch keine Offerte entschieden. ${k.alle.length} Offerten sind geplant, ${k.z.bearbeitung + k.z.offeriert} davon in Arbeit.`;
  return `${k.z.gewonnen} Aufträge gewonnen – erwartet waren rund ${zahl(k.erw)}. Der Pilot liegt ${k.ampel[1]}.`
    + (k.L && k.A ? ` Die Liste gewinnt ${pct(k.L.q)} ihrer Fälle, die Auswahl nach Erfahrung ${pct(k.A.q)}.` : "")
    + (k.ueber.length ? ` ${k.ueber.length} Offerten sind überfällig.` : "");
}
const aufgabe = (r, q, z, extra = "") => `<li class="aufgabe">
  <div><button class="link gem-name" type="button" data-cdetail="${esc(r.id)}" data-dq="${esc(q)}">${esc(r.gemeindename)}</button>
    <span class="meta">${esc(q)} · ${esc(r.produktlinie)} · ${chanceText(r.chance)} · ${esc(zustaendig(r))}</span></div>
  <div class="aufgabe-rechts">${statusText(normStatus(z.erg[r.id]))}${fristMarke(r, z)}${extra}${weiterKnoepfe(r, z, q)}</div></li>`;

function zeigeStart() {
  if (!M) return;
  if (!$("#gemeinde-liste").options.length) $("#gemeinde-liste").innerHTML = GEM.map((g) => `<option value="${esc(g.name)} (${g.kanton})">`).join("");
  const Q = jahrDaten(), k = jahrKennzahlen(Q), t = rolle.typ;
  const meine = (r) => rolle.typ !== "am" || zustaendig(r) === rolle.am;
  const offen = k.alle.filter((r) => meine(r) && (r.st === "" || r.st === "bearbeitung" || r.st === "offeriert") && r.z.phase === "freigegeben");
  const sortFrist = (a, b) => (fristInfo(a, a.z).tage ?? 999) - (fristInfo(b, b.z).tage ?? 999) || b.chance - a.chance;
  const kopf = `<div class="start-kopf"><div><p class="klein">Übersicht für</p><h2>${esc(rolleText())}</h2></div>
    <label class="suche-gross"><span class="sr-only">Gemeinde suchen</span><input type="search" id="start-suche" class="feld" list="gemeinde-liste" placeholder="Gemeinde suchen – Profil öffnen"></label></div>
    ${lies("radar:stand") ? `<p class="klein">Demo-Stand ${esc(lies("radar:stand"))} – simulierter Ablauf.</p>` : ""}
    <div class="fazit" style="border-left-color:${k.ampel ? k.ampel[0] : "#8a96a3"}">${k.ampel ? `<span class="ampel-punkt" style="background:${k.ampel[0]}"></span>` : ""}<p>${esc(fazitSatz(k, Q))}</p></div>`;
  let inhalt = "";

  if (t === "gl" || t === "vl") {
    const regel = k.L && k.A ? k.L.q - k.A.q : null;
    const kacheln = `<div class="drei-kacheln">
      <div class="kachel"><span class="kachel-titel">Aufträge gewonnen</span><b>${k.z.gewonnen}</b><span>erwartet laut Modell rund ${zahl(k.erw)}</span></div>
      <div class="kachel"><span class="kachel-titel">Liste gegen Erfahrung</span><b>${k.L ? pct(k.L.q) : "–"} <small>gegen</small> ${k.A ? pct(k.A.q) : "–"}</b>
        <span>${regel === null ? "noch kein Vergleich" : `Ziel: mindestens ${pct(I.entscheidRegel.vorsprung)}-Punkte Vorsprung der Liste`}</span></div>
      <div class="kachel"><span class="kachel-titel">Fortschritt Pilotjahr</span><b>${k.entsch.length} <small>von</small> ${k.alle.length}</b><span>Offerten entschieden</span>${stapel(k.z, k.alle.length, false)}</div>
    </div>`;
    const entscheide = [];
    Q.filter((q) => q.z.phase === "vorauswahl").forEach((q) => entscheide.push(`<li><b>${esc(q.name)} freigeben</b> – ${Object.keys(q.z.abgabe || {}).length} von ${I.regionen.length} Account Managern haben abgegeben. ${t === "vl" ? `<button class="mini" type="button" data-oeffne-q="${esc(q.name)}">Zur Liste</button>` : ""}</li>`));
    Q.filter((q) => q.z.phase === "freigegeben" && q.drin.length && q.drin.every((r) => r.st === "gewonnen" || r.st === "verloren")).forEach((q) => entscheide.push(`<li><b>${esc(q.name)} abschliessen</b> – alle Offerten sind entschieden.</li>`));
    if (k.ueber.length) entscheide.push(`<li><b>${k.ueber.length} Offerten überfällig</b> – das Offert-Team fasst nach.</li>`);
    if (regel !== null && k.L.n >= 30 && k.A.n >= 30 && regel < I.entscheidRegel.vorsprung) entscheide.push(`<li><b>Entscheidungsregel aktuell nicht erfüllt</b> – im Zwischenbericht besprechen.</li>`);
    inhalt = kacheln + `<div class="zwei">
      <div class="karte"><b class="t">Was braucht einen Entscheid?</b>${entscheide.length ? `<ul class="liste-einfach">${entscheide.join("")}</ul>` : '<p class="klein">Zurzeit nichts – der Pilot läuft nach Plan.</p>'}</div>
      ${t === "vl" ? `<div class="karte"><b class="t">Einwände der Account Manager</b>${(() => { const e = Q.flatMap((q) => (q.z.log || []).filter((l) => l.was === "Herausgenommen" || l.was === "Hinzugefügt").map((l) => ({ ...l, q: q.name }))).sort((a, b) => (b.n || 0) - (a.n || 0)).slice(0, 5);
          return e.length ? `<ul class="liste-einfach">${e.map((l) => `<li><b>${esc(l.was)}</b> ${esc(l.text)} <span class="klein">· ${esc(l.wer)} · ${esc(l.q)}</span></li>`).join("")}</ul>` : '<p class="klein">Keine – die Account Manager folgen der Liste.</p>'; })()}</div>`
        : `<div class="karte"><b class="t">Entscheidungsregel</b><p style="margin:0">${esc(I.entscheidRegel.text)}</p></div>`}
    </div>
    ${t === "vl" && k.ueber.length ? `<h3>Überfällige Offerten</h3><ul class="aufgaben">${k.ueber.sort(sortFrist).slice(0, 6).map((r) => aufgabe(r, r.q, r.z)).join("")}</ul>` : ""}
`;
  } else if (t === "ot") {
    const vorrat = zaehle(offen);
    const dringend = offen.filter((r) => fristInfo(r, r.z).ueber || fristInfo(r, r.z).bald).sort(sortFrist);
    inhalt = `<div class="drei-kacheln">
      <div class="kachel${k.ueber.length ? " rot" : ""}"><span class="kachel-titel">Überfällig</span><b>${k.ueber.length}</b><span>Frist verpasst, noch nicht offeriert</span></div>
      <div class="kachel"><span class="kachel-titel">In Arbeit</span><b>${vorrat[""] + vorrat.bearbeitung}</b><span>${vorrat[""]} geplant, ${vorrat.bearbeitung} in Bearbeitung</span></div>
      <div class="kachel"><span class="kachel-titel">Warten auf Entscheid</span><b>${vorrat.offeriert}</b><span>offeriert, die Gemeinde entscheidet</span></div></div>
    <h3>Überfällig und in den nächsten 14 Tagen fällig</h3>
    ${dringend.length ? `<ul class="aufgaben">${dringend.slice(0, 10).map((r) => aufgabe(r, r.q, r.z)).join("")}</ul>` : '<p class="klein">Nichts dringend.</p>'}
    <p><button class="knopf" type="button" data-zum="board">Zum Board</button></p>`;
  } else {   // Account Manager
    const vor = Q.filter((q) => q.z.phase === "vorauswahl" && !q.z.abgabe?.[rolle.am]);
    const entschieden = k.alle.filter((r) => meine(r) && (r.st === "gewonnen" || r.st === "verloren"))
      .sort((a, b) => sortQ(b.q) - sortQ(a.q)).slice(0, 6);
    inhalt = `${vor.map((q) => { const n = (lies("radar:rows:" + q.name) || []).map(rechne).filter((r) => zustaendig(r) === rolle.am && !r.stadt).length;
        return `<div class="aufruf"><div><b>Vorauswahl ${esc(q.name)} offen</b><br><span class="klein">${n} Opportunitäten in eurer Region warten auf eure Einschätzung.</span></div>
          <button class="knopf" type="button" data-oeffne-q="${esc(q.name)}">Jetzt wählen</button></div>`; }).join("")}
    <h3>Meine Offerten in Arbeit <span class="anzahl">${offen.length}</span></h3>
    ${offen.length ? `<ul class="aufgaben">${offen.sort(sortFrist).slice(0, 12).map((r) => aufgabe(r, r.q, r.z)).join("")}</ul>` : '<p class="klein">Zurzeit keine Offerte in Arbeit.</p>'}
    <h3>Zuletzt entschieden</h3>
    ${entschieden.length ? `<ul class="aufgaben">${entschieden.map((r) => aufgabe(r, r.q, r.z)).join("")}</ul>` : '<p class="klein">Noch nichts entschieden.</p>'}`;
  }
  $("#start").innerHTML = kopf + inhalt;
  zeigeCockpit();
}

// ------------------------------------------------------------ Demo-Zeitpunkte und Zurücksetzen
// Menü «Demo-Stand» oben im Kopf – gilt für Übersicht und Offertliste
function zeigeDemoLeiste() {
  const aktiv = lies("radar:demo"), eintrag = DEMO_STAENDE.find(([d]) => d === aktiv);
  $("#demo-knopf").innerHTML = eintrag ? `Demo: <b>${esc(eintrag[1])}</b>` : "Demo-Stand";
  $("#demo-knopf").classList.toggle("an", !!eintrag);
  $("#demo-pop").innerHTML = `<p class="demo-titel">Demo-Stand für den Pitch</p>
    <p class="klein">Zeigt das Pilotjahr zu einem Zeitpunkt – in der Übersicht und in der Offertliste.</p>
    <div class="demo-knoepfe" role="group" aria-label="Demo-Zeitpunkt">${DEMO_STAENDE.map(([d, n, t]) =>
      `<button type="button" class="demo-knopf${d === aktiv ? " an" : ""}" data-demo="${d}" aria-pressed="${d === aktiv}"><b>${n}</b><span>${t}</span></button>`).join("")}</div>
    <button type="button" class="knopf sek klein-k" id="zuruecksetzen">Zurücksetzen: leeres Q1</button>
    <p class="klein demo-hinweis">Simuliert: Ausgang aus echten bisherigen Offerten, Bearbeitungsstand und Vorauswahl der Account Manager erfunden.</p>`;
}
function demoMenue(offen) {
  $("#demo-pop").hidden = !offen;
  $("#demo-knopf").setAttribute("aria-expanded", offen);
  if (offen) ($("#demo-pop .demo-knopf.an") || $("#demo-pop .demo-knopf")).focus();
}
$("#demo-knopf").addEventListener("click", () => demoMenue($("#demo-pop").hidden));
document.addEventListener("click", (e) => { if (!$("#demo-pop").hidden && !e.target.closest(".demo-menue")) demoMenue(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#demo-pop").hidden) { demoMenue(false); $("#demo-knopf").focus(); } });
$("#demo-pop").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-demo]");
  if (b) {
    const eigeneAenderungen = !lies("radar:demo") && register().some((q) => (zustandVon(q.name).log || []).length);
    if (eigeneAenderungen && !confirm("Den Demo-Stand laden? Eure eigenen Änderungen in diesem Browser werden ersetzt.")) return;
    b.classList.add("laedt");
    await ladeDemoJahr(b.dataset.demo);
    zeigeDemoLeiste(); zeigeStart(); demoMenue(false);
    return;
  }
  if (e.target.id === "zuruecksetzen") { demoMenue(false); if (await setzeZurueck()) { zeigeDemoLeiste(); zeigeStart(); } }
});
$("#start").addEventListener("change", (e) => {
  if (e.target.id !== "start-suche") return;
  const m = /^(.*) \(([A-Z]{2})\)$/.exec(e.target.value.trim());
  const g = m ? GEM.find((x) => x.name === m[1] && x.kanton === m[2]) : GEM.find((x) => x.name.toLowerCase() === e.target.value.trim().toLowerCase());
  if (g) { oeffneProfil(g.bfs); e.target.value = ""; }
});

// ------------------------------------------------------------ Einführung pro Rolle
function zeigeHilfe(erzwingen) {
  const schluessel = "radar:hilfe:" + rolle.typ;
  if (!erzwingen && lies(schluessel)) return;
  const [titel, schritte] = I.hilfe[rolle.typ];
  $("#hilfe-inhalt").innerHTML = `<form method="dialog"><p class="klein">So funktioniert's</p><h2 id="hilfe-titel">Der Radar für ${esc(titel)}</h2>
    <ol class="hilfe-schritte">${schritte.map((s) => `<li>${s}</li>`).join("")}</ol>
    <p class="klein">Die Rolle wählt ihr oben unter «Ansicht als». Im Betrieb ergibt sie sich aus dem Login.</p>
    <div class="knoepfe"><button class="knopf" type="submit">Verstanden</button></div></form>`;
  schreib(schluessel, true);
  const d = $("#hilfe"); if (!d.open) d.showModal();
}
$("#hilfe-knopf").addEventListener("click", () => zeigeHilfe(true));

// ------------------------------------------------------------ Gemeinsame Klicks
document.addEventListener("click", (e) => {
  const det = e.target.closest("[data-detail]");
  if (det && !e.target.closest("#detail")) { oeffneDetail(quartal.name, det.dataset.detail); return; }
  const cd = e.target.closest("[data-cdetail]");
  if (cd && e.target.closest("#start")) { oeffneDetail(cd.dataset.dq, cd.dataset.cdetail); return; }
  const pr = e.target.closest("[data-profil]");
  if (pr) { oeffneProfil(pr.dataset.profil); return; }
  const w = e.target.closest("[data-wid]");
  if (w) {
    const { r } = zeileVon(w.dataset.wq, w.dataset.wid);
    setzeStatus(w.dataset.wq, w.dataset.wid, w.dataset.zu, r);
    aktualisiereAlles();
    return;
  }
  const oq = e.target.closest("[data-oeffne-q]");
  if (oq) { zeigeQuartal(oq.dataset.oeffneQ); waehleTab($("#t-liste")); scrollTo(0, 0); return; }
  const zum = e.target.closest("[data-zum]");
  if (zum) {
    if (zum.dataset.zum === "board") { waehleTab($("#t-liste")); $('#modus button[data-v="board"]').click(); }
    else waehleTab($("#t-" + zum.dataset.zum));
    scrollTo(0, 0);
  }
});
$("#modus").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  $$("#modus button").forEach((x) => { x.classList.toggle("an", x === b); x.setAttribute("aria-pressed", x === b); });
  $("#liste").classList.toggle("kompakt", b.dataset.v === "kompakt");
  schreib("radar:modus", b.dataset.v);
  if (quartal.rows.length) zeigeListe();
});
// Herausnehmen / hinzufügen aus der Detailansicht
$("#liste").addEventListener("am-entscheid", (e) => {
  const b = e.detail, klon = document.createElement("button");
  klon.dataset.act = b.dataset.act; klon.dataset.id = b.dataset.id; klon.style.display = "none";
  $("#liste").appendChild(klon); klon.click(); klon.remove();
});

// Gespeicherte Darstellung wiederherstellen und starten
{ const m = lies("radar:modus"); const b = m && $(`#modus button[data-v="${m}"]`); if (b) { $$("#modus button").forEach((x) => { x.classList.toggle("an", x === b); x.setAttribute("aria-pressed", x === b); }); } }
start().then(() => { zeigeStart(); zeigeDemoLeiste(); zeigeHilfe(false); });
