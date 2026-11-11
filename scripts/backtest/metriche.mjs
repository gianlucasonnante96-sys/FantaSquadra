// Metriche del backtest.
//
// - titolarità: quanto la probabilità di giocare è vicina a chi ha giocato davvero
// - voto previsto vs fantavoto reale (solo per chi ha giocato)
// - simulazione: per ogni giornata si generano rose casuali "realistiche"
//   (pescate in proporzione alla quotazione), l'algoritmo sceglie modulo e
//   titolari, e si contano i punti VERI che quella formazione avrebbe fatto
//   (con al massimo 3 sostituzioni dalla panchina, stesso ruolo).

const MODULI = {
  '4-3-3': { P: 1, D: 4, C: 3, A: 3 },
  '3-4-3': { P: 1, D: 3, C: 4, A: 3 },
  '4-4-2': { P: 1, D: 4, C: 4, A: 2 },
  '5-3-2': { P: 1, D: 5, C: 3, A: 2 },
  '3-5-2': { P: 1, D: 3, C: 5, A: 2 },
};
const ROSA = { P: 3, D: 8, C: 8, A: 6 };
const ROSE_PER_GIORNATA = 400;

function rng(seme) {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ranghi(valori) {
  const ordinati = valori.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(valori.length);
  for (let i = 0; i < ordinati.length;) {
    let j = i;
    while (j + 1 < ordinati.length && ordinati[j + 1][0] === ordinati[i][0]) j++;
    for (let k = i; k <= j; k++) r[ordinati[k][1]] = (i + j) / 2;
    i = j + 1;
  }
  return r;
}

function pearson(x, y) {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}
const spearman = (x, y) => pearson(ranghi(x), ranghi(y));
const r3 = (x) => Math.round(x * 1000) / 1000;

function pesca(pool, n, caso) {
  const scelti = [];
  const disponibili = [...pool];
  for (let k = 0; k < n && disponibili.length; k++) {
    const tot = disponibili.reduce((s, p) => s + Math.max(1, p.qa), 0);
    let x = caso() * tot;
    let i = 0;
    for (; i < disponibili.length - 1; i++) {
      x -= Math.max(1, disponibili[i].qa);
      if (x <= 0) break;
    }
    scelti.push(disponibili.splice(i, 1)[0]);
  }
  return scelti;
}

// Punti reali di una formazione scelta ordinando per "chiave"
function puntiReali(rosa, chiave) {
  let migliore = null;
  for (const [nome, modulo] of Object.entries(MODULI)) {
    let previsto = 0;
    const titolari = [];
    const panchina = [];
    for (const ruolo of ['P', 'D', 'C', 'A']) {
      const ordinati = rosa.filter(p => p.ruolo === ruolo).sort((a, b) => chiave(b) - chiave(a));
      if (ordinati.length < modulo[ruolo]) { previsto = -Infinity; break; }
      titolari.push(...ordinati.slice(0, modulo[ruolo]));
      panchina.push(...ordinati.slice(modulo[ruolo]));
      previsto += ordinati.slice(0, modulo[ruolo]).reduce((s, p) => s + chiave(p), 0);
    }
    if (!migliore || previsto > migliore.previsto) migliore = { nome, previsto, titolari, panchina };
  }
  let punti = 0;
  let cambi = 0;
  const usati = new Set();
  for (const t of migliore.titolari) {
    if (t.giocato) { punti += t.fv; continue; }
    if (cambi >= 3) continue;
    const sost = migliore.panchina.find(p => p.ruolo === t.ruolo && p.giocato && !usati.has(p));
    if (sost) { usati.add(sost); punti += sost.fv; cambi++; }
  }
  return punti;
}

export function valuta(righe) {
  const giocato = righe.filter(r => r.giocato);

  // Titolarità
  const fasce = [[0, 20], [20, 50], [50, 80], [80, 101]];
  const calibrazione = fasce.map(([a, b]) => {
    const f = righe.filter(r => r.titolarita >= a && r.titolarita < b);
    return {
      fascia: `${a}-${Math.min(b, 100)}%`,
      giocatori: f.length,
      hannoGiocato: f.length ? r3(f.filter(r => r.giocato).length / f.length) : null,
    };
  });
  const brier = righe.reduce((s, r) => s + ((r.titolarita / 100) - (r.giocato ? 1 : 0)) ** 2, 0) / righe.length;

  // Voto previsto vs fantavoto reale
  const mae = giocato.reduce((s, r) => s + Math.abs(r.vp - r.fv), 0) / giocato.length;
  const perRuolo = {};
  for (const ruolo of ['P', 'D', 'C', 'A']) {
    const g = giocato.filter(r => r.ruolo === ruolo);
    perRuolo[ruolo] = r3(spearman(g.map(r => r.vp), g.map(r => r.fv)));
  }

  // Simulazione formazioni
  const giornate = [...new Set(righe.map(r => r.giornata))].sort((a, b) => a - b);
  let totAlgo = 0, totOracolo = 0, totCaso = 0, n = 0;
  const perGiornata = {};
  for (const g of giornate) {
    const pool = righe.filter(r => r.giornata === g);
    const caso = rng(1000 + g);
    let algo = 0, oracolo = 0, cieco = 0;
    for (let k = 0; k < ROSE_PER_GIORNATA; k++) {
      const rosa = [];
      for (const [ruolo, n] of Object.entries(ROSA)) rosa.push(...pesca(pool.filter(p => p.ruolo === ruolo), n, caso));
      const casuali = new Map(rosa.map(p => [p, caso()]));
      algo += puntiReali(rosa, p => p.vp + casuali.get(p) * 1e-6);
      oracolo += puntiReali(rosa, p => (p.giocato ? p.fv : -10));
      cieco += puntiReali(rosa, p => casuali.get(p));
    }
    perGiornata[g] = r3(algo / ROSE_PER_GIORNATA);
    totAlgo += algo; totOracolo += oracolo; totCaso += cieco; n += ROSE_PER_GIORNATA;
  }

  return {
    giocatoriValutati: righe.length,
    hannoGiocato: giocato.length,
    titolarita: { brier: r3(brier), calibrazione },
    votoPrevisto: {
      erroreMedioAssoluto: r3(mae),
      spearmanTotale: r3(spearman(giocato.map(r => r.vp), giocato.map(r => r.fv))),
      spearmanPerRuolo: perRuolo,
    },
    simulazione: {
      puntiMediFormazioneConsigliata: r3(totAlgo / n),
      puntiMediFormazioneCasuale: r3(totCaso / n),
      puntiMediFormazionePerfetta: r3(totOracolo / n),
      percentualeDelPotenziale: r3((totAlgo - totCaso) / (totOracolo - totCaso)),
      perGiornata,
    },
  };
}
