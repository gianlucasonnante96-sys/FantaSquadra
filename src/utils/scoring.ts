import { Player, LeagueRules, FormationSlot } from '../types';
import { isProbabileTitolare, getLivelloTitolarita } from './utils/titolarita';

/**
 * 🆕 Calcola un fattore di titolarità "arricchito" che combina:
 * - La titolarità dichiarata (0-100) dal dataset interno
 * - La probabile formazione da Fantacalcio.it
 *
 * Logica:
 * - Se il giocatore è NELLE probabili formazioni → boost fino a +15%
 * - Se NON è nelle probabili formazioni ma ha titolarità >50 → penalità -20%
 * - Altrimenti → lascia invariato
 */
function calcolaFattoreTitolaritaArricchito(player: Player): number {
  const baseTitolarita = player.titolarita / 100; // da 0 a 1
  const probabile = isProbabileTitolare(player.nome);
  
  if (probabile) {
    // È nei titolari probabili → spingi verso l'alto
    return Math.min(1.0, baseTitolarita + 0.15);
  } else {
    // NON è nei titolari probabili
    if (baseTitolarita > 0.5) {
      // Il dataset interno dice che è titolare, ma Fantacalcio no
      // → riduci l'affidabilità (probabile ballottaggio o panchina)
      return Math.max(0.1, baseTitolarita - 0.2);
    }
    // Già bassa, lascia com'è
    return baseTitolarita;
  }
}

export function calculateExpectedScore(player: Player, rules: LeagueRules): number {
  // Base: Fantamedia (peso principale)
  let votoPrevisto = player.fantamedia * 0.5;

  // Media voto (peso significativo)
  votoPrevisto += player.mediaVoto * 0.3;

  // 🆕 Fattore titolarità ARRICCHITO con probabili formazioni
  const titularFactor = calcolaFattoreTitolaritaArricchito(player);
  votoPrevisto *= (0.6 + 0.4 * titularFactor);

  // 🆕 PENALITÀ EXTRA se il giocatore è chiaramente NON titolare
  const livello = getLivelloTitolarita(player.nome);
  if (livello === 'incerto' && player.titolarita < 30) {
    // Giocatore con bassa titolarità E non nelle probabili formazioni
    // → molto probabilmente in panchina
    votoPrevisto -= 0.5;
  }

  // Fattore forma recente (ULTIME 5 PARTITE - peso aumentato)
  const formAvg = player.forma.reduce((a, b) => a + b, 0) / player.forma.length;
  const formDeviation = formAvg - 6;

  if (formDeviation > 0) {
    votoPrevisto += formDeviation * 0.6;
  } else {
    votoPrevisto += formDeviation * 0.4;
  }

  // Tendenza recente
  const recentForm = (player.forma[3] + player.forma[4]) / 2;
  const recentDeviation = recentForm - formAvg;
  votoPrevisto += recentDeviation * 0.3;

  // Fattore casa/trasferta
  if (player.inCasa) {
    votoPrevisto += 0.4;
  } else {
    votoPrevisto -= 0.3;
  }

  // Impatto avversario
  const difficultyMap: Record<number, number> = {
    1: 1.5,
    2: 0.8,
    3: 0,
    4: -0.8,
    5: -1.5,
  };
  const difficultyBonus = difficultyMap[player.difficoltaAvversario] || 0;
  votoPrevisto += difficultyBonus;

  // ===== BONUS SPECIFICI PER RUOLO =====

  // PORTIERI
  if (player.role === 'P') {
    const cleanSheetProbability = player.difficoltaAvversario <= 2 ? 0.7 :
                                   player.difficoltaAvversario <= 3 ? 0.5 :
                                   player.difficoltaAvversario <= 4 ? 0.3 : 0.15;

    if (rules.bonusImbattibilita !== 'off') {
      const bonusValue = rules.bonusImbattibilita === '1' ? 1 : 0.5;
      votoPrevisto += cleanSheetProbability * bonusValue * 0.8;
    }

    if (player.difficoltaAvversario >= 4) {
      votoPrevisto += 0.3;
    }
  }

  // DIFENSORI
  if (player.role === 'D') {
    const cleanSheetProbability = player.difficoltaAvversario <= 2 ? 0.6 :
                                   player.difficoltaAvversario <= 3 ? 0.4 :
                                   player.difficoltaAvversario <= 4 ? 0.25 : 0.1;

    if (rules.modificatoreDifesa !== 'off') {
      votoPrevisto += cleanSheetProbability * 0.4;
    }

    if (player.difficoltaAvversario <= 2) {
      votoPrevisto += 0.3;
    }

    if (player.difficoltaAvversario >= 4) {
      votoPrevisto -= 0.2;
    }
  }

  // CENTROCAMPISTI
  if (player.role === 'C') {
    const goalProbability = player.difficoltaAvversario <= 2 ? 0.5 :
                            player.difficoltaAvversario <= 3 ? 0.3 :
                            player.difficoltaAvversario <= 4 ? 0.15 : 0.05;

    votoPrevisto += goalProbability * 1.2;

    if (rules.assist !== 'off') {
      const assistValue = rules.assist === '1' ? 1 : 0.5;
      const assistProbability = player.difficoltaAvversario <= 2 ? 0.6 :
                                player.difficoltaAvversario <= 3 ? 0.4 :
                                player.difficoltaAvversario <= 4 ? 0.25 : 0.1;
      votoPrevisto += assistProbability * assistValue * 0.5;
    }

    if (player.inCasa && player.difficoltaAvversario <= 3) {
      votoPrevisto += 0.2;
    }
  }

  // ATTACCANTI
  if (player.role === 'A') {
    const goalProbability = player.difficoltaAvversario === 1 ? 0.8 :
                            player.difficoltaAvversario === 2 ? 0.6 :
                            player.difficoltaAvversario === 3 ? 0.4 :
                            player.difficoltaAvversario === 4 ? 0.2 : 0.1;

    votoPrevisto += goalProbability * 1.5;

    if (rules.assist !== 'off') {
      const assistValue = rules.assist === '1' ? 1 : 0.5;
      const assistProbability = player.difficoltaAvversario <= 2 ? 0.5 :
                                player.difficoltaAvversario <= 3 ? 0.35 :
                                player.difficoltaAvversario <= 4 ? 0.2 : 0.1;
      votoPrevisto += assistProbability * assistValue * 0.6;
    }

    const rigoreProbability = player.difficoltaAvversario <= 3 ? 0.15 : 0.08;
    votoPrevisto += rigoreProbability * 0.5;

    if (player.inCasa && player.difficoltaAvversario <= 2) {
      votoPrevisto += 0.5;
    }

    if (!player.inCasa && player.difficoltaAvversario >= 4) {
      votoPrevisto -= 0.4;
    }
  }

  // Fattore "momentum"
  if (formDeviation > 0.3 && player.difficoltaAvversario <= 2) {
    votoPrevisto += 0.4;
  }
  if (formDeviation < -0.3 && player.difficoltaAvversario >= 4) {
    votoPrevisto -= 0.3;
  }

  // Arrotonda ai valori 0.5 più vicini nel range 5-8
  const rounded = Math.round(votoPrevisto * 2) / 2;
  return Math.max(5, Math.min(8, rounded));
}

export function calculateModificatoreBonus(
  defenders: FormationSlot[],
  goalkeeper: FormationSlot | null,
  rules: LeagueRules
): number {
  if (rules.modificatoreDifesa === 'off') return 0;
  if (defenders.length === 0) return 0;

  if (defenders.length !== 4 && defenders.length !== 5) {
    return 0;
  }

  const sortedDefenders = [...defenders].sort((a, b) => b.player.mediaVoto - a.player.mediaVoto);
  const top3Defenders = sortedDefenders.slice(0, 3);

  let totalVotes = top3Defenders.reduce((sum, d) => sum + d.player.mediaVoto, 0);
  let count = 3;

  if (goalkeeper) {
    totalVotes += goalkeeper.player.mediaVoto;
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
  const avg = forma.reduce((a, b) => a + b, 0) / forma.length;
  if (avg >= 6.7) return 'hot';
  if (avg >= 6.2) return 'warm';
  return 'cold';
}

export function getDifficultyLabel(difficulty: number): string {
  if (difficulty <= 1) return 'Molto Facile';
  if (difficulty <= 2) return 'Facile';
  if (difficulty <= 3) return 'Media';
  if (difficulty <= 4) return 'Difficile';
  return 'Molto Difficile';
}
