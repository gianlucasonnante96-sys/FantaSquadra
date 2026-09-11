import { Player } from '../types';

const API_FOOTBALL_KEY = import.meta.env.VITE_API_FOOTBALL_KEY || '';
const API_BASE_URL = 'https://v3.football.api-sports.io';

export interface MatchDay {
  round: number;
  fixtures: Array<{
    homeTeam: string;
    awayTeam: string;
    date: string;
  }>;
}

// ============================================================
// 1. RECUPERO CALENDARIO DA API-FOOTBALL
// ============================================================

export async function getCurrentMatchDay(): Promise<MatchDay | null> {
  if (!API_FOOTBALL_KEY) {
    console.warn('⚠️ API_FOOTBALL_KEY mancante, salto recupero calendario');
    return null;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/fixtures?league=135&season=2026&next=20`,
      {
        headers: {
          'x-rapidapi-key': API_FOOTBALL_KEY,
          'x-rapidapi-host': 'v3.football.api-sports.io'
        }
      }
    );
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    
    const data = await response.json();
    const fixtures = data.response || [];
    if (fixtures.length === 0) return null;

    const currentRound = Math.ceil(fixtures.length / 10);
    
    return {
      round: currentRound,
      fixtures: fixtures.slice(0, 10).map((f: any) => ({
        homeTeam: f.teams?.home?.name || '',
        awayTeam: f.teams?.away?.name || '',
        date: f.date || '',
      }))
    };
  } catch (error) {
    console.error('Errore API-Football:', error);
    return null;
  }
}

// ============================================================
// 2. CALCOLO DIFFICOLTÀ AVVERSARIO
// ============================================================

export function calculateDifficulty(opponent: string, isHome: boolean): number {
  const topTeams = ['Inter', 'Juventus', 'Milan', 'Napoli', 'Atalanta', 'Roma', 'Lazio'];
  const midTeams = ['Fiorentina', 'Bologna', 'Torino', 'Sassuolo'];
  
  if (topTeams.includes(opponent)) return isHome ? 3 : 5;
  if (midTeams.includes(opponent)) return isHome ? 2 : 4;
  return isHome ? 1 : 3;
}

// ============================================================
// 3. PARSING DELLE PROBABILI FORMAZIONI
// ============================================================

export function parseProbableFormations(text: string): Record<string, string[]> {
  const formations: Record<string, string[]> = {};
  
  if (!text || typeof text !== 'string') return formations;
  
  const lines = text.split('\n');
  let currentTeam = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const teamMatch = trimmed.match(
      /^(Atalanta|Bologna|Cagliari|Como|Fiorentina|Frosinone|Genoa|Inter|Juventus|Lazio|Lecce|Milan|Monza|Napoli|Parma|Roma|Sassuolo|Torino|Udinese|Venezia)/i
    );
    if (teamMatch) {
      currentTeam = teamMatch[1];
      formations[currentTeam] = formations[currentTeam] || [];
      continue;
    }
    
    const playerMatch = trimmed.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(\d+)%/);
    if (playerMatch && currentTeam) {
      formations[currentTeam].push(playerMatch[1]);
    }
  }
  
  return formations;
}

// ============================================================
// 4. ARRICCHIMENTO PLAYER CON DATI PARTITA + TITOLARITÀ
// ============================================================

/**
 * Normalizza una stringa per confronti robusti.
 * Ritorna '' se il valore non è una stringa valida.
 */
function normalizzaNome(valore: unknown): string {
  if (typeof valore !== 'string' || !valore) return '';
  try {
    return valore.toLowerCase().trim();
  } catch {
    return '';
  }
}

export function updatePlayersWithMatchData(
  players: Player[],
  matchDay: MatchDay | null,
  probableFormations: Record<string, string[]> | null | undefined
): Player[] {
  // Se non ci sono dati, ritorna i player invariati (safe)
  if (!Array.isArray(players)) return [];
  if (!matchDay || !Array.isArray(matchDay.fixtures)) return players;
  
  const formazioniSicure = probableFormations || {};
  
  return players.map((player) => {
    if (!player) return player;
    
    // Match partita
    const match = matchDay.fixtures.find(
      (f) => f && (f.homeTeam === player.team || f.awayTeam === player.team)
    );
    if (!match) return player;
    
    const isHome = match.homeTeam === player.team;
    const opponent = isHome ? match.awayTeam : match.homeTeam;
    
    // 🔒 RECUPERO FORMAZIONE IN MODO SAFE
    const teamFormation = Array.isArray(formazioniSicure[player.team])
      ? formazioniSicure[player.team]
      : [];
    
    // 🔒 NORMALIZZAZIONE NOME/COGNOME IN MODO SAFE
    const playerSurname = normalizzaNome(player.surname);
    const playerName = normalizzaNome(player.name);
    
    // 🔒 CONTROLLO ELEMENTO PER ELEMENTO
    const isInProbable =
      teamFormation.length > 0 &&
      teamFormation.some((name) => {
        if (typeof name !== 'string' || !name) return false;
        try {
          const nameLower = name.toLowerCase();
          return (
            (playerSurname && nameLower.includes(playerSurname)) ||
            (playerName && nameLower.includes(playerName))
          );
        } catch {
          return false;
        }
      });
    
    // 🎯 AGGIORNAMENTO TITOLARITÀ
    let newTitolarita = player.titolarita ?? 50;
    if (isInProbable) {
      newTitolarita = Math.min(95, newTitolarita + 10);
    } else if (teamFormation.length > 0) {
      newTitolarita = Math.max(10, newTitolarita - 20);
    }
    
    return {
      ...player,
      inCasa: isHome,
      avversario: opponent,
      difficoltaAvversario: calculateDifficulty(opponent, isHome),
      titolarita: newTitolarita,
    };
  });
}
