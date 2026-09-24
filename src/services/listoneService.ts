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

interface StatisticaGiocatore {
  ruolo: string;
  squadra: string;
  mediaVoto: number;
  fantamedia: number;
  partiteGiocate: number;
}

interface StatisticheFile {
  aggiornato: string;
  fonte: string;
  statistiche: Record<string, StatisticaGiocatore>;
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
  try { return String(valore); } catch { return ''; }
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
    return { name: parts[0].replace('.', ''), surname: parts.slice(1).join(' ') };
  }
  return { name: parts[0], surname: parts.slice(1).join(' ') };
}

function estimateTitolarita(qa: number): number {
  if (qa >= 20) return 90;
  if (qa >= 10) return 80;
  if (qa >= 5) return 65;
  if (qa >= 2) return 50;
  return 30;
}

function normalizzaChiaveId(valore: string): string {
  return safeString(valore)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function cercaStatistiche(nomeListone: string): StatisticaGiocatore | null {
  try {
    const dati = statisticheData as unknown as StatisticheFile;
    if (!dati || !dati.statistiche) return null;

    const nomeNorm = nomeListone.toLowerCase().trim();
    if (!nomeNorm) return null;

    for (const [key, value] of Object.entries(dati.statistiche)) {
      if (key.toLowerCase().trim() === nomeNorm) return value;
    }

    const partiListone = nomeNorm.split(/\s+/);
    const cognomeListone = partiListone[partiListone.length - 1];

    if (cognomeListone.length >= 4) {
      for (const [key, value] of Object.entries(dati.statistiche)) {
        const keyNorm = key.toLowerCase().trim();
        const partiKey = keyNorm.split(/\s+/);
        const cognomeKey = partiKey[partiKey.length - 1];

        if (cognomeListone === cognomeKey || keyNorm.includes(cognomeListone)) {
          return value;
        }
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

    let matchTrovati = 0;
    let fmAccettate = 0;
    let fmRifiutate = 0;

    const players: Player[] = dati.giocatori.map((g) => {
      const team = normalizzaTeam(g.squadra);
      const role = normalizzaRole(g.ruolo);
      const { name, surname } = splitName(g.nome);

      const stats = cercaStatistiche(g.nome);

      let mediaVoto = 6;
      let fantamedia = 0;
      let partiteGiocate = 0;

      if (stats) {
        matchTrovati++;

        if (stats.mediaVoto > 0 && stats.mediaVoto <= 10) {
          mediaVoto = stats.mediaVoto;
        }

        if (stats.fantamedia > 0 && stats.fantamedia <= 20) {
          fantamedia = stats.fantamedia;
          fmAccettate++;
        } else if (stats.fantamedia === 0) {
          fmRifiutate++;
        }

        // 🆕 partite giocate: serve per pesare l'affidabilità della FM
        if (typeof stats.partiteGiocate === 'number' && stats.partiteGiocate >= 0) {
          partiteGiocate = stats.partiteGiocate;
        }
      }

      const titolarita = estimateTitolarita(g.quotazioneAttuale);

      const id = `fanta_${normalizzaChiaveId(name)}_${normalizzaChiaveId(surname)}_${normalizzaChiaveId(team)}`;

      return {
        id,
        name,
        surname,
        team,
        role,
        fantamedia,
        mediaVoto,
        partiteGiocate,
        titolarita,
        forma: [6, 6, 6, 6, 6],
        inCasa: true,
        avversario: '',
        difficoltaAvversario: 3,
        cleanSheetOdds: role === 'P' ? 0.35 : 0,
        isStarter: g.quotazioneAttuale > 3,
      };
    });

    console.log(`✅ Listone caricato: ${players.length} giocatori`);
    console.log(`🎯 Match statistiche: ${matchTrovati}/${players.length}`);
    console.log(`📊 FM accettate: ${fmAccettate}, FM=0 (nessun dato): ${fmRifiutate}`);

    const okoye = players.find(p => (p.surname || '').toLowerCase().includes('okoye'));
    if (okoye) {
      console.log(`🔍 Okoye: FM=${okoye.fantamedia}, MV=${okoye.mediaVoto}, PG=${okoye.partiteGiocate}`);
    }

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

export function saveToCache(_players: Player[], _status: ListoneStatus): void {}
export function clearCache(): void {}

export function parseExcelFile(_file: File): Promise<{ players: Player[]; status: ListoneStatus }> {
  return Promise.reject(new Error('Upload manuale disabilitato.'));
}

export function importFromJSON(_jsonContent: string): { players: Player[]; status: ListoneStatus } | null {
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
      console.warn('Errore getAvversario:', e);
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
