import { Player, LeagueRules, FormationSlot } from '../types';
import { isProbabileTitolare, getLivelloTitolarita } from './titolarita';
import squadreData from '../data/squadre.json';

// ============================================================
// CONFIGURAZIONE
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
  
  // 🔥 Peso momentum (forma recente)
  pesoMomentum: 0.6,
  
  pesoFixturePerRuolo: {
    'P': 0.6, 'D': 0.4, 'C': 0.7, 'A': 0.8,
  } as Record<string, number>,
  
  pesoTeamStrengthPerRuolo: {
    'P': 0.4, 'D': 0.5, 'C': 0.7, 'A': 0.8,
  } as Record<string, number>,
  
  rangeVotoPerRuolo: {
    'P': [5.0, 8.0], 'D': [5.0, 7.5], 'C': [5.0, 8.0], 'A': [5.0, 8.0],
  } as Record<string, [number, number]>,
  
  pesoGolFattiPerRuolo: { 'C': 0.3, 'A': 0.3 } as Record<string, number>,
  pesoGolSubitiPerRuolo: { 'D': 0.4 } as Record<string, number>,
  
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
// 🔥 STATISTICHE SQUADRA (dinamiche)
// ============================================================

interface StatsSquadra {
  punti: number;
  g: number;
  gf: number;
  gs: number;
  forma: string[];
}

function getStatsSquadra(team: string | undefined): StatsSquadra | null {
  if (!team) return null;
  try {
    const dati = squadreData as any;
    if (!dati || !dati.squadre) return null;
    
    const nome = normalizzaNomeSquadra(team);
    
    for (const [key, value] of Object.entries(dati.squadre)) {
      const keyNorm = normalizzaNomeSquadra(key);
      if (keyNorm.toLowerCase() === nome.toLowerCase()) {
        return value as StatsSquadra;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

// ============================================================
// 🔥 TEAM STRENGTH DINAMICO
// Calcolato da: punti, gol fatti, gol subiti
// ============================================================

function calcolaTeamStrength(team: string | undefined): number {
  const stats = getStatsSquadra(team);
  
  if (!stats || stats.g === 0) {
    // Fallback: valore medio-basso per squadre senza dati
    return 0.85;
  }
  
  const puntiMax = stats.g * 3;
  const puntiRatio = Math.min(1, stats.punti / puntiMax); // 0-1
  const gfRatio = Math.min(3, stats.gf / stats.g) / 3;   // 0-1
  const gsRatio = Math.min(3, stats.gs / stats.g) / 3;   // 0-1
  
  // Formula: 55% punti + 25% attacco + 20% difesa
  const strength = 0.5 
                 + (puntiRatio * 0.35)   // punti contano molto
                 + (gfRatio * 0.15)      // attacco contribuisce
                 - (gsRatio * 0.10);     // difesa debole penalizza
  
  // Clamp tra 0.65 (squadra debolissima) e 1.25 (squadra top)
  return Math.max(0.65, Math.min(1.25, strength));
}

// ============================================================
// 🔥 FIXTURE DIFFICULTY DINAMICA
// Basata sulla forza dell'avversario
// ============================================================

function calcolaFixtureDifficulty(avversario: string | undefined): number {
  const strength = calcolaTeamStrength(avversario);
  
  // Trasforma 0.65-1.25 in 1.0-5.0
  const normalized = (strength - 0.65) / (1.25 - 0.65); // 0-1
  return 1 + normalized * 4;
}

function convertiDifficoltaInBonus(difficolta: number): number {
  return (3 - difficolta) * 0.75;
}

// ============================================================
// 🔥 MOMENTUM (basato sulla forma recente)
// ============================================================

function calcolaMomentum(team: string | undefined): number {
  const stats = getStatsSquadra(team);
  
  if (!stats || !Array.isArray(stats.forma) || stats.forma.length === 0) {
    return 0; // nessun dato → nessun bonus/malus
  }
  
  const puntiForma: Record<string, number> = { 'W': 3, 'D': 1, 'L': 0 };
  const formScore = stats.forma.reduce((sum, r) => sum + (puntiForma[r] || 0), 0);
  const maxFormScore = stats.forma.length * 3;
  const formRatio = maxFormScore > 0 ? formScore / maxFormScore : 0.5;
  
  // formRatio: 1.0 = tutte vittorie, 0.0 = tutte sconfitte
  // Bonus: (formRatio - 0.5) * 2 * pesoMomentum
  // Con pesoMomentum 0.6: range da -0.6 a +0.6
  return (formRatio - 0.5) * 2 * CONFIG.pesoMomentum;
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

  // 🔥 DINAMICI
  const teamStrength = calcolaTeamStrength(player.team);
  const fixtureDiff = calcolaFixtureDifficulty(player.avversario);
  const difficulty = Math.max(1, Math.min(5, Math.round(fixtureDiff)));
  const momentum = calcolaMomentum(player.team);
  
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

  // Fixture bonus dinamico
  const fixtureBonus = convertiDifficoltaInBonus(fixtureDiff) * (pesoFixture / 0.75);
  votoPrevisto += fixtureBonus;

  if (role !== 'P') votoPrevisto += teamBonus;

  // 🔥 MOMENTUM (forma recente)
  votoPrevisto += momentum;

  // ==========================================================
  // 🔥 BONUS GOL FATTI / SUBITI (dinamici)
  // ==========================================================
  
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
// MODIFICATORE DIFESA (basato su VP)
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
