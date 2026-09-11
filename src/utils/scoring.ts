import { Player, LeagueRules, FormationSlot } from '../types';
import { isProbabileTitolare, getLivelloTitolarita } from './titolarita';

/**
 * Calcola un fattore di titolarità "arricchito" che combina:
 * - La titolarità dichiarata (0-100) dal dataset interno
 * - La probabile formazione da Fantacalcio.it
 */
function calcolaFattoreTitolaritaArricchito(player: Player): number {
  // 🔒 SAFE: se player non ha nome o surname, ritorna valore neutro
  if (!player || (!player.name && !player.surname)) return 0.5;
  
  const baseTitolarita = (player.titolarita ?? 50) / 100;
  
  // 🔒 FIX: uso `player.name` (non `player.nome`) e passo nome completo
  const nomeCompleto = `${player.name || ''} ${player.surname || ''}`.trim();
  if (!nomeCompleto) return baseTitolarita;
  
  const probabile = isProbabileTitolare(nomeCompleto);
  
  if (probabile) {
    return Math.min(1.0, baseTitolarita + 0.15);
  } else {
    if (baseTitolarita > 0.5) {
      return Math.max(0.1, baseTitolarita - 0.2);
    }
    return baseTitolarita;
  }
}

export function calculateExpectedScore(player: Player, rules: LeagueRules): number {
  // 🔒 SAFE: se player è undefined, ritorna un valore di default
  if (!player) return 6;

  // 🔒 SAFE: garantisci che forma sia un array di 5 numeri
  const forma = Array.isArray(player.forma) && player.forma.length >= 5
    ? player.forma
    : [6, 6, 6, 6, 6];

  // Base: Fantamedia
  let votoPrevisto = (player.fantamedia ?? 5) * 0.5;

  // Media voto
  votoPrevisto += (player.mediaVoto ?? 6) * 0.3;

  // Fattore titolarità arricchito
  const titularFactor = calcolaFattoreTitolaritaArricchito(player);
  votoPrevisto *= (0.6 + 0.4 * titularFactor);

  // Penalità extra se non titolare
  const nomeCompleto = `${player.name || ''} ${player.surname || ''}`.trim();
  if (nomeCompleto) {
    const livello = getLivelloTitolarita(nomeCompleto);
    if (livello === 'incerto' && (player.titolarita ?? 50) < 30) {
      votoPrevisto -= 0.5;
    }
  }

  // Forma recente (usa `forma` sicuro)
  const formAvg = forma.reduce((a, b) => a + (b || 6), 0) / forma.length;
  const formDeviation = formAvg - 6;

  if (formDeviation > 0) {
    votoPrevisto += formDeviation * 0.6;
  } else {
    votoPrevisto += formDeviation * 0.4;
  }

  // Tendenza recente
  const recentForm = ((forma[3] || 6) + (forma[4] || 6)) / 2;
  const recentDeviation = recentForm - formAvg;
  votoPrevisto += recentDeviation * 0.3;

  // Casa/trasferta
  if (player.inCasa) {
    votoPrevisto += 0.4;
  } else {
    votoPrevisto -= 0.3;
  }

  // Difficoltà avversario
  const difficulty = player.difficoltaAvversario ?? 3;
  const difficultyMap: Record<number, number> = {
    1: 1.5,
    2: 0.8,
    3: 0,
    4: -0.8,
    5: -1.5,
  };
  votoPrevisto += difficultyMap[difficulty] || 0;

  // ===== BONUS PER RUOLO =====

  // PORTIERI
  if (player.role === 'P') {
    const cleanSheetProbability = difficulty <= 2 ? 0.7 :
                                   difficulty <= 3 ? 0.5 :
                                   difficulty <= 4 ? 0.3 : 0.15;

    if (rules.bonusImbattibilita !== 'off') {
      const bonusValue = rules.bonusImbattibilita === '1' ? 1 : 0.5;
      votoPrevisto += cleanSheetProbability * bonusValue * 0.8;
    }

    if (difficulty >= 4) {
      votoPrevisto += 0.3;
    }
  }

  // DIFENSORI
  if (player.role === 'D') {
    const cleanSheetProbability = difficulty <= 2 ? 0.6 :
                                   difficulty <= 3 ? 0.4 :
                                   difficulty <= 4 ? 0.25 : 0.1;

    if (rules.modificatoreDifesa !== 'off') {
      votoPrevisto += cleanSheetProbability * 0.4;
    }

    if (difficulty <= 2) {
      votoPrevisto += 0.3;
    }

    if (difficulty >= 4) {
      votoPrevisto -= 0.2;
    }
  }

  // CENTROCAMPISTI
  if (player.role === 'C') {
    const goalProbability = difficulty <= 2 ? 0.5 :
                            difficulty <= 3 ? 0.3 :
                            difficulty <= 4 ? 0.15 : 0.05;

    votoPrevisto += goalProbability * 1.2;

    if (rules.assist !== 'off') {
      const assistValue = rules.assist === '1' ? 1 : 0.5;
      const assistProbability = difficulty <= 2 ? 0.6 :
                                difficulty <= 3 ? 0.4 :
                                difficulty <= 4 ? 0.25 : 0.1;
      votoPrevisto += assistProbability * assistValue * 0.5;
    }

    if (player.inCasa && difficulty <= 3) {
      votoPrevisto += 0.2;
    }
  }

  // ATTACCANTI
  if (player.role === 'A') {
    const goalProbability = difficulty === 1 ? 0.8 :
                            difficulty === 2 ? 0.6 :
                            difficulty === 3 ? 0.4 :
                            difficulty === 4 ? 0.2 : 0.1;

    votoPrevisto += goalProbability * 1.5;

    if (rules.assist !== 'off') {
      const assistValue = rules.assist === '1' ? 1 : 0.5;
      const assistProbability = difficulty <= 2 ? 0.5 :
                                difficulty <= 3 ? 0.35 :
                                difficulty <= 4 ? 0.2 : 0.1;
      votoPrevisto += assistProbability * assistValue * 0.6;
    }

    const rigoreProbability = difficulty <= 3 ? 0.15 : 0.08;
    votoPrevisto += rigoreProbability * 0.5;

    if (player.inCasa && difficulty <= 2) {
      votoPrevisto += 0.5;
    }

    if (!player.inCasa && difficulty >= 4) {
      votoPrevisto -= 0.4;
    }
  }

  // Momentum
  if (formDeviation > 0.3 && difficulty <= 2) {
    votoPrevisto += 0.4;
  }
  if (formDeviation < -0.3 && difficulty >= 4) {
    votoPrevisto -= 0.3;
  }

  // 🔒 SAFE: se il risultato è NaN, ritorna 6
  if (!Number.isFinite(votoPrevisto)) return 6;

  const rounded = Math.round(votoPrevisto * 2) / 2;
  return Math.max(5, Math.min(8, rounded));
}

export function calculateModificatoreBonus(
  defenders: FormationSlot[],
  goalkeeper: FormationSlot | null,
  rules: LeagueRules
): number {
  if (rules.modificatoreDifesa === 'off') return 0;
  if (!Array.isArray(defenders) || defenders.length === 0) return 0;

  if (defenders.length !== 4 && defenders.length !== 5) {
    return 0;
  }

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
