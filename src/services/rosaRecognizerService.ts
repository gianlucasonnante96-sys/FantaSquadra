
import { Player } from '../types';
import Tesseract from 'tesseract.js';

// Servizio per riconoscere i giocatori dalla rosa caricata

interface RiconoscimentoResult {
  giocatoreRiconosciuto: Player | null;
  confidence: number;
  nomeOriginale: string;
}

// Normalizza un nome per il confronto (rimuove accenti, caratteri speciali, ecc.)
function normalizzaNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Rimuove accenti
    .replace(/[^a-z0-9\s]/g, '') // Rimuove caratteri speciali
    .replace(/\s+/g, ' ') // Normalizza spazi
    .trim();
}

// Calcola la similarità tra due stringhe (Levenshtein distance normalizzata)
function calcolaSimilarita(str1: string, str2: string): number {
  const s1 = normalizzaNome(str1);
  const s2 = normalizzaNome(str2);

  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0 || len2 === 0) return 0;

  // Matrice per Levenshtein distance
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLength = Math.max(len1, len2);

  return 1 - distance / maxLength;
}

// Riconosce un giocatore dalla rosa basandosi su nome, squadra e ruolo
function riconosciGiocatore(
  nomeCercato: string,
  squadraCercata: string | null,
  ruoloCercato: string | null,
  listaGiocatori: Player[]
): RiconoscimentoResult {
  let migliorMatch: Player | null = null;
  let migliorConfidence = 0;

  for (const giocatore of listaGiocatori) {
    // Calcola similarità del nome
    const nomeCompleto = `${giocatore.name} ${giocatore.surname}`;
    const similaritaNome = calcolaSimilarita(nomeCercato, nomeCompleto);

    // Calcola similarità del cognome (spesso più affidabile)
    const similaritaCognome = calcolaSimilarita(nomeCercato, giocatore.surname);

    // Bonus se la squadra corrisponde
    let bonusSquadra = 0;
    if (squadraCercata) {
      const similaritaSquadra = calcolaSimilarita(squadraCercata, giocatore.team);
      if (similaritaSquadra > 0.7) {
        bonusSquadra = 0.2;
      }
    }

    // Bonus se il ruolo corrisponde
    let bonusRuolo = 0;
    if (ruoloCercato) {
      const ruoloNormalizzato = ruoloCercato.toUpperCase().trim();
      if (
        (ruoloNormalizzato.includes('P') && giocatore.role === 'P') ||
        (ruoloNormalizzato.includes('D') && giocatore.role === 'D') ||
        (ruoloNormalizzato.includes('C') && giocatore.role === 'C') ||
        (ruoloNormalizzato.includes('A') && giocatore.role === 'A')
      ) {
        bonusRuolo = 0.15;
      }
    }

    // Calcola confidence finale
    const confidence = Math.max(similaritaNome, similaritaCognome) + bonusSquadra + bonusRuolo;

    if (confidence > migliorConfidence) {
      migliorConfidence = confidence;
      migliorMatch = giocatore;
    }
  }

  return {
    giocatoreRiconosciuto: migliorMatch,
    confidence: migliorConfidence,
    nomeOriginale: nomeCercato,
  };
}

// Parsa un file Excel e riconosce i giocatori
export async function riconosciGiocatoriDaExcel(
  file: File,
  listaGiocatori: Player[]
): Promise<{ riconosciuti: Player[]; nonRiconosciuti: string[] }> {
  const XLSX = await import('xlsx');
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  const riconosciuti: Player[] = [];
  const nonRiconosciuti: string[] = [];
  const idGiaAggiunti = new Set<string>();

  // Trova l'header
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(10, jsonData.length); i++) {
    const row = jsonData[i] as any[];
    if (row && row.length > 0) {
      const rowText = row.join(' ').toLowerCase();
      if (rowText.includes('nome') || rowText.includes('giocatore') || rowText.includes('calciatore')) {
        headerRowIndex = i;
        break;
      }
    }
  }

  const headers = jsonData[headerRowIndex] as any[];
  const nomeCol = headers.findIndex(h =>
    h && (h.toString().toLowerCase().includes('nome') ||
          h.toString().toLowerCase().includes('giocatore') ||
          h.toString().toLowerCase().includes('calciatore'))
  );
  const squadraCol = headers.findIndex(h =>
    h && (h.toString().toLowerCase().includes('squadra') ||
          h.toString().toLowerCase().includes('team'))
  );
  const ruoloCol = headers.findIndex(h =>
    h && (h.toString().toLowerCase().includes('ruolo') ||
          h.toString().toLowerCase().includes('role'))
  );

  // Processa ogni riga
  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i] as any[];
    if (!row || row.length === 0) continue;

    const nome = nomeCol >= 0 ? row[nomeCol]?.toString() : row[0]?.toString();
    const squadra = squadraCol >= 0 ? row[squadraCol]?.toString() : null;
    const ruolo = ruoloCol >= 0 ? row[ruoloCol]?.toString() : null;

    if (!nome || nome.trim() === '') continue;

    const result = riconosciGiocatore(nome, squadra, ruolo, listaGiocatori);

    if (result.giocatoreRiconosciuto && result.confidence > 0.6) {
      if (!idGiaAggiunti.has(result.giocatoreRiconosciuto.id)) {
        riconosciuti.push(result.giocatoreRiconosciuto);
        idGiaAggiunti.add(result.giocatoreRiconosciuto.id);
      }
    } else {
      nonRiconosciuti.push(nome);
    }
  }

  return { riconosciuti, nonRiconosciuti };
}

// Riconosce i giocatori da un'immagine usando OCR
export async function riconosciGiocatoriDaImmagine(
  file: File,
  listaGiocatori: Player[]
): Promise<{ riconosciuti: Player[]; nonRiconosciuti: string[] }> {
  const riconosciuti: Player[] = [];
  const nonRiconosciuti: string[] = [];
  const idGiaAggiunti = new Set<string>();

  try {
    // Esegui OCR sull'immagine
    const result = await Tesseract.recognize(file, 'ita', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`OCR progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    const text = result.data.text;
    const lines = text.split('\n').filter(line => line.trim().length > 0);

    // Cerca pattern di nomi di giocatori
    // Pattern comune: "Nome Cognome" o "Cognome Nome"
    for (const line of lines) {
      // Ignora righe troppo corte o con numeri
      if (line.length < 3 || /^\d+$/.test(line.trim())) continue;

      // Prova a estrarre il nome del giocatore
      const nomeEstratto = line.trim();

      // Cerca il giocatore nella lista
      const result = riconosciGiocatore(nomeEstratto, null, null, listaGiocatori);

      if (result.giocatoreRiconosciuto && result.confidence > 0.7) {
        if (!idGiaAggiunti.has(result.giocatoreRiconosciuto.id)) {
          riconosciuti.push(result.giocatoreRiconosciuto);
          idGiaAggiunti.add(result.giocatoreRiconosciuto.id);
        }
      } else if (nomeEstratto.length > 3 && !/^\d/.test(nomeEstratto)) {
        // Aggiungi ai non riconosciuti solo se sembra un nome
        nonRiconosciuti.push(nomeEstratto);
      }
    }
  } catch (error) {
    console.error('Errore OCR:', error);
    throw new Error('Errore nel riconoscimento dell\'immagine');
  }

  return { riconosciuti, nonRiconosciuti };
}

// Riconosce i giocatori da un file (Excel o immagine)
export async function riconosciGiocatoriDaFile(
  file: File,
  listaGiocatori: Player[]
): Promise<{ riconosciuti: Player[]; nonRiconosciuti: string[] }> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
    return riconosciGiocatoriDaExcel(file, listaGiocatori);
  } else if (fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
    return riconosciGiocatoriDaImmagine(file, listaGiocatori);
  } else {
    throw new Error('Formato file non supportato. Usa Excel (.xlsx, .xls, .csv) o immagine (.png, .jpg, .jpeg)');
  }
}
