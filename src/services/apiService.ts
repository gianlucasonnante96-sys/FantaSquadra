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

export async function getCurrentMatchDay(): Promise<MatchDay | null> {
  if (!API_FOOTBALL_KEY) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/fixtures?league=135&season=2026&next=20`, {
      headers: {
        'x-rapidapi-key': API_FOOTBALL_KEY,
        'x-rapidapi-host': 'v3.football.api-sports.io'
      }
    });
    if (!response.ok) throw new Error('API error');
    
    const data = await response.json();
    const fixtures = data.response || [];
    if (fixtures.length === 0) return null;

    const currentRound = Math.ceil(fixtures.length / 10);
    
    return {
      round: currentRound,
      fixtures: fixtures.slice(0, 10).map((f: any) => ({
        homeTeam: f.teams.home.name,
        awayTeam: f.teams.away.name,
        date: f.date,
      }))
    };
  } catch (error) {
    console.error('Errore API:', error);
    return null;
  }
}

export function calculateDifficulty(opponent: string, isHome: boolean): number {
  const topTeams = ['Inter', 'Juventus', 'Milan', 'Napoli', 'Atalanta', 'Roma', 'Lazio'];
  const midTeams = ['Fiorentina', 'Bologna', 'Torino', 'Sassuolo'];
  
  if (topTeams.includes(opponent)) return isHome ? 3 : 5;
  if (midTeams.includes(opponent)) return isHome ? 2 : 4;
  return isHome ? 1 : 3;
}

export function parseProbableFormations(text: string): Record<string, string[]> {
  const formations: Record<string, string[]> = {};
  const lines = text.split('\n');
  let currentTeam = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    const teamMatch = trimmed.match(/^(Atalanta|Bologna|Cagliari|Como|Fiorentina|Frosinone|Genoa|Inter|Juventus|Lazio|Lecce|Milan|Monza|Napoli|Parma|Roma|Sassuolo|Torino|Udinese|Venezia)/i);
    if (teamMatch) {
      currentTeam = teamMatch[1];
      formations[currentTeam] = [];
      continue;
    }
    
    const playerMatch = trimmed.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(\d+)%/);
    if (playerMatch && currentTeam) {
      formations[currentTeam].push(playerMatch[1]);
    }
  }
  return formations;
}

export function updatePlayersWithMatchData(
  players: Player[], 
  matchDay: MatchDay,
  probableFormations: Record<string, string[]>
): Player[] {
  return players.map(player => {
    const match = matchDay.fixtures.find(f => f.homeTeam === player.team || f.awayTeam === player.team);
    if (!match) return player;
    
    const isHome = match.homeTeam === player.team;
    const opponent = isHome ? match.awayTeam : match.homeTeam;
    const teamFormation = probableFormations[player.team] || [];
    
    const isInProbable = teamFormation.some(
      name => name.toLowerCase().includes(player.surname.toLowerCase()) ||
              name.toLowerCase().includes(player.name.toLowerCase())
    );
    
    let newTitolarita = player.titolarita;
    if (isInProbable) newTitolarita = Math.min(95, player.titolarita + 10);
    else if (teamFormation.length > 0) newTitolarita = Math.max(10, player.titolarita - 20);
    
    return {
      ...player,
      inCasa: isHome,
      avversario: opponent,
      difficoltaAvversario: calculateDifficulty(opponent, isHome),
      titolarita: newTitolarita,
    };
  });
}
