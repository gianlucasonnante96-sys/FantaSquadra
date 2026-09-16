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
  if (!nomeNorm || nomeNorm.length < 3) return null;

  const parti = nomeNorm.split(' ').filter(p => p.length > 2);
  if (parti.length === 0) return null;

  const cognomeEstratto = parti[parti.length - 1];
  if (cognomeEstratto.length < 3) return null;

  // 1. Match esatto nome completo (name + surname)
  for (const g of listaGiocatori) {
    const comb1 = normalizzaNome(`${g.name} ${g.surname}`);
    const comb2 = normalizzaNome(`${g.surname} ${g.name}`);
    if (comb1 === nomeNorm || comb2 === nomeNorm) return g;
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
// RICONOSCIMENTO DA FILE
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
    // 🔥 Passa la lista per matchare direttamente le celle
    nomiGiocatori = await leggiNomiDaExcel(file, listaGiocatori);
  } else if (fileName.endsWith('.json')) {
    nomiGiocatori = await leggiNomiDaJSON(file);
  } else {
    nomiGiocatori = await leggiNomiDaTesto(file);
  }

  console.log(`📄 Estratti ${nomiGiocatori.length} nomi dal file`);
  console.log(`📋 Primi 10 nomi:`, nomiGiocatori.slice(0, 10));

  // 🔥 A questo punto i nomi sono già matchati (per Excel), ma rifacciamo il match per sicurezza
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
// 🔥 LETTURA EXCEL — APPROCCIO "MATCH DIRETTO"
// ============================================================

async function leggiNomiDaExcel(file: File, listaGiocatori: Player[]): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const nomiTrovati: string[] = [];

        console.log(`📚 File Excel con ${workbook.SheetNames.length} fogli`);

        // 🔥 Itera su TUTTI i fogli
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

          if (!rows || rows.length === 0) continue;

          console.log(`📊 Foglio "${sheetName}": ${rows.length} righe`);

          // 🔥 MATCH DIRETTO: per ogni cella, prova a matchare con il listone
          for (const row of rows) {
            if (!row || !Array.isArray(row)) continue;

            for (const cell of row) {
              if (cell === null || cell === undefined) continue;

              const testo = String(cell).trim();

              // Filtri base
              if (!testo || testo.length < 3 || testo.length > 50) continue;
              if (/^\d+$/.test(testo)) continue; // solo numeri
              if (/^[^a-zA-ZÀ-ü]+$/.test(testo)) continue; // nessuna lettera

              // 🔥 Prova a matchare direttamente con il listone
              const giocatore = trovaGiocatore(testo, listaGiocatori);

              if (giocatore) {
                // Aggiungi il nome del giocatore trovato (nome completo dal listone)
                const nomeCompleto = `${giocatore.name} ${giocatore.surname}`.trim();
                if (nomeCompleto && !nomiTrovati.includes(nomeCompleto)) {
                  nomiTrovati.push(nomeCompleto);
                }
              }
            }
          }
        }

        console.log(`🎯 Match diretti trovati: ${nomiTrovati.length}`);
        resolve(nomiTrovati);
      } catch (err) {
        console.error('Errore parsing Excel:', err);
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
    if (nome && nome.length >= 3 && nome.length <= 50) {
      nomi.push(nome);
    }
  }
  return nomi;
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
