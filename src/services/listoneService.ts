import { Player, Role } from '../types';
import { allPlayers as fallbackPlayers, serieATeams } from '../data/players';
import { fetchNextMatchday, applyMatchdayData, Fixture } from './matchdayService';
import * as XLSX from 'xlsx';

const TEAM_ALIASES: Record<string, string> = {
  'ATA': 'Atalanta', 'BOL': 'Bologna', 'CAG': 'Cagliari', 'COM': 'Como',
  'FIO': 'Fiorentina', 'FRO': 'Frosinone', 'GEN': 'Genoa', 'INT': 'Inter',
  'JUV': 'Juventus', 'LAZ': 'Lazio', 'LEC': 'Lecce', 'MIL': 'Milan',
  'MON': 'Monza', 'NAP': 'Napoli', 'PAR': 'Parma', 'ROM': 'Roma',
  'SAS': 'Sassuolo', 'TOR': 'Torino', 'UDI': 'Udinese', 'VEN': 'Venezia', 'EMP': 'Empoli',
  'ATALANTA': 'Atalanta', 'BOLOGNA': 'Bologna', 'CAGLIARI': 'Cagliari',
  'COMO': 'Como', 'FIORENTINA': 'Fiorentina', 'FROSINONE': 'Frosinone',
  'GENOA': 'Genoa', 'INTER': 'Inter', 'JUVENTUS': 'Juventus', 'JUVE': 'Juventus',
  'LAZIO': 'Lazio', 'LECCE': 'Lecce', 'MILAN': 'Milan', 'MONZA': 'Monza',
  'NAPOLI': 'Napoli', 'PARMA': 'Parma', 'ROMA': 'Roma', 'SASSUOLO': 'Sassuolo',
  'TORINO': 'Torino', 'UDINESE': 'Udinese', 'VENEZIA': 'Venezia', 'EMPOLI': 'Empoli'
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

// FIX: Ripristinato il vecchio CACHE_KEY per compatibilità con i dati già salvati
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

function normalizeRole(role: string): Role {
  if (!role) return 'C';
  const r = role.trim().toUpperCase().replace(/\./g, ''); // rimuove punti
  
  // Formato lettera singola o abbreviazione
  if (r === 'P' || r === 'POR' || r === 'PORTIERE' || r === 'PORTIERI') return 'P';
  if (r === 'D' || r === 'DIF' || r === 'DIFENSORE' || r === 'DIFENSORI') return 'D';
  if (r === 'C' || r === 'CEN' || r === 'CENTROCAMPISTA' || r === 'CENTROCAMPISTI') return 'C';
  if (r === 'A' || r === 'ATT' || r === 'ATTACCANTE' || r === 'ATTACCANTI') return 'A';
  
  // Formato numerico (usato da alcuni listoni: 1=P, 2=D, 3=C, 4=A)
  if (r === '1') return 'P';
  if (r === '2') return 'D';
  if (r === '3') return 'C';
  if (r === '4') return 'A';
  
  // Fallback: cerca di indovinare dal contenuto
  if (r.includes('PORT')) return 'P';
  if (r.includes('DIF')) return 'D';
  if (r.includes('ATT')) return 'A';
  if (r.includes('CEN')) return 'C';
  
  return 'C';
}

function estimateFantamedia(qi: number, role: Role): number {
  if (role === 'P') return Math.min(2 + qi * 0.1, 5.5);
  if (role === 'D') return Math.min(2 + qi * 0.12, 6);
  if (role === 'C') return Math.min(2.5 + qi * 0.15, 7.5);
  return Math.min(3 + qi * 0.15, 8);
}

function estimateMediaVoto(qi: number): number {
  return Math.min(5.5 + qi * 0.04, 7.2);
}

function estimateTitolarita(qi: number): number {
  if (qi >= 20) return 95;
  if (qi >= 10) return 85;
  if (qi >= 5) return 70;
  if (qi >= 2) return 50;
  return 30;
}

function splitName(fullName: string): { name: string; surname: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { name: '', surname: parts[0] };
  if (parts[0].length <= 3 || parts[0].endsWith('.')) {
    return { name: parts[0].replace('.', ''), surname: parts.slice(1).join(' ') };
  }
  return { name: parts[0], surname: parts.slice(1).join(' ') };
}

function findColumn(headers: string[], patterns: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] || '').toString().toLowerCase().trim();
    for (const pattern of patterns) {
      if (h.includes(pattern.toLowerCase())) return i;
    }
  }
  return -1;
}

export async function parseExcelFile(file: File): Promise<{ players: Player[]; status: ListoneStatus }> {
  return new Promise(async (resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        
        let headerRowIndex = 0;
        let headers: string[] = [];
        for (let i = 0; i < Math.min(10, rows.length); i++) {
          const row = rows[i] as any[];
          if (row && row.length > 3) {
            const rowText = row.join(' ').toLowerCase();
            if (rowText.includes('calciatore') || rowText.includes('nome') || rowText.includes('ruolo')) {
              headerRowIndex = i;
              headers = row.map(h => (h || '').toString());
              break;
            }
          }
        }
        if (headers.length === 0) {
          headers = (rows[0] as any[]).map(h => (h || '').toString());
          headerRowIndex = 0;
        }
        
        const nameCol = findColumn(headers, ['calciatore', 'nome', 'giocatore']);
        const teamCol = findColumn(headers, ['squadra', 'sq', 'team']);
        const roleCol = findColumn(headers, ['ruolo', 'role', 'r.', 'rol']);
        const qiCol = findColumn(headers, ['quotazione', 'qi', 'prezzo']);
        
        if (nameCol === -1) { reject(new Error('Colonna "Calciatore/Nome" non trovata')); return; }
        
        // Carica gli avversari dall'API
        const fixtures = await fetchNextMatchday();
        
        const rawPlayers: Player[] = [];
        for (const row of rows.slice(headerRowIndex + 1)) {
          if (!row || !Array.isArray(row)) continue;
          const nameRaw = row[nameCol];
          if (!nameRaw || nameRaw.toString().trim() === '') continue;
          
          const fullName = nameRaw.toString().trim();
          const team = teamCol >= 0 ? normalizeTeam(row[teamCol]?.toString() || '') : '';
          const role = roleCol >= 0 ? normalizeRole(row[roleCol]?.toString() || 'C') : 'C';
          const qi = qiCol >= 0 ? (parseFloat(row[qiCol]) || 1) : 1;
          
          if (!team || !serieATeams.includes(team)) continue;
          const { name, surname } = splitName(fullName);
          
          rawPlayers.push({
            id: `xl_${name}_${surname}_${team}`.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
            name, surname, team, role,
            fantamedia: estimateFantamedia(qi, role),
            mediaVoto: estimateMediaVoto(qi),
            titolarita: estimateTitolarita(qi),
            forma: [6, 6, 6, 6, 6],
            inCasa: Math.random() > 0.5,
            avversario: 'Da definire',
            difficoltaAvversario: 3,
            cleanSheetOdds: role === 'P' ? (qi > 15 ? 0.5 : 0.3) : 0,
            isStarter: qi > 5,
          });
        }
        
        if (rawPlayers.length === 0) { reject(new Error('Nessun giocatore trovato')); return; }
        
        // Applica automaticamente avversari e titolarità
        const players = rawPlayers.map(p => {
          const qi = rawPlayers.find(r => r.id === p.id);
          const qiValue = qi ? (parseFloat(qi.fantamedia.toString()) * 3) : 1;
          return applyMatchdayData(p, fixtures, qiValue);
        });
        
        resolve({ players, status: { source: 'File Excel', fileName: file.name, lastUpdated: new Date().toLocaleString('it-IT'), playerCount: players.length, isOnline: false, error: null } });
      } catch (err) { reject(new Error(`Errore parsing: ${err instanceof Error ? err.message : 'sconosciuto'}`)); }
    };
    reader.onerror = () => reject(new Error('Errore lettura file'));
    reader.readAsArrayBuffer(file);
  });
}

export function importFromJSON(jsonContent: string): { players: Player[]; status: ListoneStatus } | null {
  try {
    const data = JSON.parse(jsonContent);
    if (!Array.isArray(data) || data.length === 0) return null;
    
    const players: Player[] = data.map((item: any, index: number) => ({
      id: item.id || `import_${index}`,
      name: item.name || '',
      surname: item.surname || '',
      team: item.team || '',
      role: (item.role || 'C') as Role,
      fantamedia: item.fantamedia || 4,
      mediaVoto: item.mediaVoto || item.media || 6,
      titolarita: item.titolarita || 70,
      forma: item.forma || [6, 6, 6, 6, 6],
      inCasa: item.inCasa ?? (Math.random() > 0.5),
      avversario: item.avversario || 'Da definire',
      difficoltaAvversario: item.difficoltaAvversario || 3,
      cleanSheetOdds: item.cleanSheetOdds || 0,
      isStarter: item.isStarter ?? true,
    }));

    return {
      players,
      status: { source: 'Importazione JSON', lastUpdated: new Date().toLocaleDateString(), playerCount: players.length, isOnline: false, error: null }
    };
  } catch {
    return null;
  }
}

export function exportToJSON(players: Player[]): string {
  return JSON.stringify(players, null, 2);
}

// FIX: Ripristinate tutte le funzioni necessarie
export function getCurrentStatus(): ListoneStatus {
  const cached = loadFromCache();
  if (cached) {
    return cached.status;
  }
  return {
    source: 'Nessun listone caricato',
    lastUpdated: null,
    playerCount: 0,
    isOnline: false,
    error: null,
  };
}

export function getPlayers(): Player[] {
  const cached = loadFromCache();
  if (cached && cached.players.length > 0) {
    return cached.players;
  }
  return fallbackPlayers;
}

export function loadListone(): { players: Player[]; status: ListoneStatus } {
  const cached = loadFromCache();
  if (cached && cached.players.length > 0) {
    return { players: cached.players, status: cached.status };
  }
  const fallbackStatus: ListoneStatus = {
    source: 'Listone Offline (hardcoded)',
    lastUpdated: null,
    playerCount: fallbackPlayers.length,
    isOnline: false,
    error: 'Nessun file caricato. Usa il listone hardcoded di esempio.',
  };
  return { players: fallbackPlayers, status: fallbackStatus };
}
