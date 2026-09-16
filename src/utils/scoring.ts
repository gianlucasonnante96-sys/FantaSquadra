import { Player, LeagueRules, FormationSlot } from '../types';
import { isProbabileTitolare, getLivelloTitolarita } from './titolarita';
import squadreData from '../data/squadre.json';

// ... (CONFIG, TEAM_STRENGTH, FIXTURE_DIFFICULTY, utility, normalizzaNomeSquadra, getTeamStrength, getFixtureDifficulty, convertiDifficoltaInBonus, calcolaFattoreTitolaritaArricchito, calcolaPesiAffidabili) ...

// 🔥 NUOVA FUNZIONE: Legge i gol fatti/subiti per una squadra
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

export function calculateExpectedScore(player: Player, rules: LeagueRules): number {
  if (!player) return 6;

  const role = player.role;
  const inCasa = player.inCasa ?? true;

  const fixtureDiff = getFixtureDifficulty(player.avversario);
  const difficulty = Math.max(1, Math.min(5, Math.round(fixtureDiff)));

  const teamStrength = getTeamStrength(player.team);
  
  // ... (pesi per ruolo, range) ...
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

  // ... (resto della logica base, bonus casa/trasferta, fixture bonus, team bonus) ...
  
  // ==========================================================
  // 🔥 MODIFICA PER GOL FATTI/SUBITI
  // ==========================================================
  
  const statsSquadra = getStatisticheSquadra(player.team);

  if (statsSquadra && statsSquadra.g > 0) {
    const partiteGiocate = statsSquadra.g;
    const mediaGolFatti = statsSquadra.gf / partiteGiocate;
    const mediaGolSubiti = statsSquadra.gs / partiteGiocate;

    // Per CENTROCAMPISTI e ATTACCANTI: bonus/malus in base ai gol fatti
    if (role === 'C' || role === 'A') {
      const bonusGol = (mediaGolFatti - 1.5) * 0.3;
      votoPrevisto += bonusGol;
    }

    // Per DIFENSORI: bonus/malus in base ai gol subiti
    if (role === 'D') {
      const bonusGolSubiti = (1.5 - mediaGolSubiti) * 0.4;
      votoPrevisto += bonusGolSubiti;
    }
  }

  // ==========================================================
  // BONUS SPECIFICI PER RUOLO
  // ==========================================================
  // ... (resto del codice: bonus portieri, difensori, centrocampisti, attaccanti) ...

  // ... (safe, arrotondamento, range) ...
}
