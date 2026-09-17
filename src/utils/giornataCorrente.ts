import { calendarioSerieA } from '../services/calendarService';
import formazioniData from '../data/formazioni.json';

// Mappa nome squadra → sigla (come su Fantacalcio.it)
const SIGLE: Record<string, string> = {
  'Atalanta': 'ATA', 'Bologna': 'BOL', 'Cagliari': 'CAG', 'Como': 'COM',
  'Fiorentina': 'FIO', 'Frosinone': 'FRO', 'Genoa': 'GEN', 'Inter': 'INT',
  'Juventus': 'JUV', 'Lazio': 'LAZ', 'Lecce': 'LEC', 'Milan': 'MIL',
  'Monza': 'MON', 'Napoli': 'NAP', 'Parma': 'PAR', 'Roma': 'ROM',
  'Sassuolo': 'SAS', 'Torino': 'TOR', 'Udinese': 'UDI', 'Venezia': 'VEN',
};

function sigla(nomeSquadra: string): string {
  return SIGLE[nomeSquadra] || nomeSquadra.substring(0, 3).toUpperCase();
}

/**
 * 🔥 Determina la giornata corrente confrontando le partite in formazioni.json
 * con il calendario Serie A.
 * 
 * IMPORTANTE: formazioni.json contiene TUTTE le partite della stagione (merge
 * cumulativo), quindi più giornate possono avere 10 match. In caso di pareggio,
 * scegliamo la giornata PIÙ ALTA (la più recente) perché il merge aggiunge
 * sempre le nuove alle vecchie.
 */
export function determinaGiornataCorrente(): number {
  try {
    const dati = formazioniData as any;
    if (!dati?.partite) {
      console.warn('⚠️ formazioni.json non ha partite');
      return 1;
    }
    
    const partiteDaFile: string[] = Object.keys(dati.partite);
    if (partiteDaFile.length === 0) {
      console.warn('⚠️ formazioni.json è vuoto');
      return 1;
    }
    
    console.log(`📅 Determinazione giornata da ${partiteDaFile.length} partite in formazioni.json`);
    
    // 🔥 Trova la giornata con più match. In caso di pareggio, scegli la PIÙ ALTA.
    let migliorGiornata = 1;
    let migliorMatch = 0;
    
    for (const giornata of calendarioSerieA) {
      let matchCount = 0;
      
      for (const partita of giornata.partite) {
        const chiave = `${sigla(partita.casa)}-${sigla(partita.trasferta)}`;
        if (partiteDaFile.includes(chiave)) {
          matchCount++;
        }
      }
      
      // 🔥 Se matchCount è maggiore, aggiorna
      // 🔥 Se matchCount è UGUALE, aggiorna SOLO se giornata.numero è più alto
      //    (perché il merge aggiunge sempre le nuove alle vecchie)
      if (
        matchCount > migliorMatch ||
        (matchCount === migliorMatch && giornata.numero > migliorGiornata)
      ) {
        migliorMatch = matchCount;
        migliorGiornata = giornata.numero;
      }
    }
    
    // 🔍 Log dettagliato per debug
    console.log(`✅ Giornata determinata: ${migliorGiornata} (${migliorMatch} match)`);
    
    // Log di tutte le giornate con match > 0 (per capire il merge)
    const giornateConMatch: string[] = [];
    for (const giornata of calendarioSerieA) {
      let matchCount = 0;
      for (const partita of giornata.partite) {
        const chiave = `${sigla(partita.casa)}-${sigla(partita.trasferta)}`;
        if (partiteDaFile.includes(chiave)) matchCount++;
      }
      if (matchCount > 0) {
        giornateConMatch.push(`${giornata.numero}(${matchCount})`);
      }
    }
    console.log(`📊 Giornate con match: ${giornateConMatch.join(', ')}`);
    
    return migliorGiornata;
  } catch (e) {
    console.error('❌ Errore determinazione giornata:', e);
    return 1;
  }
}
