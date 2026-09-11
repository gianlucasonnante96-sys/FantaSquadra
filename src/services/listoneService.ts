import { Player, Role } from '../types';

const CACHE_KEY = 'fanta_listone_cache';

export interface ListoneStatus {
  source: string;
  lastUpdated: string | null;
  playerCount: number;
  isOnline: boolean;
  error?: string;
  fileName?: string;
}

interface CachedData {
  players: Player[];
  status: ListoneStatus;
}

const serieATeams = [
  'Atalanta', 'Bologna', 'Cagliari', 'Como', 'Fiorentina', 'Frosinone',
  'Genoa', 'Inter', 'Juventus', 'Lazio', 'Lecce', 'Milan',
  'Monza', 'Napoli', 'Parma', 'Roma', 'Sassuolo', 'Torino',
  'Udinese', 'Venezia'
];

function loadFromCache(): CachedData | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

export function saveToCache(players: Player[], status: ListoneStatus) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ players, status }));
}

export function clearCache() {
  localStorage.removeItem(CACHE_KEY);
}

export function getPlayers(): Player[] {
  const cached = loadFromCache();
  return cached?.players.length ? cached.players : [];
}

export function loadListone(): { players: Player[]; status: ListoneStatus } {
  const cached = loadFromCache();
  if (cached && cached.players.length > 0) {
    return { players: cached.players, status: cached.status };
  }
  return { 
    players: [], 
    status: { source: 'Nessun dato', lastUpdated: null, playerCount: 0, isOnline: false, error: 'Carica un listone per iniziare.' } 
  };
}

// FIX 2: Miglioramento stima titolarità
function estimateTitolarita(qi: number): number {
  if (qi >= 15) return 95;
  if (qi >= 10) return 85;
  if (qi >= 6) return 70;
  if (qi >= 3) return 50;
  if (qi >= 1) return 20;
  return 10;
}

function estimateFantamedia(qi: number, role: string): number {
  const base = qi * 0.3;
  if (role === 'P') return base + 1;
  if (role === 'D') return base + 1.5;
  if (role === 'C') return base + 2;
  return base + 2.5;
}

function estimateMediaVoto(qi: number): number {
  return Math.min(7.5, 5.5 + (qi * 0.15));
}

function normalizeTeam(team: string): string {
  const map: Record<string, string> = {
    'atalanta': 'Atalanta', 'bologna': 'Bologna', 'cagliari': 'Cagliari', 'como': 'Como',
    'fiorentina': 'Fiorentina', 'frosinone': 'Frosinone', 'genoa': 'Genoa', 'inter': 'Inter',
    'juventus': 'Juventus', 'lazio': 'Lazio', 'lecce': 'Lecce', 'milan': 'Milan',
    'monza': 'Monza', 'napoli': 'Napoli', 'parma': 'Parma', 'roma': 'Roma',
    'sassuolo': 'Sassuolo', 'torino': 'Torino', 'udinese': 'Udinese', 'venezia': 'Venezia'
  };
  return map[team.toLowerCase().trim()] || team;
}

function normalizeRole(role: string): Role {
  const r = role.toUpperCase().trim();
  if (r === 'P' || r === 'POR') return 'P';
  if (r === 'D' || r === 'DIF') return 'D';
  if (r === 'C' || r === 'CEN') return 'C';
  if (r === 'A' || r === 'ATT') return 'A';
  return 'C';
}

function splitName(fullName: string): { name: string; surname: string } {
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return { name: '', surname: parts[0] };
  return { name: parts.slice(0, -1).join(' '), surname: parts[parts.length - 1] };
}

export function parseExcelFile(file: File): Promise<{ players: Player[]; status: ListoneStatus }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        // Nota: Qui serve la libreria xlsx. Assumiamo sia importata globalmente o gestita dal componente.
        // Per semplicità, questo è uno scheletro. Se usi xlsx, importa * as XLSX da 'xlsx' in cima.
        reject(new Error('Usa la funzione di importazione nel componente Roster che gestisce XLSX'));
      } catch (err) {
        reject(err);
      }
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
      avversario: item.avversario || 'Da definire', // FIX 2: Non più Atalanta di default
      difficoltaAvversario: item.difficoltaAvversario || 3,
      cleanSheetOdds: item.cleanSheetOdds || 0,
      isStarter: item.isStarter ?? true,
    }));

    return {
      players,
      status: { source: 'Importazione JSON', lastUpdated: new Date().toLocaleDateString(), playerCount: players.length, isOnline: false }
    };
  } catch {
    return null;
  }
}

export function exportToJSON(players: Player[]): string {
  return JSON.stringify(players, null, 2);
}
