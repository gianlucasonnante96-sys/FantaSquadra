
import { Player, LeagueRules, FormationSlot } from '../types';

export function calculateExpectedScore(player: Player, rules: LeagueRules): number {
  // Base: Fantamedia (peso principale)
  let votoPrevisto = player.fantamedia * 0.5;

  // Media voto (peso significativo)
  votoPrevisto += player.mediaVoto * 0.3;

  // Fattore titolarità (impatta fortemente)
  const titularFactor = player.titolarita / 100;
  votoPrevisto *= (0.6 + 0.4 * titularFactor);

  // Fattore forma recente (ULTIME 5 PARTITE - peso aumentato)
  const formAvg = player.forma.reduce((a, b) => a + b, 0) / player.forma.length;
  const formDeviation = formAvg - 6;

  // Forma ha impatto esponenziale: giocatori in forma ottengono bonus maggiori
  if (formDeviation > 0) {
    votoPrevisto += formDeviation * 0.6; // Bonus per forma positiva
  } else {
    votoPrevisto += formDeviation * 0.4; // Malus per forma negativa
  }

  // Tendenza recente (ultime 2 partite vs media)
  const recentForm = (player.forma[3] + player.forma[4]) / 2;
  const recentDeviation = recentForm - formAvg;
  votoPrevisto += recentDeviation * 0.3; // Bonus se sta migliorando

  // FATTORE CASA/TRASERTA (più significativo)
  if (player.inCasa) {
    votoPrevisto += 0.4; // Bonus casa
  } else {
    votoPrevisto -= 0.3; // Malus trasferta
  }

  // IMPATTO AVVERSARIO (molto più significativo)
  // Difficoltà 1 (molto facile) → +1.5
  // Difficoltà 2 (facile) → +0.8
  // Difficoltà 3 (media) → 0
  // Difficoltà 4 (difficile) → -0.8
  // Difficoltà 5 (molto difficile) → -1.5
  const difficultyMap: Record<number, number> = {
    1: 1.5,
    2: 0.8,
    3: 0,
    4: -0.8,
    5: -1.5,
  };
  const difficultyBonus = difficultyMap[player.difficoltaAvversario] || 0;
  votoPrevisto += difficultyBonus;

  // BONUS SPECIFICI PER RUOLO

  // PORTIERI
  if (player.role === 'P') {
    // Clean sheet bonus (basato su difficoltà avversario)
    const cleanSheetProbability = player.difficoltaAvversario <= 2 ? 0.7 :
                                   player.difficoltaAvversario <= 3 ? 0.5 :
                                   player.difficoltaAvversario <= 4 ? 0.3 : 0.15;

    if (rules.bonusImbattibilita !== 'off') {
      const bonusValue = rules.bonusImbattibilita === '1' ? 1 : 0.5;
      votoPrevisto += cleanSheetProbability * bonusValue * 0.8;
    }

    // Parate bonus (più parate contro avversari forti)
    if (player.difficoltaAvversario >= 4) {
      votoPrevisto += 0.3; // Più opportunità di parate decisive
    }
  }

  // DIFENSORI
  if (player.role === 'D') {
    // Clean sheet bonus per difensori
    const cleanSheetProbability = player.difficoltaAvversario <= 2 ? 0.6 :
                                   player.difficoltaAvversario <= 3 ? 0.4 :
                                   player.difficoltaAvversario <= 4 ? 0.25 : 0.1;

    if (rules.modificatoreDifesa !== 'off') {
      votoPrevisto += cleanSheetProbability * 0.4;
    }

    // Gol fatto bonus (difensori offensivi)
    if (player.difficoltaAvversario <= 2) {
      votoPrevisto += 0.3; // Più probabilità di gol su palla inattiva
    }

    // Malus contro attacchi forti
    if (player.difficoltaAvversario >= 4) {
      votoPrevisto -= 0.2;
    }
  }

  // CENTROCAMPISTI
  if (player.role === 'C') {
    // Gol/assist probability basata su difficoltà
    const goalProbability = player.difficoltaAvversario <= 2 ? 0.5 :
                            player.difficoltaAvversario <= 3 ? 0.3 :
                            player.difficoltaAvversario <= 4 ? 0.15 : 0.05;

    votoPrevisto += goalProbability * 1.2; // Bonus gol

    // Assist bonus
    if (rules.assist !== 'off') {
      const assistValue = rules.assist === '1' ? 1 : 0.5;
      const assistProbability = player.difficoltaAvversario <= 2 ? 0.6 :
                                player.difficoltaAvversario <= 3 ? 0.4 :
                                player.difficoltaAvversario <= 4 ? 0.25 : 0.1;
      votoPrevisto += assistProbability * assistValue * 0.5;
    }

    // Bonus casa per centrocampisti (più controllo del gioco)
    if (player.inCasa && player.difficoltaAvversario <= 3) {
      votoPrevisto += 0.2;
    }
  }

  // ATTACCANTI
  if (player.role === 'A') {
    // Gol probability MOLTO sensibile alla difficoltà
    const goalProbability = player.difficoltaAvversario === 1 ? 0.8 :
                            player.difficoltaAvversario === 2 ? 0.6 :
                            player.difficoltaAvversario === 3 ? 0.4 :
                            player.difficoltaAvversario === 4 ? 0.2 : 0.1;

    votoPrevisto += goalProbability * 1.5; // Bonus gol significativo

    // Assist bonus per attaccanti
    if (rules.assist !== 'off') {
      const assistValue = rules.assist === '1' ? 1 : 0.5;
      const assistProbability = player.difficoltaAvversario <= 2 ? 0.5 :
                                player.difficoltaAvversario <= 3 ? 0.35 :
                                player.difficoltaAvversario <= 4 ? 0.2 : 0.1;
      votoPrevisto += assistProbability * assistValue * 0.6;
    }

    // Rigore probability
    const rigoreProbability = player.difficoltaAvversario <= 3 ? 0.15 : 0.08;
    votoPrevisto += rigoreProbability * 0.5;

    // Super bonus contro difese deboli (casa + avversario facile)
    if (player.inCasa && player.difficoltaAvversario <= 2) {
      votoPrevisto += 0.5;
    }

    // Super malus contro difese forti (trasferta + avversario difficile)
    if (!player.inCasa && player.difficoltaAvversario >= 4) {
      votoPrevisto -= 0.4;
    }
  }

  // Fattore "momentum" (forma recente + avversario)
  if (formDeviation > 0.3 && player.difficoltaAvversario <= 2) {
    votoPrevisto += 0.4; // Giocatore in forma contro avversario facile
  }
  if (formDeviation < -0.3 && player.difficoltaAvversario >= 4) {
    votoPrevisto -= 0.3; // Giocatore in crisi contro avversario difficile
  }

  // Arrotonda ai valori 0.5 più vicini nel range 5-8
  // Valori possibili: 5, 5.5, 6, 6.5, 7, 7.5, 8
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
