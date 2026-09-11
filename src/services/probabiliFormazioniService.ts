
import { Player } from '../types';

// Servizio per gestire le probabili formazioni e aggiornare la titolarità

interface ProbabileFormazione {
  team: string;
  giocatori: string[]; // Lista dei nomi dei giocatori titolari
}

const PROB_FORMAZIONI_KEY = 'fantaconsiglio_probabili_formazioni';
const LAST_FETCH_KEY = 'fantaconsiglio_last_fetch';

// Salva le probabili formazioni nel localStorage
export function saveProbabiliFormazioni(formazioni: ProbabileFormazione[]): void {
  try {
    localStorage.setItem(PROB_FORMAZIONI_KEY, JSON.stringify(formazioni));
    localStorage.setItem(LAST_FETCH_KEY, new Date().toISOString());
  } catch {
    console.error('Errore nel salvataggio delle probabili formazioni');
  }
}

// Carica le probabili formazioni dal localStorage
export function loadProbabiliFormazioni(): ProbabileFormazione[] {
  try {
    const cached = localStorage.getItem(PROB_FORMAZIONI_KEY);
    if (!cached) return [];
    return JSON.parse(cached) as ProbabileFormazione[];
  } catch {
    return [];
  }
}

// Aggiorna la titolarità dei giocatori basandosi sulle probabili formazioni
export function updateTitolaritaFromProbabili(
  players: Player[],
  probabiliFormazioni: ProbabileFormazione[]
): Player[] {
  return players.map(player => {
    // Cerca se il giocatore è nella probabile formazione della sua squadra
    const formazione = probabiliFormazioni.find(f => f.team === player.team);

    if (!formazione) {
      // Se non abbiamo dati per questa squadra, mantieni la titolarità attuale
      return player;
    }

    // Controlla se il giocatore è nella lista dei titolari
    const fullName = `${player.name} ${player.surname}`.toLowerCase();
    const isTitolare = formazione.giocatori.some(g => {
      const gLower = g.toLowerCase();
      return gLower.includes(player.surname.toLowerCase()) ||
             player.surname.toLowerCase().includes(gLower) ||
             gLower === fullName;
    });

    // Aggiorna la titolarità
    const newTitolarita = isTitolare ? 90 : 20;

    return {
      ...player,
      titolarita: newTitolarita,
    };
  });
}

// Tenta di scaricare le probabili formazioni da fonti online
export async function fetchProbabiliFormazioni(): Promise<ProbabileFormazione[] | null> {
  // Lista di fonti da provare (in ordine di preferenza)
  const sources = [
    {
      name: 'Fantacalcio.it',
      url: 'https://www.fantacalcio.it/probabili-formazioni',
      proxyUrl: 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://www.fantacalcio.it/probabili-formazioni'),
    },
  ];

  for (const source of sources) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(source.proxyUrl, {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        continue;
      }

      const html = await response.text();

      // Parsa l'HTML per estrarre le probabili formazioni
      const formazioni = parseProbabiliFormazioniHTML(html);

      if (formazioni.length > 0) {
        console.log(`Probabili formazioni scaricate da ${source.name}:`, formazioni.length, 'squadre');
        saveProbabiliFormazioni(formazioni);
        return formazioni;
      }
    } catch (error) {
      console.warn(`Fetch da ${source.name} fallito:`, error);
      continue;
    }
  }

  return null;
}

// Parsa l'HTML delle probabili formazioni
function parseProbabiliFormazioniHTML(html: string): ProbabileFormazione[] {
  const formazioni: ProbabileFormazione[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Cerca i container delle formazioni
  const formazioneElements = doc.querySelectorAll('.formation, .probabile-formazione, [class*="formation"]');

  formazioneElements.forEach(element => {
    const teamElement = element.querySelector('.team-name, .squadra, [class*="team"]');
    const playersElements = element.querySelectorAll('.player-name, .giocatore, [class*="player"]');

    if (teamElement && playersElements.length > 0) {
      const team = teamElement.textContent?.trim() || '';
      const giocatori = Array.from(playersElements)
        .map(p => p.textContent?.trim() || '')
        .filter(g => g.length > 0);

      if (team && giocatori.length > 0) {
        formazioni.push({ team, giocatori });
      }
    }
  });

  return formazioni;
}

// Permette all'utente di caricare le probabili formazioni da un file
export function importProbabiliFormazioni(jsonContent: string): ProbabileFormazione[] | null {
  try {
    const data = JSON.parse(jsonContent);

    if (!Array.isArray(data)) {
      return null;
    }

    const formazioni: ProbabileFormazione[] = data.map((item: any) => ({
      team: item.team || '',
      giocatori: Array.isArray(item.giocatori) ? item.giocatori : [],
    }));

    if (formazioni.length === 0) {
      return null;
    }

    saveProbabiliFormazioni(formazioni);
    return formazioni;
  } catch {
    return null;
  }
}

// Esporta le probabili formazioni in formato JSON
export function exportProbabiliFormazioni(formazioni: ProbabileFormazione[]): string {
  return JSON.stringify(formazioni, null, 2);
}

// Aggiorna i giocatori con le probabili formazioni salvate
export function applyProbabiliFormazioni(players: Player[]): Player[] {
  const probabili = loadProbabiliFormazioni();

  if (probabili.length === 0) {
    return players;
  }

  return updateTitolaritaFromProbabili(players, probabili);
}

// Inizializza il servizio: carica le probabili formazioni salvate e tenta un aggiornamento
export async function initializeProbabiliFormazioni(): Promise<void> {
  // Controlla se abbiamo già delle probabili formazioni salvate
  const cached = loadProbabiliFormazioni();

  if (cached.length === 0) {
    // Se non abbiamo nulla, tenta di scaricare
    console.log('Nessuna probabile formazione salvata, tentativo di download...');
    await fetchProbabiliFormazioni();
  } else {
    // Controlla se è passato più di 1 giorno dall'ultimo fetch
    const lastFetch = localStorage.getItem(LAST_FETCH_KEY);
    if (lastFetch) {
      const lastDate = new Date(lastFetch);
      const now = new Date();
      const hoursDiff = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);

      if (hoursDiff > 24) {
        console.log('Probabili formazioni scadute, tentativo di aggiornamento...');
        await fetchProbabiliFormazioni();
      } else {
        console.log('Probabili formazioni già caricate:', cached.length, 'squadre');
      }
    }
  }
}
