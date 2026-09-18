import infortuniData from '../data/infortuni.json';
import { Player } from '../types';

export type StatoInfortunio = 'out' | 'out-lungo' | 'dubbio';

export interface Infortunio {
  squadra: string;
  stato: StatoInfortunio;
  rientro: string;
  descrizione: string;
}

interface InfortuniFile {
  aggiornato: string;
  fonte: string;
  infortunati: Record<string, Infortunio>;
}

/**
 * Normalizza un nome per il matching (minuscolo, no accenti, no punti)
 */
function normalizza(nome: string): string {
  if (typeof nome !== 'string' || !nome) return '';
  try {
    return nome
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\./g, '')
      .replace(/\s+/g, ' ');
  } catch {
    return '';
  }
}

/**
 * Cerca un infortunio per un giocatore.
 * Match su:
 * 1. Nome completo
 * 2. Cognome (ultima parola)
 * 3. Prima parola (spesso il cognome per i portieri)
 */
export function cercaInfortunio(player: Player | undefined | null): Infortunio | null {
  if (!player) return null;
  
  try {
    const dati = infortuniData as unknown as InfortuniFile;
    if (!dati?.infortunati) return null;
    
    const playerSurname = normalizza(player.surname);
    const playerName = normalizza(player.name);
    const fullName = `${playerName} ${playerSurname}`.trim();
    
    if (!fullName) return null;
    
    // 1. Match esatto nome completo
    for (const [chiave, inf] of Object.entries(dati.infortunati)) {
      const chiaveNorm = normalizza(chiave);
      if (chiaveNorm === fullName || chiaveNorm === playerSurname) {
        return inf;
      }
    }
    
    // 2. Match per cognome (con lunghezza minima per evitare falsi positivi)
    if (playerSurname.length >= 4) {
      for (const [chiave, inf] of Object.entries(dati.infortunati)) {
        const chiaveNorm = normalizza(chiave);
        // "sulemana k" inizia con "sulemana"
        if (chiaveNorm.startsWith(playerSurname + ' ') || chiaveNorm === playerSurname) {
          return inf;
        }
      }
    }
    
    // 3. Match per nome (se il player non ha cognome)
    if (!playerSurname && playerName.length >= 4) {
      for (const [chiave, inf] of Object.entries(dati.infortunati)) {
        const chiaveNorm = normalizza(chiave);
        if (chiaveNorm.includes(playerName)) {
          return inf;
        }
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Verifica se un giocatore è infortunato (out o out-lungo).
 */
export function isInfortunato(player: Player | undefined | null): boolean {
  const inf = cercaInfortunio(player);
  if (!inf) return false;
  return inf.stato === 'out' || inf.stato === 'out-lungo';
}

/**
 * Verifica se un giocatore è in dubbio (da valutare).
 */
export function isInDubbio(player: Player | undefined | null): boolean {
  const inf = cercaInfortunio(player);
  return inf?.stato === 'dubbio';
}

/**
 * Restituisce la data di aggiornamento del file infortuni.
 */
export function getDataAggiornamentoInfortuni(): string | null {
  try {
    const dati = infortuniData as unknown as InfortuniFile;
    return dati?.aggiornato || null;
  } catch {
    return null;
  }
}

/**
 * Restituisce la lista completa degli infortunati.
 * Utile per la sezione dedicata nella Home.
 */
export function getTuttiInfortunati(): Array<{ nome: string; infortunio: Infortunio }> {
  try {
    const dati = infortuniData as unknown as InfortuniFile;
    if (!dati?.infortunati) return [];
    
    return Object.entries(dati.infortunati).map(([nome, inf]) => ({
      nome,
      infortunio: inf,
    }));
  } catch {
    return [];
  }
}
