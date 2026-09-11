--- 1_SCORING.txt (原始)


+++ 1_SCORING.txt (修改后)
import { Player, LeagueRules, FormationSlot } from '../types';

export function calculateExpectedScore(player: Player, rules: LeagueRules): number {
  // Base: Fantamedia weighted
  let xS = player.fantamedia * 0.4;

  // Media voto contribution
  xS += player.mediaVoto * 0.25;

  // Titolarità factor (0-1 scale)
  const titularFactor = player.titolarita / 100;
  xS *= (0.5 + 0.5 * titularFactor);

  // Form factor (last 5 matches average)
  const formAvg = player.forma.reduce((a, b) => a + b, 0) / player.forma.length;
  xS += (formAvg - 6) * 0.3; // deviation from 6

  // Home/Away factor
  if (player.inCasa) {
    xS += 0.3;
  } else {
    xS -= 0.2;
  }

  // Opponent difficulty (1-5 scale, lower is easier)
  const difficultyFactor = (5 - player.difficoltaAvversario) / 4;
  xS += difficultyFactor * 0.5;

  // Goalkeeper-specific: Clean Sheet bonus
  if (player.role === 'P') {
    if (rules.bonusImbattibilita !== 'off') {
      const bonusValue = rules.bonusImbattibilita === '1' ? 1 : 0.5;
      xS += player.cleanSheetOdds * bonusValue;
    }
  }

  // Defender-specific: Clean Sheet bonus for modificatore
  if (player.role === 'D') {
    if (rules.modificatoreDifesa !== 'off') {
      xS += player.cleanSheetOdds * 0.3;
    }
  }

  // Attacking players: goal/assist probability
  if (player.role === 'A' || player.role === 'C') {
    // Higher difficulty = fewer goal chances
    const attackFactor = player.difficoltaAvversario <= 2 ? 0.4 :
                         player.difficoltaAvversario <= 3 ? 0.2 : 0;
    xS += attackFactor;

    // Assist bonus
    if (rules.assist !== 'off') {
      const assistValue = rules.assist === '1' ? 1 : 0.5;
      xS += 0.15 * assistValue * (player.difficoltaAvversario <= 3 ? 1 : 0.5);
    }
  }

  return Math.round(xS * 100) / 100;
}

export function calculateModificatoreBonus(
  defenders: FormationSlot[],
  goalkeeper: FormationSlot | null,
  rules: LeagueRules
): number {
  if (rules.modificatoreDifesa === 'off') return 0;
  if (defenders.length === 0) return 0;

  // Il modificatore si attiva solo con 4 o 5 difensori (non con 3)
  if (defenders.length !== 4 && defenders.length !== 5) {
    return 0;
  }

  // Prendi i 3 migliori difensori per media voto
  const sortedDefenders = [...defenders].sort((a, b) => b.player.mediaVoto - a.player.mediaVoto);
  const top3Defenders = sortedDefenders.slice(0, 3);

  // Calcola la media dei 3 migliori difensori + portiere
  let totalVotes = top3Defenders.reduce((sum, d) => sum + d.player.mediaVoto, 0);
  let count = 3;

  if (goalkeeper) {
    totalVotes += goalkeeper.player.mediaVoto;
    count = 4;
  }

  const avgVote = totalVotes / count;

  if (rules.modificatoreDifesa === 'standard') {
    // Standard thresholds
    if (avgVote >= 7.0) return 6;
    if (avgVote >= 6.5) return 3;
    if (avgVote >= 6.0) return 1;
    return 0;
  }

  // Custom thresholds
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
