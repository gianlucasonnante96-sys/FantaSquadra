import { Player, LeagueRules, FormationSlot } from '../types';
import { getLivelloTitolarita } from './titolarita';
import { cercaInfortunio } from './infortuni';
import squadreData from '../data/squadre.json';

// ============================================================
// CONFIGURAZIONE
// ============================================================

const CONFIG = {
  pesoFantamedia: 0.6,
  pesoMediaVoto: 0.4,
  fantamediaSogliaZero: 0.1,

  malusSubentrante: 1.5,
  minProbTitolare: 0.05,

  bonusCasa: 0.3,
  malusTrasferta: 0.25,

  pesoMomentum: 0.2,

  pesoFixturePerRuolo: {
    'P': 0.5, 'D': 0.35, 'C': 0.5, 'A': 0.6,
  } as Record<string, number>,

  pesoTeamStrengthPerRuolo: {
    'P': 0.3, 'D': 0.3, 'C': 0.4, 'A': 0.5,
  } as Record<string, number>,

  // Range portieri INVARIATO
  rangeVotoPerRuolo: {
    'P': [5.0, 7.5],
    'D': [5.0, 7.5],
    'C': [5.0, 8.0],
    'A': [5.0, 8.0],
  } as Record<string, [number, number]>,

  sogliaCompressione: 7.0,
  fattoreCompressione: 0.7,

  pesoGolFattiPerRuolo: { 'C': 0.3, 'A': 0.3 } as Record<string, number>,
  pesoGolSubitiPerRuolo: { 'D': 0.4 } as Record<string, number>,

  mediaGolCampionato: 1.4,

  // 🆕 Portieri: configurazione semplificata
  portieri: {
    pesoCleanSheet: 1.5,         // bonus CS proporzionale a P(CS)
    pesoMalusGolSubito: 0.3,     // malus gol leggero (gol già dentro MV storica)
    bonusCasa: 0.2,              // piccolo bonus casa
    malusTrasferta: 0.2,         // piccolo malus trasferta
  },

  difensori: {
    golProbability: { 1: 0.15, 2: 0.12, 3: 0.08, 4: 0.04, 5: 0.02 } as Record<number, number>,
    pesoGol: 0.6,
    assistProbability: { 1: 0.10, 2: 0.08, 3: 0.05, 4: 0.03, 5: 0.02 } as Record<number, number>,
    pesoAssist: 0.4,
    malusAvversarioForte: 0.2,
  },

  centrocampisti: {
    golProbability: { 1: 0.50, 2: 0.35, 3: 0.20, 4: 0.10, 5: 0.05 } as Record<number, number>,
    pesoGol: 0.7,
    assistProbability: { 1: 0.60, 2: 0.45, 3: 0.30, 4: 0.15, 5: 0.08 } as Record<number, number>,
    pesoAssist: 0.5,
    bonusCasaControllo: 0.2,
    malusTrasfertaDifficile: 0.3,
  },

  attaccanti: {
    golProbability: { 1: 0.75, 2: 0.55, 3: 0.35, 4: 0.18, 5: 0.08 } as Record<number, number>,
    pesoGol: 0.8,
    assistProbability: { 1: 0.50, 2: 0.40, 3: 0.28, 4: 0.15, 5: 0.08 } as Record<number, number>,
    pesoAssist: 0.5,
    rigoreProbability: { 1: 0.15, 2: 0.15, 3: 0.12, 4: 0.08, 5: 0.05 } as Record<number, number>,
    pesoRigore: 0.5,
    bonusCasaFacile: 0.4,
    malusTrasfertaDifficile: 0.4,
  },

  minVoto: 5,
  maxVoto: 8,
};

// ============================================================
// UTILITY
// ============================================================

function normalizzaNomeSquadra(nome: string | undefined): string {
  if (!nome) return '';
  const n = nome.trim();
  const SIGLE: Record<string, string> = {
    'ATA': 'Atalanta', 'BOL': 'Bologna', 'CAG': 'Cagliari', 'COM': 'Como',
    'FIO': 'Fiorentina', 'FRO': 'Frosinone', 'GEN': 'Genoa', 'INT': 'Inter',
    'JUV': 'Juventus', 'LAZ': 'Lazio', 'LEC': 'Lecce', 'MIL': 'Milan',
    'MON': 'Monza', 'NAP': 'Napoli', 'PAR': 'Parma', 'ROM': 'Roma',
    'SAS': 'Sassuolo', 'TOR': 'Torino', 'UDI': 'Udinese', 'VEN': 'Venezia',
  };
  const upper = n.toUpperCase();
  if (SIGLE[upper]) return SIGLE[upper];
  return n;
}

// ============================================================
// STATISTICHE SQUADRA
// ============================================================

interface StatsSquadra {
  punti: number;
  g: number;
  gf: number;
  gs: number;
  forma: string[];
}

let debugStampaFatta = false;

function getStatsSquadra(team: string | undefined): StatsSquadra | null {
  if (!team) return null;
  try {
    const dati = squadreData as any;
    if (!dati || !dati.squadre) {
      if (!debugStampaFatta) {
        console.warn('⚠️ squadre.json vuoto o malformato');
        debugStampaFatta = true;
      }
      return null;
    }

    const nome = normalizzaNomeSquadra(team);

    for (const [key, value] of Object.entries(dati.squadre)) {
      const keyNorm = normalizzaNomeSquadra(key);
      if (keyNorm.toLowerCase() === nome.toLowerCase()) {
        const v = value as any;
        return {
          punti: v.punti ?? 0,
          g: v.g ?? v.partite ?? 0,
          gf: v.gf ?? v.goalsFor ?? 0,
          gs: v.gs ?? v.goalsAgainst ?? 0,
          forma: Array.isArray(v.forma) ? v.forma : [],
        };
      }
    }
    return null;
  } catch (e) {
    console.error('Errore getStatsSquadra:', e);
    return null;
  }
}

// ============================================================
// ESPORTATE: Team Strength, Fixture, Momentum
// ============================================================

export function getTeamStrength(team: string | undefined): number {
  const stats = getStatsSquadra(team);

  if (!stats || stats.g === 0) {
    return 0.85;
  }

  const puntiMax = stats.g * 3;
  const puntiRatio = Math.min(1, stats.punti / puntiMax);
  const gfRatio = Math.min(3, stats.gf / stats.g) / 3;
  const gsRatio = Math.min(3, stats.gs / stats.g) / 3;

  const strength = 0.55
                 + (puntiRatio * 0.50)
                 + (gfRatio * 0.20)
                 - (gsRatio * 0.15);

  return Math.max(0.60, Math.min(1.30, strength));
}

export function getFixtureDifficulty(avversario: string | undefined): number {
  const strength = getTeamStrength(avversario);

  const normalized = (strength - 0.60) / (1.30 - 0.60);
  const amplified = Math.pow(normalized, 0.7);

  return 1 + amplified * 4;
}

export function getMomentum(team: string | undefined): number {
  const stats = getStatsSquadra(team);

  if (!stats || !Array.isArray(stats.forma) || stats.forma.length === 0) {
    return 0;
  }

  const puntiForma: Record<string, number> = { 'W': 3, 'D': 1, 'L': 0 };
  const formScore = stats.forma.reduce((sum, r) => sum + (puntiForma[r] || 0), 0);
  const maxFormScore = stats.forma.length * 3;
  const formRatio = maxFormScore > 0 ? formScore / maxFormScore : 0.5;

  return (formRatio - 0.5) * 2 * CONFIG.pesoMomentum;
}

export function getFormaSquadra(team: string | undefined): string[] {
  const stats = getStatsSquadra(team);
  return stats?.forma || [];
}

export function getStatisticheSquadra(team: string | undefined): StatsSquadra | null {
  return getStatsSquadra(team);
}

function convertiDifficoltaInBonus(difficolta: number): number {
  return (3 - difficolta) * 0.75;
}

// ============================================================
// STIMA GOL SUBITI ATTESI (modello Poisson)
// ============================================================

function stimaGolSubitiAttesi(
  team: string | undefined,
  avversario: string | undefined,
  inCasa: boolean
): number {
  if (!team || !avversario) return 1.0;

  const statsTeam = getStatsSquadra(team);
  const statsAvv = getStatsSquadra(avversario);

  if (!statsTeam || !statsAvv || statsTeam.g === 0 || statsAvv.g === 0) {
    return 1.0;
  }

  const gsPerPartita = statsTeam.gs / statsTeam.g;
  const gfPerPartitaAvv = statsAvv.gf / statsAvv.g;

  let lambda = (gsPerPartita * gfPerPartitaAvv) / CONFIG.mediaGolCampionato;

  if (inCasa) lambda *= 0.85;
  else lambda *= 1.15;

  return Math.max(0.2, Math.min(3.5, lambda));
}

function probCleanSheet(lambdaGolSubiti: number): number {
  return Math.exp(-lambdaGolSubiti);
}

// ============================================================
// FATTORE TITOLARITÀ (probabilistico)
// ============================================================

function calcolaFattoreTitolaritaArricchito(player: Player): number {
  if (!player) return 0.5;
  const prob = (player.titolarita ?? 50) / 100;
  return Math.max(CONFIG.minProbTitolare, Math.min(1, prob));
}

// ============================================================
// PESI AFFIDABILI (FM pesata su partite giocate)
// ============================================================

function calcolaPesiAffidabili(player: Player): { pesoFantamedia: number; pesoMediaVoto: number } {
  const fantamedia = player.fantamedia ?? 0;
  const partite = player.partiteGiocate ?? 0;

  if (fantamedia < CONFIG.fantamediaSogliaZero) {
    return {
      pesoFantamedia: 0,
      pesoMediaVoto: 1,
    };
  }

  const affidabilitaFM = Math.min(1, partite / 10);

  const pesoFM = CONFIG.pesoFantamedia * affidabilitaFM;
  const pesoMV = 1 - pesoFM;

  return { pesoFantamedia: pesoFM, pesoMediaVoto: pesoMV };
}

// ============================================================
// COMPRESSIONE VALORI ALTI
// ============================================================

function comprimiValoriAlti(voto: number): number {
  if (voto <= CONFIG.sogliaCompressione) return voto;

  return CONFIG.sogliaCompressione +
         (voto - CONFIG.sogliaCompressione) * CONFIG.fattoreCompressione;
}

// ============================================================
// 🆕 CALCOLO VP PER PORTIERI (formula dedicata e semplificata)
// ============================================================

function calcolaVPPortiere(player: Player, rules: LeagueRules): number {
  const P = CONFIG.portieri;
  const inCasa = player.inCasa ?? true;

  // 1) Base: MV/FM pesati (i portieri non hanno molti bonus gol, quindi FM/MV è già informativa)
  const pesi = calcolaPesiAffidabili(player);
  let vp = (player.fantamedia ?? 0) * pesi.pesoFantamedia;
  vp += (player.mediaVoto ?? 6) * pesi.pesoMediaVoto;

  // 2) Bonus/malus casa/trasferta (leggero, il CS lo cattura già)
  if (inCasa) vp += P.bonusCasa;
  else vp -= P.malusTrasferta;

  // 3) Stima gol subiti attesi (modello Poisson)
  const lambdaGolSubiti = stimaGolSubitiAttesi(player.team, player.avversario, inCasa);
  const pCS = probCleanSheet(lambdaGolSubiti);

  // 4) Bonus imbattibilità pesato per P(clean sheet)
  if (rules.bonusImbattibilita !== 'off') {
    const bonusValue = rules.bonusImbattibilita === '1' ? 1 : 0.5;
    vp += pCS * bonusValue * P.pesoCleanSheet;
  }

  // 5) Malus gol subiti (leggero)
  const malusGol = rules.golSubito ?? -1;
  vp += lambdaGolSubiti * malusGol * P.pesoMalusGolSubito;

  return vp;
}

// ============================================================
// CALCOLO VOTO PREVISTO
// ============================================================

export function calculateExpectedScore(player: Player, rules: LeagueRules): number {
  if (!player) return 6;

  const role = player.role;
  const inCasa = player.inCasa ?? true;

  // 🆕 PORTIERI: formula dedicata, esce subito
  if (role === 'P') {
    let vp = calcolaVPPortiere(player, rules);

    // Infortuni
    const infortunio = cercaInfortunio(player);
    if (infortunio) {
      if (infortunio.stato === 'out' || infortunio.stato === 'out-lungo') {
        vp = 3.5;
      } else if (infortunio.stato === 'dubbio') {
        vp *= 0.85;
      }
    }

    // Compressione valori alti
    vp = comprimiValoriAlti(vp);

    const rangePortieri = CONFIG.rangeVotoPerRuolo['P'];
    const rounded = Math.round(vp * 2) / 2;
    return Math.max(rangePortieri[0], Math.min(rangePortieri[1], rounded));
  }

  // ============================================================
  // ALTRI RUOLI (D / C / A)
  // ============================================================

  const teamStrength = getTeamStrength(player.team);
  const fixtureDiff = getFixtureDifficulty(player.avversario);
  const difficulty = Math.max(1, Math.min(5, Math.round(fixtureDiff)));
  const momentum = getMomentum(player.team);

  const pesoFixture = CONFIG.pesoFixturePerRuolo[role] ?? 0.5;
  const pesoTeamStrength = CONFIG.pesoTeamStrengthPerRuolo[role] ?? 0.4;
  const rangeVoto = CONFIG.rangeVotoPerRuolo[role] ?? [CONFIG.minVoto, CONFIG.maxVoto];
  const teamBonus = (teamStrength - 1.0) * pesoTeamStrength;

  const pesi = calcolaPesiAffidabili(player);
  let votoPrevisto = (player.fantamedia ?? 0) * pesi.pesoFantamedia;
  votoPrevisto += (player.mediaVoto ?? 6) * pesi.pesoMediaVoto;

  const titularFactor = calcolaFattoreTitolaritaArricchito(player);
  votoPrevisto *= (0.6 + 0.4 * titularFactor);

  const nomeCompleto = `${player.name || ''} ${player.surname || ''}`.trim();
  if (nomeCompleto) {
    const livello = getLivelloTitolarita(nomeCompleto);
    if (livello === 'incerto' && (player.titolarita ?? 50) < 30) {
      votoPrevisto -= 0.3;
    }
  }

  if (inCasa) votoPrevisto += CONFIG.bonusCasa;
  else votoPrevisto -= CONFIG.malusTrasferta;

  const fixtureBonus = convertiDifficoltaInBonus(fixtureDiff) * (pesoFixture / 0.75);
  votoPrevisto += fixtureBonus;

  votoPrevisto += teamBonus;
  votoPrevisto += momentum;

  const statsSquadra = getStatsSquadra(player.team);

  if (statsSquadra && statsSquadra.g > 0) {
    const mediaGolFatti = statsSquadra.gf / statsSquadra.g;
    const mediaGolSubiti = statsSquadra.gs / statsSquadra.g;

    const pesoGolFatti = CONFIG.pesoGolFattiPerRuolo[role];
    if (pesoGolFatti !== undefined) {
      const bonusGol = (mediaGolFatti - 1.5) * pesoGolFatti;
      votoPrevisto += bonusGol;
    }

    const pesoGolSubiti = CONFIG.pesoGolSubitiPerRuolo[role];
    if (pesoGolSubiti !== undefined) {
      const bonusGolSubiti = (1.5 - mediaGolSubiti) * pesoGolSubiti;
      votoPrevisto += bonusGolSubiti;
    }
  }

  // DIFENSORI
  if (role === 'D') {
    const D = CONFIG.difensori;

    const golProb = D.golProbability[difficulty] ?? 0.08;
    votoPrevisto += golProb * D.pesoGol;

    if (rules.assist !== 'off') {
      const assistValue = rules.assist === '1' ? 1 : 0.5;
      const assistProb = D.assistProbability[difficulty] ?? 0.05;
      votoPrevisto += assistProb * assistValue * D.pesoAssist;
    }

    if (difficulty >= 4) {
      votoPrevisto -= D.malusAvversarioForte;
    }
  }

  // CENTROCAMPISTI
  if (role === 'C') {
    const C = CONFIG.centrocampisti;

    const golProb = C.golProbability[difficulty] ?? 0.2;
    votoPrevisto += golProb * C.pesoGol;

    if (rules.assist !== 'off') {
      const assistValue = rules.assist === '1' ? 1 : 0.5;
      const assistProb = C.assistProbability[difficulty] ?? 0.3;
      votoPrevisto += assistProb * assistValue * C.pesoAssist;
    }

    if (inCasa && difficulty <= 3) {
      votoPrevisto += C.bonusCasaControllo;
    }

    if (!inCasa && difficulty >= 4) {
      votoPrevisto -= C.malusTrasfertaDifficile;
    }
  }

  // ATTACCANTI
  if (role === 'A') {
    const A = CONFIG.attaccanti;

    const golProb = A.golProbability[difficulty] ?? 0.35;
    votoPrevisto += golProb * A.pesoGol;

    if (rules.assist !== 'off') {
      const assistValue = rules.assist === '1' ? 1 : 0.5;
      const assistProb = A.assistProbability[difficulty] ?? 0.28;
      votoPrevisto += assistProb * assistValue * A.pesoAssist;
    }

    const rigoreProb = A.rigoreProbability[difficulty] ?? 0.12;
    votoPrevisto += rigoreProb * A.pesoRigore;

    if (inCasa && difficulty <= 2) {
      votoPrevisto += A.bonusCasaFacile;
    }

    if (!inCasa && difficulty >= 4) {
      votoPrevisto -= A.malusTrasfertaDifficile;
    }
  }

  if (!Number.isFinite(votoPrevisto)) return 6;

  // Titolarità probabilistica
  const probTitolare = calcolaFattoreTitolaritaArricchito(player);
  if (probTitolare < 0.95) {
    const vpSeTitolare = votoPrevisto;
    const vpSeSubentra = votoPrevisto - CONFIG.malusSubentrante;
    votoPrevisto = probTitolare * vpSeTitolare + (1 - probTitolare) * vpSeSubentra;
  }

  // Infortuni
  const infortunio = cercaInfortunio(player);
  if (infortunio) {
    if (infortunio.stato === 'out' || infortunio.stato === 'out-lungo') {
      votoPrevisto = 3.5;
    } else if (infortunio.stato === 'dubbio') {
      votoPrevisto *= 0.85;
    }
  }

  // Compressione valori alti
  votoPrevisto = comprimiValoriAlti(votoPrevisto);

  const rounded = Math.round(votoPrevisto * 2) / 2;
  return Math.max(rangeVoto[0], Math.min(rangeVoto[1], rounded));
}

// ============================================================
// MODIFICATORE DIFESA
// ============================================================

export function calculateModificatoreBonus(
  defenders: FormationSlot[],
  goalkeeper: FormationSlot | null,
  rules: LeagueRules
): number {
  if (rules.modificatoreDifesa === 'off') return 0;
  if (!Array.isArray(defenders) || defenders.length === 0) return 0;
  if (defenders.length !== 4 && defenders.length !== 5) return 0;

  const validDefenders = defenders.filter(d => d && d.player);
  if (validDefenders.length < 3) return 0;

  const sortedDefenders = [...validDefenders].sort(
    (a, b) => (b.expectedScore ?? 6) - (a.expectedScore ?? 6)
  );
  const top3Defenders = sortedDefenders.slice(0, 3);

  let totalVP = top3Defenders.reduce((sum, d) => sum + (d.expectedScore ?? 6), 0);
  let count = 3;

  if (goalkeeper && goalkeeper.player) {
    totalVP += goalkeeper.expectedScore ?? 6;
    count = 4;
  }

  const avgVP = totalVP / count;

  if (rules.modificatoreDifesa === 'standard') {
    if (avgVP >= 7.0) return 6;
    if (avgVP >= 6.5) return 3;
    if (avgVP >= 6.0) return 1;
    return 0;
  }

  let bonus = 0;
  for (const threshold of rules.modificatoreCustom) {
    if (avgVP >= threshold.threshold) {
      bonus = threshold.bonus;
    }
  }
  return bonus;
}

// ============================================================
// UTILITY
// ============================================================

export function getFormIndicator(forma: number[]): 'hot' | 'warm' | 'cold' {
  if (!Array.isArray(forma) || forma.length === 0) return 'warm';
  const avg = forma.reduce((a, b) => a + (b || 6), 0) / forma.length;
  if (avg >= 6.7) return 'hot';
  if (avg >= 6.2) return 'warm';
  return 'cold';
}

export function getDifficultyLabel(difficulty: number): string {
  const d = difficulty ?? 3;
  if (d <= 1) return 'Molto Facile';
  if (d <= 2) return 'Facile';
  if (d <= 3) return 'Media';
  if (d <= 4) return 'Difficile';
  return 'Molto Difficile';
}
