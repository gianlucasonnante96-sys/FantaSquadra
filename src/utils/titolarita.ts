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

// 🔒 SAFE: normalizza qualsiasi valore
function normalizza(nome: unknown): string {
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

function costruisciMappaTitolari(): Set<string> {
  const set = new Set<string>();
  const dati = formazioniData as unknown as FormazioniFile;
  
  if (!dati || !dati.partite) return set;
  
  try {
    for (const partita of Object.values(dati.partite)) {
      if (!partita) continue;
      if (Array.isArray(partita.casa?.titolari)) {
        for (const n of partita.casa.titolari) {
          const norm = normalizza(n);
          if (norm) set.add(norm);
        }
      }
      if (Array.isArray(partita.trasferta?.titolari)) {
        for (const n of partita.trasferta.titolari) {
          const norm = normalizza(n);
          if (norm) set.add(norm);
        }
      }
    }
  } catch (e) {
    console.error('Errore costruzione mappa titolari:', e);
  }
  
  return set;
}

export function getDataAggiornamentoFormazioni(): string | null {
  const dati = formazioniData as unknown as FormazioniFile;
  return dati?.aggiornato || null;
}

// 🔒 SAFE: accetta qualsiasi valore
export function isProbabileTitolare(nomeGiocatore: unknown): boolean {
  if (typeof nomeGiocatore !== 'string' || !nomeGiocatore) return false;
  
  try {
    if (!mappaTitolariCache) {
      mappaTitolariCache = costruisciMappaTitolari();
    }
    
    const nomeNorm = normalizza(nomeGiocatore);
    if (!nomeNorm) return false;
    
    if (mappaTitolariCache.has(nomeNorm)) return true;
    
    const parti = nomeNorm.split(' ');
    const cognome = parti[parti.length - 1];
    
    if (!cognome || cognome.length < 4) return false;
    
    for (const nomeMappa of mappaTitolariCache) {
      if (nomeMappa.endsWith(' ' + cognome) || nomeMappa === cognome) {
        return true;
      }
    }
  } catch (e) {
    console.error('Errore isProbabileTitolare:', e);
    return false;
  }
  
  return false;
}

export function getLivelloTitolarita(nomeGiocatore: unknown): 'confermato' | 'incerto' {
  if (typeof nomeGiocatore !== 'string' || !nomeGiocatore) return 'incerto';
  try {
    return isProbabileTitolare(nomeGiocatore) ? 'confermato' : 'incerto';
  } catch {
    return 'incerto';
  }
}
