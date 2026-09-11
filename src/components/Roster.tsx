import { useState, useMemo } from 'react';
import { Player, Role } from '../types';
import { ListoneStatus, saveToCache, clearCache } from '../services/listoneService';
import { parseExcelFile } from '../services/listoneService';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const rosterByRole = useMemo(() => {
    const grouped: Record<Role, Player[]> = { P: [], D: [], C: [], A: [] };
    localRoster.forEach(p => grouped[p.role].push(p));
    return grouped;
  }, [localRoster]);

  const searchResults = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const rosterIds = new Set(localRoster.map((p: Player) => p.id));
    return availablePlayers
      .filter((p: Player) => {
        const matchesSearch = `${p.name} ${p.surname} ${p.team}`.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch && !rosterIds.has(p.id);
      })
      .slice(0, 10);
  }, [searchTerm, localRoster, availablePlayers]);

  const addPlayer = (player: Player) => {
    setLocalRoster(prev => [...prev, player]);
    setSearchTerm('');
  };

  const removePlayer = (playerId: string) => {
    setLocalRoster(prev => prev.filter(p => p.id !== playerId));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setImportError(null);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        const result = await parseExcelFile(file);
        saveToCache(result.players, result.status);
        onListoneChange();
        alert(`✅ Caricati con successo ${result.players.length} giocatori!`);
      } else {
        setImportError('Formato non supportato. Usa un file .xlsx o .csv');
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Errore nel caricamento');
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const isRosterComplete = Object.entries(rosterByRole).every(([role, players]) => players.length >= roleCounts[role as Role]);
  const hasMinimumPlayers = localRoster.length >= 11;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-slate-900 to-emerald-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6 relative">
          <button onClick={onBack} className="absolute left-0 top-0 text-slate-400 hover:text-white transition-colors">← Indietro</button>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Gestione Rosa</h1>
          <p className="text-emerald-300">Carica il listone e costruisci la tua squadra</p>
        </div>

        {/* 📥 PANNELLO DI CARICAMENTO EXCEL */}
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-emerald-500/20 p-6 mb-6">
          <h2 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
            <span className="text-2xl">📊</span> Carica il Listone Ufficiale
          </h2>
          
          {listoneStatus && !listoneStatus.error && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-sm text-emerald-200 flex items-center gap-2">
              <span>✅</span>
              <span>Listone caricato: <strong>{listoneStatus.playerCount}</strong> giocatori disponibili ({listoneStatus.fileName || 'Dati di esempio'})</span>
            </div>
          )}

          <label className="block cursor-pointer">
            <div className="flex items-center justify-center gap-4 p-8 border-2 border-dashed border-emerald-500/50 rounded-xl hover:border-emerald-400 hover:bg-emerald-500/5 transition-all group">
              <div className="text-4xl group-hover:scale-110 transition-transform">📁</div>
              <div className="text-left">
                <div className="text-white font-medium text-lg">Clicca per caricare il file Excel</div>
                <div className="text-sm text-slate-400">Supporta file .xlsx, .xls, .csv del listone Fantacalcio.it</div>
              </div>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              disabled={isProcessing}
              onChange={handleFileUpload}
            />
          </label>

          {isProcessing && (
            <div className="mt-4 flex items-center justify-center gap-2 text-emerald-400">
              <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              Elaborazione del listone in corso...
            </div>
          )}

          {importError && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 flex items-center gap-2">
              <span>⚠️</span> {importError}
            </div>
          )}

          {listoneStatus && (
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => { if (confirm('Sei sicuro di voler eliminare il listone caricato?')) { clearCache(); onListoneChange(); } }}
                className="flex-1 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                🗑️ Elimina Listone
              </button>
            </div>
          )}
        </div>

        {/* 🔍 BARRA DI RICERCA */}
        <div className="relative z-50 bg-slate-800/60 backdrop-blur-sm rounded-xl border border-emerald-500/20 p-4 mb-6">
          <input
            type="text"
            placeholder="🔍 Cerca giocatore per nome, cognome o squadra..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 bg-slate-700/80 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-700 border border-slate-600 rounded-xl shadow-xl z-[9999] max-h-80 overflow-y-auto">
              {searchResults.map(player => (
                <button key={player.id} onClick={() => addPlayer(player)} className="w-full px-4 py-3 text-left hover:bg-slate-600/50 transition-colors flex items-center justify-between border-b border-slate-600/50 last:border-0">
                  <div>
                    <span className="text-white font-medium">{player.name} {player.surname}</span>
                    <span className="text-slate-400 text-sm ml-2">({player.team})</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    player.role === 'P' ? 'bg-yellow-500/20 text-yellow-400' :
                    player.role === 'D' ? 'bg-blue-500/20 text-blue-400' :
                    player.role === 'C' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {player.role}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 📋 LISTA DELLA TUA ROSA */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button onClick={() => setActiveRole(null)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeRole === null ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
            Tutti ({localRoster.length})
          </button>
          {(['P', 'D', 'C', 'A'] as Role[]).map(role => (
            <button key={role} onClick={() => setActiveRole(role)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeRole === role ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
              {roleLabels[role].icon} {roleLabels[role].label} ({rosterByRole[role].length}/{roleCounts[role]})
            </button>
          ))}
        </div>

        <div className="space-y-4 mb-8">
          {(['P', 'D', 'C', 'A'] as Role[]).filter(role => activeRole === null || activeRole === role).map(role => {
            const players = rosterByRole[role];
            if (players.length === 0 && activeRole !== null) return null;
            return (
              <div key={role} className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
                <div className={`px-4 py-3 bg-gradient-to-r ${roleLabels[role].color} bg-opacity-20`}>
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <span>{roleLabels[role].icon}</span> {roleLabels[role].label}
                    <span className="text-sm opacity-75 ml-auto">{players.length}/{roleCounts[role]}</span>
                  </h3>
                </div>
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {players.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4 col-span-2">Nessun giocatore. Usa la ricerca per aggiungerne.</p>
                  ) : (
                    players.map(player => (
                      <div key={player.id} className="flex items-center justify-between p-3 bg-slate-700/40 rounded-lg hover:bg-slate-700/60 transition-colors">
                        <div>
                          <div className="text-white font-medium text-sm">{player.name} {player.surname}</div>
                          <div className="text-slate-400 text-xs">{player.team} • MV: {player.mediaVoto} • Qt: {player.titolarita}%</div>
                        </div>
                        <button onClick={() => removePlayer(player.id)} className="text-red-400 hover:text-red-300 p-2 hover:bg-red-500/10 rounded-lg transition-colors" title="Rimuovi">✕</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ✅ FOOTER E CONTINUA */}
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-md border-t border-slate-700 p-4 md:relative md:bg-transparent md:border-0 md:p-0">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="text-slate-300 font-medium">
                {isRosterComplete ? <span className="text-emerald-400">✓ Rosa completa</span> : hasMinimumPlayers ? <span className="text-amber-400">⚠ Rosa parziale</span> : <span className="text-red-400">✗ Minimo 11 giocatori</span>}
              </div>
              <div className="text-sm text-slate-400">{localRoster.length}/25 giocatori</div>
            </div>
            <button
              onClick={() => { onSave(localRoster); onNext(); }}
              disabled={!hasMinimumPlayers}
              className={`w-full py-4 font-bold rounded-xl transition-all transform shadow-lg ${
                hasMinimumPlayers
                  ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white hover:scale-[1.02] shadow-emerald-500/25'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isRosterComplete ? 'Calcola Formazione Consigliata →' : hasMinimumPlayers ? 'Procedi con rosa parziale →' : `Aggiungi almeno ${11 - localRoster.length} giocatori`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
