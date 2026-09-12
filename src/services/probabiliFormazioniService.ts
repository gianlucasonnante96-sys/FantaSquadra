// src/services/probabiliFormazioniService.ts
import { Player } from '../types';
import formazioniData from '../data/formazioni.json';

// === TIPI ===

interface GiocatoreFormazione {
  nome: string;
  perc: number;
  role?: string;
  starter?: boolean;
}

interface FormazionePartita {
  matchId: string;
  casa: { sigla: string; nome?: string; giocatori: GiocatoreFormazione[] };
  trasferta: { sigla: string; nome?: string; giocatori: GiocatoreFormazione[] };
}

interface FormazioniFile {
  aggiornato: string;
  fonte: string;
  partite: Record<string, FormazionePartita>;
}

export interface ProbabileFormazione {
  team: string;
  giocatori: GiocatoreFormazione[];
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

// === SIGLE SQUADRE ===

const SIGLA_TO_NOME: Record<string, string> = {
  'ATA': 'Atalanta', 'BOL': 'Bologna', 'CAG': 'Cagliari', 'COM': 'Como',
  'FIO': 'Fiorentina', 'FRO': 'Frosinone', 'GEN': 'Genoa', 'INT': 'Inter',
  'JUV': 'Juventus', 'LAZ': 'Lazio', 'LEC': 'Lecce', 'MIL': 'Milan',
  'MON': 'Monza', 'NAP': 'Napoli', 'PAR': 'Parma', 'ROM': 'Roma',
  'SAS': 'Sassuolo', 'TOR': 'Torino', 'UDI': 'Udinese', 'VEN': 'Venezia',
};

function normalizzaTeam(team: string | undefined | null): string {
  const safe = safeLower(team);
  if (!safe) return '';
  
  const upper = safe.toUpperCase();
  if (SIGLA_TO_NOME[upper]) {
    return SIGLA_TO_NOME[upper];
  }
  
  return safe.charAt(0).toUpperCase() + safe.slice(1);
}

// === LETTURA DA formazioni.json ===

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
      
      if (partita.casa?.sigla && Array.isArray(partita.casa.giocatori)) {
        formazioni.push({
          team: partita.casa.sigla,
          giocatori: partita.casa.giocatori,
        });
      }
      
      if (partita.trasferta?.sigla && Array.isArray(partita.trasferta.giocatori)) {
        formazioni.push({
          team: partita.trasferta.sigla,
          giocatori: partita.trasferta.giocatori,
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

export function getDataAggiornamentoFormazioni(): string | null {
  try {
    const dati = formazioniData as unknown as FormazioniFile;
    return dati?.aggiornato || null;
  } catch {
    return null;
  }
}

// === LOCALSTORAGE ===

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

// === APPLICAZIONE TITOLARITÀ ===

/**
 * 🔥 NUOVA LOGICA: usa la percentuale ESATTA dal sito Fantacalcio.it
 * 
 * - Titolare certo (starter=true, perc=100) → titolarità 95%
 * - Titolare con perc<100 (ballottaggio) → titolarità = perc esatta
 * - Panchina con perc alta (es. 60) → titolarità = perc esatta
 * - Panchina con perc bassa (es. 5) → titolarità = perc esatta
 * - NON in lista → titolarità = 10
 */
export function updateTitolaritaFromProbabili(
  players: Player[],
  probabiliFormazioni: ProbabileFormazione[]
): Player[] {
  if (!Array.isArray(players)) return [];
  if (!Array.isArray(probabiliFormazioni) || probabiliFormazioni.length === 0) {
    return players;
  }
  
  // Crea mappa: nome squadra → mappa di nomi giocatori → percentuale
  const mappaFormazioni = new Map<string, Map<string, number>>();
  
  for (const formazione of probabiliFormazioni) {
    if (!formazione || !formazione.team) continue;
    const teamNorm = normalizzaTeam(formazione.team).toLowerCase();
    const giocatori = Array.isArray(formazione.giocatori) ? formazione.giocatori : [];
    
    const mappaGiocatori = new Map<string, number>();
    for (const g of giocatori) {
      // Supporta sia il vecchio formato (stringa) che il nuovo (oggetto)
      if (typeof g === 'string') {
        mappaGiocatori.set(safeLower(g), 100);
      } else if (g && typeof g === 'object' && 'nome' in g) {
        const nomeNorm = safeLower(g.nome);
        const perc = typeof g.perc === 'number' ? g.perc : 100;
        if (nomeNorm) mappaGiocatori.set(nomeNorm, perc);
      }
    }
    
    mappaFormazioni.set(teamNorm, mappaGiocatori);
  }
  
  let matchCount = 0;
  let noMatchCount = 0;
  
  const risultato = players.map(player => {
    if (!player || !player.team) return player;
    
    const playerName = safeLower(player.name);
    const playerSurname = safeLower(player.surname);
    const fullName = safeFullName(player);
    const teamNorm = normalizzaTeam(player.team).toLowerCase();
    
    if (!playerName && !playerSurname) return player;
    
    const formazioneSquadra = mappaFormazioni.get(teamNorm);
    if (!formazioneSquadra || formazioneSquadra.size === 0) {
      return player;
    }
    
    // 🔥 Cerca il giocatore e prendi la sua percentuale ESATTA
    let percentualeTrovata = 0;
    let matchTrovato = false;
    
    for (const [nomeTitolare, perc] of formazioneSquadra) {
      if (!nomeTitolare) continue;
      
      // Match per cognome (più affidabile)
      if (playerSurname && playerSurname.length >= 4 && nomeTitolare.includes(playerSurname)) {
        percentualeTrovata = perc;
        matchTrovato = true;
        break;
      }
      
      // Match per nome completo
      if (fullName && nomeTitolare === fullName) {
        percentualeTrovata = perc;
        matchTrovato = true;
        break;
      }
      
      // Match per cognome anche se corto (con controllo più stretto)
      if (playerSurname && playerSurname.length >= 3 && nomeTitolare === playerSurname) {
        percentualeTrovata = perc;
        matchTrovato = true;
        break;
      }
    }
    
    // 🔥 APPLICA LA PERCENTUALE ESATTA
    let newTitolarita: number;
    
    if (matchTrovato) {
      // Se perc è 100 (titolare certo), mettiamo 95 per lasciare margine
      // Altrimenti usiamo la perc esatta (es. 75%, 55%, 5%)
      newTitolarita = percentualeTrovata >= 100 ? 95 : percentualeTrovata;
      matchCount++;
    } else {
      // Non è nella lista → titolarità bassa
      newTitolarita = 10;
      noMatchCount++;
    }
    
    return {
      ...player,
      titolarita: newTitolarita,
    };
  });
  
  console.log(`📊 Titolarità aggiornate: ${matchCount} match, ${noMatchCount} non trovati`);
  return risultato;
}

// === FUNZIONI PUBBLICHE ===

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

// === COMPATIBILITÀ ===

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
