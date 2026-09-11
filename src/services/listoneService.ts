
import { Player, Role } from '../types';
import { allPlayers as fallbackPlayers, serieATeams } from '../data/players';
import * as XLSX from 'xlsx';
import { getAvversario } from './calendarService';

// Mappa abbreviazioni squadre fantacalcio.it -> nome completo
const TEAM_ABBR: Record<string, string> = {
  'ATA': 'Atalanta', 'BOL': 'Bologna', 'CAG': 'Cagliari', 'COM': 'Como',
  'FIO': 'Fiorentina', 'FRO': 'Frosinone', 'GEN': 'Genoa', 'INT': 'Inter',
  'JUV': 'Juventus', 'LAZ': 'Lazio', 'LEC': 'Lecce', 'MIL': 'Milan',
  'MON': 'Monza', 'NAP': 'Napoli', 'PAR': 'Parma', 'ROM': 'Roma',
  'SAS': 'Sassuolo', 'TOR': 'Torino', 'UDI': 'Udinese', 'VEN': 'Venezia',
};

// Alias per nomi squadra che potrebbero apparire nei file Excel
const TEAM_ALIASES: Record<string, string> = {
  ...TEAM_ABBR,
  'ATALANTA': 'Atalanta', 'BOLOGNA': 'Bologna', 'CAGLIARI': 'Cagliari',
  'COMO': 'Como', 'FIORENTINA': 'Fiorentina', 'FROSINONE': 'Frosinone',
  'GENOA': 'Genoa', 'INTER': 'Inter', 'JUVENTUS': 'Juventus', 'JUVE': 'Juventus',
  'LAZIO': 'Lazio', 'LECCE': 'Lecce', 'MILAN': 'Milan', 'MONZA': 'Monza',
  'NAPOLI': 'Napoli', 'PARMA': 'Parma', 'ROMA': 'Roma', 'SASSUOLO': 'Sassuolo',
  'TORINO': 'Torino', 'UDINESE': 'Udinese', 'VENEZIA': 'Venezia',
  // Varianti con spazi o caratteri speciali
  'A C MILAN': 'Milan', 'AC MILAN': 'Milan', 'INTERNAZIONALE': 'Inter',
  'HELLAS VERONA': 'Verona', 'VERONA': 'Verona', 'H VERONA': 'Verona',
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

const CACHE_KEY = 'fantaconsiglio_listone_cache';

// Carica i dati dalla cache localStorage
function loadFromCache(): CachedData | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const data: CachedData = JSON.parse(cached);
    return data;
  } catch {
    return null;
  }
}

// Salva i dati nella cache localStorage
export function saveToCache(players: Player[], status: ListoneStatus): void {
  try {
    const data: CachedData = {
      players,
      status,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // localStorage non disponibile o pieno
  }
}

// Elimina la cache
export function clearCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

// Normalizza il nome della squadra
function normalizeTeam(team: string): string {
  const trimmed = team.trim();
  const upper = trimmed.toUpperCase();

  // Match esatto
  if (TEAM_ALIASES[upper]) {
    return TEAM_ALIASES[upper];
  }

  // Match parziale (cerca se il nome della squadra è contenuto in uno degli alias)
  for (const [alias, fullName] of Object.entries(TEAM_ALIASES)) {
    if (upper.includes(alias) || alias.includes(upper)) {
      return fullName;
    }
  }

  // Match con le squadre Serie A (cerca se il nome è contenuto)
  for (const serieATeam of serieATeams) {
    if (upper.includes(serieATeam.toUpperCase()) || serieATeam.toUpperCase().includes(upper)) {
      return serieATeam;
    }
  }

  // Se non trova nulla, ritorna il nome originale
  return trimmed;
}

// Determina il ruolo da una stringa
function normalizeRole(role: string): Role {
  const r = role.trim().toUpperCase();
  // Portieri
  if (r === 'P' || r === 'POR' || r === 'PORTIERE' || r === 'P' || r.startsWith('P')) return 'P';
  // Difensori
  if (r === 'D' || r === 'DIF' || r === 'DIFENSORE' || r === 'D' || r.startsWith('D')) return 'D';
  // Attaccanti
  if (r === 'A' || r === 'ATT' || r === 'ATTACCANTE' || r === 'A' || r.startsWith('A')) return 'A';
  // Centrocampisti (default se non riconosciuto)
  if (r === 'C' || r === 'CEN' || r === 'CENTROCAMPISTA' || r === 'C' || r.startsWith('C')) return 'C';
  // Fallback: cerca di dedurre dal contenuto
  if (r.includes('POR')) return 'P';
  if (r.includes('DIF')) return 'D';
  if (r.includes('ATT')) return 'A';
  if (r.includes('CEN')) return 'C';
  return 'C';
}

// Stima la fantamedia dalla quotazione
function estimateFantamedia(qi: number, role: Role): number {
  if (role === 'P') return Math.min(2 + qi * 0.1, 5.5);
  if (role === 'D') return Math.min(2 + qi * 0.12, 6);
  if (role === 'C') return Math.min(2.5 + qi * 0.15, 7.5);
  return Math.min(3 + qi * 0.15, 8);
}

// Stima la media voto dalla quotazione
function estimateMediaVoto(qi: number): number {
  return Math.min(5.5 + qi * 0.04, 7.2);
}

// Stima la titolarità dalla quotazione
function estimateTitolarita(qi: number): number {
  if (qi >= 20) return 95;
  if (qi >= 10) return 85;
  if (qi >= 5) return 70;
  if (qi >= 2) return 50;
  return 30;
}

// Separa nome completo in nome e cognome
function splitName(fullName: string): { name: string; surname: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { name: '', surname: parts[0] };
  // Se il primo elemento è corto (iniziale o nome breve), è il nome
  if (parts[0].length <= 3 || parts[0].endsWith('.')) {
    return { name: parts[0].replace('.', ''), surname: parts.slice(1).join(' ') };
  }
  return { name: parts[0], surname: parts.slice(1).join(' ') };
}

// Trova la colonna nel foglio Excel (case-insensitive, con fuzzy matching)
function findColumn(headers: string[], patterns: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] || '').toString().toLowerCase().trim();
    for (const pattern of patterns) {
      if (h.includes(pattern.toLowerCase())) return i;
    }
  }
  return -1;
}

// Parsa un file Excel e restituisce i giocatori
export function parseExcelFile(file: File): Promise<{ players: Player[]; status: ListoneStatus }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Usa il primo foglio
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Converti in array di array
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

        if (rows.length < 2) {
          reject(new Error('Il file è vuoto o non contiene dati'));
          return;
        }

        // Trova l'header (prima riga con testo)
        let headerRowIndex = 0;
        let headers: string[] = [];

        // Cerca l'header in modo più flessibile
        for (let i = 0; i < Math.min(15, rows.length); i++) {
          const row = rows[i] as any[];
          if (row && row.length > 2) {
            const rowText = row.join(' ').toLowerCase();
            // Cerca parole chiave che indicano un header
            if (rowText.includes('calciatore') || rowText.includes('nome') ||
                rowText.includes('giocatore') || rowText.includes('ruolo') ||
                rowText.includes('squadra') || rowText.includes('quotazione') ||
                rowText.includes('fantamedia') || rowText.includes('media')) {
              headerRowIndex = i;
              headers = row.map(h => (h || '').toString());
              console.log('Header trovato alla riga', i, ':', headers);
              break;
            }
          }
        }

        // Se non trova un header chiaro, usa la prima riga non vuota
        if (headers.length === 0) {
          for (let i = 0; i < Math.min(5, rows.length); i++) {
            const row = rows[i] as any[];
            if (row && row.length > 2 && row.some(cell => cell && cell.toString().trim())) {
              headers = row.map(h => (h || '').toString());
              headerRowIndex = i;
              console.log('Usando prima riga come header:', headers);
              break;
            }
          }
        }

        // Trova le colonne
        const nameCol = findColumn(headers, ['calciatore', 'nome', 'giocatore', 'player', 'cognome']);
        const teamCol = findColumn(headers, ['squadra', 'sq', 'team', 'società', 'societa']);
        const roleCol = findColumn(headers, ['ruolo cl', 'ruolo classic', 'ruolo', 'role', 'rl']);
        const qiCol = findColumn(headers, ['quotazione iniziale', 'qi', 'quotazione attuale', 'qa', 'quotazione', 'prezzo', 'value', 'fvm']);

        if (nameCol === -1) {
          reject(new Error('Colonna "Calciatore/Nome" non trovata nel file'));
          return;
        }

        // Se non troviamo la colonna del ruolo, proviamo a cercarla in modo più intelligente
        let effectiveRoleCol = roleCol;
        if (effectiveRoleCol === -1) {
          // Cerca una colonna che contenga solo P, D, C, A
          for (let i = 0; i < headers.length; i++) {
            if (i === nameCol || i === teamCol || i === qiCol) continue;
            // Controlla le prime 10 righe di dati
            let validRoles = 0;
            for (let j = headerRowIndex + 1; j < Math.min(headerRowIndex + 11, rows.length); j++) {
              const val = (rows[j] as any[])?.[i]?.toString().trim().toUpperCase();
              if (val === 'P' || val === 'D' || val === 'C' || val === 'A') {
                validRoles++;
              }
            }
            // Se almeno il 50% delle righe ha un ruolo valido, è probabilmente la colonna del ruolo
            if (validRoles >= 5) {
              effectiveRoleCol = i;
              break;
            }
          }
        }

        const players: Player[] = [];
        const dataRows = rows.slice(headerRowIndex + 1);
        let skippedRows = 0;

        console.log('Inizio parsing:', dataRows.length, 'righe di dati');
        console.log('Colonne trovate - Nome:', nameCol, 'Squadra:', teamCol, 'Ruolo:', effectiveRoleCol, 'Quotazione:', qiCol);

        for (const row of dataRows) {
          if (!row || !Array.isArray(row)) {
            skippedRows++;
            continue;
          }

          const nameRaw = row[nameCol];
          if (!nameRaw || nameRaw.toString().trim() === '') {
            skippedRows++;
            continue;
          }

          const fullName = nameRaw.toString().trim();
          const teamRaw = teamCol >= 0 ? row[teamCol]?.toString() || '' : '';
          const team = normalizeTeam(teamRaw);
          const role = effectiveRoleCol >= 0 ? normalizeRole(row[effectiveRoleCol]?.toString() || 'C') : 'C';
          const qi = qiCol >= 0 ? (parseFloat(row[qiCol]) || 1) : 1;

          // Non filtrare per squadra - carica tutti i giocatori
          // if (!team || !serieATeams.includes(team)) continue;

          const { name, surname } = splitName(fullName);

          players.push({
            id: `xl_${name}_${surname}_${team}`.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
            name,
            surname,
            team,
            role,
            fantamedia: estimateFantamedia(qi, role),
            mediaVoto: estimateMediaVoto(qi),
            titolarita: estimateTitolarita(qi),
            forma: [6, 6, 6, 6, 6],
            inCasa: true,
            avversario: serieATeams[0],
            difficoltaAvversario: 3,
            cleanSheetOdds: role === 'P' ? 0.35 : 0,
            isStarter: qi > 3,
          });
        }

        console.log('Parsing completato:', players.length, 'giocatori caricati,', skippedRows, 'righe scartate');

        if (players.length === 0) {
          reject(new Error(`Nessun giocatore trovato nel file. Controlla che il formato sia corretto. Righe totali: ${dataRows.length}, Righe scartate: ${skippedRows}`));
          return;
        }

        const status: ListoneStatus = {
          source: 'File Excel',
          fileName: file.name,
          lastUpdated: new Date().toLocaleString('it-IT'),
          playerCount: players.length,
          isOnline: false,
          error: null,
        };

        resolve({ players, status });
      } catch (err) {
        reject(new Error(`Errore nel parsing del file: ${err instanceof Error ? err.message : 'sconosciuto'}`));
      }
    };

    reader.onerror = () => reject(new Error('Errore nella lettura del file'));
    reader.readAsArrayBuffer(file);
  });
}

// Importa da JSON
export function importFromJSON(jsonContent: string): { players: Player[]; status: ListoneStatus } | null {
  try {
    const data = JSON.parse(jsonContent);

    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

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
      inCasa: item.inCasa ?? true,
      avversario: item.avversario || serieATeams[0],
      difficoltaAvversario: item.difficoltaAvversario || 3,
      cleanSheetOdds: item.cleanSheetOdds || 0,
      isStarter: item.isStarter ?? true,
    }));

    const status: ListoneStatus = {
      source: 'File JSON',
      lastUpdated: new Date().toLocaleString('it-IT'),
      playerCount: players.length,
      isOnline: false,
      error: null,
    };

    return { players, status };
  } catch {
    return null;
  }
}

// Esporta i dati attuali in formato JSON
export function exportToJSON(players: Player[]): string {
  return JSON.stringify(players, null, 2);
}

// Ottieni lo stato attuale dei dati
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

// Ottieni i giocatori dalla cache o dal fallback
export function getPlayers(): Player[] {
  const cached = loadFromCache();
  if (cached && cached.players.length > 0) {
    return cached.players;
  }
  return fallbackPlayers;
}

// Carica il listone (dalla cache o fallback)
export function loadListone(): { players: Player[]; status: ListoneStatus } {
  const cached = loadFromCache();
  if (cached && cached.players.length > 0) {
    return { players: cached.players, status: cached.status };
  }
  // Fallback ai dati hardcoded
  const fallbackStatus: ListoneStatus = {
    source: 'Listone Offline (hardcoded)',
    lastUpdated: null,
    playerCount: fallbackPlayers.length,
    isOnline: false,
    error: 'Nessun file caricato. Usa il listone hardcoded di esempio.',
  };
  return { players: fallbackPlayers, status: fallbackStatus };
}

// Aggiorna i giocatori con le avversarie corrette in base alla giornata
export function updateAvversari(players: Player[], giornata: number): Player[] {
  return players.map(player => {
    const avversarioInfo = getAvversario(player.team, giornata);

    if (avversarioInfo) {
      return {
        ...player,
        avversario: avversarioInfo.avversario,
        inCasa: avversarioInfo.inCasa,
      };
    }

    return player;
  });
}

// Ottieni i giocatori con avversarie aggiornate per una giornata specifica
export function getPlayersWithAvversari(giornata: number): Player[] {
  const players = getPlayers();
  return updateAvversari(players, giornata);
}
