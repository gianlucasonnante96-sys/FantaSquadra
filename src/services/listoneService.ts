import { Player, Role } from '../types';
// import { allPlayers as fallbackPlayers, serieATeams } from '../data/players'; // Puoi mantenerlo come fallback
import listoneData from '../data/listone.json'; // 🔥 IMPORTA IL NUOVO FILE

// ... (interfacce e costanti) ...

// 🔥 Nuova funzione per caricare il listone da file
function loadListoneDaFile(): Player[] {
  try {
    const dati = listoneData as any;
    if (!dati || !Array.isArray(dati.giocatori)) {
      return [];
    }
    
    return dati.giocatori.map((g: any, index: number) => {
      // Normalizza ruolo
      let role: Role = 'C';
      const ruoloUpper = (g.ruolo || '').toUpperCase();
      if (ruoloUpper.includes('P')) role = 'P';
      else if (ruoloUpper.includes('D')) role = 'D';
      else if (ruoloUpper.includes('A')) role = 'A';
      
      // Split nome e cognome
      const parti = (g.nome || '').trim().split(/\s+/);
      const surname = parti.pop() || '';
      const name = parti.join(' ');
      
      // Mappa la squadra (potresti aver bisogno di una funzione di normalizzazione qui)
      // Per ora usiamo il nome diretto dalla fonte
      
      return {
        id: `fanta_${name}_${surname}_${g.squadra}`.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
        name,
        surname,
        team: g.squadra,
        role,
        fantamedia: 0, // 🔥 Impostato a 0, verrà gestito dal scoring
        mediaVoto: 6,   // 🔥 Valore neutro
        titolarita: 70, // Valore di default, verrà sovrascritto dalle formazioni
        forma: [6, 6, 6, 6, 6],
        inCasa: true,
        avversario: '',
        difficoltaAvversario: 3,
        cleanSheetOdds: 0,
        isStarter: false,
      };
    });
  } catch (e) {
    console.error('Errore lettura listone.json:', e);
    return [];
  }
}

// Modifica la funzione loadListone per usare il nuovo file
export function loadListone(): { players: Player[]; status: ListoneStatus } {
  // 1. Prova prima dal file listone.json
  const playersDaFile = loadListoneDaFile();
  
  if (playersDaFile.length > 0) {
    return {
      players: playersDaFile,
      status: {
        source: 'Listone Ufficiale Fantacalcio.it',
        lastUpdated: (listoneData as any)?.aggiornato || null,
        playerCount: playersDaFile.length,
        isOnline: false,
        error: null,
      }
    };
  }
  
  // 2. Altrimenti usa la cache (dal vecchio metodo)
  const cached = loadFromCache();
  if (cached && Array.isArray(cached.players) && cached.players.length > 0) {
    return { players: cached.players, status: cached.status };
  }
  
  // 3. Fallback finale
  return {
    players: [], // O i tuoi fallbackPlayers
    status: {
      source: 'Nessun listone disponibile',
      lastUpdated: null,
      playerCount: 0,
      isOnline: false,
      error: 'Scarica il listone da Fantacalcio.it',
    }
  };
}
