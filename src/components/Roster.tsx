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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black p-4 md:p-8 pt-20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="relative mb-6">
          <button 
            onClick={onBack} 
            className="absolute left-0 top-0 text-slate-400 hover:text-emerald-400 transition-colors text-sm font-medium bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-lg border border-white/10"
          >
            ← Indietro
          </button>
          <div className="text-center pt-1">
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              GESTIONE <span className="text-emerald-400">ROSA</span>
            </h1>
            <p className="text-emerald-400/70 text-xs tracking-widest uppercase mt-1">Aggiungi o rimuovi giocatori</p>
          </div>
        </div>

        {/* Listone Status */}
        {listoneStatus && (
          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-4 mb-6">
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
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-4 mb-6 relative z-40">
          <div className="relative">
            <input
