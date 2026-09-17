import { useMemo, useState, useRef, useEffect } from 'react';
import { Player, LeagueRules } from '../types';
import { optimizeFormation } from '../utils/optimizer';
import { getDifficultyLabel, getTeamStrength, getMomentum, getFixtureDifficulty, getFormaSquadra, getStatisticheSquadra } from '../utils/scoring';
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
  const [showGiornataScroll, setShowGiornataScroll] = useState(false);
  
  // 🔥 REF per auto-scroll alla giornata corrente
  const giornataRef = useRef<HTMLButtonElement | null>(null);

  // 🔥 AUTO-SCROLL quando si apre il selettore (con delay per DOM)
  useEffect(() => {
    if (!showGiornataScroll) return;
    
    const timer = setTimeout(() => {
      if (giornataRef.current) {
        giornataRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }, 200);
    
    return () => clearTimeout(timer);
  }, [showGiornataScroll]);

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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black p-4 flex items-center justify-center">
        <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-red-500/30 p-6 max-w-md text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-white font-semibold text-lg mb-2">Impossibile calcolare la formazione</h2>
          <p className="text-slate-400 text-sm mb-4">Controlla che la tua rosa contenga almeno 11 giocatori validi.</p>
          <button onClick={onBack} className="px-4 py-3 min-h-[48px] bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-black font-semibold rounded-lg transition-colors">
            ← Torna alla rosa
          </button>
        </div>
      </div>
    );
  }

  const getRoleGradient = (role: string) => {
    switch (role) {
      case 'P': return 'from-yellow-400 via-amber-500 to-yellow-600';
      case 'D': return 'from-emerald-400 via-green-500 to-emerald-600';
      case 'C': return 'from-blue-400 via-cyan-500 to-blue-600';
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black px-3 md:px-4 pb-4 md:pb-8 pt-16 md:pt-8">
      <div className="max-w-5xl mx-auto">
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
              FORMAZIONE <span className="text-emerald-400">CONSIGLIATA</span>
            </h1>
            <p className="text-emerald-400/70 text-[10px] md:text-xs tracking-widest uppercase mt-0.5 md:mt-1">Serie A 2026/27</p>
          </div>
          <button 
            onClick={onReset} 
            className="text-slate-400 hover:text-red-400 transition-colors text-sm font-medium bg-slate-900/80 backdrop-blur-md w-10 h-10 md:w-auto md:h-auto md:px-3 md:py-2 rounded-lg border border-white/10 flex items-center justify-center flex-shrink-0"
          >
            <span className="md:hidden text-lg">🔄</span>
            <span className="hidden md:inline">🔄 Reset</span>
          </button>
        </div>

        {/* Giornata Selector */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-xl md:rounded-2xl border border-white/10 p-3 md:p-4 mb-4 md:mb-6">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <div className="text-white font-medium text-xs md:text-sm">
              GIORNATA <span className="text-emerald-400 font-black text-base md:text-lg">{giornata}</span> <span className="text-slate-500">/ 38</span>
            </div>
            <button
              onClick={() => setShowGiornataScroll(!showGiornataScroll)}
              className="text-emerald-400 hover:text-emerald-300 text-xs md:text-sm transition-colors font-medium min-h-[32px]"
            >
              {showGiornataScroll ? '▲ Chiudi' : '▼ Cambia'}
            </button>
          </div>

          {showGiornataScroll && (
            <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide animate-fadeIn">
              {Array.from({ length: 38 }, (_, i) => i + 1).map(num => (
                <button
                  key={num}
                  ref={num === giornata ? giornataRef : null}
                  onClick={() => {
                    setGiornata(num);
                    setShowGiornataScroll(false);
                  }}
                  className={`flex-shrink-0 w-12 h-12 md:w-10 md:h-10 snap-center rounded-lg text-sm font-bold transition-all flex items-center justify-center ${
                    num === giornata
                      ? 'bg-gradient-to-br from-emerald-400 to-green-600 text-black shadow-lg shadow-emerald-500/50 scale-110'
                      : 'bg-slate-800/80 text-slate-300 active:bg-slate-700 border border-slate-700/50'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-center gap-3 md:gap-4 mt-2 md:mt-3">
            <button
              onClick={() => setGiornata(Math.max(1, giornata - 1))}
              disabled={giornata <= 1}
              className="px-4 py-2 min-h-[40px] bg-slate-800/80 active:bg-slate-700 disabled:opacity-30 text-white rounded-lg transition-colors text-xs md:text-sm border border-slate-700/50"
            >
              ← Prec
            </button>
            <button
              onClick={() => setGiornata(Math.min(38, giornata + 1))}
              disabled={giornata >= 38}
              className="px-4 py-2 min-h-[40px] bg-slate-800/80 active:bg-slate-700 disabled:opacity-30 text-white rounded-lg transition-colors text-xs md:text-sm border border-slate-700/50"
            >
              Succ →
            </button>
          </div>
        </div>

        {/* AI Banner */}
        <div className="bg-gradient-to-r from-emerald-500/10 via-green-500/5 to-transparent backdrop-blur-md rounded-xl md:rounded-2xl border border-emerald-500/20 p-3 md:p-4 mb-4 md:mb-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-400 to-green-600"></div>
          <div className="flex items-start gap-2 md:gap-3 pl-2">
            <span className="text-xl md:text-2xl">💡</span>
            <div className="min-w-0">
              <h3 className="text-emerald-400 font-bold mb-1 text-xs md:text-sm tracking-wide uppercase">Il Consiglio</h3>
              <p className="text-slate-300 text-xs md:text-sm leading-relaxed">{currentFormation.explanation}</p>
            </div>
          </div>
        </div>

        {/* Formation Selector */}
        <div className="flex gap-2 mb-4 md:mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {formations.map((f, i) => (
            <button
              key={f.modulo}
              onClick={() => setSelectedFormationIdx(i)}
              className={`px-3 md:px-4 py-2.5 min-h-[44px] rounded-xl font-bold whitespace-nowrap transition-all text-xs md:text-sm ${
                selectedFormationIdx === i
                  ? 'bg-gradient-to-r from-emerald-400 to-green-600 text-black shadow-lg shadow-emerald-500/50'
                  : 'bg-slate-900/60 backdrop-blur-md text-slate-300 border border-white/10'
              }`}
            >
              {f.modulo}
              <span className="ml-1.5 md:ml-2 text-[10px] md:text-xs opacity-75">({f.totalScore.toFixed(1)})</span>
            </button>
          ))}
        </div>

        {/* Score Header + Campo */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-xl md:rounded-2xl border border-white/10 overflow-hidden mb-4 md:mb-6">
          <div className="bg-gradient-to-r from-emerald-500/20 via-green-500/10 to-transparent px-3 md:px-6 py-3 md:py-4 flex items-center justify-between border-b border-emerald-500/20">
            <div>
              <div className="text-emerald-400 font-black text-lg md:text-2xl tracking-tight">{currentFormation.modulo}</div>
              <div className="text-slate-400 text-[10px] md:text-xs uppercase tracking-widest">Expected Score</div>
            </div>
            <div className="text-right">
              <div className="text-2xl md:text-4xl font-black text-white">{currentFormation.totalScore.toFixed(1)}</div>
              {currentFormation.modificatoreBonus > 0 && (
                <div className="text-emerald-300 text-[10px] md:text-xs">+{currentFormation.modificatoreBonus} mod.</div>
              )}
            </div>
          </div>

          {/* CAMPO */}
          <div 
            className="relative p-3 md:p-10"
            style={{
              background: 'linear-gradient(180deg, #0f1f15 0%, #163020 50%, #0f1f15 100%)',
              minHeight: '420px',
            }}
          >
            <div className="absolute inset-2 md:inset-4 border-2 border-white/20 rounded-lg pointer-events-none"></div>
            <div className="absolute left-1/2 top-2 md:top-4 bottom-2 md:bottom-4 w-0.5 bg-white/20 pointer-events-none"></div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 md:w-24 md:h-24 border-2 border-white/20 rounded-full pointer-events-none"></div>

            <div className="relative mb-6 md:mb-10 flex justify-center">
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

            <div className="relative mb-6 md:mb-10 flex justify-center gap-2 md:gap-8 flex-wrap">
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

            <div className="relative mb-6 md:mb-10 flex justify-center gap-2 md:gap-8 flex-wrap">
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

            <div className="relative flex justify-center gap-2 md:gap-8 flex-wrap">
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
        <div className="bg-slate-900/60 backdrop-blur-md rounded-xl md:rounded-2xl border border-white/10 overflow-hidden mb-4 md:mb-6">
          <div className="px-3 md:px-6 py-2.5 md:py-3 bg-slate-800/50 border-b border-white/10">
            <h3 className="text-white font-bold flex items-center gap-2 text-xs md:text-sm tracking-wide uppercase">
              <span>🪑</span> Panchina
            </h3>
          </div>
          <div className="p-2 md:p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5 md:gap-2">
              {currentFormation.bench.map((slot, i) => {
                const vp = slot.expectedScore;
                return (
                  <button
                    key={slot.player.id}
                    onClick={() => setSelectedPlayer(slot.player)}
                    className="flex items-center gap-2 md:gap-3 p-2.5 md:p-3 min-h-[56px] bg-slate-800/40 active:bg-slate-700/60 rounded-lg md:rounded-xl transition-all text-left border border-white/5"
                  >
                    <span className="text-slate-500 text-[10px] md:text-xs font-mono w-4">{i + 1}</span>
                    <div className={`w-1.5 h-8 md:h-10 rounded-full bg-gradient-to-b ${getRoleGradient(slot.player.role)} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-xs md:text-sm font-semibold truncate">
                        {slot.player.name} {slot.player.surname}
                      </div>
                      <div className="text-slate-400 text-[9px] md:text-[10px] flex flex-wrap gap-x-1.5">
                        <span>{slot.player.team}</span>
                        <span className="text-emerald-400">FM:{slot.player.fantamedia ?? 0}</span>
                        <span className="text-blue-400">MV:{slot.player.mediaVoto ?? 6}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-xs md:text-sm font-black ${getVPColor(vp)}`}>{vp.toFixed(1)}</div>
                      <div className="text-slate-600 text-[9px] md:text-[10px] font-bold">VP</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Confronto Moduli */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-xl md:rounded-2xl border border-white/10 overflow-hidden mb-4 md:mb-6">
          <button
            onClick={() => setShowAllFormations(!showAllFormations)}
            className="w-full px-3 md:px-6 py-3 md:py-4 min-h-[56px] flex items-center justify-between text-white active:bg-slate-800/30 transition-colors"
          >
            <h3 className="font-bold flex items-center gap-2 text-xs md:text-sm tracking-wide uppercase">
              <span>📊</span> Confronto Moduli
            </h3>
            <span className="text-emerald-400">{showAllFormations ? '▲' : '▼'}</span>
          </button>

          {showAllFormations && (
            <div className="p-3 md:p-4 border-t border-white/10 animate-fadeIn">
              <div className="space-y-2">
                {formations.map((f, i) => (
                  <div
                    key={f.modulo}
                    className={`p-3 md:p-4 rounded-xl border-2 transition-all ${
                      i === selectedFormationIdx
                        ? 'border-emerald-500/60 bg-emerald-500/5'
                        : 'border-slate-700/30 bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5 md:mb-2">
                      <div>
                        <span className="text-white font-bold text-sm md:text-base">{f.modulo}</span>
                        {f.modificatoreBonus > 0 && (
                          <span className="ml-1.5 md:ml-2 text-[10px] md:text-xs text-emerald-400 bg-emerald-500/20 px-1.5 md:px-2 py-0.5 rounded font-bold">
                            +{f.modificatoreBonus}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-white font-black text-base md:text-lg">{f.totalScore.toFixed(1)}</span>
                        <span className="text-slate-500 text-[10px] md:text-xs ml-1">VP</span>
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

        <div className="text-center py-3 md:py-4">
          <p className="text-slate-600 text-[10px] md:text-xs">
            🤖 Algoritmo: Fantamedia • Media Voto • Titolarità • Avversario • Team Strength • Forma • Gol Fatti/Subiti
          </p>
        </div>
      </div>

      {/* MODAL DETTAGLI CON FATTORI VP */}
      {selectedPlayer && (
        <PlayerDetailModal 
          player={selectedPlayer} 
          onClose={() => setSelectedPlayer(null)}
          getRoleGradient={getRoleGradient}
          getDifficultyColor={getDifficultyColor}
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
  const isHighVP = expectedScore >= 7.5;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 md:gap-1 active:scale-95 transition-transform"
    >
      <div className={`relative w-11 h-11 md:w-16 md:h-16 rounded-full bg-gradient-to-br ${getRoleGradient(player.role)} flex items-center justify-center shadow-xl border-2 border-white/20 ${isHighVP ? 'animate-pulse-green' : ''}`}>
        <span className="text-black font-black text-base md:text-xl">{player.surname?.[0] || '?'}</span>
        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 md:w-4 md:h-4 rounded-full border-2 border-black ${titolarita > 80 ? 'bg-emerald-400' : titolarita > 50 ? 'bg-yellow-400' : 'bg-red-500'}`}></div>
      </div>
      
      <div className="bg-black/80 backdrop-blur-sm px-1.5 md:px-2 py-0.5 rounded text-[8px] md:text-xs text-white font-bold max-w-[60px] md:max-w-[100px] truncate border border-white/10">
        {player.surname?.length > 8 ? player.surname.slice(0, 7) + '.' : (player.surname || player.name)}
      </div>

      <div className="bg-slate-900/90 px-1 md:px-1.5 py-0.5 rounded text-[7px] md:text-[10px] text-emerald-400 font-bold border border-emerald-500/30">
        FM {player.fantamedia ?? 0}
      </div>
      
      <div className={`bg-black/80 px-1.5 md:px-2 py-0.5 rounded text-[8px] md:text-xs font-black ${getVPColor(expectedScore)} border border-white/10`}>
        {expectedScore.toFixed(1)}
      </div>
    </button>
  );
}

// ============================================================
// MODAL DETTAGLI CON FATTORI VP
// ============================================================

interface PlayerDetailModalProps {
  player: Player;
  onClose: () => void;
  getRoleGradient: (role: string) => string;
  getDifficultyColor: (d: number) => string;
}

function PlayerDetailModal({ player, onClose, getRoleGradient, getDifficultyColor }: PlayerDetailModalProps) {
  const titolarita = player?.titolarita ?? 50;
  const difficulty = player.difficoltaAvversario ?? 3;
  
  // 🔥 Calcola i fattori dinamici
  const teamStrength = getTeamStrength(player.team);
  const momentum = getMomentum(player.team);
  const fixtureDiff = getFixtureDifficulty(player.avversario);
  const formaSquadra = getFormaSquadra(player.team);
  const statsSquadra = getStatisticheSquadra(player.team);

  // Etichette e colori
  const getStrengthLabel = (s: number) => {
    if (s >= 1.15) return { label: 'Molto Forte', color: 'text-emerald-400' };
    if (s >= 1.05) return { label: 'Forte', color: 'text-emerald-400' };
    if (s >= 0.95) return { label: 'Media', color: 'text-yellow-400' };
    if (s >= 0.85) return { label: 'Debole', color: 'text-orange-400' };
    return { label: 'Molto Debole', color: 'text-red-400' };
  };

  const getMomentumLabel = (m: number) => {
    if (m >= 0.2) return { label: 'In Forma', color: 'text-emerald-400', emoji: '🔥' };
    if (m >= 0.05) return { label: 'Buona', color: 'text-emerald-300', emoji: '📈' };
    if (m > -0.05) return { label: 'Neutra', color: 'text-slate-400', emoji: '➖' };
    if (m > -0.2) return { label: 'In Calo', color: 'text-orange-400', emoji: '📉' };
    return { label: 'In Crisi', color: 'text-red-400', emoji: '❄️' };
  };

  const strengthInfo = getStrengthLabel(teamStrength);
  const momentumInfo = getMomentumLabel(momentum);

  const formEmoji = (r: string) => {
    if (r === 'W') return '🟢';
    if (r === 'D') return '🟡';
    if (r === 'L') return '🔴';
    return '⚪';
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end md:items-center justify-center z-50 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900/95 backdrop-blur-md rounded-t-2xl md:rounded-2xl border-t md:border border-emerald-500/30 w-full md:max-w-md p-5 md:p-6 shadow-2xl shadow-emerald-500/20 pb-8 md:pb-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-slate-600 rounded-full mx-auto mb-4 md:hidden"></div>

        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-1.5 h-14 rounded-full bg-gradient-to-b ${getRoleGradient(player.role)}`} />
            <div>
              <div className="text-white font-black text-base md:text-lg">{player.name} {player.surname}</div>
              <div className="text-emerald-400 text-xs md:text-sm font-medium">{player.team} • {player.role}</div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white text-2xl transition-colors w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Stats principali */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-slate-800/60 rounded-xl p-2.5 md:p-3 text-center border border-emerald-500/20">
            <div className="text-emerald-400 text-xl md:text-2xl font-black">{player.fantamedia ?? 0}</div>
            <div className="text-slate-500 text-[9px] md:text-[10px] uppercase tracking-wider font-bold mt-1">Fantamedia</div>
          </div>
          <div className="bg-slate-800/60 rounded-xl p-2.5 md:p-3 text-center border border-blue-500/20">
            <div className="text-blue-400 text-xl md:text-2xl font-black">{player.mediaVoto ?? 6}</div>
            <div className="text-slate-500 text-[9px] md:text-[10px] uppercase tracking-wider font-bold mt-1">Media Voto</div>
          </div>
          <div className="bg-slate-800/60 rounded-xl p-2.5 md:p-3 text-center border border-yellow-500/20">
            <div className={`text-xl md:text-2xl font-black ${titolarita > 80 ? 'text-emerald-400' : titolarita > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
              {titolarita}%
            </div>
            <div className="text-slate-500 text-[9px] md:text-[10px] uppercase tracking-wider font-bold mt-1">Titolarità</div>
          </div>
        </div>

        {/* FATTORI DEL VOTO PREVISTO */}
        <div className="mb-4">
          <h4 className="text-emerald-400 font-bold text-xs md:text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
            🔮 Fattori del Voto Previsto
          </h4>
          
          <div className="space-y-2">
            {/* Team Strength */}
            <div className="bg-slate-800/60 rounded-xl p-3 border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">⚡</span>
                <div>
                  <div className="text-white text-xs md:text-sm font-semibold">Forza Squadra</div>
                  <div className="text-slate-500 text-[10px] md:text-xs">{player.team}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm md:text-base font-black ${strengthInfo.color}`}>
                  {teamStrength.toFixed(2)}
                </div>
                <div className={`text-[10px] md:text-xs font-bold ${strengthInfo.color}`}>
                  {strengthInfo.label}
                </div>
              </div>
            </div>

            {/* Momentum */}
            <div className="bg-slate-800/60 rounded-xl p-3 border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{momentumInfo.emoji}</span>
                <div>
                  <div className="text-white text-xs md:text-sm font-semibold">Forma Recente</div>
                  <div className="text-slate-500 text-[10px] md:text-xs flex items-center gap-0.5">
                    {formaSquadra.length > 0 
                      ? formaSquadra.map((r, i) => <span key={i}>{formEmoji(r)}</span>)
                      : 'Nessun dato'
                    }
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm md:text-base font-black ${momentumInfo.color}`}>
                  {momentum >= 0 ? '+' : ''}{momentum.toFixed(2)}
                </div>
                <div className={`text-[10px] md:text-xs font-bold ${momentumInfo.color}`}>
                  {momentumInfo.label}
                </div>
              </div>
            </div>

            {/* Fixture Difficulty */}
            <div className="bg-slate-800/60 rounded-xl p-3 border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">⚔️</span>
                <div>
                  <div className="text-white text-xs md:text-sm font-semibold">Difficoltà Partita</div>
                  <div className="text-slate-500 text-[10px] md:text-xs">
                    vs {player.avversario || '?'} ({player.inCasa ? 'Casa' : 'Trasferta'})
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm md:text-base font-black ${getDifficultyColor(difficulty)}`}>
                  {fixtureDiff.toFixed(1)}
                </div>
                <div className={`text-[10px] md:text-xs font-bold ${getDifficultyColor(difficulty)}`}>
                  {getDifficultyLabel(difficulty)}
                </div>
              </div>
            </div>

            {/* Gol fatti/subiti */}
            {statsSquadra && statsSquadra.g > 0 && (
              <div className="bg-slate-800/60 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🎯</span>
                  <div>
                    <div className="text-white text-xs md:text-sm font-semibold">
                      {player.role === 'D' ? 'Gol Subiti' : 'Gol Fatti'}
                    </div>
                    <div className="text-slate-500 text-[10px] md:text-xs">
                      {player.role === 'D' 
                        ? `${statsSquadra.gs} in ${statsSquadra.g} partite`
                        : `${statsSquadra.gf} in ${statsSquadra.g} partite`
                      }
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm md:text-base font-black ${
                    (player.role === 'D' ? statsSquadra.gs / statsSquadra.g < 1.5 : statsSquadra.gf / statsSquadra.g > 1.5)
                      ? 'text-emerald-400'
                      : 'text-slate-400'
                  }`}>
                    {player.role === 'D' 
                      ? (statsSquadra.gs / statsSquadra.g).toFixed(2)
                      : (statsSquadra.gf / statsSquadra.g).toFixed(2)
                    }
                  </div>
                  <div className="text-[10px] md:text-xs text-slate-500">media/gara</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 min-h-[48px] bg-slate-800 active:bg-slate-700 md:hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          Chiudi
        </button>
      </div>
    </div>
  );
}
