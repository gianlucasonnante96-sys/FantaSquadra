import { Player } from '../types';

// ============================================================
// TIPI
// ============================================================

export interface RiconoscimentoResult {
  riconosciuti: Player[];
  nonRiconosciuti: string[];
}

interface RiconoscimentoGiocatore {
  giocatoreRiconosciuto: Player | null;
  confidence: number;
  nomeOriginale: string;
}

// ============================================================
// UTILITY: Normalizzazione
// ============================================================

function normalizzaNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calcolaSimilarita(str1: string, str2: string): number {
  const s1 = normalizzaNome(str1);
  const s2 = normalizzaNome(str2);

  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const matrix: number[][] = [];
  for (let i = 0; i <= len1; i++) matrix[i] = [i];
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

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

// ============================================================
// MATCHING — come l'originale
// ============================================================

function riconosciGiocatore(
  nomeCercato: string,
  squadraCercata: string | null,
  ruoloCercato: string | null,
  listaGiocatori: Player[]
): RiconoscimentoGiocatore {
  let migliorMatch: Player | null = null;
  let migliorConfidence = 0;

  for (const giocatore of listaGiocatori) {
    const nomeCompleto = `${giocatore.name} ${giocatore.surname}`;
    const similaritaNome = calcolaSimilarita(nomeCercato, nomeCompleto);
    const similaritaCognome = calcolaSimilarita(nomeCercato, giocatore.surname);

    // Bonus squadra
    let bonusSquadra = 0;
    if (squadraCercata) {
      const similaritaSquadra = calcolaSimilarita(squadraCercata, giocatore.team);
      if (similaritaSquadra > 0.7) bonusSquadra = 0.2;
    }

    // Bonus ruolo
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

// ============================================================
// 🔥 EXCEL — LOGICA ORIGINALE RIPRISTINATA
// ============================================================

async function riconosciDaExcel(
  file: File,
  listaGiocatori: Player[]
): Promise<RiconoscimentoResult> {
  const XLSX = await import('xlsx');
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  console.log(`📊 Excel: ${jsonData.length} righe totali`);

  const riconosciuti: Player[] = [];
  const nonRiconosciuti: string[] = [];
  const idGiaAggiunti = new Set<string>();

  // 🔥 Trova l'header (prime 10 righe)
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(10, jsonData.length); i++) {
    const row = jsonData[i] as any[];
    if (row && row.length > 0) {
      const rowText = row.join(' ').toLowerCase();
      if (rowText.includes('nome') || rowText.includes('giocatore') || rowText.includes('calciatore')) {
        headerRowIndex = i;
        console.log(`📌 Header trovato alla riga ${i}`);
        break;
      }
    }
  }

  const headers = (jsonData[headerRowIndex] as any[]) || [];
  console.log(`📋 Headers: ${headers.join(' | ')}`);

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

  console.log(`🎯 Colonne — Nome: ${nomeCol}, Squadra: ${squadraCol}, Ruolo: ${ruoloCol}`);

  // 🔥 Processa ogni riga
  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i] as any[];
    if (!row || row.length === 0) continue;

    // 🔥 FALLBACK: se nomeCol è -1, usa row[0]
    const nome = nomeCol >= 0 ? row[nomeCol]?.toString() : row[0]?.toString();
    const squadra = squadraCol >= 0 ? row[squadraCol]?.toString() : null;
    const ruolo = ruoloCol >= 0 ? row[ruoloCol]?.toString() : null;

    if (!nome || nome.trim() === '') continue;
    if (nome.trim().length < 3) continue;

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

  console.log(`✅ Excel: ${riconosciuti.length} riconosciuti, ${nonRiconosciuti.length} non riconosciuti`);

  return { riconosciuti, nonRiconosciuti };
}

// ============================================================
// CSV / JSON / TXT
// ============================================================

async function riconosciDaTesto(
  file: File,
  listaGiocatori: Player[]
): Promise<RiconoscimentoResult> {
  const text = await file.text();
  const lines = text.split(/[\n,;]+/).map(l => l.trim()).filter(l => l.length > 2);

  const riconosciuti: Player[] = [];
  const nonRiconosciuti: string[] = [];
  const idGiaAggiunti = new Set<string>();

  for (const line of lines) {
    const result = riconosciGiocatore(line, null, null, listaGiocatori);
    if (result.giocatoreRiconosciuto && result.confidence > 0.6) {
      if (!idGiaAggiunti.has(result.giocatoreRiconosciuto.id)) {
        riconosciuti.push(result.giocatoreRiconosciuto);
        idGiaAggiunti.add(result.giocatoreRiconosciuto.id);
      }
    } else {
      nonRiconosciuti.push(line);
    }
  }

  return { riconosciuti, nonRiconosciuti };
}

// ============================================================
// 🔥 API PUBBLICA — File (Excel, CSV)
// ============================================================

export async function riconosciGiocatoriDaFile(
  file: File,
  listaGiocatori: Player[]
): Promise<RiconoscimentoResult> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
    return riconosciDaExcel(file, listaGiocatori);
  }

  return riconosciDaTesto(file, listaGiocatori);
}

// ============================================================
// 🔥 API PUBBLICA — Immagine (PaddleOCR text → match)
// ============================================================

export async function riconosciGiocatoriDaImmagine(
  file: File,
  listaGiocatori: Player[],
  testoOCR: string
): Promise<RiconoscimentoResult> {
  console.log('📝 Testo OCR ricevuto:', testoOCR.substring(0, 200));

  if (!testoOCR || testoOCR.length < 3) {
    return { riconosciuti: [], nonRiconosciuti: [] };
  }

  // 🔥 Usa lo stesso parser dell'originale per il testo OCR
  const lines = testoOCR.split(/[\n,;]+/).map(l => l.trim()).filter(l => l.length > 2);

  const riconosciuti: Player[] = [];
  const nonRiconosciuti: string[] = [];
  const idGiaAggiunti = new Set<string>();

  for (const line of lines) {
    // Pulisci la riga
    const nomePulito = line
      .replace(/\d+/g, '')
      .replace(/[^\w\s'.-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!nomePulito || nomePulito.length < 3) continue;

    const result = riconosciGiocatore(nomePulito, null, null, listaGiocatori);

    if (result.giocatoreRiconosciuto && result.confidence > 0.6) {
      if (!idGiaAggiunti.has(result.giocatoreRiconosciuto.id)) {
        riconosciuti.push(result.giocatoreRiconosciuto);
        idGiaAggiunti.add(result.giocatoreRiconosciuto.id);
      }
    } else {
      nonRiconosciuti.push(nomePulito);
    }
  }

  console.log(`✅ OCR: ${riconosciuti.length} riconosciuti, ${nonRiconosciuti.length} non riconosciuti`);
  return { riconosciuti, nonRiconosciuti };
}
