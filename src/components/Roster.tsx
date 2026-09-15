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
  'P': { label: 'Portieri', color: 'from-yellow-500 to-amber-600', icon: '🧤' },
  'D': { label: 'Difensori', color: 'from-blue-500 to-blue-600', icon: '🛡️' },
  'C': { label: 'Centrocampisti', color: 'from-green-500 to-emerald-600', icon: '🎯' },
  'A': { label: 'Attaccanti', color: 'from-red-500 to-rose-600', icon: '⚡' },
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
      console.error('❌ Errore applicazione formazioni:', e);
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

  return (
    // 🔥 Aggiunto pt-16 per evitare sovrapposizione con la status bar
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-slate-900 to-emerald-950 p-4 md:p-8 pt-20">
      <div className="max-w-4xl mx-auto">
        {/* Header con tasto Indietro NON nascosto */}
        <div className="relative mb-6">
          <button 
            onClick={onBack} 
            className="absolute left-0 top-0 text-slate-400 hover:text-white transition-colors text-sm bg-slate-800/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-700/50"
          >
            ← Indietro
          </button>
          <div className="text-center pt-1">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Gestione Rosa</h1>
            <p className="text-emerald-300">Aggiungi o rimuovi giocatori dalla tua rosa</p>
          </div>
        </div>

        {/* Listone Status */}
        {listoneStatus && (
          <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-emerald-500/20 p-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{listoneStatus.error ? '⚠️' : '📋'}</span>
              <div className="flex-1">
                <div className="text-white font-medium">Listone Serie A 2026/27</div>
                <div className="text-sm text-slate-400">
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
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-emerald-500/20 p-4 mb-6 relative z-40">
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Cerca giocatore (nome, cognome, squadra)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/80 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-700 border border-slate-600 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                {searchResults.map(player => (
                  <button
                    key={player.id}
                    onClick={() => addPlayer(player)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-600/50 transition-colors flex items-center justify-between border-b border-slate-600/50 last:border-0"
                  >
                    <div>
                      <span className="text-white font-medium">{player.name} {player.surname}</span>
                      <span className="text-slate-400 text-sm ml-2">({player.team})</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      player.role === 'P' ? 'bg-yellow-500/20 text-yellow-400' :
                      player.role === 'D' ? 'bg-blue-500/20 text-blue-400' :
                      player.role === 'C' ? 'bg-green-500/20 text-green-400' :
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

        {/* Empty roster */}
        {localRoster.length === 0 && (
          <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-emerald-500/20 p-6 mb-6 text-center">
            <div className="text-4xl mb-3">⚽</div>
            <h3 className="text-white font-semibold text-lg mb-2">La tua rosa è vuota</h3>
            <p className="text-slate-400 text-sm">
              Usa la barra di ricerca per aggiungere i giocatori del listone Serie A 2026/27.
            </p>
          </div>
        )}

        {/* Role Filter Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveRole(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeRole === null
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Tutti ({localRoster.length})
          </button>
          {(['P', 'D', 'C', 'A'] as Role[]).map(role => (
            <button
              key={role}
              onClick={() => setActiveRole(role)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeRole === role
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
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
                <div key={role} className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
                  <div className={`px-4 py-3 bg-gradient-to-r ${roleLabels[role].color} bg-opacity-20`}>
                    <h3 className="text-white font-semibold flex items-center gap-2">
                      <span>{roleLabels[role].icon}</span>
                      {roleLabels[role].label}
                      <span className="text-sm opacity-75 ml-auto">{players.length}/{roleCounts[role]}</span>
                    </h3>
                  </div>
                  <div className="p-2">
                    {players.length === 0 ? (
                      <p className="text-slate-500 text-sm text-center py-4">Nessun giocatore.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {players.map(player => (
                          <div
                            key={player.id}
                            className="flex items-center justify-between p-3 bg-slate-700/40 rounded-lg hover:bg-slate-700/60 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-white font-medium text-sm">{player.name} {player.surname}</div>
                              <div className="text-slate-400 text-xs">
                                {player.team} • 
                                <span className="text-emerald-400"> FM: {player.fantamedia ?? 0}</span> • 
                                <span className="text-blue-400"> MV: {player.mediaVoto ?? 6}</span> • 
                                Tit: {player.titolarita}%
                              </div>
                            </div>
                            <button
                              onClick={() => removePlayer(player.id)}
                              className="text-red-400 hover:text-red-300 p-1 transition-colors ml-2"
                              title="Rimuovi"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Status & Continue */}
        <div className="mt-6 bg-slate-800/60 backdrop-blur-sm rounded-xl border border-emerald-500/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-slate-300">
              {isRosterComplete ? (
                <span className="text-emerald-400 font-medium">✓ Rosa completa</span>
              ) : hasMinimumPlayers ? (
                <span className="text-amber-400 font-medium">⚠ Rosa parziale - puoi procedere</span>
              ) : (
                <span className="text-red-400 font-medium">✗ Aggiungi almeno 11 giocatori</span>
              )}
            </div>
            <div className="text-sm text-slate-400">{localRoster.length}/25 giocatori</div>
          </div>

          <div className="flex gap-3 mb-3 text-xs">
            <span className="text-yellow-400">P: {rosterByRole.P.length}/3</span>
            <span className="text-blue-400">D: {rosterByRole.D.length}/8</span>
            <span className="text-green-400">C: {rosterByRole.C.length}/8</span>
            <span className="text-red-400">A: {rosterByRole.A.length}/6</span>
          </div>

          <div className="w-full h-2 bg-slate-700 rounded-full mb-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isRosterComplete ? 'bg-emerald-500' : hasMinimumPlayers ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min((localRoster.length / 25) * 100, 100)}%` }}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!hasMinimumPlayers}
            className={`w-full py-4 font-bold rounded-xl transition-all transform shadow-lg ${
              hasMinimumPlayers
                ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white hover:scale-[1.02] shadow-emerald-500/25'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isRosterComplete
              ? 'Calcola Formazione Consigliata →'
              : hasMinimumPlayers
                ? 'Procedi con rosa parziale →'
                : `Aggiungi almeno ${11 - localRoster.length} giocatori`}
          </button>
        </div>
      </div>
    </div>
  );
}
