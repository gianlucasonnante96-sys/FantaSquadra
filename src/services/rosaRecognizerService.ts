import { Player } from '../types';
import * as XLSX from 'xlsx';

// ============================================================
// TIPI
// ============================================================

export interface RiconoscimentoResult {
  riconosciuti: Player[];
  nonRiconosciuti: string[];
}

// ============================================================
// UTILITY: Normalizzazione nomi
// ============================================================

function normalizzaNome(nome: string): string {
  return nome
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ');
}

function similarita(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return 1 - matrix[a.length][b.length] / maxLen;
}

// ============================================================
// MATCHING
// ============================================================

function trovaGiocatore(nomeEstratto: string, listaGiocatori: Player[]): Player | null {
  const nomeNorm = normalizzaNome(nomeEstratto);
  if (!nomeNorm) return null;

  const parti = nomeNorm.split(' ').filter(p => p.length > 2);
  if (parti.length === 0) return null;

  const cognomeEstratto = parti[parti.length - 1];

  // 1. Match esatto
  for (const g of listaGiocatori) {
    if (normalizzaNome(`${g.name} ${g.surname}`) === nomeNorm) return g;
  }

  // 2. Match per cognome esatto
  for (const g of listaGiocatori) {
    if (normalizzaNome(g.surname) === cognomeEstratto) return g;
  }

  // 3. Match fuzzy
  let migliorMatch: Player | null = null;
  let migliorScore = 0.8;

  for (const g of listaGiocatori) {
    const score = similarita(normalizzaNome(g.surname), cognomeEstratto);
    if (score > migliorScore) {
      migliorScore = score;
      migliorMatch = g;
    }
  }

  return migliorMatch;
}

// ============================================================
// RICONOSCIMENTO DA FILE (Excel, CSV, JSON)
// ============================================================

export async function riconosciGiocatoriDaFile(
  file: File,
  listaGiocatori: Player[]
): Promise<RiconoscimentoResult> {
  const fileName = file.name.toLowerCase();
  const riconosciuti: Player[] = [];
  const nonRiconosciuti: string[] = [];
  const idsAggiunti = new Set<string>();

  let nomiGiocatori: string[] = [];

  // 🔥 RILEVA IL TIPO DI FILE
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    // EXCEL
    nomiGiocatori = await leggiNomiDaExcel(file);
  } else if (fileName.endsWith('.json')) {
    // JSON
    nomiGiocatori = await leggiNomiDaJSON(file);
  } else {
    // CSV/TXT (testo)
    nomiGiocatori = await leggiNomiDaTesto(file);
  }

  console.log(`📄 Estratti ${nomiGiocatori.length} nomi dal file`);

  // 🔥 MATCH con il listone
  for (const nome of nomiGiocatori) {
    if (!nome || nome.length < 3) continue;

    const giocatore = trovaGiocatore(nome, listaGiocatori);
    if (giocatore && !idsAggiunti.has(giocatore.id)) {
      riconosciuti.push(giocatore);
      idsAggiunti.add(giocatore.id);
    } else if (!giocatore) {
      if (!nonRiconosciuti.includes(nome)) {
        nonRiconosciuti.push(nome);
      }
    }
  }

  console.log(`✅ Riconosciuti: ${riconosciuti.length}, Non riconosciuti: ${nonRiconosciuti.length}`);

  return { riconosciuti, nonRiconosciuti };
}

// ============================================================
// LETTURA EXCEL
// ============================================================

async function leggiNomiDaExcel(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Prendi il primo foglio
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Converti in array di array
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

        const nomi: string[] = [];

        for (const row of rows) {
          if (!row || !Array.isArray(row)) continue;

          // Prendi la prima cella non vuota della riga
          for (const cell of row) {
            const testo = String(cell || '').trim();
            if (testo.length >= 3 && testo.length <= 40) {
              // Evita header comuni
              const lower = testo.toLowerCase();
              if (!lower.includes('nome') && 
                  !lower.includes('calciatore') && 
                  !lower.includes('giocatore') &&
                  !lower.includes('squadra') &&
                  !lower.includes('ruolo')) {
                nomi.push(testo);
                break; // Solo il primo nome per riga
              }
            }
          }
        }

        resolve(nomi);
      } catch (err) {
        reject(new Error('Errore lettura Excel: ' + (err instanceof Error ? err.message : 'sconosciuto')));
      }
    };

    reader.onerror = () => reject(new Error('Errore lettura file'));
    reader.readAsArrayBuffer(file);
  });
}

// ============================================================
// LETTURA JSON
// ============================================================

async function leggiNomiDaJSON(file: File): Promise<string[]> {
  const text = await file.text();
  const data = JSON.parse(text);

  if (!Array.isArray(data)) return [];

  const nomi: string[] = [];

  for (const item of data) {
    if (typeof item === 'string') {
      nomi.push(item);
    } else if (item && typeof item === 'object') {
      // Prova vari campi comuni
      const nome = item.nome || item.name || item.calciatore || item.giocatore || '';
      const cognome = item.cognome || item.surname || '';
      const nomeCompleto = `${nome} ${cognome}`.trim();
      if (nomeCompleto.length >= 3) {
        nomi.push(nomeCompleto);
      }
    }
  }

  return nomi;
}

// ============================================================
// LETTURA CSV/TXT
// ============================================================

async function leggiNomiDaTesto(file: File): Promise<string[]> {
  const text = await file.text();
  const lines = text.split('\n').filter(l => l.trim());

  const nomi: string[] = [];

  for (const line of lines) {
    // Prendi la prima colonna
    const nome = line.split(/[,\t;]/)[0]?.trim();
    if (nome && nome.length >= 3 && nome.length <= 40) {
      // Evita header
      const lower = nome.toLowerCase();
      if (!lower.includes('nome') && 
          !lower.includes('calciatore') && 
          !lower.includes('squadra')) {
        nomi.push(nome);
      }
    }
  }

  return nomi;
}

// ============================================================
// RICONOSCIMENTO DA IMMAGINE
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

  const righe = testoOCR
    .split('\n')
    .map(r => r.trim())
    .filter(r => r.length >= 4 && r.length <= 40);

  const riconosciuti: Player[] = [];
  const nonRiconosciuti: string[] = [];
  const idsAggiunti = new Set<string>();

  for (const riga of righe) {
    const nomePulito = riga
      .replace(/\d+/g, '')
      .replace(/[^\w\s'.-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!nomePulito || nomePulito.length < 4) continue;

    const giocatore = trovaGiocatore(nomePulito, listaGiocatori);

    if (giocatore && !idsAggiunti.has(giocatore.id)) {
      riconosciuti.push(giocatore);
      idsAggiunti.add(giocatore.id);
    } else if (!giocatore) {
      if (!nonRiconosciuti.includes(nomePulito)) {
        nonRiconosciuti.push(nomePulito);
      }
    }
  }

  console.log(`✅ Riconosciuti: ${riconosciuti.length}, Non riconosciuti: ${nonRiconosciuti.length}`);

  return { riconosciuti, nonRiconosciuti };
}
