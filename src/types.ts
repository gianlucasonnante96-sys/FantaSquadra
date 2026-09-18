export type Role = 'P' | 'D' | 'C' | 'A';

export interface Player {
  id: string;
  name: string;
  surname: string;
  team: string;
  role: Role;
  fantamedia: number;
  mediaVoto: number;
  titolarita: number;
  forma: number[];
  inCasa: boolean;
  avversario: string;
  difficoltaAvversario: number;
  cleanSheetOdds: number;
  isStarter: boolean;
}

export interface LeagueRules {
  modificatoreDifesa: 'off' | 'standard' | 'custom';
  modificatoreCustom: { threshold: number; bonus: number }[];
  bonusImbattibilita: 'off' | '1' | '0.5';
  moduliConsentiti: string[];
  assist: 'off' | '1' | '0.5';
  golSubito: number;
  rigoreParato: number;
  rigoreSbagliato: number;
}

export interface FormationSlot {
  player: Player;
  expectedScore: number;
  position: string;
}

export interface Formation {
  modulo: string;
  slots: FormationSlot[];
  bench: FormationSlot[];
  totalScore: number;
  modificatoreBonus: number;
  explanation: string;
}

export type AppStep = 'home' | 'setup' | 'roster' | 'dashboard' | 'infortunati';
