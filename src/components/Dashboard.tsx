import { useMemo, useState } from 'react';
import { Player, LeagueRules } from '../types';
import { optimizeFormation } from '../utils/optimizer';
import { getDifficultyLabel } from '../utils/scoring';
import { getAvversario } from '../services/calendarService';
import { calculateDifficulty } from '../services/apiService';

interface DashboardProps {
  roster: Player[];
  rules: LeagueRules;
  onBack: () => void;
  onReset: () => void;
}

export default function Dashboard({ roster, rules, onBack, onReset }: DashboardProps) {
  const [selectedFormationIdx, setSelectedFormationIdx] = useState(0);
  const [showAllFormations, setShowAllFormations] = useState(false);
  const [giornata, setGiornata] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showGiornataGrid, setShowGiornataGrid] = useState(false);

  const rosterWithAvversari = useMemo(() => {
    if (!Array.isArray(roster)) return [];
    try {
      return roster.map(player => {
        if (!player) return player;
        const team = typeof player.team === 'string' ? player.team : '';
        if (!team) return player;
        try {
          const avversarioInfo = getAvversario(team, giornata);
          if (avversarioInfo) {
            const difficolta = calculateDifficulty(avversarioInfo.avversario, avversarioInfo.inCasa);
            return {
              ...player,
              avversario: avversarioInfo.avversario,
              inCasa: avversarioInfo.inCasa,
              difficoltaAvversario: difficolta,
            };
          }
        } catch (e) {}
        return player;
      });
    } catch (e) {
      return roster;
    }
  }, [giornata, roster]);

  const filteredRoster = useMemo(() => {
    if (!Array.isArray(rosterWithAvversari)) return [];
    return rosterWithAvversari.filter(p => p && p.id);
  }, [rosterWithAvversari]);

  const { formations, best } = useMemo(() => {
    try {
      const result = optimizeFormation(filteredRoster, rules);
      return {
        formations: Array.isArray(result?.formations) ? result.formations : [],
        best: result?.best || null,
      };
    } catch (e) {
      return { formations: [], best: null };
    }
  }, [filteredRoster, rules]);

  const currentFormation = formations[selectedFormationIdx] || best;

  if (!currentFormation) {
    return (
      <div className="min-h-screen stadium-bg p-4 md:p-8 flex items-center justify-center">
        <div className="glass-card rounded-2xl p-6 max-w-md text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-white font-semibold text-lg mb-2">Impossibile calcolare la formazione</h2>
          <p className="text-slate-400 text-sm mb-4">Controlla che la tua rosa contenga almeno 11 giocatori validi.</p>
          <button onClick={onBack} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg transition-colors">
            ← Torna alla rosa
          </button>
        </div>
      </div>
    );
  }

  const getRoleGradient = (role: string) => {
    switch (role) {
      case 'P': return 'from-yellow-400 via-amber-500 to-yellow-600';
      case 'D': return 'from-blue-400 via-cyan-500 to-blue-600';
      case 'C': return 'from-emerald-400 via-green-500 to-emerald-600';
      case 'A': return 'from-red-400 via-rose-500 to-red-600';
      default: return 'from-slate-400 to-slate-600';
    }
  };

  const getDifficultyColor = (d: number) => {
    if (d <= 1) return 'text-green-400';
    if (d <= 2) return 'text-emerald-400';
    if (d <= 3) return 'text-yellow-400';
    if (d <= 4) return 'text-orange-400';
    return 'text-red-400';
  };

  const getVPColor = (vp: number) => {
    if (vp >= 7) return 'text-emerald-400';
    if (vp >= 6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const portieri = currentFormation.slots.filter(s => s.player.role === 'P');
  const difensori = currentFormation.slots.filter(s => s.player.role === 'D');
  const centrocampisti = currentFormation.slots.filter(s => s.player.role === 'C');
  const attaccanti = currentFormation.slots.filter(s => s.player.role === 'A');

  const giornateRows = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    [31, 32, 33, 34, 35, 36, 37, 38],
  ];

  return (
    <div className="min-h-screen stadium-bg p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="text-slate-400 hover:text-emerald-400 transition-colors text-sm font-medium">
            ← Modifica Rosa
          </button>
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              FORMAZIONE <span className="text-emerald-400 glow-text-green">CONSIGLIATA</span>
            </h1>
            <p className="text-emerald-400/70 text-xs tracking-widest uppercase mt-1">Serie A 2026/27</p>
          </div>
          <button onClick={onReset} className="text-slate-400 hover:text-red-400 transition-colors text-sm font-medium">
            🔄 Reset
          </button>
        </div>

        {/* Giornata Selector */}
        <div className="glass-card rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-white font-medium text-sm">
              GIORNATA <span className="text-emerald-400 font-black text-lg glow-text-green">{giornata}</span> <span className="text-slate-500">/ 38</span>
            </div>
            <button
              onClick={() => setShowGiornataGrid(!showGiornataGrid)}
              className="text-emerald-400 hover:text-emerald-300 text-sm transition-colors font-medium"
            >
              {showGiornataGrid ? '▲ Chiudi' : '▼ Seleziona'}
            </button>
          </div>

          {showGiornataGrid && (
            <div className="space-y-1.5 mt-3 animate-fadeIn">
              {giornateRows.map((row, idx) => (
                <div key={idx} className="flex gap-1.5 justify-center flex-wrap">
                  {row.map(num => (
                    <button
                      key={num}
                      onClick={() => {
                        setGiornata(num);
                        setShowGiornataGrid(false);
                      }}
                      className={`w-8 h-8 md:w-10 md:h-10 rounded-lg text-xs md:text-sm font-bold transition-all ${
                        num === giornata
                          ? 'bg-gradient-to-br from-emerald-400 to-green-600 text-black glow-green scale-110'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/50'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-center gap-4 mt-3">
            <button
              onClick={() => setGiornata(Math.max(1, giornata - 1))}
              disabled={giornata <= 1}
              className="px-4 py-1.5 bg-slate-800/80 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm border border-slate-700/50"
            >
              ← Prec
            </button>
            <button
              onClick={() => setGiornata(Math.min(38, giornata + 1))}
              disabled={giornata >= 38}
              className="px-4 py-1.5 bg-slate-800/80 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm border border-slate-700/50"
            >
              Succ →
            </button>
          </div>
        </div>

        {/* AI Banner */}
        <div className="glass-card rounded-2xl p-4 mb-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-400 via-green-500 to-emerald-600"></div>
          <div className="flex items-start gap-3 pl-2">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="text-emerald-400 font-bold mb-1 text-sm tracking-wide uppercase">Il Consiglio</h3>
              <p className="text-slate-300 text-sm leading-relaxed">{currentFormation.explanation}</p>
            </div>
          </div>
        </div>

        {/* Formation Selector */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {formations.map((f, i) => (
            <button
              key={f.modulo}
              onClick={() => setSelectedFormationIdx(i)}
              className={`px-4 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
                selectedFormationIdx === i
                  ? 'bg-gradient-to-r from-emerald-400 to-green-600 text-black glow-green'
                  : 'glass-card text-slate-300 hover:text-white'
              }`}
            >
              {f.modulo}
              <span className="ml-2 text-xs opacity-75">({f.totalScore.toFixed(1)} VP)</span>
            </button>
          ))}
        </div>

        {/* Score Header + Campo */}
        <div className="glass-card rounded-2xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-emerald-500/20 via-green-500/10 to-transparent px-6 py-4 flex items-center justify-between border-b border-emerald-500/20">
            <div>
              <div className="text-emerald-400 font-black text-2xl tracking-tight">{currentFormation.modulo}</div>
              <div className="text-slate-400 text-xs uppercase tracking-widest">Expected Score</div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black text-white glow-text-green">{currentFormation.totalScore.toFixed(1)}</div>
              {currentFormation.modificatoreBonus > 0 && (
                <div className="text-emerald-300 text-xs">+{currentFormation.modificatoreBonus} mod. difesa</div>
              )}
            </div>
          </div>

          {/* CAMPO */}
          <div className="pitch-bg p-6 md:p-10 min-h-[520px]">
            {/* Portiere */}
            <div className="relative mb-10 flex justify-center">
              {portieri.map(slot => (
                <PlayerOnField 
                  key={slot.player.id} 
                  slot={slot} 
                  getRoleGradient={getRoleGradient}
                  getVPColor={getVPColor}
                  onClick={() => setSelectedPlayer(slot.player)}
                />
              ))}
            </div>

            {/* Difensori */}
            <div className="relative mb-10 flex justify-center gap-3 md:gap-8 flex-wrap">
              {difensori.map(slot => (
                <PlayerOnField 
                  key={slot.player.id} 
                  slot={slot} 
                  getRoleGradient={getRoleGradient}
                  getVPColor={getVPColor}
                  onClick={() => setSelectedPlayer(slot.player)}
                />
              ))}
            </div>

            {/* Centrocampisti */}
            <div className="relative mb-10 flex justify-center gap-3 md:gap-8 flex-wrap">
              {centrocampisti.map(slot => (
                <PlayerOnField 
                  key={slot.player.id} 
                  slot={slot} 
                  getRoleGradient={getRoleGradient}
                  getVPColor={getVPColor}
                  onClick={() => setSelectedPlayer(slot.player)}
                />
              ))}
            </div>

            {/* Attaccanti */}
            <div className="relative flex justify-center gap-3 md:gap-8 flex-wrap">
              {attaccanti.map(slot => (
                <PlayerOnField 
                  key={slot.player.id} 
                  slot={slot} 
                  getRoleGradient={getRoleGradient}
                  getVPColor={getVPColor}
                  onClick={() => setSelectedPlayer(slot.player)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Panchina */}
        <div className="glass-card rounded-2xl overflow-hidden mb-6">
          <div className="px-6 py-3 bg-slate-800/50 border-b border-slate-700/50">
            <h3 className="text-white font-bold flex items-center gap-2 text-sm tracking-wide uppercase">
              <span>🪑</span> Panchina
            </h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {currentFormation.bench.map((slot, i) => {
                const vp = slot.expectedScore;
                return (
                  <button
                    key={slot.player.id}
                    onClick={() => setSelectedPlayer(slot.player)}
                    className="flex items-center gap-3 p-3 bg-slate-800/40 hover:bg-slate-700/60 rounded-xl transition-all text-left border border-slate-700/30 hover:border-emerald-500/30"
                  >
                    <span className="text-slate-500 text-xs font-mono w-4">{i + 1}</span>
                    <div className={`w-1.5 h-10 rounded-full bg-gradient-to-b ${getRoleGradient(slot.player.role)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-semibold truncate">
                        {slot.player.name} {slot.player.surname}
                      </div>
                      <div className="text-slate-400 text-[10px]">
                        {slot.player.team} • 
                        <span className="text-emerald-400 ml-1">FM: {slot.player.fantamedia ?? 0}</span> • 
                        <span className="text-blue-400 ml-1">MV: {slot.player.mediaVoto ?? 6}</span> • 
                        <span className="text-slate-400 ml-1">Tit: {slot.player.titolarita}%</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-black ${getVPColor(vp)}`}>{vp.toFixed(1)}</div>
                      <div className="text-slate-600 text-[10px] font-bold">VP</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Confronto Moduli */}
        <div className="glass-card rounded-2xl overflow-hidden mb-6">
          <button
            onClick={() => setShowAllFormations(!showAllFormations)}
            className="w-full px-6 py-4 flex items-center justify-between text-white hover:bg-slate-800/30 transition-colors"
          >
            <h3 className="font-bold flex items-center gap-2 text-sm tracking-wide uppercase">
              <span>📊</span> Confronto Moduli
            </h3>
            <span className="text-emerald-400">{showAllFormations ? '▲' : '▼'}</span>
          </button>

          {showAllFormations && (
            <div className="p-4 border-t border-slate-700/50 animate-fadeIn">
              <div className="space-y-2">
                {formations.map((f, i) => (
                  <div
                    key={f.modulo}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      i === selectedFormationIdx
                        ? 'border-emerald-500/60 bg-emerald-500/5'
                        : 'border-slate-700/30 bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-white font-bold">{f.modulo}</span>
                        {f.modificatoreBonus > 0 && (
                          <span className="ml-2 text-xs text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded font-bold">
                            +{f.modificatoreBonus} mod.
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-white font-black text-lg">{f.totalScore.toFixed(1)}</span>
                        <span className="text-slate-500 text-xs ml-1">VP</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all"
                        style={{ width: `${(f.totalScore / formations[0].totalScore) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="text-center py-4">
          <p className="text-slate-600 text-xs">
            🤖 Algoritmo: Fantamedia • Media Voto • Titolarità • Avversario • Team Strength
          </p>
        </div>
      </div>

      {/* MODAL DETTAGLI */}
      {selectedPlayer && (
        <PlayerDetailModal 
          player={selectedPlayer} 
          onClose={() => setSelectedPlayer(null)}
          getRoleGradient={getRoleGradient}
          getDifficultyColor={getDifficultyColor}
          getVPColor={getVPColor}
        />
      )}
    </div>
  );
}

// ============================================================
// GIOCATORE IN CAMPO
// ============================================================

interface PlayerOnFieldProps {
  slot: { player: Player; expectedScore: number; position: string };
  getRoleGradient: (role: string) => string;
  getVPColor: (vp: number) => string;
  onClick: () => void;
}

function PlayerOnField({ slot, getRoleGradient, getVPColor, onClick }: PlayerOnFieldProps) {
  const { player, expectedScore } = slot;
  const titolarita = player?.titolarita ?? 50;
  const isHighTit = titolarita >= 80;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 group cursor-pointer"
    >
      {/* Cerchio con glow */}
      <div className={`relative w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br ${getRoleGradient(player.role)} flex items-center justify-center shadow-xl border-2 border-white/20 group-hover:scale-110 transition-transform ${isHighTit ? 'animate-pulse-green' : ''}`}>
        <span className="text-black font-black text-lg md:text-xl">{player.surname?.[0] || '?'}</span>
        {/* Indicatore titolarità */}
        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-black ${titolarita > 80 ? 'bg-emerald-400' : titolarita > 50 ? 'bg-yellow-400' : 'bg-red-500'}`}></div>
      </div>
      
      {/* Nome */}
      <div className="bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded-md text-[10px] md:text-xs text-white font-bold max-w-[80px] md:max-w-[100px] truncate border border-white/10">
        {player.surname || player.name}
      </div>

      {/* FM */}
      <div className="bg-slate-900/80 px-1.5 py-0.5 rounded text-[9px] md:text-[10px] text-emerald-400 font-bold border border-emerald-500/20">
        FM {player.fantamedia ?? 0}
      </div>
      
      {/* VP */}
      <div className={`bg-black/80 px-2 py-0.5 rounded text-[10px] md:text-xs font-black ${getVPColor(expectedScore)} border border-white/10`}>
        {expectedScore.toFixed(1)} VP
      </div>
    </button>
  );
}

// ============================================================
// MODAL
// ============================================================

interface PlayerDetailModalProps {
  player: Player;
  onClose: () => void;
  getRoleGradient: (role: string) => string;
  getDifficultyColor: (d: number) => string;
  getVPColor: (vp: number) => string;
}

function PlayerDetailModal({ player, onClose, getRoleGradient, getDifficultyColor }: PlayerDetailModalProps) {
  const titolarita = player?.titolarita ?? 50;
  const difficulty = player.difficoltaAvversario ?? 3;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="glass-card rounded-2xl max-w-md w-full p-6 shadow-2xl glow-green"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-1.5 h-14 rounded-full bg-gradient-to-b ${getRoleGradient(player.role)}`} />
            <div>
              <div className="text-white font-black text-lg">{player.name} {player.surname}</div>
              <div className="text-emerald-400 text-sm font-medium">{player.team} • {player.role}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl transition-colors">×</button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-emerald-500/20">
            <div className="text-emerald-400 text-2xl font-black glow-text-green">{player.fantamedia ?? 0}</div>
            <div className="text-slate-500 text-[10px] uppercase tracking-wider font-bold mt-1">Fantamedia</div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-blue-500/20">
            <div className="text-blue-400 text-2xl font-black">{player.mediaVoto ?? 6}</div>
            <div className="text-slate-500 text-[10px] uppercase tracking-wider font-bold mt-1">Media Voto</div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-yellow-500/20">
            <div className={`text-2xl font-black ${titolarita > 80 ? 'text-emerald-400' : titolarita > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
              {titolarita}%
            </div>
            <div className="text-slate-500 text-[10px] uppercase tracking-wider font-bold mt-1">Titolarità</div>
          </div>
        </div>

        <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/50">
          <div className="text-slate-500 text-[10px] uppercase tracking-wider font-bold mb-2">Prossima partita</div>
          <div className="text-white font-bold text-lg">
            {player.inCasa ? '🏠 in casa' : '✈️ in trasferta'} vs {player.avversario || '?'}
          </div>
          <div className={`text-sm font-medium mt-1 ${getDifficultyColor(difficulty)}`}>
            Difficoltà: {getDifficultyLabel(difficulty)}
          </div>
        </div>
      </div>
    </div>
  );
}
