import { useState, useMemo } from 'react';
import { Player, Role } from '../types';
import { ListoneStatus } from '../services/listoneService';
import { applyProbabiliFormazioni } from '../services/probabiliFormazioniService';
import RosaRecognizer from './RosaRecognizer';

interface RosterProps {
  roster: Player[];
  onSave: (roster: Player[]) => void;
  onNext: () => void;
  onBack: () => void;
  availablePlayers: Player[];
  listoneStatus: ListoneStatus | null;
  onListoneChange: () => void;
}

const roleLabels: Record<Role, { label: string; color: string; icon: string }> = {
  'P': { label: 'Portieri', color: 'from-yellow-400 to-amber-600', icon: '🧤' },
  'D': { label: 'Difensori', color: 'from-blue-400 to-cyan-600', icon: '🛡️' },
  'C': { label: 'Centrocampisti', color: 'from-emerald-400 to-green-600', icon: '🎯' },
  'A': { label: 'Attaccanti', color: 'from-red-400 to-rose-600', icon: '⚡' },
};

const roleCounts: Record<Role, number> = { P: 3, D: 8, C: 8, A: 6 };

export default function Roster({ roster, onSave, onNext, onBack, availablePlayers, listoneStatus, onListoneChange }: RosterProps) {
  const [localRoster, setLocalRoster] = useState<Player[]>(roster);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeRole, setActiveRole] = useState<Role | null>(null);

  const rosterByRole = useMemo(() => {
    const grouped: Record<Role, Player[]> = { P: [], D: [], C: [], A: [] };
    if (!Array.isArray(localRoster)) return grouped;
    localRoster.forEach(p => {
      if (!p || !p.role) return;
      if (grouped[p.role]) grouped[p.role].push(p);
    });
    return grouped;
  }, [localRoster]);

  const searchResults = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    if (!Array.isArray(availablePlayers)) return [];
    
    const rosterIds = new Set(
      (localRoster || []).filter(p => p && p.id).map(p => p.id)
    );
    
    const searchLower = searchTerm.toLowerCase().trim();
    if (!searchLower) return [];
    
    return availablePlayers
      .filter((p: Player) => {
        if (!p) return false;
        const haystack = `${p.name || ''} ${p.surname || ''} ${p.team || ''}`.toLowerCase();
        return haystack.includes(searchLower) && !rosterIds.has(p.id);
      })
      .slice(0, 10);
  }, [searchTerm, localRoster, availablePlayers]);

  const addPlayer = (player: Player) => {
    if (!player) return;
    setLocalRoster(prev => [...prev, player]);
    setSearchTerm('');
  };

  const addPlayers = (players: Player[]) => {
    if (!Array.isArray(players)) return;
    setLocalRoster(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const newPlayers = players.filter(p => p && !existingIds.has(p.id));
      return [...prev, ...newPlayers];
    });
  };

  const removePlayer = (playerId: string) => {
    setLocalRoster(prev => prev.filter(p => p.id !== playerId));
  };

  const handleSave = () => {
    let rosterFinale = localRoster;
    try {
      rosterFinale = applyProbabiliFormazioni(localRoster);
    } catch (e) {
      rosterFinale = localRoster;
    }
    onSave(rosterFinale);
    setLocalRoster(rosterFinale);
    onNext();
  };

  const isRosterComplete = Object.entries(rosterByRole).every(
    ([role, players]) => players.length >= roleCounts[role as Role]
  );

  const hasMinimumPlayers = localRoster.length >= 11;

  const getVP = (p: Player) => {
    const fm = p.fantamedia ?? 0;
    const mv = p.mediaVoto ?? 6;
    return fm > 0 ? fm : mv;
  };

  return (
    <div className="min-h-screen stadium-bg p-4 md:p-8 pt-20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="relative mb-6">
          <button 
            onClick={onBack} 
            className="absolute left-0 top-0 text-slate-400 hover:text-emerald-400 transition-colors text-sm font-medium glass-card px-3 py-2 rounded-lg"
          >
            ← Indietro
          </button>
          <div className="text-center pt-1">
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              GESTIONE <span className="text-emerald-400 glow-text-green">ROSA</span>
            </h1>
            <p className="text-emerald-400/70 text-xs tracking-widest uppercase mt-1">Aggiungi o rimuovi giocatori</p>
          </div>
        </div>

        {/* Listone Status */}
        {listoneStatus && (
          <div className="glass-card rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{listoneStatus.error ? '⚠️' : '📋'}</span>
              <div className="flex-1">
                <div className="text-white font-bold text-sm">Listone Serie A 2026/27</div>
                <div className="text-slate-400 text-xs">
                  {listoneStatus.error 
                    ? listoneStatus.error
                    : `${listoneStatus.playerCount} giocatori • ${listoneStatus.source}`
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        <RosaRecognizer
          listaGiocatori={availablePlayers}
          giocatoriGiaInRosa={localRoster}
          onAggiungiGiocatori={addPlayers}
        />

        {/* Search */}
        <div className="glass-card rounded-2xl p-4 mb-6 relative z-40">
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Cerca giocatore (nome, cognome, squadra)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 glass-card rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto">
                {searchResults.map(player => (
                  <button
                    key={player.id}
                    onClick={() => addPlayer(player)}
                    className="w-full px-4 py-3 text-left hover:bg-emerald-500/10 transition-colors flex items-center justify-between border-b border-slate-700/30 last:border-0"
                  >
                    <div>
                      <span className="text-white font-semibold">{player.name} {player.surname}</span>
                      <span className="text-slate-400 text-sm ml-2">({player.team})</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      player.role === 'P' ? 'bg-yellow-500/20 text-yellow-400' :
                      player.role === 'D' ? 'bg-blue-500/20 text-blue-400' :
                      player.role === 'C' ? 'bg-emerald-500/20 text-emerald-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {player.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Empty */}
        {localRoster.length === 0 && (
          <div className="glass-card rounded-2xl p-8 mb-6 text-center">
            <div className="text-5xl mb-3">⚽</div>
            <h3 className="text-white font-bold text-lg mb-2">La tua rosa è vuota</h3>
            <p className="text-slate-400 text-sm">
              Usa la barra di ricerca per aggiungere i giocatori del listone.
            </p>
          </div>
        )}

        {/* Role Filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveRole(null)}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              activeRole === null
                ? 'bg-gradient-to-r from-emerald-400 to-green-600 text-black glow-green'
                : 'glass-card text-slate-300 hover:text-white'
            }`}
          >
            Tutti ({localRoster.length})
          </button>
          {(['P', 'D', 'C', 'A'] as Role[]).map(role => (
            <button
              key={role}
              onClick={() => setActiveRole(role)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                activeRole === role
                  ? `bg-gradient-to-r ${roleLabels[role].color} text-black glow-green`
                  : 'glass-card text-slate-300 hover:text-white'
              }`}
            >
              {roleLabels[role].icon} {roleLabels[role].label} ({rosterByRole[role].length}/{roleCounts[role]})
            </button>
          ))}
        </div>

        {/* Player List */}
        <div className="space-y-4">
          {(['P', 'D', 'C', 'A'] as Role[])
            .filter(role => activeRole === null || activeRole === role)
            .map(role => {
              const players = rosterByRole[role];
              if (players.length === 0 && activeRole !== null) return null;
              return (
                <div key={role} className="glass-card rounded-2xl overflow-hidden">
                  <div className={`px-4 py-3 bg-gradient-to-r ${roleLabels[role].color} bg-opacity-10 border-b border-slate-700/40`}>
                    <h3 className="text-white font-bold flex items-center gap-2 text-sm tracking-wide uppercase">
                      <span>{roleLabels[role].icon}</span>
                      {roleLabels[role].label}
                      <span className="text-xs opacity-60 ml-auto font-mono">{players.length}/{roleCounts[role]}</span>
                    </h3>
                  </div>
                  <div className="p-2">
                    {players.length === 0 ? (
                      <p className="text-slate-500 text-sm text-center py-4">Nessun giocatore.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {players.map(player => {
                          const vp = getVP(player);
                          const vpColor = vp >= 7 ? 'text-emerald-400' : vp >= 6 ? 'text-yellow-400' : 'text-red-400';
                          return (
                            <div
                              key={player.id}
                              className="flex items-center justify-between p-3 bg-slate-900/40 hover:bg-slate-800/60 rounded-xl transition-all border border-slate-700/30 hover:border-emerald-500/30"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-white font-semibold text-sm">{player.name} {player.surname}</div>
                                <div className="text-slate-400 text-[10px] mt-0.5">
                                  {player.team} • 
                                  <span className="text-emerald-400 ml-1">FM: {player.fantamedia ?? 0}</span> • 
                                  <span className="text-blue-400 ml-1">MV: {player.mediaVoto ?? 6}</span> • 
                                  <span className="ml-1">Tit: {player.titolarita}%</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                <span className={`text-xs font-black ${vpColor}`}>{vp.toFixed(1)}</span>
                                <button
                                  onClick={() => removePlayer(player.id)}
                                  className="text-red-400 hover:text-red-300 p-1 transition-colors"
                                  title="Rimuovi"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Status */}
        <div className="mt-6 glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-slate-300 text-sm font-medium">
              {isRosterComplete ? (
                <span className="text-emerald-400">✓ Rosa completa</span>
              ) : hasMinimumPlayers ? (
                <span className="text-amber-400">⚠ Rosa parziale</span>
              ) : (
                <span className="text-red-400">✗ Aggiungi almeno 11 giocatori</span>
              )}
            </div>
            <div className="text-sm text-slate-400 font-mono">{localRoster.length}/25</div>
          </div>

          <div className="flex gap-3 mb-3 text-[10px] font-bold">
            <span className="text-yellow-400">P: {rosterByRole.P.length}/3</span>
            <span className="text-blue-400">D: {rosterByRole.D.length}/8</span>
            <span className="text-emerald-400">C: {rosterByRole.C.length}/8</span>
            <span className="text-red-400">A: {rosterByRole.A.length}/6</span>
          </div>

          <div className="w-full h-1.5 bg-slate-800 rounded-full mb-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isRosterComplete ? 'bg-gradient-to-r from-emerald-400 to-green-600' : hasMinimumPlayers ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min((localRoster.length / 25) * 100, 100)}%` }}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!hasMinimumPlayers}
            className={`w-full py-4 font-black rounded-xl transition-all text-sm tracking-wide uppercase ${
              hasMinimumPlayers
                ? 'bg-gradient-to-r from-emerald-400 to-green-600 text-black hover:scale-[1.02] glow-green'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            {isRosterComplete
              ? 'CALCOLA FORMAZIONE →'
              : hasMinimumPlayers
                ? 'PROCEDI →'
                : `AGGIUNGI ${11 - localRoster.length} GIOCATORI`}
          </button>
        </div>
      </div>
    </div>
  );
}
