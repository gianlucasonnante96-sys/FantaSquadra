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
 * Logica:
 * 1. Legge le chiavi da formazioni.json (es. "MON-SAS", "BOL-TOR", ...)
 * 2. Per ogni giornata del calendario, conta quante partite matchano
 * 3. La giornata con più match è quella corrente
 */
export function determinaGiornataCorrente(): number {
  try {
    const dati = formazioniData as any;
    if (!dati?.partite) {
      console.warn('⚠️ formazioni.json non ha partite');
      return 1;
    }
    
    // Estrai le chiavi delle partite (es. ["MON-SAS", "BOL-TOR", ...])
    const partiteDaFile: string[] = Object.keys(dati.partite);
    if (partiteDaFile.length === 0) {
      console.warn('⚠️ formazioni.json è vuoto');
      return 1;
    }
    
    console.log(`📅 Determinazione giornata da ${partiteDaFile.length} partite in formazioni.json`);
    console.log(`   Partite: ${partiteDaFile.join(', ')}`);
    
    // Per ogni giornata del calendario, conta quante partite matchano
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
      
      if (matchCount > migliorMatch) {
        migliorMatch = matchCount;
        migliorGiornata = giornata.numero;
      }
    }
    
    console.log(`✅ Giornata determinata: ${migliorGiornata} (${migliorMatch}/${partiteDaFile.length} match)`);
    return migliorGiornata;
  } catch (e) {
    console.error('❌ Errore determinazione giornata:', e);
    return 1;
  }
}
