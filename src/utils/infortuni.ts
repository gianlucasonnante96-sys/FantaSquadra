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
    
    // 2. Match per cognome
    if (playerSurname.length >= 4) {
      for (const [chiave, inf] of Object.entries(dati.infortunati)) {
        const chiaveNorm = normalizza(chiave);
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

export function isInfortunato(player: Player | undefined | null): boolean {
  const inf = cercaInfortunio(player);
  if (!inf) return false;
  return inf.stato === 'out' || inf.stato === 'out-lungo';
}

export function isInDubbio(player: Player | undefined | null): boolean {
  const inf = cercaInfortunio(player);
  return inf?.stato === 'dubbio';
}

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

/**
 * 🔥 NUOVO: Raggruppa gli infortunati per squadra in ordine alfabetico.
 */
export interface SquadraInfortunati {
  squadra: string;
  giocatori: Array<{ nome: string; infortunio: Infortunio }>;
}

export function getInfortunatiPerSquadra(): SquadraInfortunati[] {
  try {
    const infortunati = getTuttiInfortunati();
    if (infortunati.length === 0) return [];
    
    // Raggruppa per squadra
    const mappa = new Map<string, Array<{ nome: string; infortunio: Infortunio }>>();
    
    for (const item of infortunati) {
      const squadra = item.infortunio.squadra || 'Sconosciuta';
      if (!mappa.has(squadra)) mappa.set(squadra, []);
      mappa.get(squadra)!.push(item);
    }
    
    // Ordina le squadre alfabeticamente
    const squadre = Array.from(mappa.entries())
      .map(([squadra, giocatori]) => {
        // Ordina anche i giocatori dentro ogni squadra per stato (out, out-lungo, dubbio)
        const ordineStato: Record<string, number> = { 'out': 1, 'out-lungo': 2, 'dubbio': 3 };
        const giocatoriOrdinati = giocatori.sort((a, b) => {
          const ordA = ordineStato[a.infortunio.stato] || 99;
          const ordB = ordineStato[b.infortunio.stato] || 99;
          if (ordA !== ordB) return ordA - ordB;
          return a.nome.localeCompare(b.nome, 'it');
        });
        return { squadra, giocatori: giocatoriOrdinati };
      })
      .sort((a, b) => a.squadra.localeCompare(b.squadra, 'it'));
    
    return squadre;
  } catch {
    return [];
  }
}
