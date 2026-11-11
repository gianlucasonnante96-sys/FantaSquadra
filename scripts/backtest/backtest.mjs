// Backtest dell'algoritmo sulle giornate già giocate.
//
// Per ogni squadra e giornata:
//   1. prende i dati del repository subito PRIMA della partita (commit precedente
//      a quello in cui la squadra risulta aver giocato);
//   2. calcola il voto previsto di ogni giocatore con il codice da testare;
//   3. ricava dalla storia il fantavoto vero (o se non ha giocato).
// Poi misura quanto le previsioni sono buone e simula formazioni consigliate.
//
// Uso:
//   node scripts/backtest/backtest.mjs [codice] [cartella-lavoro]
//     codice: "attuale" (cartella src/ di lavoro, default) oppure un ref git, es. origin/main
// Richiede: git fetch --depth=3000 origin main, e tsx (npm i -g tsx).

import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { valuta } from './metriche.mjs';

const execFileP = promisify(execFile);
const codice = process.argv[2] || 'attuale';
const lavoro = resolve(process.argv[3] || 'scripts/backtest/out');
const repo = process.cwd();
mkdirSync(lavoro, { recursive: true });

const git = (args) => execFileSync('git', args, {
  encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
const leggi = (commit, path) => {
  try { return JSON.parse(git(['show', `${commit}:${path}`])); } catch { return null; }
};

// --- 1. storico degli snapshot -------------------------------------------
const fileStorico = join(lavoro, 'storico.json');
if (!existsSync(fileStorico)) {
  execFileSync('node', [join(repo, 'scripts/backtest/estrai-storico.mjs'), lavoro], { stdio: 'inherit' });
}
const storico = JSON.parse(readFileSync(fileStorico, 'utf8'));

const NOME_DA_SIGLA = {
  ATA: 'Atalanta', BOL: 'Bologna', CAG: 'Cagliari', COM: 'Como', FIO: 'Fiorentina',
  FRO: 'Frosinone', GEN: 'Genoa', INT: 'Inter', JUV: 'Juventus', LAZ: 'Lazio',
  LEC: 'Lecce', MIL: 'Milan', MON: 'Monza', NAP: 'Napoli', PAR: 'Parma',
  ROM: 'Roma', SAS: 'Sassuolo', TOR: 'Torino', UDI: 'Udinese', VEN: 'Venezia',
};

// --- 2. eventi squadra/giornata -------------------------------------------
// Un evento nasce quando le partite giocate di una squadra passano da G-1 a G.
const eventi = [];
for (let i = 1; i < storico.length; i++) {
  const prima = storico[i - 1];
  const dopo = storico[i];
  for (const [squadra, g] of Object.entries(dopo.partiteSquadra)) {
    if (g !== prima.partiteSquadra[squadra] + 1) continue;
    // ultimo snapshot in cui la squadra ha ancora G partite (voti consolidati)
    let fine = i;
    while (fine + 1 < storico.length && storico[fine + 1].partiteSquadra[squadra] === g) fine++;
    const commitPrima = git(['rev-parse', `${dopo.commit}^`]).trim();
    eventi.push({ squadra, giornata: g, commitPrima, commitDopo: storico[fine].commit });
  }
}

// --- 3. previsioni con il codice da testare ---------------------------------
const cartellaCodice = join(lavoro, `codice-${codice.replace(/[^a-z0-9]/gi, '_')}`);
rmSync(cartellaCodice, { recursive: true, force: true });
mkdirSync(cartellaCodice, { recursive: true });
if (codice === 'attuale') {
  cpSync(join(repo, 'src'), join(cartellaCodice, 'src'), { recursive: true });
} else {
  execFileSync('sh', ['-c', `git archive ${codice} src | tar -x -C "${cartellaCodice}"`]);
}
cpSync(join(repo, 'scripts/backtest/predici.ts'), join(cartellaCodice, 'predici.ts'));

const gruppi = new Map();
for (const e of eventi) {
  const k = `${e.commitPrima}|${e.giornata}`;
  if (!gruppi.has(k)) gruppi.set(k, { ...e, squadre: [] });
  gruppi.get(k).squadre.push(e.squadra);
}

const FILE_DATI = ['listone', 'statistiche', 'formazioni', 'squadre', 'risultati', 'infortuni'];

async function prevedi(gruppo, indice) {
  const dir = join(lavoro, 'run', `${indice}`);
  rmSync(dir, { recursive: true, force: true });
  cpSync(cartellaCodice, dir, { recursive: true });
  for (const f of FILE_DATI) {
    const contenuto = leggi(gruppo.commitPrima, `src/data/${f}.json`);
    if (contenuto) writeFileSync(join(dir, 'src/data', `${f}.json`), JSON.stringify(contenuto));
  }
  const out = join(dir, 'previsioni.json');
  await execFileP('tsx', ['predici.ts', String(gruppo.giornata), gruppo.squadre.join(','), out], { cwd: dir });
  const previsioni = JSON.parse(readFileSync(out, 'utf8'));
  rmSync(dir, { recursive: true, force: true });
  return previsioni;
}

const lista = [...gruppi.values()];
const previsioniPerGruppo = new Array(lista.length);
let prossimo = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (prossimo < lista.length) {
    const i = prossimo++;
    previsioniPerGruppo[i] = await prevedi(lista[i], i);
  }
}));

// --- 4. esiti reali dalla storia --------------------------------------------
const cacheStat = new Map();
const stat = (commit) => {
  if (!cacheStat.has(commit)) cacheStat.set(commit, leggi(commit, 'src/data/statistiche.json')?.statistiche || {});
  return cacheStat.get(commit);
};
const mezzo = (x) => Math.round(x * 2) / 2;

const righe = [];
lista.forEach((gruppo, i) => {
  for (const p of previsioniPerGruppo[i]) {
    const evento = eventi.find(e => e.commitPrima === gruppo.commitPrima && e.giornata === gruppo.giornata && e.squadra === p.squadra);
    const prima = stat(evento.commitPrima)[p.nome];
    const dopo = stat(evento.commitDopo)[p.nome];
    if (!dopo || (prima && NOME_DA_SIGLA[prima.squadra] !== p.squadra)) continue;
    if (NOME_DA_SIGLA[dopo.squadra] !== p.squadra) continue;
    const pg0 = prima?.partiteGiocate ?? 0;
    const delta = dopo.partiteGiocate - pg0;
    if (delta === 0) {
      righe.push({ ...p, giornata: gruppo.giornata, giocato: false });
    } else if (delta === 1) {
      const fv = mezzo(dopo.fantamedia * dopo.partiteGiocate - (prima?.fantamedia ?? 0) * pg0);
      const voto = mezzo(dopo.mediaVoto * dopo.partiteGiocate - (prima?.mediaVoto ?? 0) * pg0);
      if (fv < -5 || fv > 25) continue; // dato incoerente
      righe.push({ ...p, giornata: gruppo.giornata, giocato: true, fv, voto });
    }
  }
});

writeFileSync(join(lavoro, `righe-${codice.replace(/[^a-z0-9]/gi, '_')}.json`), JSON.stringify(righe));
const risultati = valuta(righe);
writeFileSync(join(lavoro, `metriche-${codice.replace(/[^a-z0-9]/gi, '_')}.json`), JSON.stringify(risultati, null, 2));
console.log(`\nCodice: ${codice} — eventi squadra/giornata: ${eventi.length}, giocatori valutati: ${righe.length}`);
console.log(JSON.stringify(risultati, null, 2));
