import { Player, Role } from '../types';
import { allPlayers as fallbackPlayers } from '../data/players';
import * as XLSX from 'xlsx';

export const serieATeams = [
  'Atalanta', 'Bologna', 'Cagliari', 'Como', 'Empoli', 'Fiorentina', 'Frosinone',
  'Genoa', 'Inter', 'Juventus', 'Lazio', 'Lecce', 'Milan',
  'Monza', 'Napoli', 'Parma', 'Roma', 'Sassuolo', 'Torino',
  'Udinese', 'Venezia'
];

const TEAM_ALIASES: Record<string, string> = {
  'ATA': 'Atalanta', 'ATALANTA': 'Atalanta',
  'BOL': 'Bologna', 'BOLOGNA': 'Bologna',
  'CAG': 'Cagliari', 'CAGLIARI': 'Cagliari',
  'COM': 'Como', 'COMO': 'Como',
  'FIO': 'Fiorentina', 'FIORENTINA': 'Fiorentina',
  'FRO': 'Frosinone', 'FROSINONE': 'Frosinone',
  'GEN': 'Genoa', 'GENOA': 'Genoa',
  'INT': 'Inter', 'INTER': 'Inter',
  'JUV': 'Juventus', 'JUVENTUS': 'Juventus', 'JUVE': 'Juventus',
  'LAZ': 'Lazio', 'LAZIO': 'Lazio',
  'LEC': 'Lecce', 'LECCE': 'Lecce',
  'MIL': 'Milan', 'MILAN': 'Milan',
  'MON': 'Monza', 'MONZA': 'Monza',
  'NAP': 'Napoli', 'NAPOLI': 'Napoli',
  'PAR': 'Parma', 'PARMA': 'Parma',
  'ROM': 'Roma', 'ROMA': 'Roma',
  'SAS': 'Sassuolo', 'SASSUOLO': 'Sassuolo',
  'TOR': 'Torino', 'TORINO': 'Torino',
  'UDI': 'Udinese', 'UDINESE': 'Udinese',
  'VEN': 'Venezia', 'VENEZIA': 'Venezia',
  'EMP': 'Empoli', 'EMPOLI': 'Empoli'
};

export interface ListoneStatus {
  source: string;
  fileName?: string;
  lastUpdated: string | null;
  playerCount: number;
  isOnline: boolean;
  error: string | null;
}

interface CachedData {
  players: Player[];
  status: ListoneStatus;
  timestamp: number;
}

const CACHE_KEY = 'fanta_listone_cache';

function loadFromCache(): CachedData | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch { return null; }
}

export function saveToCache(players: Player[], status: ListoneStatus): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ players, status, timestamp: Date.now() }));
  } catch {}
}

export function clearCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

function normalizeTeam(team: string): string {
  const upper = team.trim().toUpperCase();
  return TEAM_ALIASES[upper] || team.trim();
}

export async function parseExcelFile(file: File): Promise<{ players: Player[]; status: ListoneStatus }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        
        // 1. Trova la riga di intestazione esatta
        let headerRowIndex = -1;
        let headers: string[] = [];
        
        for (let i = 0; i < Math.min(20, rows.length); i++) {
          const row = rows[i] as any[];
          if (row && row.length >= 5) {
            const rowText = row.map(c => (c || '').toString().toLowerCase()).join(' ');
            if (rowText.includes('id') && rowText.includes('nome') && rowText.includes('squadra') && rowText.includes(' r ')) {
              headerRowIndex = i;
              headers = row.map(h => (h || '').toString().trim());
              break;
            }
          }
        }
        
        if (headerRowIndex === -1) {
          reject(new Error('Intestazione del file non trovata. Usa il listone ufficiale Fantacalcio.it'));
          return;
        }
        
        // 2. Mappa gli indici delle colonne
        const colId = headers.findIndex(h => h.toLowerCase() === 'id');
        const colR = headers.findIndex(h => h.toUpperCase() === 'R');
        const colNome = headers.findIndex(h => h.toLowerCase() === 'nome');
        const colSquadra = headers.findIndex(h => h.toLowerCase() === 'squadra');
        const colQtA = headers.findIndex(h => h.toLowerCase() === 'qt.a');
        const colFVM = headers.findIndex(h => h.toLowerCase() === 'fvm');
        
        if (colNome === -1 || colSquadra === -1 || colR === -1) {
          reject(new Error('Colonne necessarie (Id, R, Nome, Squadra) non trovate.'));
          return;
        }

        const players: Player[] = [];
        const seenIds = new Set<string>();

        // 3. Estrai i giocatori
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i] as any[];
          if (!row || row.length === 0) continue;
          
          const firstCell = (row[0] || '').toString().trim();
          // Salta righe di separazione o sezioni
          if (firstCell === '' || firstCell.includes('Quotazioni') || firstCell.includes('Ceduti') || 
              ['Portieri', 'Difensori', 'Centrocampisti', 'Attaccanti'].includes(firstCell) || firstCell === '---') {
            continue;
          }
          
          const nomeRaw = row[colNome];
          if (!nomeRaw || nomeRaw.toString().trim() === '') continue;
          
          const nome = nomeRaw.toString().trim();
          const squadraRaw = colSquadra >= 0 ? row[colSquadra]?.toString().trim() : '';
          const rRaw = colR >= 0 ? row[colR]?.toString().trim().toUpperCase() : 'C';
          const qtA = colQtA >= 0 ? (parseFloat(row[colQtA]) || 1) : 1;
          const fvm = colFVM >= 0 ? (parseFloat(row[colFVM]) || 60) : 60; // FVM è tipo 85, quindi /10 = 8.5
          const idRaw = colId >= 0 ? row[colId]?.toString().trim() : '';
          
          const squadra = normalizeTeam(squadraRaw);
          if (!squadra || !serieATeams.includes(squadra)) continue;
          
          // Ruolo dalla colonna "R" (P, D, C, A)
          let role: Role = 'C';
          if (rRaw === 'P') role = 'P';
          else if (rRaw === 'D') role = 'D';
          else if (rRaw === 'C') role = 'C';
          else if (rRaw === 'A') role = 'A';
          
          const uniqueId = idRaw || `${nome}_${squadra}`;
          if (seenIds.has(uniqueId)) continue;
          seenIds.add(uniqueId);
          
          const parts = nome.split(' ');
          const surname = parts.pop() || '';
          const name = parts.join(' ');
          
          players.push({
            id: `xl_${name}_${surname}_${squadra}`.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
            name: name || surname,
            surname: surname,
            team: squadra,
            role: role,
            fantamedia: role === 'P' ? Math.min(2 + qtA * 0.1, 5.5) : Math.min(3 + qtA * 0.15, 8),
            mediaVoto: fvm > 0 ? fvm / 10 : 6, // Converte 85 -> 8.5
            titolarita: qtA >= 15 ? 95 : qtA >= 8 ? 80 : qtA >= 3 ? 50 : 20,
            forma: [6, 6, 6, 6, 6],
            inCasa: Math.random() > 0.5,
            avversario: 'Da definire',
            difficoltaAvversario: 3,
            cleanSheetOdds: role === 'P' ? (qtA > 10 ? 0.5 : 0.3) : 0,
            isStarter: qtA > 5,
          });
        }
        
        if (players.length === 0) {
          reject(new Error('Nessun giocatore valido trovato nel file.'));
          return;
        }
        
        resolve({ 
          players, 
          status: { 
            source: 'File Excel', 
            fileName: file.name, 
            lastUpdated: new Date().toLocaleString('it-IT'), 
            playerCount: players.length, 
            isOnline: false, 
            error: null 
          } 
        });
      } catch (err) {
        reject(new Error(`Errore nel parsing: ${err instanceof Error ? err.message : 'sconosciuto'}`));
      }
    };
    reader.onerror = () => reject(new Error('Errore nella lettura del file'));
    reader.readAsArrayBuffer(file);
  });
}

export function importFromJSON(jsonContent: string): { players: Player[]; status: ListoneStatus } | null {
  try {
    const data = JSON.parse(jsonContent);
    if (!Array.isArray(data) || data.length === 0) return null;
    return {
      players: data.map((item: any, i: number) => ({ ...item, id: item.id || `import_${i}` })),
      status: { source: 'JSON', lastUpdated: new Date().toLocaleString('it-IT'), playerCount: data.length, isOnline: false, error: null }
    };
  } catch { return null; }
}

export function exportToJSON(players: Player[]): string {
  return JSON.stringify(players, null, 2);
}

export function getPlayers(): Player[] {
  const cached = loadFromCache();
  return (cached && cached.players.length > 0) ? cached.players : fallbackPlayers;
}

export function loadListone(): { players: Player[]; status: ListoneStatus } {
  const cached = loadFromCache();
  if (cached && cached.players.length > 0) {
    return { players: cached.players, status: cached.status };
  }
  return { 
    players: fallbackPlayers, 
    status: { source: 'Listone Offline', lastUpdated: null, playerCount: fallbackPlayers.length, isOnline: false, error: 'Nessun file caricato.' } 
  };
}
