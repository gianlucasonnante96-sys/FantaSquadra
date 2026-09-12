// src/services/probabiliFormazioniService.ts
import { Player } from '../types';
import formazioniData from '../data/formazioni.json';

// === TIPI ===

interface FormazionePartita {
  matchId: string;
  casa: { sigla: string; titolari: string[] };
  trasferta: { sigla: string; titolari: string[] };
}

interface FormazioniFile {
  aggiornato: string;
  fonte: string;
  partite: Record<string, FormazionePartita>;
}

export interface ProbabileFormazione {
  team: string;
  giocatori: string[];
}

const PROB_FORMAZIONI_KEY = 'fantaconsiglio_probabili_formazioni';
const LAST_FETCH_KEY = 'fantaconsiglio_last_fetch';

// === UTILITY SAFE ===

function safeLower(valore: unknown): string {
  if (typeof valore !== 'string' || !valore) return '';
  try {
    return valore.toLowerCase().trim();
  } catch {
    return '';
  }
}

function safeFullName(player: Player): string {
  const name = safeLower(player?.name);
  const surname = safeLower(player?.surname);
  return `${name} ${surname}`.trim();
}

// === LETTURA DA formazioni.json (BUILD TIME) ===

/**
 * Legge le formazioni direttamente dal file JSON generato dallo scraper.
 * Questo file è aggiornato automaticamente da GitHub Actions ogni giorno.
 */
export function loadFormazioniDaFile(): ProbabileFormazione[] {
  try {
    const dati = formazioniData as unknown as FormazioniFile;
    if (!dati || !dati.partite) {
      console.log('⚠️ formazioni.json vuoto o malformato');
      return [];
    }
    
    const formazioni: ProbabileFormazione[] = [];
    
    for (const partita of Object.values(dati.partite)) {
      if (!partita) continue;
      
      // Squadra casa
      if (partita.casa?.sigla && Array.isArray(partita.casa.titolari)) {
        formazioni.push({
          team: partita.casa.sigla,
          giocatori: partita.casa.titolari,
        });
      }
      
      // Squadra trasferta
      if (partita.trasferta?.sigla && Array.isArray(partita.trasferta.titolari)) {
        formazioni.push({
          team: partita.trasferta.sigla,
          giocatori: partita.trasferta.titolari,
        });
      }
    }
    
    console.log(`📋 Caricate ${formazioni.length} formazioni da formazioni.json`);
    return formazioni;
  } catch (e) {
    console.error('Errore lettura formazioni.json:', e);
    return [];
  }
}

/**
 * Restituisce la data di ultimo aggiornamento delle formazioni.
 */
export function getDataAggiornamentoFormazioni(): string | null {
  try {
    const dati = formazioniData as unknown as FormazioniFile;
    return dati?.aggiornato || null;
  } catch {
    return null;
  }
}

// === LETTURA DA LOCALSTORAGE (RUNTIME) ===

export function saveProbabiliFormazioni(formazioni: ProbabileFormazione[]): void {
  try {
    localStorage.setItem(PROB_FORMAZIONI_KEY, JSON.stringify(formazioni));
    localStorage.setItem(LAST_FETCH_KEY, new Date().toISOString());
  } catch (e) {
    console.error('Errore salvataggio formazioni:', e);
  }
}

export function loadProbabiliFormazioni(): ProbabileFormazione[] {
  try {
    const cached = localStorage.getItem(PROB_FORMAZIONI_KEY);
    if (!cached) return [];
    const parsed = JSON.parse(cached);
    if (!Array.isArray(parsed)) return [];
    return parsed as ProbabileFormazione[];
  } catch {
    return [];
  }
}

// === MAPPA SIGLE → NOMI COMPLETI ===

const SIGLA_TO_NOME: Record<string, string> = {
  'ATA': 'Atalanta',
  'BOL': 'Bologna',
  'CAG': 'Cagliari',
  'COM': 'Como',
  'FIO': 'Fiorentina',
  'FRO': 'Frosinone',
  'GEN': 'Genoa',
  'INT': 'Inter',
  'JUV': 'Juventus',
  'LAZ': 'Lazio',
  'LEC': 'Lecce',
  'MIL': 'Milan',
  'MON': 'Monza',
  'NAP': 'Napoli',
  'PAR': 'Parma',
  'ROM': 'Roma',
  'SAS': 'Sassuolo',
  'TOR': 'Torino',
  'UDI': 'Udinese',
  'VEN': 'Venezia',
};

/**
 * Normalizza il nome della squadra: se è una sigla (es. "VEN"), la converte
 * nel nome completo (es. "Venezia"). Altrimenti restituisce il nome così com'è.
 */
function normalizzaTeam(team: string | undefined | null): string {
  const safe = safeLower(team);
  if (!safe) return '';
  
  const upper = safe.toUpperCase();
  if (SIGLA_TO_NOME[upper]) {
    return SIGLA_TO_NOME[upper];
  }
  
  // Capitalizza la prima lettera
  return safe.charAt(0).toUpperCase() + safe.slice(1);
}

// === APPLICAZIONE TITOLARITÀ ===

/**
 * Aggiorna la titolarità dei giocatori in base alle probabili formazioni.
 * 
 * Logica:
 * - Se il giocatore è tra i titolari probabili → titolarità += 15 (max 95)
 * - Se NON è tra i titolari e la sua squadra ha formazioni → titolarità -= 25 (min 10)
 * - Se non ci sono dati per la sua squadra → titolarità invariata
 */
export function updateTitolaritaFromProbabili(
  players: Player[],
  probabiliFormazioni: ProbabileFormazione[]
): Player[] {
  if (!Array.isArray(players)) return [];
  if (!Array.isArray(probabiliFormazioni) || probabiliFormazioni.length === 0) {
    return players;
  }
  
  // Crea una mappa: nome squadra → set di nomi giocatori titolari (normalizzati)
  const mappaFormazioni = new Map<string, Set<string>>();
  for (const formazione of probabiliFormazioni) {
    if (!formazione || !formazione.team) continue;
    const teamNorm = normalizzaTeam(formazione.team);
    const giocatori = Array.isArray(formazione.giocatori) ? formazione.giocatori : [];
    
    const setGiocatori = new Set<string>();
    for (const g of giocatori) {
      const gNorm = safeLower(g);
      if (gNorm) setGiocatori.add(gNorm);
    }
    
    mappaFormazioni.set(teamNorm.toLowerCase(), setGiocatori);
  }
  
  return players.map(player => {
    if (!player || !player.team) return player;
    
    const playerName = safeLower(player.name);
    const playerSurname = safeLower(player.surname);
    const fullName = safeFullName(player);
    const teamNorm = normalizzaTeam(player.team).toLowerCase();
    
    // Se il giocatore non ha nome, lascialo invariato
    if (!playerName && !playerSurname) return player;
    
    // Cerca la formazione della sua squadra
    const formazioneSquadra = mappaFormazioni.get(teamNorm);
    if (!formazioneSquadra || formazioneSquadra.size === 0) {
      // Nessun dato per questa squadra, lascia invariato
      return player;
    }
    
    // Controlla se il giocatore è tra i titolari
    let isTitolare = false;
    for (const nomeTitolare of formazioneSquadra) {
      if (!nomeTitolare) continue;
      
      // Match per cognome (più affidabile)
      if (playerSurname && nomeTitolare.includes(playerSurname)) {
        isTitolare = true;
        break;
      }
      
      // Match per nome completo
      if (fullName && nomeTitolare === fullName) {
        isTitolare = true;
        break;
      }
      
      // Match per nome (solo se cognome non ha matchato)
      if (playerName && playerName.length >= 4 && nomeTitolare.includes(playerName)) {
        isTitolare = true;
        break;
      }
    }
    
    // Aggiorna la titolarità
    const titolaritaBase = player.titolarita ?? 50;
    const newTitolarita = isTitolare
      ? Math.min(95, titolaritaBase + 15)
      : Math.max(10, titolaritaBase - 25);
    
    return {
      ...player,
      titolarita: newTitolarita,
    };
  });
}

// === FUNZIONI PUBBLICHE ===

/**
 * Applica le probabili formazioni salvate ai giocatori.
 * Fonte: prima localStorage, poi formazioni.json
 */
export function applyProbabiliFormazioni(players: Player[]): Player[] {
  if (!Array.isArray(players)) return [];
  
  let probabili = loadProbabiliFormazioni();
  
  if (probabili.length === 0) {
    probabili = loadFormazioniDaFile();
  }
  
  if (probabili.length === 0) {
    console.log('ℹ️ Nessuna probabile formazione disponibile');
    return players;
  }
  
  return updateTitolaritaFromProbabili(players, probabili);
}

/**
 * Inizializza il servizio: carica le formazioni dal file JSON 
 * e le salva in localStorage per uso futuro.
 */
export async function initializeProbabiliFormazioni(): Promise<void> {
  try {
    const formazioni = loadFormazioniDaFile();
    if (formazioni.length > 0) {
      saveProbabiliFormazioni(formazioni);
      console.log(`✅ Inizializzate ${formazioni.length} formazioni`);
    } else {
      console.log('ℹ️ Nessuna formazione disponibile nel file JSON');
    }
  } catch (e) {
    console.error('Errore inizializzazione:', e);
  }
}

// === DEPRECATED (mantenute per compatibilità) ===

export function importProbabiliFormazioni(jsonContent: string): ProbabileFormazione[] | null {
  try {
    const data = JSON.parse(jsonContent);
    if (!Array.isArray(data)) return null;
    
    const formazioni: ProbabileFormazione[] = data.map((item: any) => ({
      team: item?.team || '',
      giocatori: Array.isArray(item?.giocatori) ? item.giocatori : [],
    })).filter(f => f.team);
    
    if (formazioni.length === 0) return null;
    saveProbabiliFormazioni(formazioni);
    return formazioni;
  } catch {
    return null;
  }
}

export function exportProbabiliFormazioni(formazioni: ProbabileFormazione[]): string {
  return JSON.stringify(formazioni, null, 2);
}
