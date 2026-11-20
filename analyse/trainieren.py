"""GovTech-Marktradar · Training (einmalig)

Rechnet alle Modelle genau nach den Vorgaben im Projektfile und schreibt
die Ergebnisse nach ../daten/. Das Webtool wendet sie danach nur noch an.

Aufruf:  python analyse/trainieren.py
Rohdaten: analyse/rohdaten/ (nicht im Repo, liegen auf Moodle)
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

HIER = Path(__file__).parent
ROH = HIER / "rohdaten"
AUS = HIER.parent / "daten"
AUS.mkdir(exist_ok=True)

pruef = []  # (Kontrollwert, erwartet, bei uns, stimmt)


def pruefe(name, erwartet, ist, ok):
    pruef.append((name, str(erwartet), str(ist), "ja" if ok else "NEIN"))


# ---------------------------------------------------------------- Block 2
g = pd.read_csv(ROH / "GEMANDA_Datensatz1_Gemeinden_bereinigt.csv")
SP = ["bev_wachstum_pct", "anteil_0_19_pct", "anteil_65plus_pct", "auslaender_pct",
      "haushaltsgroesse", "siedlungsflaeche_pct", "landwirtschaftsflaeche_pct",
      "unproduktive_flaeche_pct", "beschaeftigte_sektor1_pct",
      "arbeitsplaetze_pro_100_einw", "neubauwohnungen_pro_1000_einw",
      "leerwohnungsziffer_pct"]
X1 = g[SP].copy()
X1["leerwohnungsziffer_pct"] = X1["leerwohnungsziffer_pct"].fillna(X1["leerwohnungsziffer_pct"].median())
Z1 = StandardScaler().fit_transform(X1)
pca = PCA(n_components=3).fit(Z1)
werte = pca.transform(Z1)
# Vorzeichen wie Prompt 1.4
for k, spalte in enumerate(["siedlungsflaeche_pct", "anteil_0_19_pct", "unproduktive_flaeche_pct"]):
    if pca.components_[k, SP.index(spalte)] < 0:
        werte[:, k] *= -1
erkl = pca.explained_variance_ratio_.sum()
pruefe("PCA: Anteil erklärte Unterschiede (3 Achsen)", "gut zwei Drittel (67 %)", f"{erkl:.1%}", 0.64 < erkl < 0.70)

km = KMeans(n_clusters=4, n_init=10, random_state=42).fit(werte)
groessen = pd.Series(km.labels_).value_counts()
ZIEL = {691: "A", 566: "B", 615: "C", 300: "D"}
label_zu_typ = {lab: ZIEL.get(n, "?") for lab, n in groessen.items()}
g["typ"] = [label_zu_typ[l] for l in km.labels_]
ist_gr = g["typ"].value_counts().sort_index().to_dict()
pruefe("Clustergrössen A/B/C/D", "691/566/615/300", "/".join(str(ist_gr.get(t, 0)) for t in "ABCD"),
       ist_gr == {"A": 691, "B": 566, "C": 615, "D": 300})

# ---------------------------------------------------------------- Block 3
o = pd.read_csv(ROH / "GEMANDA_Datensatz2_Offerten.csv")
vgl = o.drop_duplicates("bfs_nr")[["bfs_nr", "gemeindetyp"]].merge(g[["bfs_nr", "typ"]], on="bfs_nr")
gleich = (vgl["gemeindetyp"] == vgl["typ"]).mean()
pruefe("Typ stimmt mit Datensatz 2 überein", "100 %", f"{gleich:.1%} von {len(vgl)} Gemeinden", gleich == 1.0)

o["y"] = (o["auftrag_gewonnen"] == "ja").astype(int)
o["bestandskunde_n"] = (o["bestandskunde"] == "ja").astype(int)
pruefe("Ja-Anteil Datensatz 2", "17,2 %", f"{o['y'].mean():.1%}", round(o["y"].mean(), 3) == 0.172)

KAT = ["gemeindetyp", "produktlinie", "quelle", "verfahren", "sprachregion"]
MERK = ["gemeindetyp", "produktlinie", "quelle", "verfahren", "bestandskunde_n", "kontakte_12m", "sprachregion"]
Xk = pd.get_dummies(o[MERK], columns=KAT, drop_first=True, dtype=float)
SPALTEN_K = list(Xk.columns)


def klassifikation(seed):
    Xtr, Xte, ytr, yte, itr, ite = train_test_split(
        Xk, o["y"], o.index, test_size=0.3, random_state=seed, stratify=o["y"])
    sc = StandardScaler().fit(Xtr)
    m = LogisticRegression(max_iter=1000).fit(sc.transform(Xtr), ytr)
    p = m.predict_proba(sc.transform(Xte))[:, 1]
    t = o.loc[ite].copy()
    t["chance"] = p
    t = t.sort_values(["chance", "offerte_id"], ascending=[False, True])
    top = t.head(225)
    return sc, m, t, top["y"].sum(), 225 * t["y"].mean()


sc, logit, test, treffer, zufall = klassifikation(42)
q_liste, q_zufall = treffer * 80 / 225, zufall * 80 / 225
pruefe("Treffer unter den obersten 225 Testofferten", "95", int(treffer), int(treffer) == 95)
pruefe("Aufträge pro Quartal mit Liste / zufällig", "≈ 34 / ≈ 14", f"{q_liste:.1f} / {q_zufall:.1f}",
       round(q_liste) == 34 and round(q_zufall) == 14)
spanne = []
for s in [7, 13, 99, 2024, 5]:
    _, _, _, tr, _ = klassifikation(s)
    spanne.append(tr * 80 / 225)
alle = [q_liste] + spanne
pruefe("Spanne über 6 Aufteilungen", "32–37", f"{min(alle):.0f}–{max(alle):.0f}",
       round(min(alle)) >= 31 and round(max(alle)) <= 38)

# Idee 1: 70 + 10 Entdeckungsplätze (auf 225 hochgerechnet: 197 + 28)
# Entdeckung = die Neukunden mit der höchsten Chance unterhalb der 70 Listenplätze.
# Gerechnet über alle 6 Aufteilungen, weil eine einzelne stark schwankt.
liste_n = round(225 * 70 / 80)
entd_n = 225 - liste_n
lk = []
for s in [42, 7, 13, 99, 2024, 5]:
    _, _, ts, tr, _ = klassifikation(s)
    oben, rest = ts.head(liste_n), ts.iloc[liste_n:]
    entd = rest[rest["bestandskunde"] == "nein"].head(entd_n)
    lk.append({"liste": tr * 80 / 225, "mix": (oben["y"].sum() + entd["y"].sum()) * 80 / 225,
               "nk_liste": (ts.head(225)["bestandskunde"] == "nein").sum() * 80 / 225,
               "nk_mix": ((oben["bestandskunde"] == "nein").sum() + entd_n) * 80 / 225})
lk = pd.DataFrame(lk)
lernkosten = {
    "liste_plaetze": 70, "entdeckung_plaetze": 10,
    "auftraege_nur_liste": round(lk["liste"].mean(), 1),
    "auftraege_mit_entdeckung": round(lk["mix"].mean(), 1),
    "kosten_spanne": [round((lk["liste"] - lk["mix"]).min(), 1), round((lk["liste"] - lk["mix"]).max(), 1)],
    "neukunden_nur_liste": round(lk["nk_liste"].mean(), 1),
    "neukunden_mit_entdeckung": round(lk["nk_mix"].mean(), 1),
}

# Zusammensetzung der obersten 225 nach Typ
zus = []
for t in "ABCD":
    n_test = (test["gemeindetyp"] == t).sum()
    n_top = (test.head(225)["gemeindetyp"] == t).sum()
    zus.append({"typ": t, "test": int(n_test), "ja_anteil": round(test[test["gemeindetyp"] == t]["y"].mean(), 3),
                "auf_liste": int(n_top), "anteil_auf_liste": round(n_top / n_test, 3)})

# Gewinnkurve (Rückblick)
kurve = [round(test["y"].iloc[:k].sum() / test["y"].sum(), 3) for k in range(0, 901, 45)]

# Rohe Ja-Anteile (ganzer Datensatz) für Begründungen
def anteile(spalte):
    return {k: {"ja": round(v["y"].mean(), 3), "n": int(len(v))} for k, v in o.groupby(spalte)}

kombi = {}
for bk in ["ja", "nein"]:
    for an in [True, False]:
        s = o[(o["bestandskunde"] == bk) & ((o["quelle"] == "Anfrage der Gemeinde") == an)]
        kombi[f"{bk}|{'anfrage' if an else 'andere'}"] = {"ja": round(s["y"].mean(), 3), "n": int(len(s))}

# Mix der Trainingsdaten (für Warnung bei verändertem Mix)
mix = {sp: {k: round(v, 3) for k, v in o[sp].value_counts(normalize=True).items()}
       for sp in ["produktlinie", "quelle", "gemeindetyp", "sprachregion"]}

# ---------------------------------------------------------------- Schritt 6
o["einwohner_1000"] = o["einwohner"] / 1000
Xr = pd.get_dummies(o[["einwohner_1000", "produktlinie", "bestandskunde_n", "kontakte_12m"]],
                    columns=["produktlinie"], drop_first=True, dtype=float)
Xr = Xr[["einwohner_1000", "produktlinie_Fiskal", "produktlinie_Schalter", "bestandskunde_n", "kontakte_12m"]]
Xrtr, Xrte, yrtr, yrte, irtr, irte = train_test_split(Xr, o["offertwert_chf1000"], o.index,
                                                      test_size=0.3, random_state=42)
lin = LinearRegression().fit(Xrtr, yrtr)
pr = lin.predict(Xrte)
fehler = yrte.values - pr
mae, r2 = mean_absolute_error(yrte, pr), r2_score(yrte, pr)
q10, q90 = np.quantile(fehler, [0.1, 0.9])
verz = {t: round(float(fehler[o.loc[irte, "gemeindetyp"].values == t].mean()), 1) for t in "ABCD"}
pruefe("Regression: erklärte Unterschiede (R²)", "0,81", f"{r2:.2f}", round(r2, 2) == 0.81)
pruefe("Regression: durchschnittlicher Abstand", "≈ 27 (CHF 1'000)", f"{mae:.1f}", round(mae) == 27)
pruefe("Regression: Fehlerband (8 von 10)", "−42 bis +43", f"{q10:.0f} bis +{q90:.0f}",
       round(q10) == -42 and round(q90) == 43)
pruefe("Regression: Verzerrung Typ C", "≈ +37", f"{verz['C']:+.0f}", round(verz["C"]) == 37)
bsp = lin.predict(pd.DataFrame([[5, 1, 0, 0, 1]], columns=Xr.columns))[0]
pruefe("Beispiel Fiskal, 5'000 Einw., Neukunde, 1 Kontakt", "≈ 183 (141–226)",
       f"{bsp:.0f} ({max(0, bsp + q10):.0f}–{bsp + q90:.0f})", round(bsp) == 183)

# ---------------------------------------------------------------- Export
modell = {
    "stand": "Training auf Datensatz 2 (2017–2025), Aufteilung 70/30, Zufallswert 42",
    "klassifikation": {
        "spalten": SPALTEN_K,
        "mittel": sc.mean_.round(6).tolist(), "streuung": sc.scale_.round(6).tolist(),
        "koeff": logit.coef_[0].round(6).tolist(), "achse": round(float(logit.intercept_[0]), 6),
    },
    "regression": {
        "spalten": list(Xr.columns), "koeff": lin.coef_.round(4).tolist(),
        "start": round(float(lin.intercept_), 4),
        "band_unten": round(float(q10), 1), "band_oben": round(float(q90), 1),
        "mae": round(float(mae), 1), "r2": round(float(r2), 3), "verzerrung": verz,
    },
    "kennzahlen": {
        "ja_anteil": round(o["y"].mean(), 3),
        "auftraege_liste": round(q_liste, 1), "auftraege_zufall": round(q_zufall, 1),
        "spanne": [round(min(alle), 1), round(max(alle), 1)],
        "treffer_top225": int(treffer), "test_n": 900,
        "lernkosten": lernkosten, "zusammensetzung": zus, "gewinnkurve": kurve,
    },
    "anteile": {sp: anteile(sp) for sp in ["bestandskunde", "quelle", "gemeindetyp", "produktlinie", "verfahren"]},
    "kombi": kombi,
    "mix": mix,
}
(AUS / "modell.json").write_text(json.dumps(modell, ensure_ascii=False, indent=1), encoding="utf-8")

# Demo-Quartal: 320 Testofferten ohne Ergebnis
demo = test.sample(320, random_state=2027).sort_values("offerte_id")
SP_DEMO = ["offerte_id", "bfs_nr", "gemeindename", "kanton", "sprachregion", "gemeindetyp", "einwohner",
           "produktlinie", "quelle", "verfahren", "bestandskunde", "kontakte_12m"]
demo[SP_DEMO].to_csv(AUS / "demo_quartal_2027Q1.csv", index=False, encoding="utf-8")

# Gemeinden: Typ, Kundenstatus, Produkte
gew = o[o["y"] == 1].groupby("bfs_nr")["produktlinie"].apply(lambda s: sorted(set(s))).to_dict()
off = o.groupby("bfs_nr").size().to_dict()
ew = o.drop_duplicates("bfs_nr").set_index("bfs_nr")["einwohner"].to_dict()
gem = []
for r in g.itertuples():
    gem.append({"bfs": int(r.bfs_nr), "name": r.gemeindename, "kanton": r.kanton, "sprache": r.sprachregion,
                "typ": r.typ, "einwohner": int(ew[r.bfs_nr]) if r.bfs_nr in ew else None,
                "offerten": int(off.get(r.bfs_nr, 0)), "produkte": gew.get(r.bfs_nr, []),
                "wachstum": float(r.bev_wachstum_pct), "jung": float(r.anteil_0_19_pct),
                "neubau": float(r.neubauwohnungen_pro_1000_einw)})
(AUS / "gemeinden.json").write_text(json.dumps(gem, ensure_ascii=False), encoding="utf-8")

# Prüftabelle
breite = max(len(p[0]) for p in pruef)
print(f"{'Kontrollwert'.ljust(breite)} | erwartet | bei uns | stimmt")
for p in pruef:
    print(f"{p[0].ljust(breite)} | {p[1]} | {p[2]} | {p[3]}")
print("\nLernkosten:", lernkosten)
print("Zusammensetzung:", zus)
