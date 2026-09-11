// src/utils/titolarita.ts
import formazioniData from '../data/formazioni.json';

type FormazionePartita = {
  casa: { sigla: string; titolari: string[]; panchina: string[] };
  trasferta: { sigla: string; titolari: string[]; panchina: string[] };
};

type FormazioniFile = {
  aggiornato: string;
  fonte: string;
  partite: Record<string, FormazionePartita>;
};

let mappaTitolariCache: Set<string> | null = null;
let dataAggiornamento: string | null = null;

/**
 * Normalizza un nome per confronti robusti:
 * - tutto minuscolo
 * - rimuove accenti
 * - rimuove spazi doppi
 * - rimuove punti finali
 */
function normalizza(nome: string): string {
  return nome
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Costruisce un Set con tutti i nomi dei probabili titolari
 * per lookup O(1)
 */
function costruisciMappaTitolari(): Set<string> {
  const set = new Set<string>();
  const dati = formazioniData as unknown as FormazioniFile;
  
  if (!dati?.partite) return set;
  
  for (const partita of Object.values(dati.partite)) {
    partita.casa?.titolari?.forEach(n => set.add(normalizza(n)));
    partita.trasferta?.titolari?.forEach(n => set.add(normalizza(n)));
  }
  
  return set;
}

/**
 * Restituisce la data dell'ultimo aggiornamento delle formazioni
 */
export function getDataAggiornamentoFormazioni(): string | null {
  const dati = formazioniData as unknown as FormazioniFile;
  return dati?.aggiornato || null;
}

/**
 * Verifica se un giocatore è indicato come probabile titolare.
 * Fa match su:
 * 1. Nome esatto normalizzato
 * 2. Cognome (se il nome completo non matcha)
 */
export function isProbabileTitolare(nomeGiocatore: string): boolean {
  if (!mappaTitolariCache) {
    mappaTitolariCache = costruisciMappaTitolari();
    dataAggiornamento = getDataAggiornamentoFormazioni();
  }
  
  const nomeNorm = normalizza(nomeGiocatore);
  
  // 1. Match esatto
  if (mappaTitolariCache.has(nomeNorm)) return true;
  
  // 2. Match sul cognome (ultima parola)
  const parti = nomeNorm.split(' ');
  const cognome = parti[parti.length - 1];
  
  // Evita match troppo corti (es. "De", "La")
  if (cognome.length < 4) return false;
  
  for (const nomeMappa of mappaTitolariCache) {
    if (nomeMappa.endsWith(' ' + cognome) || nomeMappa === cognome) {
      return true;
    }
  }
  
  return false;
}

/**
 * Restituisce il livello di affidabilità della titolarità:
 * - 'confermato': presente nelle probabili formazioni
 * - 'incerto': non presente (potrebbe essere panchina o ballottaggio)
 */
export function getLivelloTitolarita(nomeGiocatore: string): 'confermato' | 'incerto' {
  return isProbabileTitolare(nomeGiocatore) ? 'confermato' : 'incerto';
}
