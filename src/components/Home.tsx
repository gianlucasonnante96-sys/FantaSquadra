import { Player, LeagueRules } from '../types';
import { getTuttiInfortunati } from '../utils/infortuni';

interface ListoneStatus {
  source: string;
  lastUpdated: string | null;
  playerCount: number;
  isOnline: boolean;
  error: string | null;
}

interface HomeProps {
  roster: Player[];
  rules: LeagueRules;
  listoneStatus: ListoneStatus | null;
  onNavigate: (step: 'setup' | 'roster' | 'dashboard' | 'infortunati') => void;
}

export default function Home({ roster, rules, listoneStatus, onNavigate }: HomeProps) {
  const isRosterComplete = roster.length >= 11;
  const hasRules = rules.moduliConsentiti.length > 0;
  
  // Conta infortunati per il badge
  const infortunati = getTuttiInfortunati();
  const numInfortunati = infortunati.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black px-3 md:px-4 pb-6 md:pb-8 pt-16 md:pt-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
            <span className="text-4xl md:text-6xl">⚽</span>
            <h1 className="text-3xl md:text-6xl font-black text-white tracking-tight">
              FANTA<span className="text-emerald-400">SQUADRA</span>
            </h1>
          </div>
          <p className="text-emerald-400/70 text-[10px] md:text-sm tracking-widest uppercase">
            Il tuo assistente per il fantacalcio
          </p>
        </div>

        {/* Status Banner */}
        {listoneStatus && (
          <div className="bg-slate-900/60 backdrop-blur-md rounded-xl md:rounded-2xl border border-white/10 p-3 md:p-4 mb-6 md:mb-8">
            <div className="flex items-center gap-2 md:gap-3">
              <span className="text-xl md:text-2xl">{listoneStatus.error ? '⚠️' : '📋'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-xs md:text-sm">Listone Serie A 2026/27</div>
                <div className="text-slate-400 text-[10px] md:text-xs truncate">
                  {listoneStatus.error ? listoneStatus.error : `${listoneStatus.playerCount} giocatori caricati`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pannelli di navigazione — 2x2 su desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">

          {/* PANNELLO 1: Regole Lega */}
          <button
            onClick={() => onNavigate('setup')}
            className="group bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-5 md:p-6 active:bg-slate-800/60 md:hover:bg-slate-800/60 active:scale-[0.98] md:hover:scale-[1.02] transition-all text-left relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-400/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform"></div>
            <div className="relative">
              <div className="text-4xl md:text-5xl mb-3 md:mb-4">⚙️</div>
              <h2 className="text-white font-black text-lg md:text-xl mb-1 md:mb-2 tracking-tight">Regole Lega</h2>
              <p className="text-slate-400 text-xs md:text-sm mb-3 md:mb-4">Modificatore, bonus, moduli consentiti</p>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${hasRules ? 'bg-emerald-400' : 'bg-yellow-400'}`}></div>
                <span className={`text-[10px] md:text-xs font-bold ${hasRules ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {hasRules ? 'Configurate' : 'Da configurare'}
                </span>
              </div>
            </div>
          </button>

          {/* PANNELLO 2: La Mia Squadra */}
          <button
            onClick={() => onNavigate('roster')}
            className="group bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-5 md:p-6 active:bg-slate-800/60 md:hover:bg-slate-800/60 active:scale-[0.98] md:hover:scale-[1.02] transition-all text-left relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-400/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform"></div>
            <div className="relative">
              <div className="text-4xl md:text-5xl mb-3 md:mb-4">👥</div>
              <h2 className="text-white font-black text-lg md:text-xl mb-1 md:mb-2 tracking-tight">La Mia Squadra</h2>
              <p className="text-slate-400 text-xs md:text-sm mb-3 md:mb-4">Aggiungi o modifica i giocatori della rosa</p>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isRosterComplete ? 'bg-emerald-400' : 'bg-yellow-400'}`}></div>
                <span className={`text-[10px] md:text-xs font-bold ${isRosterComplete ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {roster.length}/25 giocatori
                </span>
              </div>
            </div>
          </button>

          {/* PANNELLO 3: Formazione Consigliata */}
          <button
            onClick={() => onNavigate('dashboard')}
            disabled={!isRosterComplete}
            className={`group backdrop-blur-md rounded-2xl border p-5 md:p-6 transition-all text-left relative overflow-hidden ${
              isRosterComplete
                ? 'bg-gradient-to-br from-emerald-500/10 to-slate-900/60 border-emerald-500/30 active:bg-emerald-500/20 md:hover:bg-emerald-500/20 active:scale-[0.98] md:hover:scale-[1.02]'
                : 'bg-slate-900/60 border-white/10 opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-400/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform"></div>
            <div className="relative">
              <div className="text-4xl md:text-5xl mb-3 md:mb-4">🏆</div>
              <h2 className="text-white font-black text-lg md:text-xl mb-1 md:mb-2 tracking-tight">Formazione Consigliata</h2>
              <p className="text-slate-400 text-xs md:text-sm mb-3 md:mb-4">Scopri la formazione ottimale per la giornata</p>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isRosterComplete ? 'bg-emerald-400' : 'bg-slate-600'}`}></div>
                <span className={`text-[10px] md:text-xs font-bold ${isRosterComplete ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {isRosterComplete ? 'Pronto' : 'Rosa incompleta'}
                </span>
              </div>
            </div>
          </button>

          {/* 🔥 PANNELLO 4: Infortunati */}
          <button
            onClick={() => onNavigate('infortunati')}
            className="group bg-slate-900/60 backdrop-blur-md rounded-2xl border border-red-500/20 p-5 md:p-6 active:bg-red-500/10 md:hover:bg-red-500/10 active:scale-[0.98] md:hover:scale-[1.02] transition-all text-left relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-400/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform"></div>
            <div className="relative">
              <div className="text-4xl md:text-5xl mb-3 md:mb-4">🏥</div>
              <h2 className="text-white font-black text-lg md:text-xl mb-1 md:mb-2 tracking-tight">Infortunati</h2>
              <p className="text-slate-400 text-xs md:text-sm mb-3 md:mb-4">Lista infortunati e tempi di recupero</p>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${numInfortunati > 0 ? 'bg-red-400' : 'bg-slate-600'}`}></div>
                <span className={`text-[10px] md:text-xs font-bold ${numInfortunati > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                  {numInfortunati} giocatori
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-gradient-to-r from-emerald-500/10 via-green-500/5 to-transparent backdrop-blur-md rounded-xl md:rounded-2xl border border-emerald-500/20 p-4 md:p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-400 to-green-600"></div>
          <div className="flex items-start gap-3 pl-2">
            <span className="text-2xl md:text-3xl">💡</span>
            <div>
              <h3 className="text-emerald-400 font-bold mb-1 md:mb-2 text-sm md:text-base tracking-wide uppercase">Come funziona</h3>
              <ol className="text-slate-300 text-xs md:text-sm leading-relaxed space-y-1">
                <li>1️⃣ Configura le regole della tua lega</li>
                <li>2️⃣ Aggiungi i giocatori della tua rosa</li>
                <li>3️⃣ Scopri la formazione consigliata dall'algoritmo</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="text-center mt-6 md:mt-8">
          <p className="text-slate-600 text-[10px] md:text-xs">
            🤖 Dati aggiornati automaticamente da Fantacalcio.it ogni 2 ore
          </p>
        </div>
      </div>
    </div>
  );
}
