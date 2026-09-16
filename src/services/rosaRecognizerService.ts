import { Player } from '../types';

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
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

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
// MATCHING: Trova il giocatore nel listone
// ============================================================

function trovaGiocatore(
  nomeEstratto: string,
  listaGiocatori: Player[]
): Player | null {
  const nomeNorm = normalizzaNome(nomeEstratto);
  if (!nomeNorm) return null;

  const parti = nomeNorm.split(' ').filter(p => p.length > 2);
  if (parti.length === 0) return null;

  const cognomeEstratto = parti[parti.length - 1];

  // 1. Match esatto
  for (const g of listaGiocatori) {
    const nomeCompleto = normalizzaNome(`${g.name} ${g.surname}`);
    if (nomeCompleto === nomeNorm) return g;
  }

  // 2. Match per cognome esatto
  for (const g of listaGiocatori) {
    const cognomeGiocatore = normalizzaNome(g.surname);
    if (cognomeGiocatore === cognomeEstratto) return g;
  }

  // 3. Match fuzzy (similarità > 0.8)
  let migliorMatch: Player | null = null;
  let migliorScore = 0.8;

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
// RICONOSCIMENTO DA FILE (Excel/CSV)
// ============================================================

export async function riconosciGiocatoriDaFile(
  file: File,
  listaGiocatori: Player[]
): Promise<RiconoscimentoResult> {
  if (file.type.startsWith('image/')) {
    throw new Error('Per le immagini usa riconosciGiocatoriDaImmagine()');
  }

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
// RICONOSCIMENTO DA IMMAGINE (con PaddleOCR)
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
