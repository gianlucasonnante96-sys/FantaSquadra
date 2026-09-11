--- 2_OPTIMIZER.txt (原始)


+++ 2_OPTIMIZER.txt (修改后)
import { Player, LeagueRules, Formation, FormationSlot } from '../types';
import { calculateExpectedScore, calculateModificatoreBonus } from './scoring';

interface ModuleConfig {
  name: string;
  positions: { role: 'P' | 'D' | 'C' | 'A'; count: number; label: string }[];
}

const MODULES: ModuleConfig[] = [
  { name: '4-3-3', positions: [
    { role: 'P', count: 1, label: 'POR' },
    { role: 'D', count: 4, label: 'DIF' },
    { role: 'C', count: 3, label: 'CEN' },
    { role: 'A', count: 3, label: 'ATT' },
  ]},
  { name: '3-4-3', positions: [
    { role: 'P', count: 1, label: 'POR' },
    { role: 'D', count: 3, label: 'DIF' },
    { role: 'C', count: 4, label: 'CEN' },
    { role: 'A', count: 3, label: 'ATT' },
  ]},
  { name: '4-4-2', positions: [
    { role: 'P', count: 1, label: 'POR' },
    { role: 'D', count: 4, label: 'DIF' },
    { role: 'C', count: 4, label: 'CEN' },
    { role: 'A', count: 2, label: 'ATT' },
  ]},
  { name: '5-3-2', positions: [
    { role: 'P', count: 1, label: 'POR' },
    { role: 'D', count: 5, label: 'DIF' },
    { role: 'C', count: 3, label: 'CEN' },
    { role: 'A', count: 2, label: 'ATT' },
  ]},
  { name: '3-5-2', positions: [
    { role: 'P', count: 1, label: 'POR' },
    { role: 'D', count: 3, label: 'DIF' },
    { role: 'C', count: 5, label: 'CEN' },
    { role: 'A', count: 2, label: 'ATT' },
  ]},
  { name: '4-3-1-2', positions: [
    { role: 'P', count: 1, label: 'POR' },
    { role: 'D', count: 4, label: 'DIF' },
    { role: 'C', count: 4, label: 'CEN' },
    { role: 'A', count: 2, label: 'ATT' },
  ]},
];

export function optimizeFormation(
  roster: Player[],
  rules: LeagueRules
): { formations: Formation[]; best: Formation } {
  const allowedModules = MODULES.filter(m => rules.moduliConsentiti.includes(m.name));

  // Calculate xS for all players
  const playersWithScore = roster.map(p => ({
    player: p,
    xS: calculateExpectedScore(p, rules),
  }));

  const formations: Formation[] = [];

  for (const module of allowedModules) {
    const slots: FormationSlot[] = [];
    const usedIds = new Set<string>();
    let totalScore = 0;

    for (const pos of module.positions) {
      const available = playersWithScore
        .filter(ps => ps.player.role === pos.role && !usedIds.has(ps.player.id))
        .sort((a, b) => b.xS - a.xS);

      const selected = available.slice(0, pos.count);
      for (const sel of selected) {
        usedIds.add(sel.player.id);
        const slot: FormationSlot = {
          player: sel.player,
          expectedScore: sel.xS,
          position: pos.label,
        };
        slots.push(slot);
        totalScore += sel.xS;
      }
    }

    // Calculate modificatore bonus
    const defenders = slots.filter(s => s.player.role === 'D');
    const goalkeeper = slots.find(s => s.player.role === 'P') || null;
    const modificatoreBonus = calculateModificatoreBonus(defenders, goalkeeper, rules);

    // Build bench from remaining players
    const bench: FormationSlot[] = [];
    const remaining = playersWithScore
      .filter(ps => !usedIds.has(ps.player.id))
      .sort((a, b) => {
        // Prioritize by titolarità for bench (safe subs)
        const aScore = a.xS * 0.6 + (a.player.titolarita / 100) * 0.4;
        const bScore = b.xS * 0.6 + (b.player.titolarita / 100) * 0.4;
        return bScore - aScore;
      });

    // Bench order: P, D, C, A with high titolarità first
    const benchByRole = { P: [] as typeof remaining, D: [] as typeof remaining, C: [] as typeof remaining, A: [] as typeof remaining };
    for (const r of remaining) {
      benchByRole[r.player.role].push(r);
    }

    for (const role of ['P', 'D', 'C', 'A'] as const) {
      for (const r of benchByRole[role]) {
        bench.push({
          player: r.player,
          expectedScore: r.xS,
          position: role,
        });
      }
    }

    formations.push({
      modulo: module.name,
      slots,
      bench,
      totalScore: totalScore + modificatoreBonus,
      modificatoreBonus,
      explanation: generateExplanation(module.name, slots, modificatoreBonus, rules),
    });
  }

  // Sort by total score
  formations.sort((a, b) => b.totalScore - a.totalScore);

  return { formations, best: formations[0] };
}

function generateExplanation(
  modulo: string,
  slots: FormationSlot[],
  modificatoreBonus: number,
  rules: LeagueRules
): string {
  const defenders = slots.filter(s => s.player.role === 'D');
  const attackers = slots.filter(s => s.player.role === 'A');
  const midfielders = slots.filter(s => s.player.role === 'C');

  let explanation = `Il modulo ${modulo} è stato selezionato come ottimale. `;

  if (modificatoreBonus > 0) {
    explanation += `La difesa garantisce un bonus modificatore di +${modificatoreBonus} punti grazie alle prestazioni attese dei difensori. `;
  }

  // Find best performer
  const bestPerformer = [...slots].sort((a, b) => b.expectedScore - a.expectedScore)[0];
  explanation += `Il giocatore con il punteggio atteso più alto è ${bestPerformer.player.name} ${bestPerformer.player.surname} (${bestPerformer.player.team}) con xS di ${bestPerformer.expectedScore.toFixed(2)}. `;

  // Home advantage
  const homePlayers = slots.filter(s => s.player.inCasa);
  if (homePlayers.length > 6) {
    explanation += `La maggior parte della formazione gioca in casa, garantendo un vantaggio di rendimento. `;
  }

  // Easy matches
  const easyMatches = slots.filter(s => s.player.difficoltaAvversario <= 2);
  if (easyMatches.length > 4) {
    explanation += `Ben ${easyMatches.length} titolari affrontano avversari con difficoltà bassa. `;
  }

  if (rules.bonusImbattibilita !== 'off') {
    const gk = slots.find(s => s.player.role === 'P');
    if (gk && gk.player.cleanSheetOdds > 0.4) {
      explanation += `Il portiere ha buone probabilità di clean sheet (${(gk.player.cleanSheetOdds * 100).toFixed(0)}%).`;
    }
  }

  return explanation;
}

export function getAvailableModules(): string[] {
  return MODULES.map(m => m.name);
}
