// Calcola il voto previsto di tutti i giocatori del listone per una giornata,
// usando il codice e i dati della cartella src/ in cui viene copiato.
// Viene lanciato da backtest.mjs, non serve usarlo a mano.
//
// Argomenti: <giornata> <squadre separate da virgola> <file-output>

import { writeFileSync } from 'node:fs';
import { loadListone } from './src/services/listoneService';
import { updateTitolaritaFromProbabili } from './src/services/probabiliFormazioniService';
import { getAvversario } from './src/services/calendarService';
import { calculateExpectedScore, getTeamStrength } from './src/utils/scoring';
import { cercaInfortunio } from './src/utils/infortuni';
import formazioniData from './src/data/formazioni.json';
import listoneData from './src/data/listone.json';

const [giornataArg, squadreArg, outFile] = process.argv.slice(2);
const giornata = Number(giornataArg);
const squadre = new Set(squadreArg.split(','));

// Regole uguali per entrambe le versioni. Niente bonus imbattibilità perché
// i fantavoti di Fantacalcio.it (con cui si confronta) non lo includono.
const rules = {
  modificatoreDifesa: 'standard',
  modificatoreCustom: [],
  bonusImbattibilita: 'off',
  moduliConsentiti: ['4-3-3', '3-4-3', '4-4-2', '5-3-2', '3-5-2'],
  assist: '1',
  golSubito: -1,
  rigoreParato: 3,
  rigoreSbagliato: -3,
} as any;

const SIGLE: Record<string, string> = {
  Atalanta: 'ATA', Bologna: 'BOL', Cagliari: 'CAG', Como: 'COM', Fiorentina: 'FIO',
  Frosinone: 'FRO', Genoa: 'GEN', Inter: 'INT', Juventus: 'JUV', Lazio: 'LAZ',
  Lecce: 'LEC', Milan: 'MIL', Monza: 'MON', Napoli: 'NAP', Parma: 'PAR',
  Roma: 'ROM', Sassuolo: 'SAS', Torino: 'TOR', Udinese: 'UDI', Venezia: 'VEN',
};

// Per evitare log rumorosi del codice dell'app
console.log = () => {};
console.warn = () => {};

const { players } = loadListone();
const nomiListone = (listoneData as any).giocatori.map((g: any) => g.nome);
const quotazioni = (listoneData as any).giocatori.map((g: any) => g.quotazioneAttuale);

// Usa solo le probabili formazioni della partita di questa giornata
const partite = (formazioniData as any).partite || {};

const risultato: any[] = [];
players.forEach((p, i) => {
  if (!squadre.has(p.team)) return;
  const info = getAvversario(p.team, giornata);
  if (!info) return;
  const casa = info.inCasa ? p.team : info.avversario;
  const trasf = info.inCasa ? info.avversario : p.team;
  const chiave = `${SIGLE[casa]}-${SIGLE[trasf]}`;
  const partita = partite[chiave];
  let giocatore = { ...p, avversario: info.avversario, inCasa: info.inCasa };
  if (partita) {
    const lato = info.inCasa ? partita.casa : partita.trasferta;
    giocatore = updateTitolaritaFromProbabili([giocatore], [{ team: lato.sigla, giocatori: lato.giocatori }])[0];
  }
  const vp = calculateExpectedScore(giocatore, rules);
  risultato.push({
    nome: nomiListone[i],
    squadra: p.team,
    ruolo: p.role,
    qa: quotazioni[i],
    titolarita: giocatore.titolarita,
    vp,
    haFormazione: !!partita,
    // dati grezzi, utili per analizzare il modello
    fm: p.fantamedia,
    mv: p.mediaVoto,
    pg: p.partiteGiocate,
    inCasa: info.inCasa,
    forza: getTeamStrength(p.team),
    forzaAvv: getTeamStrength(info.avversario),
    infortunio: cercaInfortunio(giocatore)?.stato ?? null,
  });
});

writeFileSync(outFile, JSON.stringify(risultato));
