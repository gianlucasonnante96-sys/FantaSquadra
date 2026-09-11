import { Player } from '../types';

const API_KEY = import.meta.env.VITE_API_FOOTBALL_KEY || '';
const API_BASE = 'https://v3.football.api-sports.io';

export interface Fixture {
  home: string;
  away: string;
  date: string;
  round: number;
}

// 🔥 FUNZIONE PRINCIPALE: Carica gli avversari reali dalla API gratuita
export async function fetchNextMatchday(): Promise<Fixture[]> {
  if (!API_KEY) {
    console.warn('API key non configurata. Usa dati di fallback.');
    return getFallbackFixtures();
  }

  try {
    // Ottieni le prossime 10 partite di Serie A (league ID 135)
    const response = await fetch(`${API_BASE}/fixtures?league=135&season=2026&next=10`, {
      headers: {
        'x-apisports-key': API_KEY
      }
    });

    if (!response.ok) throw new Error('API error');
    
    const data = await response.json();
    const fixtures = data.response || [];
    
    if (fixtures.length === 0) return getFallbackFixtures();

    // Estrai il numero di giornata dalla prima partita
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

// Fallback se l'API non è configurata o fallisce
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

// Calcola la difficoltà dell'avversario (1-5)
export function calculateDifficulty(opponent: string): number {
  const top = ['Inter', 'Napoli', 'Juventus', 'Milan', 'Atalanta', 'Roma', 'Lazio'];
  const mid = ['Fiorentina', 'Bologna', 'Torino', 'Udinese', 'Genoa'];
  if (top.includes(opponent)) return 5;
  if (mid.includes(opponent)) return 3;
  return 2;
}

// 🧠 ALGORITMO INTELLIGENTE: Stima la titolarità basata su Qi (simula probabili formazioni)
export function estimateProbableStarter(qi: number, role: string): number {
  if (qi >= 15) return 95; // Top player
  if (qi >= 10) return 85; // Titolari indiscussi
  if (qi >= 6) return 65;  // Titolari a rotazione
  if (qi >= 3) return 40;  // Riserve
  return 15;               // Terze scelte
}

// Applica automaticamente tutti i dati al giocatore
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
