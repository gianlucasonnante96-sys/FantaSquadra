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
        } catch (e) {
          console.warn('Errore getAvversario:', e);
        }
        return player;
      });
    } catch (e) {
      console.error('Errore rosterWithAvversari:', e);
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
      console.error('Errore optimizeFormation:', e);
      return { formations: [], best: null };
    }
  }, [filteredRoster, rules]);

  const currentFormation = formations[selectedFormationIdx] || best;

  if (!currentFormation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-slate-900 to-emerald-950 p-4 md:p-8 flex items-center justify-center">
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-red-500/30 p-6 max-w-md text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-white font-semibold text-lg mb-2">Impossibile calcolare la formazione</h2>
          <p className="text-slate-400 text-sm mb-4">Controlla che la tua rosa contenga almeno 11 giocatori validi.</p>
          <button onClick={onBack} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors">
            ← Torna alla rosa
          </button>
        </div>
      </div>
    );
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'P': return 'from-yellow-500 to-amber-600';
      case 'D': return 'from-blue-500 to-blue-600';
      case 'C': return 'from-green-500 to-emerald-600';
      case 'A': return 'from-red-500 to-rose-600';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  const getDifficultyColor = (d: number) => {
    if (d <= 1) return 'text-green-400';
    if (d <= 2) return 'text-emerald-400';
    if (d <= 3) return 'text-yellow-400';
    if (d <= 4) return 'text-orange-400';
    return 'text-red-400';
  };

  const portieri = currentFormation.slots.filter(s => s.player.role === 'P');
  const difensori = currentFormation.slots.filter(s => s.player.role === 'D');
  const centrocampisti = currentFormation.slots.filter(s => s.player.role === 'C');
  const attaccanti = currentFormation.slots.filter(s => s.player.role === 'A');

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-slate-900 to-emerald-950 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors text-sm">
            ← Modifica Rosa
          </button>
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-white">Formazione Consigliata</h1>
            <p className="text-emerald-300 text-sm">Serie A 2026/27</p>
          </div>
          <button onClick={onReset} className="text-slate-400 hover:text-white transition-colors text-sm">
            🔄 Reset
          </button>
        </div>

        {/* Giornata Selector */}
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-emerald-500/20 p-4 mb-6">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setGiornata(Math.max(1, giornata - 1))}
              disabled={giornata <= 1}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              ← Prec
            </button>
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-sm">Giornata</span>
              <input
                type="number"
                min="1"
                max="38"
                value={giornata}
                onChange={(e) => setGiornata(Math.max(1, Math.min(38, parseInt(e.target.value) || 1)))}
                className="w-20 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-center font-bold text-lg"
              />
              <span className="text-slate-400 text-sm">di 38</span>
            </div>
            <button
              onClick={() => setGiornata(Math.min(38, giornata + 1))}
              disabled={giornata >= 38}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              Succ →
            </button>
          </div>
        </div>

        {/* AI Explanation Banner */}
        <div className="bg-gradient-to-r from-emerald-600/30 to-green-600/30 backdrop-blur-sm rounded-xl border border-emerald-500/30 p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="text-white font-semibold mb-1">Il Consiglio del FantaConsiglio</h3>
              <p className="text-emerald-100 text-sm leading-relaxed">{currentFormation.explanation}</p>
            </div>
          </div>
        </div>

        {/* Formation Selector */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {formations.map((f, i) => (
            <button
              key={f.modulo}
              onClick={() => setSelectedFormationIdx(i)}
              className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                selectedFormationIdx === i
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {f.modulo}
              <span className="ml-2 text-xs opacity-75">({f.totalScore.toFixed(1)} VP)</span>
            </button>
          ))}
        </div>

        {/* Score Header */}
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-emerald-500/20 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-emerald-600/40 to-green-600/40 px-6 py-4 flex items-center justify-between">
            <div>
              <div className="text-white font-bold text-xl">{currentFormation.modulo}</div>
              <div className="text-emerald-200 text-sm">Expected Score Totale</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-white">{currentFormation.totalScore.toFixed(1)}</div>
              {currentFormation.modificatoreBonus > 0 && (
                <div className="text-emerald-300 text-sm">+{currentFormation.modificatoreBonus} mod. difesa</div>
              )}
            </div>
          </div>

          {/* 🔥 CAMPO DA GIOCO VISIVO */}
          <div 
            className="relative p-6 md:p-10"
            style={{
              background: 'linear-gradient(180deg, #1a5f2a 0%, #2d7a3e 50%, #1a5f2a 100%)',
              minHeight: '500px',
            }}
          >
            {/* Linee del campo */}
            <div className="absolute inset-4 border-2 border-white/30 rounded-lg pointer-events-none"></div>
            <div className="absolute left-1/2 top-4 bottom-4 w-0.5 bg-white/30 pointer-events-none"></div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-2 border-white/30 rounded-full pointer-events-none"></div>

            {/* PORTIERE */}
            <div className="relative mb-8 flex justify-center">
              {portieri.map(slot => (
                <PlayerOnField 
                  key={slot.player.id} 
                  slot={slot} 
                  getRoleColor={getRoleColor}
                  getDifficultyColor={getDifficultyColor}
                  onClick={() => setSelectedPlayer(slot.player)}
                />
              ))}
            </div>

            {/* DIFENSORI */}
            <div className="relative mb-8 flex justify-center gap-3 md:gap-6 flex-wrap">
              {difensori.map(slot => (
                <PlayerOnField 
                  key={slot.player.id} 
                  slot={slot} 
                  getRoleColor={getRoleColor}
                  getDifficultyColor={getDifficultyColor}
                  onClick={() => setSelectedPlayer(slot.player)}
                />
              ))}
            </div>

            {/* CENTROCAMPISTI */}
            <div className="relative mb-8 flex justify-center gap-3 md:gap-6 flex-wrap">
              {centrocampisti.map(slot => (
                <PlayerOnField 
                  key={slot.player.id} 
                  slot={slot} 
                  getRoleColor={getRoleColor}
                  getDifficultyColor={getDifficultyColor}
                  onClick={() => setSelectedPlayer(slot.player)}
                />
              ))}
            </div>

            {/* ATTACCANTI */}
            <div className="relative flex justify-center gap-3 md:gap-6 flex-wrap">
              {attaccanti.map(slot => (
                <PlayerOnField 
                  key={slot.player.id} 
                  slot={slot} 
                  getRoleColor={getRoleColor}
                  getDifficultyColor={getDifficultyColor}
                  onClick={() => setSelectedPlayer(slot.player)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* PANCHINA */}
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden mb-6">
          <div className="px-6 py-3 bg-slate-700/40 border-b border-slate-600/50">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span>🪑</span> Panchina
            </h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentFormation.bench.map((slot, i) => (
                <button
                  key={slot.player.id}
                  onClick={() => setSelectedPlayer(slot.player)}
                  className="flex items-center gap-3 p-3 bg-slate-700/30 hover:bg-slate-700/60 rounded-lg transition-colors text-left"
                >
                  <span className="text-slate-500 text-sm font-mono w-5">{i + 1}.</span>
                  <div className={`w-2 h-8 rounded-full bg-gradient-to-b ${getRoleColor(slot.player.role)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">
                      {slot.player.name} {slot.player.surname}
                    </div>
                    {/* 🔥 FM/MV in panchina */}
                    <div className="text-slate-400 text-xs">
                      {slot.player.team} • 
                      <span className="text-emerald-400"> FM: {slot.player.fantamedia ?? 0}</span> • 
                      <span className="text-blue-400"> MV: {slot.player.mediaVoto ?? 6}</span> • 
                      Tit: {slot.player.titolarita}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 text-sm font-medium">{slot.expectedScore.toFixed(1)}</div>
                    <div className="text-slate-500 text-xs">VP</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* All Formations Comparison */}
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden mb-6">
          <button
            onClick={() => setShowAllFormations(!showAllFormations)}
            className="w-full px-6 py-4 flex items-center justify-between text-white hover:bg-slate-700/30 transition-colors"
          >
            <h3 className="font-semibold flex items-center gap-2">
              <span>📊</span> Confronto Moduli
            </h3>
            <span className="text-emerald-400">{showAllFormations ? '▲' : '▼'}</span>
          </button>

          {showAllFormations && (
            <div className="p-4 border-t border-slate-700/50">
              <div className="space-y-3">
                {formations.map((f, i) => (
                  <div
                    key={f.modulo}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      i === selectedFormationIdx
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-slate-700 bg-slate-700/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-white font-bold">{f.modulo}</span>
                        {f.modificatoreBonus > 0 && (
                          <span className="ml-2 text-xs text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                            +{f.modificatoreBonus} mod.
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-white font-bold text-lg">{f.totalScore.toFixed(1)}</span>
                        <span className="text-slate-400 text-sm ml-1">VP</span>
                      </div>
                    </div>
                    <div className="mt-2 w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full"
                        style={{ width: `${(f.totalScore / formations[0].totalScore) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-4 text-center">
          <p className="text-slate-500 text-xs">
            🤖 Voto Previsto calcolato con algoritmo che combina Fantamedia, Media Voto,
            % Titolarità, Fattore Campo e Difficoltà Avversario.
          </p>
        </div>
      </div>

      {/* 🔥 MODAL DETTAGLI GIOCATORE */}
      {selectedPlayer && (
        <PlayerDetailModal 
          player={selectedPlayer} 
          onClose={() => setSelectedPlayer(null)}
          getRoleColor={getRoleColor}
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
  getRoleColor: (role: string) => string;
  getDifficultyColor: (d: number) => string;
  onClick: () => void;
}

function PlayerOnField({ slot, getRoleColor, getDifficultyColor, onClick }: PlayerOnFieldProps) {
  const { player, expectedScore } = slot;
  const titolarita = player?.titolarita ?? 50;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 group cursor-pointer"
    >
      {/* Cerchio con maglia */}
      <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br ${getRoleColor(player.role)} flex items-center justify-center shadow-lg border-2 border-white/50 group-hover:scale-110 transition-transform`}>
        <span className="text-white font-bold text-lg">{player.surname?.[0] || '?'}</span>
      </div>
      
      {/* Nome */}
      <div className="bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] md:text-xs text-white font-medium max-w-[80px] md:max-w-[100px] truncate">
        {player.surname || player.name}
      </div>
      
      {/* VP */}
      <div className="bg-emerald-600/90 px-1.5 py-0.5 rounded text-[9px] md:text-[10px] text-white font-bold">
        {expectedScore.toFixed(1)} VP
      </div>
    </button>
  );
}

// ============================================================
// MODAL DETTAGLI GIOCATORE
// ============================================================

interface PlayerDetailModalProps {
  player: Player;
  onClose: () => void;
  getRoleColor: (role: string) => string;
  getDifficultyColor: (d: number) => string;
}

function PlayerDetailModal({ player, onClose, getRoleColor, getDifficultyColor }: PlayerDetailModalProps) {
  const titolarita = player?.titolarita ?? 50;
  const difficulty = player.difficoltaAvversario ?? 3;

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 rounded-2xl border border-emerald-500/30 max-w-md w-full p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-14 rounded-full bg-gradient-to-b ${getRoleColor(player.role)}`} />
            <div>
              <div className="text-white font-bold text-lg">{player.name} {player.surname}</div>
              <div className="text-slate-400 text-sm">{player.team} • {player.role}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">×</button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-slate-700/50 rounded-lg p-3 text-center">
            <div className="text-emerald-400 text-2xl font-bold">{player.fantamedia ?? 0}</div>
            <div className="text-slate-400 text-xs">Fantamedia</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3 text-center">
            <div className="text-blue-400 text-2xl font-bold">{player.mediaVoto ?? 6}</div>
            <div className="text-slate-400 text-xs">Media Voto</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3 text-center">
            <div className={`text-2xl font-bold ${titolarita > 80 ? 'text-emerald-400' : titolarita > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
              {titolarita}%
            </div>
            <div className="text-slate-400 text-xs">Titolarità</div>
          </div>
        </div>

        {/* Match Info */}
        <div className="bg-slate-700/30 rounded-lg p-3 mb-4">
          <div className="text-slate-400 text-xs mb-1">Prossima partita</div>
          <div className="text-white font-medium">
            {player.inCasa ? '🏠 in casa' : '✈️ in trasferta'} vs {player.avversario || '?'}
          </div>
          <div className={`text-sm ${getDifficultyColor(difficulty)}`}>
            Difficoltà: {getDifficultyLabel(difficulty)}
          </div>
        </div>

        {/* Info extra */}
        <div className="text-slate-500 text-xs text-center">
          Clicca fuori per chiudere
        </div>
      </div>
    </div>
  );
}
