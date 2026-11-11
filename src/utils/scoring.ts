import { Player, LeagueRules, FormationSlot } from '../types';
import { cercaInfortunio } from './infortuni';
import squadreData from '../data/squadre.json';
import risultatiData from '../data/risultati.json';

// ============================================================
// CONFIGURAZIONE
// ============================================================

const CONFIG = {
  // Fantavoto medio di chi scende in campo, per ruolo (Serie A 2026/27).
  // È il punto di partenza per giocatori con poche partite.
  mediaRuolo: { P: 4.8, D: 6.0, C: 6.4, A: 6.9 } as Record<string, number>,

  // Quante "partite virtuali" alla media di ruolo si aggiungono alla fantamedia.
  // Con 2 partite giocate la fantamedia conta poco, con 10 conta molto.
  partiteVirtuali: 5,

  // Quanto la fantamedia del giocatore sposta il voto previsto rispetto alla media
  // di ruolo. Valori < 1 perché una parte della fantamedia è fortuna (un gol in
  // più o in meno) e non si ripete.
  pesoFantamedia: { P: 0.15, D: 0.6, C: 0.75, A: 0.9 } as Record<string, number>,

  // Effetto della forza della propria squadra e dell'avversario (forza 1 = media).
  // Per i portieri pesano molto perché il loro fantavoto dipende dai gol subiti.
  pesoForzaSquadra: { P: 2.4, D: 1.0, C: 0.9, A: 1.2 } as Record<string, number>,
  pesoForzaAvversario: { P: 2.1, D: 0.9, C: 1.0, A: 1.95 } as Record<string, number>,

  // Differenza casa/trasferta: metà in più in casa, metà in meno fuori.
  vantaggioCasa: { P: 0.3, D: 0.05, C: 0.1, A: 0.35 } as Record<string, number>,

  // Se un titolare non gioca entra un panchinaro: in media vale circa 6 punti,
  // ma non sempre c'è un cambio disponibile (massimo 3, stesso ruolo).
  valoreSostituto: 4,

  // Probabilità residua di giocare per un giocatore segnalato "in dubbio"
  fattoreDubbio: 0.3,

  // Clean sheet (solo se la lega usa il bonus imbattibilità)
  mediaGolCampionato: 1.4,

  pesoMomentum: 0.2,

  sosPeso: 0.5,
  sosMinPartite: 3,
  strengthRange: [0.55, 1.40] as [number, number],
};

// ============================================================
// UTILITY
// ============================================================

function normalizzaNomeSquadra(nome: string | undefined): string {
  if (!nome) return '';
  const n = nome.trim();
  const SIGLE: Record<string, string> = {
    'ATA': 'Atalanta', 'BOL': 'Bologna', 'CAG': 'Cagliari', 'COM': 'Como',
    'FIO': 'Fiorentina', 'FRO': 'Frosinone', 'GEN': 'Genoa', 'INT': 'Inter',
    'JUV': 'Juventus', 'LAZ': 'Lazio', 'LEC': 'Lecce', 'MIL': 'Milan',
    'MON': 'Monza', 'NAP': 'Napoli', 'PAR': 'Parma', 'ROM': 'Roma',
    'SAS': 'Sassuolo', 'TOR': 'Torino', 'UDI': 'Udinese', 'VEN': 'Venezia',
  };
  const upper = n.toUpperCase();
  if (SIGLE[upper]) return SIGLE[upper];
  return n;
}

// ============================================================
// STATISTICHE SQUADRA
// ============================================================

interface StatsSquadra {
  punti: number;
  g: number;
  gf: number;
  gs: number;
  forma: string[];
}

function getStatsSquadra(team: string | undefined): StatsSquadra | null {
  if (!team) return null;
  try {
    const dati = squadreData as any;
    if (!dati || !dati.squadre) return null;

    const nome = normalizzaNomeSquadra(team);

    for (const [key, value] of Object.entries(dati.squadre)) {
      const keyNorm = normalizzaNomeSquadra(key);
      if (keyNorm.toLowerCase() === nome.toLowerCase()) {
        const v = value as any;
        return {
          punti: v.punti ?? 0,
          g: v.g ?? v.partite ?? 0,
          gf: v.gf ?? v.goalsFor ?? 0,
          gs: v.gs ?? v.goalsAgainst ?? 0,
          forma: Array.isArray(v.forma) ? v.forma : [],
        };
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

// ============================================================
// STRENGTH OF SCHEDULE
// ============================================================

interface PartitaGiocata {
  casa: string;
  trasferta: string;
  golCasa: number;
  golTrasferta: number;
}

function getTutteLePartiteGiocate(): PartitaGiocata[] {
  try {
    const dati = risultatiData as any;
    if (!dati || !dati.giornate) return [];

    const partite: PartitaGiocata[] = [];
    for (const giornata of Object.values(dati.giornate)) {
      if (Array.isArray(giornata)) {
        for (const p of giornata) {
          if (p && p.casa && p.trasferta && typeof p.golCasa === 'number') {
            partite.push(p);
          }
        }
      }
    }
    return partite;
  } catch {
    return [];
  }
}

function calcolaStrengthBase(team: string): number {
  const stats = getStatsSquadra(team);
  if (!stats || stats.g === 0) return 0.85;

  const puntiMax = stats.g * 3;
  const puntiRatio = Math.min(1, stats.punti / puntiMax);
  const gfRatio = Math.min(3, stats.gf / stats.g) / 3;
  const gsRatio = Math.min(3, stats.gs / stats.g) / 3;

  const strength = 0.55
                 + (puntiRatio * 0.50)
                 + (gfRatio * 0.20)
                 - (gsRatio * 0.25);

  const [min, max] = CONFIG.strengthRange;
  return Math.max(min, Math.min(max, strength));
}

let strengthCache: Map<string, number> | null = null;

function getStrengthCache(): Map<string, number> {
  if (strengthCache) return strengthCache;

  const mappa = new Map<string, number>();

  try {
    const dati = squadreData as any;
    if (!dati || !dati.squadre) {
      strengthCache = mappa;
      return mappa;
    }

    // 1) Strength base per ogni squadra
    const base = new Map<string, number>();
    for (const nome of Object.keys(dati.squadre)) {
      base.set(nome, calcolaStrengthBase(nome));
    }

    // 2) Media campionato
    const valori = Array.from(base.values());
    const mediaCampionato = valori.reduce((a, b) => a + b, 0) / (valori.length || 1);

    // 3) Partite giocate
    const partiteGiocate = getTutteLePartiteGiocate();

    console.log(`📊 Strength of Schedule: ${partiteGiocate.length} partite giocate da analizzare`);

    // 4) Per ogni squadra: media della forza degli avversari incontrati
    for (const [nome, sBase] of base.entries()) {
      const avversariIncontrati: number[] = [];
      const nomiAvversari: string[] = [];

      for (const p of partiteGiocate) {
        const casaNorm = normalizzaNomeSquadra(p.casa);
        const trasfNorm = normalizzaNomeSquadra(p.trasferta);
        const teamNorm = normalizzaNomeSquadra(nome);

        if (casaNorm.toLowerCase() === teamNorm.toLowerCase()) {
          const sAvv = base.get(p.trasferta) ?? 0.85;
          avversariIncontrati.push(sAvv);
          nomiAvversari.push(p.trasferta);
        } else if (trasfNorm.toLowerCase() === teamNorm.toLowerCase()) {
          const sAvv = base.get(p.casa) ?? 0.85;
          avversariIncontrati.push(sAvv);
          nomiAvversari.push(p.casa);
        }
      }

      if (avversariIncontrati.length < CONFIG.sosMinPartite) {
        mappa.set(nome, sBase);
        console.log(`   ${nome}: base=${sBase.toFixed(3)}, SoS=n/a (solo ${avversariIncontrati.length} partite)`);
        continue;
      }

      const mediaAvversari = avversariIncontrati.reduce((a, b) => a + b, 0) / avversariIncontrati.length;
      const diffSoS = mediaAvversari - mediaCampionato;
      const fattoreSoS = 1 + diffSoS * CONFIG.sosPeso;
      const strengthFinale = sBase * fattoreSoS;

      const [min, max] = CONFIG.strengthRange;
      const finale = Math.max(min, Math.min(max, strengthFinale));
      mappa.set(nome, finale);

      const delta = finale - sBase;
      const segno = delta >= 0 ? '+' : '';
      console.log(`   ${nome}: base=${sBase.toFixed(3)} → ${finale.toFixed(3)} (${segno}${delta.toFixed(3)}) avv: ${nomiAvversari.join(', ')}`);
    }

    console.log(`📊 Strength of Schedule: ${mappa.size}/${base.size} squadre processate`);
    const conSoS = Array.from(base.entries()).filter(([nome]) => {
      const b = base.get(nome)!;
      const s = mappa.get(nome)!;
      return Math.abs(b - s) > 0.01;
    }).length;
    console.log(`📊 Squadre con SoS applicata: ${conSoS}/${base.size}`);

    strengthCache = mappa;
    return mappa;
  } catch (e) {
    console.error('Errore SoS:', e);
    strengthCache = mappa;
    return mappa;
  }
}

// ============================================================
// ESPORTATE: Team Strength, Fixture, Momentum
// ============================================================

export function getTeamStrength(team: string | undefined): number {
  if (!team) return 0.85;
  const cache = getStrengthCache();

  const nome = normalizzaNomeSquadra(team);
  for (const [key, value] of cache.entries()) {
    if (normalizzaNomeSquadra(key).toLowerCase() === nome.toLowerCase()) {
      return value;
    }
  }
  return 0.85;
}

export function getFixtureDifficulty(avversario: string | undefined): number {
  const strength = getTeamStrength(avversario);

  const [min, max] = CONFIG.strengthRange;
  const normalized = (strength - min) / (max - min);
  const amplified = Math.pow(normalized, 0.7);

  return 1 + amplified * 4;
}

export function getMomentum(team: string | undefined): number {
  const stats = getStatsSquadra(team);

  if (!stats || !Array.isArray(stats.forma) || stats.forma.length === 0) {
    return 0;
  }

  const puntiForma: Record<string, number> = { 'W': 3, 'D': 1, 'L': 0 };
  const formScore = stats.forma.reduce((sum, r) => sum + (puntiForma[r] || 0), 0);
  const maxFormScore = stats.forma.length * 3;
  const formRatio = maxFormScore > 0 ? formScore / maxFormScore : 0.5;

  return (formRatio - 0.5) * 2 * CONFIG.pesoMomentum;
}

export function getFormaSquadra(team: string | undefined): string[] {
  const stats = getStatsSquadra(team);
  return stats?.forma || [];
}

export function getStatisticheSquadra(team: string | undefined): StatsSquadra | null {
  return getStatsSquadra(team);
}

// ============================================================
// STIMA GOL SUBITI ATTESI (Poisson) — per il bonus imbattibilità
// ============================================================

function stimaGolSubitiAttesi(
  team: string | undefined,
  avversario: string | undefined,
  inCasa: boolean
): number {
  if (!team || !avversario) return 1.0;

  const statsTeam = getStatsSquadra(team);
  const statsAvv = getStatsSquadra(avversario);

  if (!statsTeam || !statsAvv || statsTeam.g === 0 || statsAvv.g === 0) {
    return 1.0;
  }

  const gsPerPartita = statsTeam.gs / statsTeam.g;
  const gfPerPartitaAvv = statsAvv.gf / statsAvv.g;

  let lambda = (gsPerPartita * gfPerPartitaAvv) / CONFIG.mediaGolCampionato;

  if (inCasa) lambda *= 0.85;
  else lambda *= 1.15;

  return Math.max(0.2, Math.min(3.5, lambda));
}

// ============================================================
// PROBABILITÀ DI GIOCARE
// ============================================================

export function calcolaProbabilitaGioca(player: Player): number {
  if (!player) return 0.5;
  let prob = (player.titolarita ?? 50) / 100;

  const infortunio = cercaInfortunio(player);
  if (infortunio) {
    if (infortunio.stato === 'out' || infortunio.stato === 'out-lungo') prob = 0;
    else if (infortunio.stato === 'dubbio') prob *= CONFIG.fattoreDubbio;
  }

  return Math.max(0, Math.min(1, prob));
}

// ============================================================
// VOTO PREVISTO SE GIOCA
// ============================================================

/**
 * Fantavoto atteso nel caso in cui il giocatore scenda in campo.
 * Ogni fattore entra una sola volta:
 *   media di ruolo
 *   + quanto il giocatore è sopra/sotto la media (fantamedia "prudente")
 *   + forza della propria squadra − forza dell'avversario
 *   ± casa/trasferta
 * La fantamedia contiene già gol, assist e malus: non si aggiungono di nuovo.
 */
export function calcolaVotoSeGioca(player: Player, rules: LeagueRules): number {
  const role = player.role;
  const media = CONFIG.mediaRuolo[role] ?? 6;

  const fm = (player.fantamedia ?? 0) > 0 ? player.fantamedia : media;
  const partite = (player.fantamedia ?? 0) > 0 ? Math.max(0, player.partiteGiocate ?? 0) : 0;
  const k = CONFIG.partiteVirtuali;
  const fantamediaPrudente = (fm * partite + media * k) / (partite + k);

  let voto = media;
  voto += (CONFIG.pesoFantamedia[role] ?? 0.6) * (fantamediaPrudente - media);

  if (player.avversario) {
    voto += (CONFIG.pesoForzaSquadra[role] ?? 1) * (getTeamStrength(player.team) - 1);
    voto -= (CONFIG.pesoForzaAvversario[role] ?? 1) * (getTeamStrength(player.avversario) - 1);
  }

  const casa = (CONFIG.vantaggioCasa[role] ?? 0.1) / 2;
  voto += (player.inCasa ?? true) ? casa : -casa;

  // Il bonus imbattibilità non è nella fantamedia di Fantacalcio.it: si aggiunge qui
  if (role === 'P' && rules.bonusImbattibilita !== 'off') {
    const bonus = rules.bonusImbattibilita === '1' ? 1 : 0.5;
    const lambda = stimaGolSubitiAttesi(player.team, player.avversario, player.inCasa ?? true);
    voto += Math.exp(-lambda) * bonus;
  }

  return voto;
}

// ============================================================
// CALCOLO VOTO PREVISTO
// ============================================================

/**
 * Punti attesi che il giocatore porta se schierato titolare:
 *   probabilità che giochi × voto se gioca
 * + probabilità che non giochi × valore medio del sostituto dalla panchina.
 * Non viene arrotondato: l'arrotondamento si fa solo quando si mostra il numero.
 */
export function calculateExpectedScore(player: Player, rules: LeagueRules): number {
  if (!player) return 6;

  const prob = calcolaProbabilitaGioca(player);
  const votoSeGioca = calcolaVotoSeGioca(player, rules);
  const valore = prob * votoSeGioca + (1 - prob) * CONFIG.valoreSostituto;

  if (!Number.isFinite(valore)) return 6;
  return Math.round(valore * 100) / 100;
}

export function calculateModificatoreBonus(
  defenders: FormationSlot[],
  goalkeeper: FormationSlot | null,
  rules: LeagueRules
): number {
  if (rules.modificatoreDifesa === 'off') return 0;
  if (!Array.isArray(defenders) || defenders.length === 0) return 0;
  if (defenders.length !== 4 && defenders.length !== 5) return 0;

  const validDefenders = defenders.filter(d => d && d.player);
  if (validDefenders.length < 3) return 0;

  const sortedDefenders = [...validDefenders].sort(
    (a, b) => (b.expectedScore ?? 6) - (a.expectedScore ?? 6)
  );
  const top3Defenders = sortedDefenders.slice(0, 3);

  let totalVP = top3Defenders.reduce((sum, d) => sum + (d.expectedScore ?? 6), 0);
  let count = 3;

  if (goalkeeper && goalkeeper.player) {
    totalVP += goalkeeper.expectedScore ?? 6;
    count = 4;
  }

  const avgVP = totalVP / count;

  if (rules.modificatoreDifesa === 'standard') {
    if (avgVP >= 7.0) return 6;
    if (avgVP >= 6.5) return 3;
    if (avgVP >= 6.0) return 1;
    return 0;
  }

  let bonus = 0;
  for (const threshold of rules.modificatoreCustom) {
    if (avgVP >= threshold.threshold) {
      bonus = threshold.bonus;
    }
  }
  return bonus;
}

// ============================================================
// UTILITY
// ============================================================

export function getFormIndicator(forma: number[]): 'hot' | 'warm' | 'cold' {
  if (!Array.isArray(forma) || forma.length === 0) return 'warm';
  const avg = forma.reduce((a, b) => a + (b || 6), 0) / forma.length;
  if (avg >= 6.7) return 'hot';
  if (avg >= 6.2) return 'warm';
  return 'cold';
}

export function getDifficultyLabel(difficulty: number): string {
  const d = difficulty ?? 3;
  if (d <= 1) return 'Molto Facile';
  if (d <= 2) return 'Facile';
  if (d <= 3) return 'Media';
  if (d <= 4) return 'Difficile';
  return 'Molto Difficile';
}
