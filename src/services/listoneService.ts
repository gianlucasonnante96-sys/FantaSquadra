import { Player, Role } from '../types';
import listoneData from '../data/listone.json';
import statisticheData from '../data/statistiche.json';

// ============================================================
// TIPI
// ============================================================

interface GiocatoreListone {
  nome: string;
  squadra: string;
  ruolo: string;
  quotazioneIniziale: number;
  quotazioneAttuale: number;
  fvm: number;
}

interface ListoneFile {
  aggiornato: string;
  fonte: string;
  giocatori: GiocatoreListone[];
}

interface StatisticheFile {
  aggiornato: string;
  fonte: string;
  statistiche: Record<string, {
    forma: number[];
    mediaVoto: number;
    fantamedia: number;
  }>;
}

export interface ListoneStatus {
  source: string;
  lastUpdated: string | null;
  playerCount: number;
  isOnline: boolean;
  error: string | null;
}

// ============================================================
// UTILITY
// ============================================================

function safeString(valore: unknown): string {
  if (typeof valore === 'string') return valore;
  if (valore === null || valore === undefined) return '';
  try {
    return String(valore);
  } catch {
    return '';
  }
}

const SIGLA_TO_NOME: Record<string, string> = {
  'ATA': 'Atalanta', 'BOL': 'Bologna', 'CAG': 'Cagliari', 'COM': 'Como',
  'FIO': 'Fiorentina', 'FRO': 'Frosinone', 'GEN': 'Genoa', 'INT': 'Inter',
  'JUV': 'Juventus', 'LAZ': 'Lazio', 'LEC': 'Lecce', 'MIL': 'Milan',
  'MON': 'Monza', 'NAP': 'Napoli', 'PAR': 'Parma', 'ROM': 'Roma',
  'SAS': 'Sassuolo', 'TOR': 'Torino', 'UDI': 'Udinese', 'VEN': 'Venezia',
};

function normalizzaTeam(team: string | undefined | null): string {
  const safe = safeString(team).trim().toUpperCase();
  if (!safe) return '';
  if (SIGLA_TO_NOME[safe]) return SIGLA_TO_NOME[safe];
  return safe.charAt(0).toUpperCase() + safe.slice(1).toLowerCase();
}

function normalizzaRole(ruolo: string | undefined | null): Role {
  const r = safeString(ruolo).trim().toUpperCase();
  if (!r) return 'C';
  
  for (const char of r) {
    if (char === 'P') return 'P';
    if (char === 'D') return 'D';
    if (char === 'C') return 'C';
    if (char === 'A') return 'A';
  }
  
  if (r.includes('POR')) return 'P';
  if (r.includes('DIF')) return 'D';
  if (r.includes('ATT')) return 'A';
  return 'C';
}

function splitName(fullName: string): { name: string; surname: string } {
  const safe = safeString(fullName).trim();
  if (!safe) return { name: '', surname: '' };
  
  const parts = safe.split(/\s+/);
  if (parts.length === 1) return { name: '', surname: parts[0] };
  
  if (parts[0].length <= 3 || parts[0].endsWith('.')) {
    return { 
      name: parts[0].replace('.', ''), 
      surname: parts.slice(1).join(' ') 
    };
  }
  
  return { 
    name: parts[0], 
    surname: parts.slice(1).join(' ') 
  };
}

function estimateTitolarita(qa: number): number {
  if (qa >= 20) return 90;
  if (qa >= 10) return 80;
  if (qa >= 5) return 65;
  if (qa >= 2) return 50;
  return 30;
}

// ============================================================
// RICERCA STATISTICHE
// ============================================================

function cercaStatistiche(nome: string): { forma: number[]; mediaVoto: number; fantamedia: number } | null {
  try {
    const dati = statisticheData as unknown as StatisticheFile;
    if (!dati || !dati.statistiche) return null;
    
    const nomeNorm = nome.toLowerCase().trim();
    if (!nomeNorm) return null;
    
    // 1. Match esatto
    for (const [key, value] of Object.entries(dati.statistiche)) {
      const keyNorm = key.toLowerCase().trim();
      if (keyNorm === nomeNorm) return value;
    }
    
    // 2. Match parziale (il nome nel listone è abbreviato)
    for (const [key, value] of Object.entries(dati.statistiche)) {
      const keyNorm = key.toLowerCase().trim();
      if (keyNorm.includes(nomeNorm) || nomeNorm.includes(keyNorm)) {
        return value;
      }
    }
    
    // 3. Match per cognome (ultima parola)
    const parti = nomeNorm.split(' ');
    const cognome = parti[parti.length - 1];
    if (cognome.length >= 4) {
      for (const [key, value] of Object.entries(dati.statistiche)) {
        const keyNorm = key.toLowerCase().trim();
        if (keyNorm.includes(cognome)) return value;
      }
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

// ============================================================
// CARICAMENTO LISTONE
// ============================================================

export function loadListone(): { players: Player[]; status: ListoneStatus } {
  try {
    const dati = listoneData as unknown as ListoneFile;
    
    if (!dati || !Array.isArray(dati.giocatori) || dati.giocatori.length === 0) {
      console.warn('⚠️ listone.json vuoto o malformato');
      return {
        players: [],
        status: {
          source: 'Listone non disponibile',
          lastUpdated: null,
          playerCount: 0,
          isOnline: false,
          error: 'Il listone non è stato ancora caricato dal workflow',
        }
      };
    }
    
    const players: Player[] = dati.giocatori.map((g, index) => {
      const team = normalizzaTeam(g.squadra);
      const role = normalizzaRole(g.ruolo);
      const { name, surname } = splitName(g.nome);
      
      // Cerca statistiche per forma/media voto/fantamedia
      const stats = cercaStatistiche(g.nome);
      
      const forma = stats?.forma || [6, 6, 6, 6, 6];
      const mediaVoto = stats?.mediaVoto || 6;
      const fantamedia = stats?.fantamedia || 0;
      
      const titolarita = estimateTitolarita(g.quotazioneAttuale);
      
      const id = `fanta_${name}_${surname}_${team}_${index}`
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      
      return {
        id,
        name,
        surname,
        team,
        role,
        fantamedia,
        mediaVoto,
        titolarita,
        forma,
        inCasa: true,
        avversario: '',
        difficoltaAvversario: 3,
        cleanSheetOdds: role === 'P' ? 0.35 : 0,
        isStarter: g.quotazioneAttuale > 3,
      };
    });
    
    console.log(`✅ Listone caricato: ${players.length} giocatori`);
    
    return {
      players,
      status: {
        source: 'Listone Ufficiale Fantacalcio.it',
        lastUpdated: dati.aggiornato || null,
        playerCount: players.length,
        isOnline: false,
        error: null,
      }
    };
  } catch (e) {
    console.error('Errore lettura listone.json:', e);
    return {
      players: [],
      status: {
        source: 'Errore listone',
        lastUpdated: null,
        playerCount: 0,
        isOnline: false,
        error: e instanceof Error ? e.message : 'Errore sconosciuto',
      }
    };
  }
}

// ============================================================
// COMPATIBILITÀ
// ============================================================

export function getPlayers(): Player[] {
  const { players } = loadListone();
  return players;
}

export function getCurrentStatus(): ListoneStatus {
  const { status } = loadListone();
  return status;
}

export function saveToCache(_players: Player[], _status: ListoneStatus): void {
  console.log('ℹ️ saveToCache disabilitato');
}

export function clearCache(): void {
  console.log('ℹ️ clearCache disabilitato');
}

export function parseExcelFile(_file: File): Promise<{ players: Player[]; status: ListoneStatus }> {
  return Promise.reject(new Error('Upload manuale disabilitato.'));
}

export function importFromJSON(_jsonContent: string): { players: Player[]; status: ListoneStatus } | null {
  console.warn('⚠️ importFromJSON disabilitato');
  return null;
}

export function exportToJSON(players: Player[]): string {
  return JSON.stringify(players, null, 2);
}

// ============================================================
// AVVERSARI
// ============================================================

import { getAvversario } from './calendarService';

export function updateAvversari(players: Player[], giornata: number): Player[] {
  if (!Array.isArray(players)) return [];
  
  return players.map(player => {
    if (!player) return player;
    
    try {
      const team = safeString(player.team);
      if (!team) return player;
      
      const avversarioInfo = getAvversario(team, giornata);
      
      if (avversarioInfo) {
        return {
          ...player,
          avversario: avversarioInfo.avversario,
          inCasa: avversarioInfo.inCasa,
        };
      }
    } catch (e) {
      console.warn('Errore getAvversario per', player?.team, e);
    }
    
    return player;
  });
}

export function getPlayersWithAvversari(giornata: number): Player[] {
  try {
    const players = getPlayers();
    return updateAvversari(players, giornata);
  } catch (e) {
    console.error('Errore getPlayersWithAvversari:', e);
    return getPlayers();
  }
}
