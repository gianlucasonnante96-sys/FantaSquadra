import { Player } from '../types';
import { loadFormazioniDaFile } from './probabiliFormazioniService';

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
  if (!API_FOOTBALL_KEY) {
    console.warn('⚠️ API_FOOTBALL_KEY mancante');
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

export function calculateDifficulty(opponent: string, isHome: boolean): number {
  const topTeams = ['Inter', 'Juventus', 'Milan', 'Napoli', 'Atalanta', 'Roma', 'Lazio'];
  const midTeams = ['Fiorentina', 'Bologna', 'Torino', 'Sassuolo'];
  
  if (topTeams.includes(opponent)) return isHome ? 3 : 5;
  if (midTeams.includes(opponent)) return isHome ? 2 : 4;
  return isHome ? 1 : 3;
}

const SIGLA_TO_NOME: Record<string, string> = {
  'ATA': 'Atalanta', 'BOL': 'Bologna', 'CAG': 'Cagliari', 'COM': 'Como',
  'FIO': 'Fiorentina', 'FRO': 'Frosinone', 'GEN': 'Genoa', 'INT': 'Inter',
  'JUV': 'Juventus', 'LAZ': 'Lazio', 'LEC': 'Lecce', 'MIL': 'Milan',
  'MON': 'Monza', 'NAP': 'Napoli', 'PAR': 'Parma', 'ROM': 'Roma',
  'SAS': 'Sassuolo', 'TOR': 'Torino', 'UDI': 'Udinese', 'VEN': 'Venezia',
};

function normalizzaTeamApi(team: string | undefined | null): string {
  if (typeof team !== 'string' || !team) return '';
  const upper = team.trim().toUpperCase();
  if (SIGLA_TO_NOME[upper]) return SIGLA_TO_NOME[upper];
  return team.trim();
}

function normalizzaNome(valore: unknown): string {
  if (typeof valore !== 'string' || !valore) return '';
  try {
    return valore.toLowerCase().trim();
  } catch {
    return '';
  }
}

/**
 * 🔥 NUOVA VERSIONE: applica la PERCENTUALE ESATTA dalle formazioni.
 * 
 * - Se il giocatore è in lista con perc=100 → titolarità 95
 * - Se in lista con perc<100 → titolarità = perc
 * - Se NON in lista → titolarità 10
 */
export function updatePlayersWithMatchData(
  players: Player[],
  matchDay: MatchDay | null,
  probabiliFormazioni?: Record<string, Array<{ nome: string; perc: number }>> | null
): Player[] {
  if (!Array.isArray(players)) return [];
  
  // Se non ci sono formazioni passate, leggile dal file
  let formazioniDaApplicare = probabiliFormazioni;
  
  if (!formazioniDaApplicare) {
    try {
      const formazioniFile = loadFormazioniDaFile();
      formazioniDaApplicare = {};
      for (const f of formazioniFile) {
        const nomeCompleto = normalizzaTeamApi(f.team);
        if (nomeCompleto) {
          formazioniDaApplicare[nomeCompleto] = f.giocatori.map(g => {
            if (typeof g === 'string') return { nome: g, perc: 100 };
            return { nome: g.nome || '', perc: g.perc ?? 100 };
          }).filter(g => g.nome);
        }
      }
      console.log(`📋 Applicate ${Object.keys(formazioniDaApplicare).length} formazioni dal file`);
    } catch (e) {
      console.warn('Errore caricamento formazioni:', e);
      formazioniDaApplicare = {};
    }
  }
  
  if (!matchDay || !Array.isArray(matchDay.fixtures)) return players;
  
  const formazioni = formazioniDaApplicare || {};
  
  return players.map((player) => {
    if (!player) return player;
    
    const match = matchDay.fixtures.find(
      (f) => f && (f.homeTeam === player.team || f.awayTeam === player.team)
    );
    if (!match) return player;
    
    const isHome = match.homeTeam === player.team;
    const opponent = isHome ? match.awayTeam : match.homeTeam;
    
    const teamFormation = Array.isArray(formazioni[player.team])
      ? formazioni[player.team]
      : [];
    
    const playerSurname = normalizzaNome(player.surname);
    const playerName = normalizzaNome(player.name);
    
    // 🔥 Cerca la percentuale ESATTA
    let percentualeTrovata = 0;
    let matchTrovato = false;
    
    for (const g of teamFormation) {
      const nomeLower = normalizzaNome(g.nome);
      if (!nomeLower) continue;
      
      if (
        (playerSurname && playerSurname.length >= 4 && nomeLower.includes(playerSurname)) ||
        (playerName && playerName.length >= 4 && nomeLower.includes(playerName)) ||
        nomeLower === playerSurname
      ) {
        percentualeTrovata = g.perc;
        matchTrovato = true;
        break;
      }
    }
    
    // 🔥 Applica la percentuale
    let newTitolarita: number;
    if (matchTrovato) {
      newTitolarita = percentualeTrovata >= 100 ? 95 : percentualeTrovata;
    } else {
      newTitolarita = 10;
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
