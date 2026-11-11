// Estrae dalla storia git le "fotografie" di statistiche.json e squadre.json.
// Ogni commit del workflow è uno snapshot dei dati in quel momento: confrontando
// due snapshot consecutivi si ricava il fantavoto preso da ogni giocatore in una
// giornata (FM_dopo * PG_dopo - FM_prima * PG_prima).
//
// Uso: node scripts/backtest/estrai-storico.mjs <cartella-output>
// Richiede una storia git sufficiente: git fetch --depth=3000 origin main

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2] || 'scripts/backtest/out';
mkdirSync(outDir, { recursive: true });

const ref = process.env.BACKTEST_REF || 'origin/main';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
}

function leggiFile(commit, path) {
  try {
    return JSON.parse(git(['show', `${commit}:${path}`]));
  } catch {
    return null;
  }
}

const righe = git([
  'log', '--reverse', '--format=%H %cI', ref, '--',
  'src/data/statistiche.json', 'src/data/squadre.json',
]).trim().split('\n');

const snapshot = [];
for (const riga of righe) {
  const [commit, data] = riga.split(' ');
  const stat = leggiFile(commit, 'src/data/statistiche.json');
  const sq = leggiFile(commit, 'src/data/squadre.json');
  if (!stat?.statistiche || !sq?.squadre) continue;

  const giocatori = {};
  let conPartite = 0;
  for (const [nome, s] of Object.entries(stat.statistiche)) {
    if (!s) continue;
    giocatori[nome] = [s.squadra, s.ruolo, s.mediaVoto ?? 0, s.fantamedia ?? 0, s.partiteGiocate ?? 0];
    if ((s.partiteGiocate ?? 0) > 0) conPartite++;
  }
  // Gli snapshot iniziali avevano partiteGiocate sempre a 0: inutilizzabili
  if (conPartite < 50) continue;

  const partiteSquadra = {};
  for (const [nome, s] of Object.entries(sq.squadre)) partiteSquadra[nome] = s.g;

  snapshot.push({ commit, data, partiteSquadra, giocatori });
}

writeFileSync(join(outDir, 'storico.json'), JSON.stringify(snapshot));
console.log(`Snapshot utilizzabili: ${snapshot.length} (${snapshot[0]?.data} → ${snapshot.at(-1)?.data})`);
