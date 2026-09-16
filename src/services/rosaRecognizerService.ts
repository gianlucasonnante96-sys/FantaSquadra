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

  // 1. Match esatto nome completo (name + surname)
  for (const g of listaGiocatori) {
    const nomeCompleto = normalizzaNome(`${g.name} ${g.surname}`);
    if (nomeCompleto === nomeNorm) return g;
  }

  // 2. Match per cognome
  const parti = nomeNorm.split(' ').filter(p => p.length > 2);
  if (parti.length > 0) {
    const cognome = parti[parti.length - 1];
    for (const g of listaGiocatori) {
      const cognomeGiocatore = normalizzaNome(g.surname);
      if (cognomeGiocatore === cognome) return g;
      if (similarita(cognomeGiocatore, cognome) > 0.85) return g;
    }
  }

  return null;
}

// ============================================================
// RICONOSCIMENTO DA FILE (Excel, CSV, JSON)
// ============================================================

export async function riconosciGiocatoriDaFile(
  file: File,
  listaGiocatori: Player[]
): Promise<RiconoscimentoResult> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return riconosciDaExcel(file, listaGiocatori);
  }

  return riconosciDaTesto(file, listaGiocatori);
}

// ============================================================
// 🔥 EXCEL — CODICE ORIGINALE CHE FUNZIONAVA
// ============================================================

async function riconosciDaExcel(
  file: File,
  listaGiocatori: Player[]
): Promise<RiconoscimentoResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

        if (rows.length < 2) {
          reject(new Error('Il file è vuoto o non contiene dati'));
          return;
        }

        // 🔥 Trova l'header (prima riga con testo)
        let headerRowIndex = 0;
        let headers: string[] = [];

        for (let i = 0; i < Math.min(15, rows.length); i++) {
          const row = rows[i] as any[];
          if (row && row.length > 2) {
            const rowText = row.join(' ').toLowerCase();
            if (rowText.includes('calciatore') || rowText.includes('nome') ||
                rowText.includes('giocatore') || rowText.includes('ruolo') ||
                rowText.includes('squadra')) {
              headerRowIndex = i;
              headers = row.map(h => (h || '').toString());
              console.log('Header trovato alla riga', i, ':', headers);
              break;
            }
          }
        }

        if (headers.length === 0) {
          for (let i = 0; i < Math.min(5, rows.length); i++) {
            const row = rows[i] as any[];
            if (row && row.length > 2 && row.some(cell => cell && cell.toString().trim())) {
              headers = row.map(h => (h || '').toString());
              headerRowIndex = i;
              console.log('Usando prima riga come header:', headers);
              break;
            }
          }
        }

        // 🔥 Trova la colonna del nome
        let nameCol = -1;
        const namePatterns = ['calciatore', 'nome', 'giocatore', 'player', 'cognome'];
        for (let i = 0; i < headers.length; i++) {
          const h = headers[i].toLowerCase();
          if (namePatterns.some(p => h.includes(p))) {
            nameCol = i;
            break;
          }
        }

        if (nameCol === -1) {
          // Fallback: cerca la prima colonna con testo (non numeri)
          for (let i = 0; i < headers.length; i++) {
            const colValues = rows.slice(headerRowIndex + 1, headerRowIndex + 6)
              .map(r => (r as any[])?.[i]?.toString().trim())
              .filter(v => v && !/^\d+$/.test(v));
            if (colValues.length >= 3) {
              nameCol = i;
              break;
            }
          }
        }

        if (nameCol === -1) {
          reject(new Error('Colonna "Calciatore/Nome" non trovata nel file'));
          return;
        }

        console.log(`📊 Header row: ${headerRowIndex}, Colonna nome: ${nameCol}`);
        console.log(`📋 Headers: ${headers.join(' | ')}`);

        const riconosciuti: Player[] = [];
        const nonRiconosciuti: string[] = [];
        const idsAggiunti = new Set<string>();

        // 🔥 Parsa i dati
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i] as any[];
          if (!row || !Array.isArray(row)) continue;

          const nomeRaw = row[nameCol];
          if (!nomeRaw) continue;

          const nome = nomeRaw.toString().trim();
          if (!nome || nome.length < 3) continue;

          const giocatore = trovaGiocatore(nome, listaGiocatori);

          if (giocatore && !idsAggiunti.has(giocatore.id)) {
            riconosciuti.push(giocatore);
            idsAggiunti.add(giocatore.id);
          } else if (!giocatore) {
            nonRiconosciuti.push(nome);
          }
        }

        console.log(`✅ Excel: ${riconosciuti.length} riconosciuti, ${nonRiconosciuti.length} non riconosciuti`);

        resolve({ riconosciuti, nonRiconosciuti });
      } catch (err) {
        reject(new Error(`Errore nel parsing del file: ${err instanceof Error ? err.message : 'sconosciuto'}`));
      }
    };

    reader.onerror = () => reject(new Error('Errore nella lettura del file'));
    reader.readAsArrayBuffer(file);
  });
}

// ============================================================
// CSV / JSON / TXT
// ============================================================

async function riconosciDaTesto(
  file: File,
  listaGiocatori: Player[]
): Promise<RiconoscimentoResult> {
  const text = await file.text();
  const lines = text.split('\n').filter(l => l.trim());
  const riconosciuti: Player[] = [];
  const nonRiconosciuti: string[] = [];
  const idsAggiunti = new Set<string>();

  for (const line of lines) {
    const nome = line.split(/[,\t;]/)[0]?.trim();
    if (!nome || nome.length < 3) continue;

    const giocatore = trovaGiocatore(nome, listaGiocatori);
    if (giocatore && !idsAggiunti.has(giocatore.id)) {
      riconosciuti.push(giocatore);
      idsAggiunti.add(giocatore.id);
    } else if (!giocatore) {
      nonRiconosciuti.push(nome);
    }
  }

  return { riconosciuti, nonRiconosciuti };
}

// ============================================================
// RICONOSCIMENTO DA IMMAGINE (PaddleOCR)
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
    .filter(r => r.length >= 4 && r.length <= 50);

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
