import { Player } from '../types';

const API_KEY = '50edc6a6c8f2202be5440038d7924652'; // ✅ INSERISCI QUI LA TUA API KEY
const API_BASE = 'https://v3.football.api-sports.io';

export interface Fixture {
  home: string;
  away: string;
  date: string;
  round: number;
}

export async function fetchNextMatchday(): Promise<Fixture[]> {
  if (!API_KEY || API_KEY === '50edc6a6c8f2202be5440038d7924652') {
    console.warn('API key non configurata. Usa dati di fallback.');
    return getFallbackFixtures();
  }

  try {
    const response = await fetch(`${API_BASE}/fixtures?league=135&season=2026&next=10`, {
      headers: {
        'x-apisports-key': API_KEY
      }
    });

    if (!response.ok) throw new Error('API error');
    
    const data = await response.json();
    const fixtures = data.response || [];
    
    if (fixtures.length === 0) return getFallbackFixtures();

    const round = fixtures[0].league?.round || 1;

    return fixtures.map((f: any) => ({
      home: f.teams.home.name,
      away: f.teams.away.name,
      date: f.fixture.date,
      round: typeof round === 'string' ? parseInt(round.replace('Regular Season - ', '')) : round
    }));
  } catch (error) {
    console.error('Errore API, uso fallback:', error);
    return getFallbackFixtures();
  }
}

function getFallbackFixtures(): Fixture[] {
  return [
    { home: 'Genoa', away: 'Frosinone', date: '2026-09-13', round: 5 },
    { home: 'Lecce', away: 'Monza', date: '2026-09-13', round: 5 },
    { home: 'Napoli', away: 'Bologna', date: '2026-09-13', round: 5 },
    { home: 'Fiorentina', away: 'Cagliari', date: '2026-09-13', round: 5 },
    { home: 'Inter', away: 'Venezia', date: '2026-09-13', round: 5 },
    { home: 'Parma', away: 'Milan', date: '2026-09-13', round: 5 },
    { home: 'Torino', away: 'Como', date: '2026-09-13', round: 5 },
    { home: 'Atalanta', away: 'Juventus', date: '2026-09-13', round: 5 },
    { home: 'Empoli', away: 'Roma', date: '2026-09-13', round: 5 },
    { home: 'Lazio', away: 'Udinese', date: '2026-09-13', round: 5 }
  ];
}

export function calculateDifficulty(opponent: string): number {
  const top = ['Inter', 'Napoli', 'Juventus', 'Milan', 'Atalanta', 'Roma', 'Lazio'];
  const mid = ['Fiorentina', 'Bologna', 'Torino', 'Udinese', 'Genoa'];
  if (top.includes(opponent)) return 5;
  if (mid.includes(opponent)) return 3;
  return 2;
}

export function estimateProbableStarter(qi: number, role: string): number {
  if (qi >= 15) return 95;
  if (qi >= 10) return 85;
  if (qi >= 6) return 65;
  if (qi >= 3) return 40;
  return 15;
}

export function applyMatchdayData(player: Player, fixtures: Fixture[], qi: number): Player {
  const fixture = fixtures.find(f => f.home === player.team || f.away === player.team);
  
  if (fixture) {
    const isHome = fixture.home === player.team;
    const opponent = isHome ? fixture.away : fixture.home;
    const smartTitolarita = estimateProbableStarter(qi, player.role);
    
    return {
      ...player,
      inCasa: isHome,
      avversario: opponent,
      difficoltaAvversario: calculateDifficulty(opponent),
      titolarita: smartTitolarita
    };
  }
  
  return {
    ...player,
    avversario: 'Da definire',
    difficoltaAvversario: 3
  };
}
