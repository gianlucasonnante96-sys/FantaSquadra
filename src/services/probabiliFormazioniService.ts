import { Player } from '../types';

// Servizio per gestire le probabili formazioni e aggiornare la titolarità

interface ProbabileFormazione {
  team: string;
  giocatori: string[]; // Lista dei nomi dei giocatori titolari
}

const PROB_FORMAZIONI_KEY = 'fantaconsiglio_probabili_formazioni';
const LAST_FETCH_KEY = 'fantaconsiglio_last_fetch';

// 🔒 SAFE: normalizza un valore a stringa lower-case, ritorna '' se non valido
function safeLower(valore: unknown): string {
  if (typeof valore !== 'string' || !valore) return '';
  try {
    return valore.toLowerCase().trim();
  } catch {
    return '';
  }
}

// 🔒 SAFE: costruisce il nome completo in modo sicuro
function safeFullName(player: Player): string {
  const name = safeLower(player?.name);
  const surname = safeLower(player?.surname);
  return `${name} ${surname}`.trim();
}

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
    const parsed = JSON.parse(cached);
    if (!Array.isArray(parsed)) return [];
    return parsed as ProbabileFormazione[];
  } catch {
    return [];
  }
}

// 🔒 Aggiorna la titolarità dei giocatori basandosi sulle probabili formazioni
export function updateTitolaritaFromProbabili(
  players: Player[],
  probabiliFormazioni: ProbabileFormazione[]
): Player[] {
  // Se non ci sono players, ritorna array vuoto
  if (!Array.isArray(players)) return [];
  // Se non ci sono formazioni, ritorna i players invariati
  if (!Array.isArray(probabiliFormazioni) || probabiliFormazioni.length === 0) {
    return players;
  }

  return players.map(player => {
    if (!player) return player;

    // 🔒 SAFE: recupero nome e cognome
    const playerName = safeLower(player.name);
    const playerSurname = safeLower(player.surname);
    const fullName = safeFullName(player);

    // Se il giocatore non ha né nome né cognome, lascialo invariato
    if (!playerName && !playerSurname) return player;

    // Cerca se il giocatore è nella probabile formazione della sua squadra
    const formazione = probabiliFormazioni.find(f => f && f.team === player.team);

    if (!formazione) {
      // Se non abbiamo dati per questa squadra, mantieni la titolarità attuale
      return player;
    }

    // 🔒 SAFE: giocatori array potrebbe essere undefined
    const giocatori = Array.isArray(formazione.giocatori) ? formazione.giocatori : [];

    // 🔒 SAFE: controlla se il giocatore è nella lista dei titolari
    const isTitolare = giocatori.some(g => {
      const gLower = safeLower(g);
      if (!gLower) return false;
      
      // Match per cognome (più affidabile)
      if (playerSurname && gLower.includes(playerSurname)) return true;
      if (playerSurname && playerSurname.includes(gLower)) return true;
      
      // Match per nome completo
      if (fullName && gLower === fullName) return true;
      
      // Match per nome (solo se cognome non ha matchato)
      if (playerName && playerName.length >= 4 && gLower.includes(playerName)) return true;
      
      return false;
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
  if (!html || typeof html !== 'string') return formazioni;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

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
  } catch (e) {
    console.error('Errore parsing HTML formazioni:', e);
  }

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
      team: item?.team || '',
      giocatori: Array.isArray(item?.giocatori) ? item.giocatori : [],
    })).filter(f => f.team);

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

// 🔒 Aggiorna i giocatori con le probabili formazioni salvate
export function applyProbabiliFormazioni(players: Player[]): Player[] {
  if (!Array.isArray(players)) return [];
  
  const probabili = loadProbabiliFormazioni();

  if (probabili.length === 0) {
    return players;
  }

  return updateTitolaritaFromProbabili(players, probabili);
}

// Inizializza il servizio
export async function initializeProbabiliFormazioni(): Promise<void> {
  try {
    const cached = loadProbabiliFormazioni();

    if (cached.length === 0) {
      console.log('Nessuna probabile formazione salvata, tentativo di download...');
      await fetchProbabiliFormazioni();
    } else {
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
  } catch (e) {
    console.error('Errore inizializzazione probabili formazioni:', e);
  }
}
