// Calendario completo Serie A 2026/27

export interface Partita {
  casa: string;
  trasferta: string;
}

export interface Giornata {
  numero: number;
  partite: Partita[];
}

// 🔥 Normalizza il nome squadra per confronto robusto
// "Udinese", "udinese", "Udinese ", "Udinese Calcio" → "udinese"
function normalizzaNomeSquadra(nome: string | undefined | null): string {
  if (typeof nome !== 'string' || !nome) return '';
  return nome
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')       // rimuove spazi doppi
    .replace(/[^a-z]/g, '');     // rimuove tutto tranne lettere
}

export const calendarioSerieA: Giornata[] = [
  {
    numero: 1,
    partite: [
      { casa: 'Atalanta', trasferta: 'Sassuolo' },
      { casa: 'Bologna', trasferta: 'Lazio' },
      { casa: 'Cagliari', trasferta: 'Parma' },
      { casa: 'Como', trasferta: 'Udinese' },
      { casa: 'Fiorentina', trasferta: 'Roma' },
      { casa: 'Frosinone', trasferta: 'Juventus' },
      { casa: 'Genoa', trasferta: 'Napoli' },
      { casa: 'Inter', trasferta: 'Monza' },
      { casa: 'Torino', trasferta: 'Milan' },
      { casa: 'Venezia', trasferta: 'Lecce' },
    ],
  },
  {
    numero: 2,
    partite: [
      { casa: 'Atalanta', trasferta: 'Bologna' },
      { casa: 'Cagliari', trasferta: 'Inter' },
      { casa: 'Fiorentina', trasferta: 'Frosinone' },
      { casa: 'Juventus', trasferta: 'Parma' },
      { casa: 'Lazio', trasferta: 'Genoa' },
      { casa: 'Lecce', trasferta: 'Roma' },
      { casa: 'Milan', trasferta: 'Venezia' },
      { casa: 'Monza', trasferta: 'Udinese' },
      { casa: 'Napoli', trasferta: 'Como' },
      { casa: 'Sassuolo', trasferta: 'Torino' },
    ],
  },
  {
    numero: 3,
    partite: [
      { casa: 'Bologna', trasferta: 'Sassuolo' },
      { casa: 'Cagliari', trasferta: 'Lecce' },
      { casa: 'Fiorentina', trasferta: 'Torino' },
      { casa: 'Frosinone', trasferta: 'Venezia' },
      { casa: 'Genoa', trasferta: 'Como' },
      { casa: 'Inter', trasferta: 'Napoli' },
      { casa: 'Juventus', trasferta: 'Milan' },
      { casa: 'Parma', trasferta: 'Monza' },
      { casa: 'Roma', trasferta: 'Atalanta' },
      { casa: 'Udinese', trasferta: 'Lazio' },
    ],
  },
  {
    numero: 4,
    partite: [
      { casa: 'Atalanta', trasferta: 'Cagliari' },
      { casa: 'Como', trasferta: 'Parma' },
      { casa: 'Genoa', trasferta: 'Frosinone' },
      { casa: 'Inter', trasferta: 'Udinese' },
      { casa: 'Lazio', trasferta: 'Milan' },
      { casa: 'Lecce', trasferta: 'Monza' },
      { casa: 'Napoli', trasferta: 'Bologna' },
      { casa: 'Sassuolo', trasferta: 'Juventus' },
      { casa: 'Torino', trasferta: 'Roma' },
      { casa: 'Venezia', trasferta: 'Fiorentina' },
    ],
  },
  {
    numero: 5,
    partite: [
      { casa: 'Bologna', trasferta: 'Torino' },
      { casa: 'Fiorentina', trasferta: 'Napoli' },
      { casa: 'Frosinone', trasferta: 'Como' },
      { casa: 'Juventus', trasferta: 'Atalanta' },
      { casa: 'Milan', trasferta: 'Lecce' },
      { casa: 'Monza', trasferta: 'Sassuolo' },
      { casa: 'Parma', trasferta: 'Genoa' },
      { casa: 'Roma', trasferta: 'Inter' },
      { casa: 'Udinese', trasferta: 'Cagliari' },
      { casa: 'Venezia', trasferta: 'Lazio' },
    ],
  },
  {
    numero: 6,
    partite: [
      { casa: 'Atalanta', trasferta: 'Venezia' },
      { casa: 'Cagliari', trasferta: 'Juventus' },
      { casa: 'Como', trasferta: 'Roma' },
      { casa: 'Genoa', trasferta: 'Fiorentina' },
      { casa: 'Inter', trasferta: 'Parma' },
      { casa: 'Lazio', trasferta: 'Monza' },
      { casa: 'Lecce', trasferta: 'Bologna' },
      { casa: 'Napoli', trasferta: 'Frosinone' },
      { casa: 'Sassuolo', trasferta: 'Milan' },
      { casa: 'Torino', trasferta: 'Udinese' },
    ],
  },
  {
    numero: 7,
    partite: [
      { casa: 'Bologna', trasferta: 'Inter' },
      { casa: 'Fiorentina', trasferta: 'Como' },
      { casa: 'Frosinone', trasferta: 'Sassuolo' },
      { casa: 'Juventus', trasferta: 'Lazio' },
      { casa: 'Milan', trasferta: 'Atalanta' },
      { casa: 'Monza', trasferta: 'Cagliari' },
      { casa: 'Parma', trasferta: 'Torino' },
      { casa: 'Roma', trasferta: 'Genoa' },
      { casa: 'Udinese', trasferta: 'Lecce' },
      { casa: 'Venezia', trasferta: 'Napoli' },
    ],
  },
  {
    numero: 8,
    partite: [
      { casa: 'Atalanta', trasferta: 'Frosinone' },
      { casa: 'Cagliari', trasferta: 'Bologna' },
      { casa: 'Como', trasferta: 'Sassuolo' },
      { casa: 'Genoa', trasferta: 'Venezia' },
      { casa: 'Inter', trasferta: 'Fiorentina' },
      { casa: 'Lazio', trasferta: 'Parma' },
      { casa: 'Lecce', trasferta: 'Juventus' },
      { casa: 'Napoli', trasferta: 'Roma' },
      { casa: 'Torino', trasferta: 'Monza' },
      { casa: 'Udinese', trasferta: 'Milan' },
    ],
  },
  {
    numero: 9,
    partite: [
      { casa: 'Fiorentina', trasferta: 'Atalanta' },
      { casa: 'Frosinone', trasferta: 'Lecce' },
      { casa: 'Genoa', trasferta: 'Juventus' },
      { casa: 'Milan', trasferta: 'Bologna' },
      { casa: 'Monza', trasferta: 'Napoli' },
      { casa: 'Parma', trasferta: 'Udinese' },
      { casa: 'Roma', trasferta: 'Cagliari' },
      { casa: 'Sassuolo', trasferta: 'Lazio' },
      { casa: 'Torino', trasferta: 'Como' },
      { casa: 'Venezia', trasferta: 'Inter' },
    ],
  },
  {
    numero: 10,
    partite: [
      { casa: 'Atalanta', trasferta: 'Parma' },
      { casa: 'Bologna', trasferta: 'Monza' },
      { casa: 'Como', trasferta: 'Venezia' },
      { casa: 'Frosinone', trasferta: 'Torino' },
      { casa: 'Juventus', trasferta: 'Napoli' },
      { casa: 'Lazio', trasferta: 'Cagliari' },
      { casa: 'Lecce', trasferta: 'Genoa' },
      { casa: 'Milan', trasferta: 'Inter' },
      { casa: 'Sassuolo', trasferta: 'Fiorentina' },
      { casa: 'Udinese', trasferta: 'Roma' },
    ],
  },
  {
    numero: 11,
    partite: [
      { casa: 'Cagliari', trasferta: 'Frosinone' },
      { casa: 'Fiorentina', trasferta: 'Juventus' },
      { casa: 'Genoa', trasferta: 'Milan' },
      { casa: 'Inter', trasferta: 'Como' },
      { casa: 'Monza', trasferta: 'Atalanta' },
      { casa: 'Napoli', trasferta: 'Lazio' },
      { casa: 'Parma', trasferta: 'Bologna' },
      { casa: 'Roma', trasferta: 'Sassuolo' },
      { casa: 'Torino', trasferta: 'Lecce' },
      { casa: 'Venezia', trasferta: 'Udinese' },
    ],
  },
  {
    numero: 12,
    partite: [
      { casa: 'Atalanta', trasferta: 'Inter' },
      { casa: 'Bologna', trasferta: 'Udinese' },
      { casa: 'Como', trasferta: 'Cagliari' },
      { casa: 'Juventus', trasferta: 'Venezia' },
      { casa: 'Lazio', trasferta: 'Lecce' },
      { casa: 'Milan', trasferta: 'Frosinone' },
      { casa: 'Monza', trasferta: 'Fiorentina' },
      { casa: 'Napoli', trasferta: 'Torino' },
      { casa: 'Parma', trasferta: 'Roma' },
      { casa: 'Sassuolo', trasferta: 'Genoa' },
    ],
  },
  {
    numero: 13,
    partite: [
      { casa: 'Cagliari', trasferta: 'Milan' },
      { casa: 'Como', trasferta: 'Juventus' },
      { casa: 'Frosinone', trasferta: 'Parma' },
      { casa: 'Inter', trasferta: 'Genoa' },
      { casa: 'Lecce', trasferta: 'Atalanta' },
      { casa: 'Roma', trasferta: 'Monza' },
      { casa: 'Sassuolo', trasferta: 'Napoli' },
      { casa: 'Torino', trasferta: 'Lazio' },
      { casa: 'Udinese', trasferta: 'Fiorentina' },
      { casa: 'Venezia', trasferta: 'Bologna' },
    ],
  },
  {
    numero: 14,
    partite: [
      { casa: 'Bologna', trasferta: 'Roma' },
      { casa: 'Fiorentina', trasferta: 'Cagliari' },
      { casa: 'Frosinone', trasferta: 'Inter' },
      { casa: 'Genoa', trasferta: 'Torino' },
      { casa: 'Juventus', trasferta: 'Udinese' },
      { casa: 'Lazio', trasferta: 'Atalanta' },
      { casa: 'Milan', trasferta: 'Parma' },
      { casa: 'Monza', trasferta: 'Como' },
      { casa: 'Napoli', trasferta: 'Lecce' },
      { casa: 'Venezia', trasferta: 'Sassuolo' },
    ],
  },
  {
    numero: 15,
    partite: [
      { casa: 'Atalanta', trasferta: 'Genoa' },
      { casa: 'Cagliari', trasferta: 'Venezia' },
      { casa: 'Como', trasferta: 'Bologna' },
      { casa: 'Inter', trasferta: 'Torino' },
      { casa: 'Juventus', trasferta: 'Monza' },
      { casa: 'Lazio', trasferta: 'Roma' },
      { casa: 'Lecce', trasferta: 'Sassuolo' },
      { casa: 'Napoli', trasferta: 'Milan' },
      { casa: 'Parma', trasferta: 'Fiorentina' },
      { casa: 'Udinese', trasferta: 'Frosinone' },
    ],
  },
  {
    numero: 16,
    partite: [
      { casa: 'Atalanta', trasferta: 'Napoli' },
      { casa: 'Fiorentina', trasferta: 'Bologna' },
      { casa: 'Frosinone', trasferta: 'Lazio' },
      { casa: 'Genoa', trasferta: 'Udinese' },
      { casa: 'Lecce', trasferta: 'Inter' },
      { casa: 'Milan', trasferta: 'Como' },
      { casa: 'Roma', trasferta: 'Juventus' },
      { casa: 'Sassuolo', trasferta: 'Parma' },
      { casa: 'Torino', trasferta: 'Cagliari' },
      { casa: 'Venezia', trasferta: 'Monza' },
    ],
  },
  {
    numero: 17,
    partite: [
      { casa: 'Bologna', trasferta: 'Juventus' },
      { casa: 'Cagliari', trasferta: 'Genoa' },
      { casa: 'Como', trasferta: 'Lecce' },
      { casa: 'Fiorentina', trasferta: 'Lazio' },
      { casa: 'Inter', trasferta: 'Sassuolo' },
      { casa: 'Monza', trasferta: 'Milan' },
      { casa: 'Parma', trasferta: 'Napoli' },
      { casa: 'Roma', trasferta: 'Frosinone' },
      { casa: 'Torino', trasferta: 'Venezia' },
      { casa: 'Udinese', trasferta: 'Atalanta' },
    ],
  },
  {
    numero: 18,
    partite: [
      { casa: 'Atalanta', trasferta: 'Como' },
      { casa: 'Frosinone', trasferta: 'Bologna' },
      { casa: 'Genoa', trasferta: 'Monza' },
      { casa: 'Juventus', trasferta: 'Torino' },
      { casa: 'Lazio', trasferta: 'Inter' },
      { casa: 'Lecce', trasferta: 'Parma' },
      { casa: 'Milan', trasferta: 'Fiorentina' },
      { casa: 'Napoli', trasferta: 'Cagliari' },
      { casa: 'Sassuolo', trasferta: 'Udinese' },
      { casa: 'Venezia', trasferta: 'Roma' },
    ],
  },
  {
    numero: 19,
    partite: [
      { casa: 'Bologna', trasferta: 'Genoa' },
      { casa: 'Cagliari', trasferta: 'Sassuolo' },
      { casa: 'Como', trasferta: 'Lazio' },
      { casa: 'Fiorentina', trasferta: 'Lecce' },
      { casa: 'Inter', trasferta: 'Juventus' },
      { casa: 'Monza', trasferta: 'Frosinone' },
      { casa: 'Parma', trasferta: 'Venezia' },
      { casa: 'Roma', trasferta: 'Milan' },
      { casa: 'Torino', trasferta: 'Atalanta' },
      { casa: 'Udinese', trasferta: 'Napoli' },
    ],
  },
  {
    numero: 20,
    partite: [
      { casa: 'Atalanta', trasferta: 'Roma' },
      { casa: 'Cagliari', trasferta: 'Como' },
      { casa: 'Juventus', trasferta: 'Genoa' },
      { casa: 'Lazio', trasferta: 'Bologna' },
      { casa: 'Lecce', trasferta: 'Udinese' },
      { casa: 'Milan', trasferta: 'Torino' },
      { casa: 'Napoli', trasferta: 'Fiorentina' },
      { casa: 'Parma', trasferta: 'Inter' },
      { casa: 'Sassuolo', trasferta: 'Monza' },
      { casa: 'Venezia', trasferta: 'Frosinone' },
    ],
  },
  {
    numero: 21,
    partite: [
      { casa: 'Bologna', trasferta: 'Atalanta' },
      { casa: 'Como', trasferta: 'Napoli' },
      { casa: 'Fiorentina', trasferta: 'Sassuolo' },
      { casa: 'Frosinone', trasferta: 'Milan' },
      { casa: 'Genoa', trasferta: 'Parma' },
      { casa: 'Inter', trasferta: 'Venezia' },
      { casa: 'Juventus', trasferta: 'Cagliari' },
      { casa: 'Lecce', trasferta: 'Torino' },
      { casa: 'Monza', trasferta: 'Lazio' },
      { casa: 'Roma', trasferta: 'Udinese' },
    ],
  },
  {
    numero: 22,
    partite: [
      { casa: 'Atalanta', trasferta: 'Fiorentina' },
      { casa: 'Cagliari', trasferta: 'Parma' },
      { casa: 'Genoa', trasferta: 'Lecce' },
      { casa: 'Lazio', trasferta: 'Venezia' },
      { casa: 'Milan', trasferta: 'Juventus' },
      { casa: 'Monza', trasferta: 'Roma' },
      { casa: 'Napoli', trasferta: 'Inter' },
      { casa: 'Sassuolo', trasferta: 'Como' },
      { casa: 'Torino', trasferta: 'Frosinone' },
      { casa: 'Udinese', trasferta: 'Bologna' },
    ],
  },
  {
    numero: 23,
    partite: [
      { casa: 'Atalanta', trasferta: 'Lazio' },
      { casa: 'Bologna', trasferta: 'Milan' },
      { casa: 'Como', trasferta: 'Monza' },
      { casa: 'Fiorentina', trasferta: 'Udinese' },
      { casa: 'Inter', trasferta: 'Cagliari' },
      { casa: 'Juventus', trasferta: 'Sassuolo' },
      { casa: 'Lecce', trasferta: 'Napoli' },
      { casa: 'Parma', trasferta: 'Frosinone' },
      { casa: 'Roma', trasferta: 'Torino' },
      { casa: 'Venezia', trasferta: 'Genoa' },
    ],
  },
  {
    numero: 24,
    partite: [
      { casa: 'Bologna', trasferta: 'Como' },
      { casa: 'Cagliari', trasferta: 'Lazio' },
      { casa: 'Frosinone', trasferta: 'Fiorentina' },
      { casa: 'Genoa', trasferta: 'Atalanta' },
      { casa: 'Inter', trasferta: 'Milan' },
      { casa: 'Monza', trasferta: 'Lecce' },
      { casa: 'Napoli', trasferta: 'Juventus' },
      { casa: 'Roma', trasferta: 'Parma' },
      { casa: 'Torino', trasferta: 'Sassuolo' },
      { casa: 'Udinese', trasferta: 'Venezia' },
    ],
  },
  {
    numero: 25,
    partite: [
      { casa: 'Atalanta', trasferta: 'Monza' },
      { casa: 'Como', trasferta: 'Torino' },
      { casa: 'Fiorentina', trasferta: 'Inter' },
      { casa: 'Juventus', trasferta: 'Bologna' },
      { casa: 'Lazio', trasferta: 'Napoli' },
      { casa: 'Lecce', trasferta: 'Frosinone' },
      { casa: 'Milan', trasferta: 'Genoa' },
      { casa: 'Sassuolo', trasferta: 'Roma' },
      { casa: 'Udinese', trasferta: 'Parma' },
      { casa: 'Venezia', trasferta: 'Cagliari' },
    ],
  },
  {
    numero: 26,
    partite: [
      { casa: 'Bologna', trasferta: 'Lecce' },
      { casa: 'Cagliari', trasferta: 'Udinese' },
      { casa: 'Como', trasferta: 'Milan' },
      { casa: 'Frosinone', trasferta: 'Napoli' },
      { casa: 'Genoa', trasferta: 'Lazio' },
      { casa: 'Inter', trasferta: 'Atalanta' },
      { casa: 'Monza', trasferta: 'Juventus' },
      { casa: 'Parma', trasferta: 'Sassuolo' },
      { casa: 'Roma', trasferta: 'Venezia' },
      { casa: 'Torino', trasferta: 'Fiorentina' },
    ],
  },
  {
    numero: 27,
    partite: [
      { casa: 'Atalanta', trasferta: 'Torino' },
      { casa: 'Fiorentina', trasferta: 'Venezia' },
      { casa: 'Juventus', trasferta: 'Roma' },
      { casa: 'Lazio', trasferta: 'Frosinone' },
      { casa: 'Lecce', trasferta: 'Como' },
      { casa: 'Milan', trasferta: 'Cagliari' },
      { casa: 'Monza', trasferta: 'Genoa' },
      { casa: 'Napoli', trasferta: 'Parma' },
      { casa: 'Sassuolo', trasferta: 'Bologna' },
      { casa: 'Udinese', trasferta: 'Inter' },
    ],
  },
  {
    numero: 28,
    partite: [
      { casa: 'Bologna', trasferta: 'Napoli' },
      { casa: 'Cagliari', trasferta: 'Fiorentina' },
      { casa: 'Como', trasferta: 'Udinese' },
      { casa: 'Frosinone', trasferta: 'Monza' },
      { casa: 'Genoa', trasferta: 'Roma' },
      { casa: 'Lazio', trasferta: 'Juventus' },
      { casa: 'Milan', trasferta: 'Sassuolo' },
      { casa: 'Parma', trasferta: 'Lecce' },
      { casa: 'Torino', trasferta: 'Inter' },
      { casa: 'Venezia', trasferta: 'Atalanta' },
    ],
  },
  {
    numero: 29,
    partite: [
      { casa: 'Atalanta', trasferta: 'Milan' },
      { casa: 'Fiorentina', trasferta: 'Genoa' },
      { casa: 'Inter', trasferta: 'Frosinone' },
      { casa: 'Juventus', trasferta: 'Como' },
      { casa: 'Monza', trasferta: 'Bologna' },
      { casa: 'Napoli', trasferta: 'Venezia' },
      { casa: 'Parma', trasferta: 'Lazio' },
      { casa: 'Roma', trasferta: 'Lecce' },
      { casa: 'Sassuolo', trasferta: 'Cagliari' },
      { casa: 'Udinese', trasferta: 'Torino' },
    ],
  },
  {
    numero: 30,
    partite: [
      { casa: 'Cagliari', trasferta: 'Napoli' },
      { casa: 'Como', trasferta: 'Fiorentina' },
      { casa: 'Frosinone', trasferta: 'Udinese' },
      { casa: 'Genoa', trasferta: 'Inter' },
      { casa: 'Lecce', trasferta: 'Lazio' },
      { casa: 'Milan', trasferta: 'Monza' },
      { casa: 'Roma', trasferta: 'Bologna' },
      { casa: 'Sassuolo', trasferta: 'Atalanta' },
      { casa: 'Torino', trasferta: 'Juventus' },
      { casa: 'Venezia', trasferta: 'Parma' },
    ],
  },
  {
    numero: 31,
    partite: [
      { casa: 'Bologna', trasferta: 'Venezia' },
      { casa: 'Cagliari', trasferta: 'Atalanta' },
      { casa: 'Fiorentina', trasferta: 'Milan' },
      { casa: 'Frosinone', trasferta: 'Genoa' },
      { casa: 'Inter', trasferta: 'Roma' },
      { casa: 'Juventus', trasferta: 'Lecce' },
      { casa: 'Lazio', trasferta: 'Torino' },
      { casa: 'Napoli', trasferta: 'Sassuolo' },
      { casa: 'Parma', trasferta: 'Como' },
      { casa: 'Udinese', trasferta: 'Monza' },
    ],
  },
  {
    numero: 32,
    partite: [
      { casa: 'Atalanta', trasferta: 'Udinese' },
      { casa: 'Bologna', trasferta: 'Cagliari' },
      { casa: 'Como', trasferta: 'Frosinone' },
      { casa: 'Fiorentina', trasferta: 'Parma' },
      { casa: 'Milan', trasferta: 'Napoli' },
      { casa: 'Monza', trasferta: 'Inter' },
      { casa: 'Roma', trasferta: 'Lazio' },
      { casa: 'Sassuolo', trasferta: 'Lecce' },
      { casa: 'Torino', trasferta: 'Genoa' },
      { casa: 'Venezia', trasferta: 'Juventus' },
    ],
  },
  {
    numero: 33,
    partite: [
      { casa: 'Cagliari', trasferta: 'Monza' },
      { casa: 'Frosinone', trasferta: 'Roma' },
      { casa: 'Genoa', trasferta: 'Sassuolo' },
      { casa: 'Inter', trasferta: 'Bologna' },
      { casa: 'Juventus', trasferta: 'Fiorentina' },
      { casa: 'Lazio', trasferta: 'Como' },
      { casa: 'Lecce', trasferta: 'Milan' },
      { casa: 'Napoli', trasferta: 'Udinese' },
      { casa: 'Parma', trasferta: 'Atalanta' },
      { casa: 'Venezia', trasferta: 'Torino' },
    ],
  },
  {
    numero: 34,
    partite: [
      { casa: 'Atalanta', trasferta: 'Juventus' },
      { casa: 'Bologna', trasferta: 'Fiorentina' },
      { casa: 'Como', trasferta: 'Inter' },
      { casa: 'Lecce', trasferta: 'Cagliari' },
      { casa: 'Milan', trasferta: 'Lazio' },
      { casa: 'Monza', trasferta: 'Venezia' },
      { casa: 'Roma', trasferta: 'Napoli' },
      { casa: 'Sassuolo', trasferta: 'Frosinone' },
      { casa: 'Torino', trasferta: 'Parma' },
      { casa: 'Udinese', trasferta: 'Genoa' },
    ],
  },
  {
    numero: 35,
    partite: [
      { casa: 'Fiorentina', trasferta: 'Roma' },
      { casa: 'Frosinone', trasferta: 'Atalanta' },
      { casa: 'Genoa', trasferta: 'Cagliari' },
      { casa: 'Inter', trasferta: 'Lecce' },
      { casa: 'Lazio', trasferta: 'Sassuolo' },
      { casa: 'Napoli', trasferta: 'Monza' },
      { casa: 'Parma', trasferta: 'Milan' },
      { casa: 'Torino', trasferta: 'Bologna' },
      { casa: 'Udinese', trasferta: 'Juventus' },
      { casa: 'Venezia', trasferta: 'Como' },
    ],
  },
  {
    numero: 36,
    partite: [
      { casa: 'Bologna', trasferta: 'Frosinone' },
      { casa: 'Cagliari', trasferta: 'Torino' },
      { casa: 'Como', trasferta: 'Atalanta' },
      { casa: 'Juventus', trasferta: 'Inter' },
      { casa: 'Lazio', trasferta: 'Udinese' },
      { casa: 'Lecce', trasferta: 'Fiorentina' },
      { casa: 'Milan', trasferta: 'Roma' },
      { casa: 'Monza', trasferta: 'Parma' },
      { casa: 'Napoli', trasferta: 'Genoa' },
      { casa: 'Sassuolo', trasferta: 'Venezia' },
    ],
  },
  {
    numero: 37,
    partite: [
      { casa: 'Atalanta', trasferta: 'Lecce' },
      { casa: 'Fiorentina', trasferta: 'Monza' },
      { casa: 'Frosinone', trasferta: 'Cagliari' },
      { casa: 'Genoa', trasferta: 'Bologna' },
      { casa: 'Inter', trasferta: 'Lazio' },
      { casa: 'Parma', trasferta: 'Juventus' },
      { casa: 'Roma', trasferta: 'Como' },
      { casa: 'Torino', trasferta: 'Napoli' },
      { casa: 'Udinese', trasferta: 'Sassuolo' },
      { casa: 'Venezia', trasferta: 'Milan' },
    ],
  },
  {
    numero: 38,
    partite: [
      { casa: 'Bologna', trasferta: 'Parma' },
      { casa: 'Cagliari', trasferta: 'Roma' },
      { casa: 'Como', trasferta: 'Genoa' },
      { casa: 'Juventus', trasferta: 'Frosinone' },
      { casa: 'Lazio', trasferta: 'Fiorentina' },
      { casa: 'Lecce', trasferta: 'Venezia' },
      { casa: 'Milan', trasferta: 'Udinese' },
      { casa: 'Monza', trasferta: 'Torino' },
      { casa: 'Napoli', trasferta: 'Atalanta' },
      { casa: 'Sassuolo', trasferta: 'Inter' },
    ],
  },
];

// 🔥 FIX: funzione con normalizzazione per match robusto
export function getAvversario(squadra: string, giornata: number): { avversario: string; inCasa: boolean } | null {
  if (!squadra) return null;
  
  const giornataData = calendarioSerieA.find(g => g.numero === giornata);
  if (!giornataData) return null;

  const squadraNorm = normalizzaNomeSquadra(squadra);

  for (const partita of giornataData.partite) {
    const casaNorm = normalizzaNomeSquadra(partita.casa);
    const trasfNorm = normalizzaNomeSquadra(partita.trasferta);
    
    if (casaNorm === squadraNorm) {
      return { avversario: partita.trasferta, inCasa: true };
    }
    if (trasfNorm === squadraNorm) {
      return { avversario: partita.casa, inCasa: false };
    }
  }

  return null;
}

export function getPartiteGiornata(giornata: number): Partita[] {
  const giornataData = calendarioSerieA.find(g => g.numero === giornata);
  return giornataData ? giornataData.partite : [];
}

export function giocaInCasa(squadra: string, giornata: number): boolean | null {
  if (!squadra) return null;
  
  const giornataData = calendarioSerieA.find(g => g.numero === giornata);
  if (!giornataData) return null;

  const squadraNorm = normalizzaNomeSquadra(squadra);

  for (const partita of giornataData.partite) {
    if (normalizzaNomeSquadra(partita.casa) === squadraNorm) return true;
    if (normalizzaNomeSquadra(partita.trasferta) === squadraNorm) return false;
  }

  return null;
}
