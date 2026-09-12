import { Player, LeagueRules, FormationSlot } from '../types';
import { isProbabileTitolare, getLivelloTitolarita } from './titolarita';

// ============================================================
// CONFIGURAZIONE ALGORITMO
// Modifica questi valori per "tunare" l'algoritmo senza toccare la logica
// ============================================================

const CONFIG = {
  // ===== PESI BASE =====
  pesoFantamedia: 0.5,
  pesoMediaVoto: 0.3,
  
  // 🔥 PESI ALTERNATIVI quando fantamedia è inaffidabile (0 o < soglia)
  pesoFantamediaInaffidabile: 0,
  pesoMediaVotoInaffidabile: 0.6,
  
  // 🔥 Soglie per considerare la fantamedia "inaffidabile"
  fantamediaSogliaBassa: 4.0,  // sotto questo valore = dato sospetto
  fantamediaSogliaZero: 0.1,   // sotto questo valore = dato mancante
  
  // ===== TITOLARITÀ =====
  boostTitolarita: 0.15,
  malusTitolaritaBassa: 0.2,
  
  // ===== FORMA RECENTE =====
  pesoFormaPositiva: 0.6,
  pesoFormaNegativa: 0.4,
  pesoTendenza: 0.3,
  
  // ===== CASA/TRASFERTA =====
  bonusCasa: 0.4,
  malusTrasferta: 0.3,
  
  // ===== DIFFICOLTÀ AVVERSARIO =====
  difficolta: {
    1: 1.5, 2: 0.8, 3: 0, 4: -0.8, 5: -1.5,
  } as Record<number, number>,
  
  // ===== PORTIERI =====
  portieri: {
    cleanSheetBase: { 1: 0.75, 2: 0.60, 3: 0.40, 4: 0.20, 5: 0.10 } as Record<number, number>,
    pesoCleanSheet: 1.5,
    bonusParate: { 1: 0.0, 2: 0.1, 3: 0.2, 4: 0.5, 5: 0.7 } as Record<number, number>,
    malusGolSubiti: 0.4,
    bonusCasaFacile: 0.3,
  },
  
  // ===== DIFENSORI =====
  difensori: {
    cleanSheetBase: { 1: 0.65, 2: 0.50, 3: 0.35, 4: 0.20, 5: 0.10 } as Record<number, number>,
    pesoCleanSheet: 0.6,
    golProbability: { 1: 0.15, 2: 0.12, 3: 0.08, 4: 0.04, 5: 0.02 } as Record<number, number>,
    pesoGol: 1.2,
    assistProbability: { 1: 0.10, 2: 0.08, 3: 0.05, 4: 0.03, 5: 0.02 } as Record<number, number>,
    pesoAssist: 0.5,
    malusAvversarioForte: 0.3,
  },
  
  // ===== CENTROCAMPISTI =====
  centrocampisti: {
    golProbability: { 1: 0.50, 2: 0.35, 3: 0.20, 4: 0.10, 5: 0.05 } as Record<number, number>,
    pesoGol: 1.3,
    assistProbability: { 1: 0.60, 2: 0.45, 3: 0.30, 4: 0.15, 5: 0.08 } as Record<number, number>,
    pesoAssist: 0.7,
    bonusCasaControllo: 0.2,
    malusTrasfertaDifficile: 0.3,
  },
  
  // ===== ATTACCANTI =====
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
  
  // ===== LIMITI FINALI =====
  minVoto: 5,
  maxVoto: 8,
};

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
// 🔥 GESTIONE FANTAMEDIA INAFFIDABILE
// ============================================================

/**
 * Restituisce i pesi effettivi per fantamedia e media voto,
 * tenendo conto dell'affidabilità del dato fantamedia.
 * 
 * CASI:
 * 1. fantamedia = 0 (dato mancante dal listone) → ignora fantamedia, usa solo media voto
 * 2. fantamedia < 4 ma > 0 (dato sospetto) → riduce peso fantamedia
 * 3. fantamedia >= 4 (dato valido) → usa pesi normali
 */
function calcolaPesiAffidabili(player: Player): { pesoFantamedia: number; pesoMediaVoto: number } {
  const fantamedia = player.fantamedia ?? 0;
  
  // CASO 1: fantamedia mancante (0 o quasi)
  if (fantamedia < CONFIG.fantamediaSogliaZero) {
    return {
      pesoFantamedia: CONFIG.pesoFantamediaInaffidabile,
      pesoMediaVoto: CONFIG.pesoMediaVotoInaffidabile,
    };
  }
  
  // CASO 2: fantamedia bassa ma presente (sospetta)
  if (fantamedia < CONFIG.fantamediaSogliaBassa) {
    // Usa un peso ridotto per fantamedia, ma non zero
    return {
      pesoFantamedia: CONFIG.pesoFantamedia * 0.3,
      pesoMediaVoto: CONFIG.pesoMediaVoto * 1.5,
    };
  }
  
  // CASO 3: fantamedia valida
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

  const forma = Array.isArray(player.forma) && player.forma.length >= 5
    ? player.forma
    : [6, 6, 6, 6, 6];

  const role = player.role;
  const difficulty = player.difficoltaAvversario ?? 3;
  const inCasa = player.inCasa ?? true;

  // 🔥 USA PESI AFFIDABILI (gestisce fantamedia mancante)
  const pesi = calcolaPesiAffidabili(player);
  
  let votoPrevisto = (player.fantamedia ?? 0) * pesi.pesoFantamedia;
  votoPrevisto += (player.mediaVoto ?? 6) * pesi.pesoMediaVoto;

  // Fattore titolarità
  const titularFactor = calcolaFattoreTitolaritaArricchito(player);
  votoPrevisto *= (0.6 + 0.4 * titularFactor);

  // Penalità extra per giocatori fuori
  const nomeCompleto = `${player.name || ''} ${player.surname || ''}`.trim();
  if (nomeCompleto) {
    const livello = getLivelloTitolarita(nomeCompleto);
    if (livello === 'incerto' && (player.titolarita ?? 50) < 30) {
      votoPrevisto -= 0.5;
    }
  }

  // Forma recente
  const formAvg = forma.reduce((a, b) => a + (b || 6), 0) / forma.length;
  const formDeviation = formAvg - 6;

  if (formDeviation > 0) {
    votoPrevisto += formDeviation * CONFIG.pesoFormaPositiva;
  } else {
    votoPrevisto += formDeviation * CONFIG.pesoFormaNegativa;
  }

  // Tendenza recente (ultime 2 partite)
  const recentForm = ((forma[3] || 6) + (forma[4] || 6)) / 2;
  votoPrevisto += (recentForm - formAvg) * CONFIG.pesoTendenza;

  // Casa/Trasferta
  if (inCasa) {
    votoPrevisto += CONFIG.bonusCasa;
  } else {
    votoPrevisto -= CONFIG.malusTrasferta;
  }

  // Difficoltà avversario (base)
  votoPrevisto += CONFIG.difficolta[difficulty] || 0;

  // ==========================================================
  // 🔥 BONUS SPECIFICI PER RUOLO
  // ==========================================================

  // ===== PORTIERI =====
  if (role === 'P') {
    const P = CONFIG.portieri;
    
    // Clean sheet bonus
    const cleanSheetProb = P.cleanSheetBase[difficulty] ?? 0.4;
    if (rules.bonusImbattibilita !== 'off') {
      const bonusValue = rules.bonusImbattibilita === '1' ? 1 : 0.5;
      votoPrevisto += cleanSheetProb * bonusValue * P.pesoCleanSheet;
    }
    
    // Malus gol subiti probabili
    const golSubitiProbabili = difficulty >= 4 ? 2 : difficulty === 3 ? 1 : 0.5;
    votoPrevisto -= golSubitiProbabili * P.malusGolSubiti;
    
    // Bonus parate
    votoPrevisto += P.bonusParate[difficulty] ?? 0.2;
    
    // Bonus porta inviolata in casa vs avversario facile
    if (inCasa && difficulty <= 2) {
      votoPrevisto += P.bonusCasaFacile;
    }
  }

  // ===== DIFENSORI =====
  if (role === 'D') {
    const D = CONFIG.difensori;
    
    // Clean sheet
    const cleanSheetProb = D.cleanSheetBase[difficulty] ?? 0.35;
    if (rules.modificatoreDifesa !== 'off') {
      votoPrevisto += cleanSheetProb * D.pesoCleanSheet;
    }
    
    // Bonus gol su palla inattiva
    const golProb = D.golProbability[difficulty] ?? 0.08;
    votoPrevisto += golProb * D.pesoGol;
    
    // Bonus assist
    if (rules.assist !== 'off') {
      const assistValue = rules.assist === '1' ? 1 : 0.5;
      const assistProb = D.assistProbability[difficulty] ?? 0.05;
      votoPrevisto += assistProb * assistValue * D.pesoAssist;
    }
    
    // Malus contro attacchi forti
    if (difficulty >= 4) {
      votoPrevisto -= D.malusAvversarioForte;
    }
  }

  // ===== CENTROCAMPISTI =====
  if (role === 'C') {
    const C = CONFIG.centrocampisti;
    
    // Bonus gol
    const golProb = C.golProbability[difficulty] ?? 0.2;
    votoPrevisto += golProb * C.pesoGol;
    
    // Bonus assist
    if (rules.assist !== 'off') {
      const assistValue = rules.assist === '1' ? 1 : 0.5;
      const assistProb = C.assistProbability[difficulty] ?? 0.3;
      votoPrevisto += assistProb * assistValue * C.pesoAssist;
    }
    
    // Bonus casa (controllo del gioco)
    if (inCasa && difficulty <= 3) {
      votoPrevisto += C.bonusCasaControllo;
    }
    
    // Malus trasferta vs big
    if (!inCasa && difficulty >= 4) {
      votoPrevisto -= C.malusTrasfertaDifficile;
    }
  }

  // ===== ATTACCANTI =====
  if (role === 'A') {
    const A = CONFIG.attaccanti;
    
    // Bonus gol
    const golProb = A.golProbability[difficulty] ?? 0.35;
    votoPrevisto += golProb * A.pesoGol;
    
    // Bonus assist
    if (rules.assist !== 'off') {
      const assistValue = rules.assist === '1' ? 1 : 0.5;
      const assistProb = A.assistProbability[difficulty] ?? 0.28;
      votoPrevisto += assistProb * assistValue * A.pesoAssist;
    }
    
    // Bonus rigore
    const rigoreProb = A.rigoreProbability[difficulty] ?? 0.12;
    votoPrevisto += rigoreProb * A.pesoRigore;
    
    // Super bonus casa + avversario facile
    if (inCasa && difficulty <= 2) {
      votoPrevisto += A.bonusCasaFacile;
    }
    
    // Super malus trasferta + avversario difficile
    if (!inCasa && difficulty >= 4) {
      votoPrevisto -= A.malusTrasfertaDifficile;
    }
  }

  // ===== MOMENTUM (forma + avversario) =====
  if (formDeviation > 0.3 && difficulty <= 2) {
    votoPrevisto += 0.4;
  }
  if (formDeviation < -0.3 && difficulty >= 4) {
    votoPrevisto -= 0.3;
  }

  // ===== SAFE =====
  if (!Number.isFinite(votoPrevisto)) return 6;

  const rounded = Math.round(votoPrevisto * 2) / 2;
  return Math.max(CONFIG.minVoto, Math.min(CONFIG.maxVoto, rounded));
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
    (a, b) => (b.player.mediaVoto ?? 6) - (a.player.mediaVoto ?? 6)
  );
  const top3Defenders = sortedDefenders.slice(0, 3);

  let totalVotes = top3Defenders.reduce((sum, d) => sum + (d.player.mediaVoto ?? 6), 0);
  let count = 3;

  if (goalkeeper && goalkeeper.player) {
    totalVotes += goalkeeper.player.mediaVoto ?? 6;
    count = 4;
  }

  const avgVote = totalVotes / count;

  if (rules.modificatoreDifesa === 'standard') {
    if (avgVote >= 7.0) return 6;
    if (avgVote >= 6.5) return 3;
    if (avgVote >= 6.0) return 1;
    return 0;
  }

  let bonus = 0;
  for (const threshold of rules.modificatoreCustom) {
    if (avgVote >= threshold.threshold) {
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
