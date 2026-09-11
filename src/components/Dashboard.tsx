
import { useMemo, useState } from 'react';
import { Player, LeagueRules, Formation } from '../types';
import { optimizeFormation } from '../utils/optimizer';
import { getFormIndicator, getDifficultyLabel } from '../utils/scoring';
import { getGiornataCorrente, setGiornataCorrente, getPlayersWithMatches } from '../services/listoneService';

interface DashboardProps {
  roster: Player[];
  rules: LeagueRules;
  onBack: () => void;
  onReset: () => void;
}

export default function Dashboard({ roster, rules, onBack, onReset }: DashboardProps) {
  const [selectedFormationIdx, setSelectedFormationIdx] = useState(0);
  const [showAllFormations, setShowAllFormations] = useState(false);
  const [giornata, setGiornata] = useState(getGiornataCorrente());

  // Applica il calendario automatico per ottenere le avversarie corrette
  const rosterWithMatches = useMemo(() => {
    return getPlayersWithMatches(giornata);
  }, [giornata, roster]);

  // Filtra solo i giocatori della rosa
  const rosterIds = new Set(roster.map(p => p.id));
  const filteredRoster = rosterWithMatches.filter(p => rosterIds.has(p.id));

  const { formations, best } = useMemo(() => {
    return optimizeFormation(filteredRoster, rules);
  }, [filteredRoster, rules]);

  const currentFormation = formations[selectedFormationIdx] || best;

  const handleGiornataChange = (newGiornata: number) => {
    const g = Math.max(1, Math.min(38, newGiornata));
    setGiornata(g);
    setGiornataCorrente(g);
    setSelectedFormationIdx(0);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'P': return 'from-yellow-500 to-amber-600';
      case 'D': return 'from-blue-500 to-blue-600';
      case 'C': return 'from-green-500 to-emerald-600';
      case 'A': return 'from-red-500 to-rose-600';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  const getFormColor = (form: 'hot' | 'warm' | 'cold') => {
    switch (form) {
      case 'hot': return 'text-orange-400';
      case 'warm': return 'text-yellow-400';
      case 'cold': return 'text-blue-400';
    }
  };

  const getFormEmoji = (form: 'hot' | 'warm' | 'cold') => {
    switch (form) {
      case 'hot': return '🔥';
      case 'warm': return '☀️';
      case 'cold': return '❄️';
    }
  };

  const getDifficultyColor = (d: number) => {
    if (d <= 1) return 'text-green-400';
    if (d <= 2) return 'text-emerald-400';
    if (d <= 3) return 'text-yellow-400';
    if (d <= 4) return 'text-orange-400';
    return 'text-red-400';
  };

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
              onClick={() => handleGiornataChange(giornata - 1)}
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
                onChange={(e) => handleGiornataChange(parseInt(e.target.value) || 1)}
                className="w-20 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-center font-bold text-lg"
              />
              <span className="text-slate-400 text-sm">di 38</span>
            </div>
            <button
              onClick={() => handleGiornataChange(giornata + 1)}
              disabled={giornata >= 38}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              Succ →
            </button>
          </div>
          <p className="text-center text-xs text-slate-500 mt-2">
            Le avversarie vengono calcolate automaticamente dal calendario Serie A 2026/27
          </p>
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
              <span className="ml-2 text-xs opacity-75">({f.totalScore.toFixed(1)} xS)</span>
            </button>
          ))}
        </div>

        {/* Main Formation Display */}
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-emerald-500/20 overflow-hidden mb-6">
          {/* Score Header */}
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

          {/* Formation Field */}
          <div className="p-4 md:p-6">
            {/* Goalkeeper */}
            <div className="mb-6">
              {currentFormation.slots
                .filter(s => s.player.role === 'P')
                .map(slot => (
                  <PlayerCard key={slot.player.id} slot={slot} getRoleColor={getRoleColor} getFormColor={getFormColor} getFormEmoji={getFormEmoji} getDifficultyColor={getDifficultyColor} />
                ))}
            </div>

            {/* Defenders */}
            <div className="mb-6">
              <div className="text-slate-400 text-xs uppercase tracking-wider mb-2">Difesa</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {currentFormation.slots
                  .filter(s => s.player.role === 'D')
                  .map(slot => (
                    <PlayerCard key={slot.player.id} slot={slot} getRoleColor={getRoleColor} getFormColor={getFormColor} getFormEmoji={getFormEmoji} getDifficultyColor={getDifficultyColor} compact />
                  ))}
              </div>
            </div>

            {/* Midfielders */}
            <div className="mb-6">
              <div className="text-slate-400 text-xs uppercase tracking-wider mb-2">Centrocampo</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {currentFormation.slots
                  .filter(s => s.player.role === 'C')
                  .map(slot => (
                    <PlayerCard key={slot.player.id} slot={slot} getRoleColor={getRoleColor} getFormColor={getFormColor} getFormEmoji={getFormEmoji} getDifficultyColor={getDifficultyColor} compact />
                  ))}
              </div>
            </div>

            {/* Attackers */}
            <div>
              <div className="text-slate-400 text-xs uppercase tracking-wider mb-2">Attacco</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {currentFormation.slots
                  .filter(s => s.player.role === 'A')
                  .map(slot => (
                    <PlayerCard key={slot.player.id} slot={slot} getRoleColor={getRoleColor} getFormColor={getFormColor} getFormEmoji={getFormEmoji} getDifficultyColor={getDifficultyColor} compact />
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bench */}
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden mb-6">
          <div className="px-6 py-3 bg-slate-700/40 border-b border-slate-600/50">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span>🪑</span> Panchina
              <span className="text-xs text-slate-400 ml-2">(ordinata per priorità di sostituzione)</span>
            </h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentFormation.bench.map((slot, i) => (
                <div key={slot.player.id} className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                  <span className="text-slate-500 text-sm font-mono w-5">{i + 1}.</span>
                  <div className={`w-2 h-8 rounded-full bg-gradient-to-b ${getRoleColor(slot.player.role)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{slot.player.name} {slot.player.surname}</div>
                    <div className="text-slate-400 text-xs">{slot.player.team} • Tit: {slot.player.titolarita}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 text-sm font-medium">{slot.expectedScore.toFixed(1)}</div>
                    <div className="text-slate-500 text-xs">xS</div>
                  </div>
                </div>
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
                        <span className="text-slate-400 text-sm ml-1">xS</span>
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

        {/* Algorithm Info */}
        <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-4 text-center">
          <p className="text-slate-500 text-xs">
            🤖 Punteggio calcolato con algoritmo Expected Score (xS) che combina Fantamedia, Media Voto,
            % Titolarità, Forma recente, Fattore Campo e Difficoltà Avversario.
          </p>
        </div>
      </div>
    </div>
  );
}

// Player Card Component
interface PlayerCardProps {
  slot: { player: Player; expectedScore: number; position: string };
  getRoleColor: (role: string) => string;
  getFormColor: (form: 'hot' | 'warm' | 'cold') => string;
  getFormEmoji: (form: 'hot' | 'warm' | 'cold') => string;
  getDifficultyColor: (d: number) => string;
  compact?: boolean;
}

function PlayerCard({ slot, getRoleColor, getFormColor, getFormEmoji, getDifficultyColor, compact }: PlayerCardProps) {
  const { player, expectedScore } = slot;
  const form = getFormIndicator(player.forma);
  const difficulty = getDifficultyLabel(player.difficoltaAvversario);

  if (compact) {
    return (
      <div className="bg-slate-700/40 rounded-xl p-3 hover:bg-slate-700/60 transition-colors border border-slate-600/30">
        <div className="flex items-start justify-between mb-2">
          <div className={`w-1.5 h-8 rounded-full bg-gradient-to-b ${getRoleColor(player.role)}`} />
          <div className="text-right">
            <div className="text-emerald-400 font-bold text-sm">{expectedScore.toFixed(1)}</div>
            <div className="text-slate-500 text-[10px]">xS</div>
          </div>
        </div>
        <div className="text-white font-medium text-sm truncate">{player.surname}</div>
        <div className="text-slate-400 text-xs truncate">{player.team}</div>

        <div className="mt-2 flex items-center gap-2 text-[10px]">
          <span className={`${getFormColor(form)}`}>{getFormEmoji(form)} {form === 'hot' ? 'In forma' : form === 'warm' ? 'OK' : 'Freddo'}</span>
        </div>

        <div className="mt-1 flex items-center gap-1">
          <span className={`text-[10px] ${getDifficultyColor(player.difficoltaAvversario)}`}>
            {player.inCasa ? '🏠' : '✈️'} vs {player.avversario}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <div className="flex-1 h-1 bg-slate-600 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${player.titolarita > 80 ? 'bg-emerald-500' : player.titolarita > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${player.titolarita}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400">{player.titolarita}%</span>
        </div>
      </div>
    );
  }

  // Full card for goalkeeper
  return (
    <div className="bg-slate-700/40 rounded-xl p-4 hover:bg-slate-700/60 transition-colors border border-slate-600/30 max-w-xs mx-auto">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-12 rounded-full bg-gradient-to-b ${getRoleColor(player.role)}`} />
          <div>
            <div className="text-white font-bold">{player.name} {player.surname}</div>
            <div className="text-slate-400 text-sm">{player.team}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-emerald-400 font-bold text-xl">{expectedScore.toFixed(1)}</div>
          <div className="text-slate-500 text-xs">Expected Score</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className={`${getFormColor(form)} text-lg`}>{getFormEmoji(form)}</div>
          <div className="text-slate-400 text-[10px]">Forma</div>
          <div className="text-white text-xs font-medium">{(player.forma.reduce((a, b) => a + b, 0) / player.forma.length).toFixed(1)}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-yellow-400 text-lg">🎯</div>
          <div className="text-slate-400 text-[10px]">Titolarità</div>
          <div className="text-white text-xs font-medium">{player.titolarita}%</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className={`${getDifficultyColor(player.difficoltaAvversario)} text-lg`}>
            {player.difficoltaAvversario <= 2 ? '🟢' : player.difficoltaAvversario <= 3 ? '🟡' : '🔴'}
          </div>
          <div className="text-slate-400 text-[10px]">Match</div>
          <div className="text-white text-xs font-medium">{player.inCasa ? '🏠' : '✈️'} {player.avversario}</div>
        </div>
      </div>

      {player.cleanSheetOdds > 0 && (
        <div className="mt-2 text-center text-xs text-slate-400">
          Clean Sheet: <span className="text-emerald-400 font-medium">{(player.cleanSheetOdds * 100).toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}
