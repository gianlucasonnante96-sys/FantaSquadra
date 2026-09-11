import { Player, Role } from '../types';
import { allPlayers as fallbackPlayers, serieATeams } from '../data/players';
import { fetchNextMatchday, applyMatchdayData } from './matchdayService';
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
  const r = role.toString().trim().toUpperCase();
  if (r === 'P') return 'P';
  if (r === 'D') return 'D';
  if (r === 'C') return 'C';
  if (r === 'A') return 'A';
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

// ✅ FUNZIONE CORRETTA: Usa indici fissi basati sulla struttura reale del file Excel
// Colonna 0: Id, Colonna 1: R, Colonna 2: RM, Colonna 3: Nome, Colonna 4: Squadra, Colonna 5: Qt.A
function findColumnIndices(headers: string[]): { id: number; role: number; name: number; team: number; qi: number } {
  // Cerca gli indici esatti delle colonne
  const idCol = headers.findIndex(h => h.toString().trim().toLowerCase() === 'id');
  const roleCol = headers.findIndex(h => h.toString().trim().toUpperCase() === 'R'); // Solo "R" esatto
  const nameCol = headers.findIndex(h => h.toString().trim().toLowerCase() === 'nome');
  const teamCol = headers.findIndex(h => h.toString().trim().toLowerCase() === 'squadra');
  const qiCol = headers.findIndex(h => h.toString().trim().toLowerCase() === 'qt.a');
  
  console.log('🔍 DEBUG INDICI TROVATI -> Id:', idCol, 'Ruolo(R):', roleCol, 'Nome:', nameCol, 'Squadra:', teamCol, 'Qt.A:', qiCol);
  console.log('🔍 DEBUG HEADERS:', headers);
  
  return { id: idCol, role: roleCol, name: nameCol, team: teamCol, qi: qiCol };
}

// ✅ Controlla se una riga è un separatore di sezione (da saltare)
function isSeparatorRow(row: any[]): boolean {
  if (!row || row.length === 0) return true;
  const firstCell = (row[0] || '').toString().trim();
  // Riga con "Quotazioni Fantacalcio" o "Calciatori Ceduti"
  if (firstCell.includes('Quotazioni') || firstCell.includes('Calciatori Ceduti')) return true;
  // Riga con "---"
  if (firstCell === '---') return true;
  // Riga vuota
  if (firstCell === '' && row.every(c => !c || c.toString().trim() === '')) return true;
  return false;
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
        
        // ✅ Trova l'header principale
        let headerRowIndex = -1;
        let headers: string[] = [];
        
        for (let i = 0; i < Math.min(20, rows.length); i++) {
          const row = rows[i] as any[];
          if (row && row.length >= 5) {
            const rowText = row.map(c => (c || '').toString().toLowerCase()).join(' ');
            if (rowText.includes('id') && rowText.includes('nome') && rowText.includes('squadra')) {
              headerRowIndex = i;
              headers = row.map(h => (h || '').toString());
              break;
            }
          }
        }
        
        if (headerRowIndex === -1) {
          reject(new Error('Header del file non trovato'));
          return;
        }
        
        // ✅ Trova gli indici delle colonne
        const indices = findColumnIndices(headers);
        
        if (indices.name === -1 || indices.team === -1) {
          reject(new Error('Colonne "Nome" o "Squadra" non trovate'));
          return;
        }
        
        if (indices.role === -1) {
          console.warn('⚠️ Colonna "R" non trovata, uso indice fisso 1');
          indices.role = 1; // Fallback su indice fisso
        }
        
        // Carica gli avversari dall'API
        const fixtures = await fetchNextMatchday();
        
        const rawPlayers: Player[] = [];
        const seenIds = new Set<string>();
        
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i] as any[];
          if (!row || !Array.isArray(row)) continue;
          
          // ✅ Salta le righe separatore
          if (isSeparatorRow(row)) continue;
          
          // ✅ Usa gli indici fissi per leggere i dati
          const nameRaw = row[indices.name];
          if (!nameRaw || nameRaw.toString().trim() === '') continue;
          
          const fullName = nameRaw.toString().trim();
          const team = normalizeTeam(row[indices.team]?.toString() || '');
          
          // ✅ Legge SOLO la colonna "R" (indice 1 o quello trovato)
          const rawRole = row[indices.role]?.toString() || '';
          const role = normalizeRole(rawRole);
          
          const qi = indices.qi >= 0 ? (parseFloat(row[indices.qi]) || 1) : 1;
          const playerId = indices.id >= 0 ? row[indices.id]?.toString() || '' : '';
          
          // Salta se la squadra non è in Serie A
          if (!team || !serieATeams.includes(team)) continue;
          
          // Evita duplicati
          const uniqueId = playerId || `${fullName}_${team}`;
          if (seenIds.has(uniqueId)) continue;
          seenIds.add(uniqueId);
          
          const { name, surname } = splitName(fullName);
          
          rawPlayers.push({
            id: `xl_${name}_${surname}_${team}`.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
            name, surname, team, role,
            fantamedia: estimateFantamedia(qi, role),
            mediaVoto: estimateMediaVoto(qi),
            titolarita: estimateTitolarita(qi),
            forma: [6, 6, 6, 6, 6],
            inCasa: true,
            avversario: 'Da definire',
            difficoltaAvversario: 3,
            cleanSheetOdds: role === 'P' ? (qi > 15 ? 0.5 : 0.3) : 0,
            isStarter: qi > 5,
          });
        }
        
        if (rawPlayers.length === 0) {
          reject(new Error('Nessun giocatore trovato'));
          return;
        }
        
        // Applica automaticamente avversari e titolarità
        const players = rawPlayers.map((p, i) => {
          const qi = rawPlayers[i].fantamedia * 3;
          return applyMatchdayData(p, fixtures, qi);
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

    return { players, status: { source: 'Importazione JSON', lastUpdated: new Date().toLocaleDateString(), playerCount: players.length, isOnline: false, error: null } };
  } catch {
    return null;
  }
}

export function exportToJSON(players: Player[]): string {
  return JSON.stringify(players, null, 2);
}

export function getCurrentStatus(): ListoneStatus {
  const cached = loadFromCache();
  return cached ? cached.status : { source: 'Nessun listone', lastUpdated: null, playerCount: 0, isOnline: false, error: null };
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
  return { players: fallbackPlayers, status: { source: 'Listone Offline', lastUpdated: null, playerCount: fallbackPlayers.length, isOnline: false, error: 'Nessun file caricato.' } };
}
