import { Player, LeagueRules, FormationSlot } from '../types';
import { isProbabileTitolare, getLivelloTitolarita } from './titolarita';
import squadreData from '../data/squadre.json';

// ============================================================
// CONFIGURAZIONE ALGORITMO
// ============================================================

const CONFIG = {
  pesoFantamedia: 0.6,
  pesoMediaVoto: 0.4,
  pesoFantamediaInaffidabile: 0,
  pesoMediaVotoInaffidabile: 0.7,
  fantamediaSogliaZero: 0.1,
  
  boostTitolarita: 0.15,
  malusTitolaritaBassa: 0.2,
  
  bonusCasa: 0.4,
  malusTrasferta: 0.3,
  
  pesoFixturePerRuolo: {
    'P': 0.6,
    'D': 0.4,
    'C': 0.7,
    'A': 0.8,
  } as Record<string, number>,
  
  pesoTeamStrengthPerRuolo: {
    'P': 0.4,
    'D': 0.5,
    'C': 0.7,
    'A': 0.8,
  } as Record<string, number>,
  
  rangeVotoPerRuolo: {
    'P': [5.0, 8.0],
    'D': [5.0, 7.5],
    'C': [5.0, 8.0],
    'A': [5.0, 8.0],
  } as Record<string, [number, number]>,
  
  // 🔥 Bonus gol fatti/subiti (basato sulla classifica)
  pesoGolFattiPerRuolo: {
    'C': 0.3,
    'A': 0.3,
  } as Record<string, number>,
  
  pesoGolSubitiPerRuolo: {
    'D': 0.4,
  } as Record<string, number>,
  
  portieri: {
    cleanSheetBase: { 1: 0.75, 2: 0.60, 3: 0.40, 4: 0.20, 5: 0.10 } as Record<number, number>,
    pesoCleanSheet: 1.5,
    bonusParate: { 1: 0.0, 2: 0.1, 3: 0.2, 4: 0.5, 5: 0.7 } as Record<number, number>,
    malusGolSubiti: 0.4,
    bonusCasaFacile: 0.3,
  },
  
  difensori: {
    golProbability: { 1: 0.15, 2: 0.12, 3: 0.08, 4: 0.04, 5: 0.02 } as Record<number, number>,
    pesoGol: 1.2,
    assistProbability: { 1: 0.10, 2: 0.08, 3: 0.05, 4: 0.03, 5: 0.02 } as Record<number, number>,
    pesoAssist: 0.5,
    malusAvversarioForte: 0.2,
  },
  
  centrocampisti: {
    golProbability: { 1: 0.50, 2: 0.35, 3: 0.20, 4: 0.10, 5: 0.05 } as Record<number, number>,
    pesoGol: 1.3,
    assistProbability: { 1: 0.60, 2: 0.45, 3: 0.30, 4: 0.15, 5: 0.08 } as Record<number, number>,
    pesoAssist: 0.7,
    bonusCasaControllo: 0.2,
    malusTrasfertaDifficile: 0.3,
  },
  
  attaccanti: {
    golProbability: { 1: 0.75, 2: 0.55, 3: 0.35, 4: 0.18, 5: 0.08 } as Record<number, number>,
    pesoGol: 1.6,
    assistProbability: { 1: 0.50, 2: 0.40, 3: 0.28, 4: 0.15, 5: 0.08 } as Record<number, number>,
    pesoAssist: 0.7,
    rigoreProbability: { 1: 0.15, 2: 0.15, 3: 0.12, 4: 0.08, 5: 0.05 } as Record<number, number>,
    pesoRigore: 0.6,
    bonusCasaFacile: 0.5,
    malusTrasfertaDifficile: 0.4,
  },
  
  minVoto: 5,
  maxVoto: 8,
};

// ============================================================
// TEAM STRENGTH
// ============================================================

const TEAM_STRENGTH: Record<string, number> = {
  'Inter': 1.22, 'Roma': 1.20, 'Como': 1.15, 'Lazio': 1.15,
  'Milan': 1.10, 'Napoli': 1.10, 'Cagliari': 1.05, 'Juventus': 1.05,
  'Atalanta': 1.05, 'Frosinone': 0.95, 'Sassuolo': 0.90, 'Lecce': 0.85,
  'Torino': 0.85, 'Udinese': 0.82, 'Fiorentina': 0.82, 'Bologna': 0.80,
  'Parma': 0.72, 'Genoa': 0.72, 'Monza': 0.70, 'Venezia': 0.65,
};

// ============================================================
// FIXTURE DIFFICULTY
// ============================================================

const FIXTURE_DIFFICULTY: Record<string, number> = {
  'Inter': 5.0, 'Roma': 4.9, 'Como': 4.5, 'Lazio': 4.4,
  'Milan': 4.3, 'Napoli': 4.2, 'Juventus': 4.0, 'Atalanta': 3.9,
  'Cagliari': 3.8, 'Frosinone': 3.5, 'Sassuolo': 3.3, 'Fiorentina': 3.0,
  'Torino': 2.9, 'Bologna': 2.9, 'Lecce': 2.8, 'Udinese': 2.7,
  'Parma': 2.4, 'Genoa': 2.3, 'Monza': 2.2, 'Venezia': 1.9,
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

function getTeamStrength(team: string | undefined): number {
  const nome = normalizzaNomeSquadra(team);
  return TEAM_STRENGTH[nome] ?? 0.85;
}

function getFixtureDifficulty(avversario: string | undefined): number {
  const nome = normalizzaNomeSquadra(avversario);
  return FIXTURE_DIFFICULTY[nome] ?? 3.0;
}

function convertiDifficoltaInBonus(difficolta: number): number {
  return (3 - difficolta) * 0.75;
}

// 🔥 Statistiche squadra (GF/GS/G)
function getStatisticheSquadra(team: string | undefined): { gf: number; gs: number; g: number } | null {
  if (!team) return null;
  try {
    const dati = squadreData as any;
    if (!dati || !dati.squadre) return null;
    
    const nome = normalizzaNomeSquadra(team);
    
    for (const [key, value] of Object.entries(dati.squadre)) {
      const keyNorm = normalizzaNomeSquadra(key);
      if (keyNorm.toLowerCase() === nome.toLowerCase()) {
        return value as { gf: number; gs: number; g: number };
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

// ============================================================
// FATTORE TITOLARITÀ
// ============================================================

function calcolaFattoreTitolaritaArricchito(player: Player): number {
  if (!player || (!player.name && !player.surname)) return 0.5;
  
  const baseTitolarita = (player.titolarita ?? 50) / 100;
  const nomeCompleto = `${player.name || ''} ${player.surname || ''}`.trim();
  if (!nomeCompleto) return baseTitolarita;
  
  const probabile = isProbabileTitolare(nomeCompleto);
  
  if (probabile) {
    return Math.min(1.0, baseTitolarita + CONFIG.boostTitolarita);
  } else {
    if (baseTitolarita > 0.5) {
      return Math.max(0.1, baseTitolarita - CONFIG.malusTitolaritaBassa);
    }
    return baseTitolarita;
  }
}

// ============================================================
// GESTIONE FANTAMEDIA INAFFIDABILE
// ============================================================

function calcolaPesiAffidabili(player: Player): { pesoFantamedia: number; pesoMediaVoto: number } {
  const fantamedia = player.fantamedia ?? 0;
  
  if (fantamedia < CONFIG.fantamediaSogliaZero) {
    return {
      pesoFantamedia: CONFIG.pesoFantamediaInaffidabile,
      pesoMediaVoto: CONFIG.pesoMediaVotoInaffidabile,
    };
  }
  
  return {
    pesoFantamedia: CONFIG.pesoFantamedia,
    pesoMediaVoto: CONFIG.pesoMediaVoto,
  };
}

// ============================================================
// CALCOLO VOTO PREVISTO
// ============================================================

export function calculateExpectedScore(player: Player, rules: LeagueRules): number {
  if (!player) return 6;

  const role = player.role;
  const inCasa = player.inCasa ?? true;

  const fixtureDiff = getFixtureDifficulty(player.avversario);
  const difficulty = Math.max(1, Math.min(5, Math.round(fixtureDiff)));

  const teamStrength = getTeamStrength(player.team);
  
  const pesoFixture = CONFIG.pesoFixturePerRuolo[role] ?? 0.75;
  const pesoTeamStrength = CONFIG.pesoTeamStrengthPerRuolo[role] ?? 0.8;
  const rangeVoto = CONFIG.rangeVotoPerRuolo[role] ?? [CONFIG.minVoto, CONFIG.maxVoto];
  const teamBonus = (teamStrength - 1.0) * pesoTeamStrength;

  // BASE
  const pesi = calcolaPesiAffidabili(player);
  let votoPrevisto = (player.fantamedia ?? 0) * pesi.pesoFantamedia;
  votoPrevisto += (player.mediaVoto ?? 6) * pesi.pesoMediaVoto;

  const titularFactor = calcolaFattoreTitolaritaArricchito(player);
  votoPrevisto *= (0.6 + 0.4 * titularFactor);

  const nomeCompleto = `${player.name || ''} ${player.surname || ''}`.trim();
  if (nomeCompleto) {
    const livello = getLivelloTitolarita(nomeCompleto);
    if (livello === 'incerto' && (player.titolarita ?? 50) < 30) {
      votoPrevisto -= 0.5;
    }
  }

  if (inCasa) votoPrevisto += CONFIG.bonusCasa;
  else votoPrevisto -= CONFIG.malusTrasferta;

  // Fixture bonus pesato per ruolo
  const fixtureBonus = convertiDifficoltaInBonus(fixtureDiff) * (pesoFixture / 0.75);
  votoPrevisto += fixtureBonus;

  if (role !== 'P') votoPrevisto += teamBonus;

  // ==========================================================
  // 🔥 BONUS GOL FATTI / SUBITI (basato su squadre.json)
  // ==========================================================
  
  const statsSquadra = getStatisticheSquadra(player.team);
  
  if (statsSquadra && statsSquadra.g > 0) {
    const mediaGolFatti = statsSquadra.gf / statsSquadra.g;
    const mediaGolSubiti = statsSquadra.gs / statsSquadra.g;
    
    // CENTROCAMPISTI e ATTACCANTI: bonus in base ai gol FATTI
    const pesoGolFatti = CONFIG.pesoGolFattiPerRuolo[role];
    if (pesoGolFatti !== undefined) {
      const bonusGol = (mediaGolFatti - 1.5) * pesoGolFatti;
      votoPrevisto += bonusGol;
    }
    
    // DIFENSORI: bonus in base ai gol SUBITI
    const pesoGolSubiti = CONFIG.pesoGolSubitiPerRuolo[role];
    if (pesoGolSubiti !== undefined) {
      const bonusGolSubiti = (1.5 - mediaGolSubiti) * pesoGolSubiti;
      votoPrevisto += bonusGolSubiti;
    }
  }

  // ==========================================================
  // BONUS SPECIFICI PER RUOLO
  // ==========================================================

  // PORTIERI
  if (role === 'P') {
    const P = CONFIG.portieri;
    
    const cleanSheetProb = P.cleanSheetBase[difficulty] ?? 0.4;
    if (rules.bonusImbattibilita !== 'off') {
      const bonusValue = rules.bonusImbattibilita === '1' ? 1 : 0.5;
      votoPrevisto += cleanSheetProb * bonusValue * P.pesoCleanSheet;
    }
    
    const golSubitiProbabili = difficulty >= 4 ? 2 : difficulty === 3 ? 1 : 0.5;
    votoPrevisto -= golSubitiProbabili * P.malusGolSubiti;
    
    votoPrevisto += P.bonusParate[difficulty] ?? 0.2;
    
    if (inCasa && difficulty <= 2) {
      votoPrevisto += P.bonusCasaFacile;
    }

    votoPrevisto += teamBonus * 0.5;
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

  const rounded = Math.round(votoPrevisto * 2) / 2;
  return Math.max(rangeVoto[0], Math.min(rangeVoto[1], rounded));
}

// ============================================================
// 🔥 MODIFICATORE DIFESA (basato sul VP)
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
