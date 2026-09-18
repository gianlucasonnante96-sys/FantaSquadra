import { getInfortunatiPerSquadra, getDataAggiornamentoInfortuni, StatoInfortunio } from '../utils/infortuni';

interface InfortunatiProps {
  onBack: () => void;
}

export default function Infortunati({ onBack }: InfortunatiProps) {
  const squadre = getInfortunatiPerSquadra();
  const dataAggiornamento = getDataAggiornamentoInfortuni();
  
  const totaleInfortunati = squadre.reduce((acc, s) => acc + s.giocatori.length, 0);

  const getStatoInfo = (stato: StatoInfortunio) => {
    switch (stato) {
      case 'dubbio':
        return {
          label: 'In Dubbio',
          emoji: '⚠️',
          bg: 'bg-yellow-500/10',
          border: 'border-yellow-500/30',
          text: 'text-yellow-400',
        };
      case 'out-lungo':
        return {
          label: 'Out Lungo',
          emoji: '🚑',
          bg: 'bg-red-500/10',
          border: 'border-red-500/40',
          text: 'text-red-400',
        };
      default:
        return {
          label: 'Infortunato',
          emoji: '🏥',
          bg: 'bg-orange-500/10',
          border: 'border-orange-500/30',
          text: 'text-orange-400',
        };
    }
  };

  const getSquadraEmoji = (squadra: string): string => {
    const mappa: Record<string, string> = {
      'Atalanta': '⚫🔵',
      'Bologna': '🔴🔵',
      'Cagliari': '🔴🔵',
      'Como': '🔵⚪',
      'Fiorentina': '🟣⚪',
      'Frosinone': '🟡🔵',
      'Genoa': '🔴🔵',
      'Inter': '⚫🔵',
      'Juventus': '⚫⚪',
      'Lazio': '🔵⚪',
      'Lecce': '🟡🔴',
      'Milan': '🔴⚫',
      'Monza': '🔴⚪',
      'Napoli': '🔵⚪',
      'Parma': '🟡🔵',
      'Roma': '🔴🟡',
      'Sassuolo': '🟢⚫',
      'Torino': '🔴⚪',
      'Udinese': '⚫⚪',
      'Venezia': '🟠⚫',
    };
    return mappa[squadra] || '⚽';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black px-3 md:px-4 pb-6 md:pb-8 pt-16 md:pt-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 md:mb-6 gap-2">
          <button
            onClick={onBack}
            className="text-slate-400 hover:text-emerald-400 transition-colors text-sm font-medium bg-slate-900/80 backdrop-blur-md w-10 h-10 md:w-auto md:h-auto md:px-3 md:py-2 rounded-lg border border-white/10 flex items-center justify-center flex-shrink-0"
          >
            <span className="md:hidden text-lg">🏠</span>
            <span className="hidden md:inline">🏠 Home</span>
          </button>
          <div className="text-center flex-1 min-w-0">
            <h1 className="text-base md:text-3xl font-black text-white tracking-tight truncate">
              <span className="text-red-400">🏥 INFORTUNATI</span>
            </h1>
            <p className="text-red-400/70 text-[10px] md:text-xs tracking-widest uppercase mt-0.5 md:mt-1">
              Serie A 2026/27
            </p>
          </div>
          <div className="w-10 md:w-auto md:px-3 flex-shrink-0 text-right">
            <div className="text-red-400 font-black text-xl md:text-2xl">{totaleInfortunati}</div>
          </div>
        </div>

        {/* Info aggiornamento */}
        {dataAggiornamento && (
          <div className="bg-slate-900/60 backdrop-blur-md rounded-xl border border-white/10 p-3 mb-4 md:mb-6">
            <p className="text-slate-400 text-[10px] md:text-xs text-center">
              📅 Aggiornato:{' '}
              {new Date(dataAggiornamento).toLocaleString('it-IT', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        )}

        {/* Lista vuota */}
        {squadre.length === 0 && (
          <div className="bg-slate-900/60 backdrop-blur-md rounded-xl border border-white/10 p-8 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-white font-bold text-base md:text-lg mb-2">Nessun infortunato</h3>
            <p className="text-slate-400 text-sm">Tutti i giocatori sono disponibili.</p>
          </div>
        )}

        {/* Squadre con infortunati */}
        <div className="space-y-4 md:space-y-6">
          {squadre.map(({ squadra, giocatori }) => (
            <div
              key={squadra}
              className="bg-slate-900/60 backdrop-blur-md rounded-xl md:rounded-2xl border border-white/10 overflow-hidden"
            >
              {/* Header squadra */}
              <div className="px-4 md:px-5 py-3 bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                  <span className="text-lg md:text-xl">{getSquadraEmoji(squadra)}</span>
                  <h2 className="text-white font-black text-sm md:text-base tracking-tight">{squadra}</h2>
                </div>
                <span className="text-red-400 font-bold text-xs md:text-sm bg-red-500/20 px-2 py-0.5 rounded">
                  {giocatori.length}
                </span>
              </div>

              {/* Lista giocatori */}
              <div className="p-2 md:p-3 space-y-2">
                {giocatori.map(({ nome, infortunio }) => {
                  const statoInfo = getStatoInfo(infortunio.stato);
                  return (
                    <div
                      key={nome}
                      className={`${statoInfo.bg} border ${statoInfo.border} rounded-xl p-3 md:p-4`}
                    >
                      <div className="flex items-start gap-2 md:gap-3">
                        <span className="text-xl md:text-2xl flex-shrink-0">{statoInfo.emoji}</span>
                        <div className="flex-1 min-w-0">
                          {/* Nome + stato */}
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-white font-bold text-sm md:text-base">{nome}</span>
                            <span
                              className={`text-[9px] md:text-[10px] font-bold ${statoInfo.text} ${statoInfo.bg} border ${statoInfo.border} px-1.5 py-0.5 rounded uppercase tracking-wider`}
                            >
                              {statoInfo.label}
                            </span>
                          </div>

                          {/* Rientro */}
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-slate-500 text-[10px] md:text-xs">Rientro:</span>
                            <span className={`font-bold text-xs md:text-sm ${statoInfo.text}`}>
                              {infortunio.rientro}
                            </span>
                          </div>

                          {/* Descrizione */}
                          {infortunio.descrizione && (
                            <p className="text-slate-400 text-[11px] md:text-xs leading-relaxed">
                              {infortunio.descrizione}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 md:mt-8">
          <p className="text-slate-600 text-[10px] md:text-xs">
            🏥 Dati infortuni aggiornati automaticamente da Fantacalcio.it
          </p>
        </div>
      </div>
    </div>
  );
}
