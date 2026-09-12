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
  
  // ===== DIFFICOLTÀ AVVERSARIO (base per tutti) =====
  difficolta: {
    1: 1.5,   // Molto facile
    2: 0.8,   // Facile
    3: 0,     // Media
    4: -0.8,  // Difficile
    5: -1.5,  // Molto difficile
  } as Record<number, number>,
  
  // ===== PORTIERI =====
  portieri: {
    cleanSheetBase: {
      1: 0.75, 2: 0.60, 3: 0.40, 4: 0.20, 5: 0.10,
    } as Record<number, number>,
    pesoCleanSheet: 1.5,
    bonusParate: {
      1: 0.0, 2: 0.1, 3: 0.2, 4: 0.5, 5: 0.7,
    } as Record<number, number>,
    malusGolSubiti: 0.4,
    bonusCasaFacile: 0.3,
  },
  
  // ===== DIFENSORI =====
  difensori: {
    cleanSheetBase: {
      1: 0.65, 2: 0.50, 3: 0.35, 4: 0.20, 5: 0.10,
    } as Record<number, number>,
    pesoCleanSheet: 0.6,
    // Bonus gol (i difensori fanno gol su palla inattiva)
    golProbability: {
      1: 0.15, 2: 0.12, 3: 0.08, 4: 0.04, 5: 0.02,
    } as Record<number, number>,
    pesoGol: 1.2,
    // Assist (cross, sponde)
    assistProbability: {
      1: 0.10, 2: 0.08, 3: 0.05, 4: 0.03, 5: 0.02,
    } as Record<number, number>,
    pesoAssist: 0.5,
    malusAvversarioForte: 0.3,
  },
  
  // ===== CENTROCAMPISTI =====
  centrocampisti: {
    // Probabilità gol (dipende dal tipo di centrocampista)
    golProbability: {
      1: 0.50, 2: 0.35, 3: 0.20, 4: 0.10, 5: 0.05,
    } as Record<number, number>,
    pesoGol: 1.3,
    // Assist (più probabili dei gol per i cc)
    assistProbability: {
      1: 0.60, 2: 0.45, 3: 0.30, 4: 0.15, 5: 0.08,
    } as Record<number, number>,
    pesoAssist: 0.7,
    bonusCasaControllo: 0.2,
    malusTrasfertaDifficile: 0.3,
  },
  
  // ===== ATTACCANTI =====
  attaccanti: {
    golProbability: {
      1: 0.75, 2: 0.55, 3: 0.35, 4: 0.18, 5: 0.08,
    } as Record<number, number>,
    pesoGol: 1.6,
    assistProbability: {
      1: 0.50, 2: 0.40, 3: 0.28, 4: 0.15, 5: 0.08,
    } as Record<number, number>,
    pesoAssist: 0.7,
    // Rigore (probabilità di calciare un rigore)
    rigoreProbability: {
      1: 0.15, 2: 0.15, 3: 0.12, 4: 0.08, 5: 0.05,
    } as Record<number, number>,
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

  // ===== BASE: FANTAMEDIA + MEDIA VOTO =====
  let votoPrevisto = (player.fantamedia ?? 5) * CONFIG.pesoFantamedia;
  votoPrevisto += (player.mediaVoto ?? 6) * CONFIG.pesoMediaVoto;

  // ===== FATTORE TITOLARITÀ =====
  const titularFactor = calcolaFattoreTitolaritaArricchito(player);
  votoPrevisto *= (0.6 + 0.4 * titularFactor);

  // Penalità extra per giocatori palesemente fuori
  const nomeCompleto = `${player.name || ''} ${player.surname || ''}`.trim();
  if (nomeCompleto) {
    const livello = getLivelloTitolarita(nomeCompleto);
    if (livello === 'incerto' && (player.titolarita ?? 50) < 30) {
      votoPrevisto -= 0.5;
    }
  }

  // ===== FORMA RECENTE =====
  const formAvg = forma.reduce((a, b) => a + (b || 6), 0) / forma.length;
  const formDeviation = formAvg - 6;

  if (formDeviation > 0) {
    votoPrevisto += formDeviation * CONFIG.pesoFormaPositiva;
  } else {
    votoPrevisto += formDeviation * CONFIG.pesoFormaNegativa;
  }

  // Tendenza recente (ultime 2 partite vs media)
  const recentForm = ((forma[3] || 6) + (forma[4] || 6)) / 2;
  const recentDeviation = recentForm - formAvg;
  votoPrevisto += recentDeviation * CONFIG.pesoTendenza;

  // ===== CASA/TRASFERTA =====
  if (inCasa) {
    votoPrevisto += CONFIG.bonusCasa;
  } else {
    votoPrevisto -= CONFIG.malusTrasferta;
  }

  // ===== DIFFICOLTÀ AVVERSARIO (base) =====
  const difficultyBonus = CONFIG.difficolta[difficulty] || 0;
  votoPrevisto += difficultyBonus;

  // ==========================================================
  // 🔥 BONUS SPECIFICI PER RUOLO
  // ==========================================================

  // ===== PORTIERI =====
  if (role === 'P') {
    const P = CONFIG.portieri;
    
    // Clean sheet
    const cleanSheetProb = P.cleanSheetBase[difficulty] ?? 0.4;
    if (rules.bonusImbattibilita !== 'off') {
      const bonusValue = rules.bonusImbattibilita === '1' ? 1 : 0.5;
      votoPrevisto += cleanSheetProb * bonusValue * P.pesoCleanSheet;
    }
    
    // Malus gol subiti (vs avversari forti)
    const golSubitiProbabili = difficulty >= 4 ? 2 : difficulty === 3 ? 1 : 0.5;
    votoPrevisto -= golSubitiProbabili * P.malusGolSubiti;
    
    // Bonus parate (più parate contro avversari forti)
    votoPrevisto += P.bonusParate[difficulty] ?? 0.2;
    
    // Bonus porta inviolata in casa
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
    
    // Bonus gol (palla inattiva)
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
    
    // Malus trasferta contro big
    if (!inCasa && difficulty >= 4) {
      votoPrevisto -= C.malusTrasfertaDifficile;
    }
  }

  // ===== ATTACCANTI =====
  if (role === 'A') {
    const A = CONFIG.attaccanti;
    
    // Bonus gol (molto sensibile alla difficoltà)
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
