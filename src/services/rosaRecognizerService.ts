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

  // 1. Match esatto nome completo
  for (const g of listaGiocatori) {
    if (normalizzaNome(`${g.name} ${g.surname}`) === nomeNorm) return g;
    if (normalizzaNome(`${g.surname} ${g.name}`) === nomeNorm) return g;
  }

  // 2. Match per cognome esatto
  for (const g of listaGiocatori) {
    if (normalizzaNome(g.surname) === cognomeEstratto) return g;
  }

  // 3. Match fuzzy (similarità > 0.85)
  let migliorMatch: Player | null = null;
  let migliorScore = 0.85;

  for (const g of listaGiocatori) {
    const cognomeGiocatore = normalizzaNome(g.surname);
    const score = similarita(cognomeGiocatore, cognomeEstratto);
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

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    nomiGiocatori = await leggiNomiDaExcel(file);
  } else if (fileName.endsWith('.json')) {
    nomiGiocatori = await leggiNomiDaJSON(file);
  } else {
    nomiGiocatori = await leggiNomiDaTesto(file);
  }

  console.log(`📄 Estratti ${nomiGiocatori.length} nomi dal file`);
  console.log(`📋 Primi 5 nomi:`, nomiGiocatori.slice(0, 5));

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
// LETTURA EXCEL — VERSIONE ROBUSTA
// ============================================================

async function leggiNomiDaExcel(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const nomi: string[] = [];

        // 🔥 Itera su TUTTI i fogli del file (non solo il primo)
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

          if (!rows || rows.length < 2) continue;

          // 🔥 STEP 1: Trova la colonna del "Calciatore" cercando l'header
          const headerRowIndex = trovaHeaderRow(rows);
          const nameColumnIndex = trovaColonnaNome(rows, headerRowIndex);

          console.log(`📊 Foglio "${sheetName}": header row ${headerRowIndex}, colonna nome ${nameColumnIndex}`);

          // 🔥 STEP 2: Estrai i nomi dalla colonna giusta
          const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 1;

          for (let i = startRow; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !Array.isArray(row)) continue;

            // Se abbiamo identificato la colonna, usa quella
            let valoreCella = nameColumnIndex >= 0 ? row[nameColumnIndex] : null;

            // Se non abbiamo trovato la colonna, cerca la prima cella che "sembra un nome"
            if (!valoreCella) {
              for (const cell of row) {
                const testo = String(cell || '').trim();
                if (sembraNomeGiocatore(testo)) {
                  valoreCella = testo;
                  break;
                }
              }
            }

            if (!valoreCella) continue;

            const nome = String(valoreCella).trim();
            if (nome && nome.length >= 3 && nome.length <= 50 && !nonEUnNome(nome)) {
              nomi.push(nome);
            }
          }
        }

        // Rimuovi duplicati
        const nomiUnici = Array.from(new Set(nomi));
        resolve(nomiUnici);
      } catch (err) {
        console.error('Errore parsing Excel:', err);
        reject(new Error('Errore lettura Excel: ' + (err instanceof Error ? err.message : 'sconosciuto')));
      }
    };

    reader.onerror = () => reject(new Error('Errore lettura file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Trova la riga di intestazione cercando parole chiave come "Calciatore", "Nome", "Giocatore"
 */
function trovaHeaderRow(rows: any[][]): number {
  const keywords = ['calciatore', 'nome', 'giocatore', 'player', 'cognome', 'name'];

  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;

    const rowText = row.map(c => String(c || '').toLowerCase()).join(' ');
    
    // Se la riga contiene almeno 2 keywords, è probabilmente l'header
    const matches = keywords.filter(k => rowText.includes(k)).length;
    if (matches >= 1) {
      return i;
    }
  }

  return -1;
}

/**
 * Trova l'indice della colonna che contiene i nomi dei calciatori
 */
function trovaColonnaNome(rows: any[][], headerRowIndex: number): number {
  if (headerRowIndex < 0) return -1;

  const headerRow = rows[headerRowIndex];
  if (!headerRow || !Array.isArray(headerRow)) return -1;

  const nameKeywords = ['calciatore', 'nome', 'giocatore', 'player', 'cognome', 'name'];

  for (let i = 0; i < headerRow.length; i++) {
    const header = String(headerRow[i] || '').toLowerCase().trim();
    if (nameKeywords.some(k => header.includes(k))) {
      // 🔥 Escludi la colonna "nome squadra" o "nome allenatore"
      if (header.includes('squadra') || header.includes('team') || 
          header.includes('allenatore') || header.includes('ruolo')) {
        continue;
      }
      return i;
    }
  }

  return -1;
}

/**
 * Verifica se una stringa "sembra" il nome di un giocatore
 * (2+ parole, lettere, no numeri, no simboli strani)
 */
function sembraNomeGiocatore(testo: string): boolean {
  if (!testo || testo.length < 3 || testo.length > 50) return false;
  if (/^\d+/.test(testo)) return false; // inizia con numero
  if (!/^[A-ZÀ-Üa-zà-ü]/.test(testo)) return false; // inizia con lettera
  
  // Deve avere almeno 2 parole o una parola sola (cognome)
  const parole = testo.split(/\s+/).filter(p => p.length > 1);
  return parole.length >= 1 && parole.length <= 4;
}

/**
 * Verifica se una stringa è un'intestazione o un valore da scartare
 */
function nonEUnNome(testo: string): boolean {
  const lower = testo.toLowerCase().trim();
  const blacklist = [
    'calciatore', 'nome', 'giocatore', 'squadra', 'ruolo', 'quotazione',
    'fantamedia', 'media', 'presenze', 'gol', 'assist', 'ammonizioni',
    'espulsioni', 'rigori', 'portiere', 'difensore', 'centrocampista',
    'attaccante', 'total', 'totale', 'pk', 'rig', 'rp', 'amm', 'esp'
  ];
  return blacklist.some(b => lower === b || lower.startsWith(b + ' '));
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
      const nome = item.nome || item.name || item.calciatore || item.giocatore || '';
      const cognome = item.cognome || item.surname || '';
      const nomeCompleto = `${nome} ${cognome}`.trim();
      if (nomeCompleto.length >= 3) nomi.push(nomeCompleto);
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
    const nome = line.split(/[,\t;]/)[0]?.trim();
    if (nome && nome.length >= 3 && nome.length <= 50 && !nonEUnNome(nome)) {
      nomi.push(nome);
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

  const righe = testoOCR.split('\n').map(r => r.trim()).filter(r => r.length >= 4 && r.length <= 50);
  const riconosciuti: Player[] = [];
  const nonRiconosciuti: string[] = [];
  const idsAggiunti = new Set<string>();

  for (const riga of righe) {
    const nomePulito = riga.replace(/\d+/g, '').replace(/[^\w\s'.-]/g, '').replace(/\s+/g, ' ').trim();
    if (!nomePulito || nomePulito.length < 4) continue;
    if (nonEUnNome(nomePulito)) continue;

    const giocatore = trovaGiocatore(nomePulito, listaGiocatori);
    if (giocatore && !idsAggiunti.has(giocatore.id)) {
      riconosciuti.push(giocatore);
      idsAggiunti.add(giocatore.id);
    } else if (!giocatore) {
      if (!nonRiconosciuti.includes(nomePulito)) nonRiconosciuti.push(nomePulito);
    }
  }

  console.log(`✅ Riconosciuti: ${riconosciuti.length}, Non riconosciuti: ${nonRiconosciuti.length}`);
  return { riconosciuti, nonRiconosciuti };
}
