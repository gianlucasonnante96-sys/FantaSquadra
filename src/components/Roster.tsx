import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Player, Role } from '../types';
import { ListoneStatus, importFromJSON, exportToJSON, parseExcelFile, saveToCache, clearCache } from '../services/listoneService';

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
  const [showUpload, setShowUpload] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchMenuPosition, setSearchMenuPosition] = useState({ top: 0, left: 0, width: 0 });

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

  const handleSave = () => {
    onSave(localRoster);
    onNext();
  };

  const isRosterComplete = Object.entries(rosterByRole).every(
    ([role, players]) => players.length >= roleCounts[role as Role]
  );

  const hasMinimumPlayers = localRoster.length >= 11; // Almeno 11 per fare una formazione

  useEffect(() => {
    if (!searchInputRef.current || searchResults.length === 0) return;

    const updateSearchMenuPosition = () => {
      const rect = searchInputRef.current?.getBoundingClientRect();
      if (!rect) return;
      setSearchMenuPosition({ top: rect.bottom + 8, left: rect.left, width: rect.width });
    };

    updateSearchMenuPosition();
    window.addEventListener('resize', updateSearchMenuPosition);
    window.addEventListener('scroll', updateSearchMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateSearchMenuPosition);
      window.removeEventListener('scroll', updateSearchMenuPosition, true);
    };
  }, [searchResults.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-slate-900 to-emerald-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <button onClick={onBack} className="absolute left-4 top-4 text-slate-400 hover:text-white transition-colors">
            ← Indietro
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Gestione Rosa</h1>
          <p className="text-emerald-300">Aggiungi o rimuovi giocatori dalla tua rosa</p>
        </div>

        {/* Listone Status & Import Section */}
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-emerald-500/20 p-4 mb-6">
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="w-full flex items-center justify-between text-white"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{listoneStatus?.error ? '⚠️' : '📋'}</span>
              <div className="text-left">
                <div className="font-medium">Listone Serie A</div>
                <div className="text-sm text-slate-400">
                  {listoneStatus?.fileName 
                    ? `📄 ${listoneStatus.fileName} • ${listoneStatus.playerCount} giocatori`
                    : listoneStatus?.error
                      ? `${listoneStatus.playerCount} giocatori (hardcoded)`
                      : `${listoneStatus?.playerCount || 0} giocatori caricati`
                  }
                </div>
              </div>
            </div>
            <span className="text-emerald-400">{showUpload ? '▲' : '▼'}</span>
          </button>
          
          {showUpload && (
            <div className="mt-4 space-y-4">
              {/* Status Info */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${listoneStatus?.error ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                    <span className="text-sm text-white font-medium">
                      {listoneStatus?.fileName ? `File: ${listoneStatus.fileName}` : listoneStatus?.source}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">{listoneStatus?.playerCount} giocatori</span>
                </div>
                {listoneStatus?.lastUpdated && (
                  <p className="text-xs text-slate-400">Caricato il: {listoneStatus.lastUpdated}</p>
                )}
                {listoneStatus?.error && (
                  <p className="text-xs text-amber-400 mt-1">{listoneStatus.error}</p>
                )}
              </div>

              {/* File Upload (Excel/JSON) */}
              <div className="border-t border-slate-700 pt-4">
                <p className="text-sm text-slate-300 mb-3">
                  📥 Carica un nuovo listone (il file verrà salvato e utilizzato dall'IA):
                </p>
                
                <label className="block cursor-pointer">
                  <div className="flex items-center justify-center gap-3 p-6 border-2 border-dashed border-emerald-500/50 rounded-xl hover:border-emerald-400 hover:bg-emerald-500/5 transition-all">
                    <span className="text-3xl">📊</span>
                    <div className="text-left">
                      <div className="text-white font-medium">Carica file Excel o JSON</div>
                      <div className="text-xs text-slate-400">Supporta .xlsx, .xls, .csv, .json</div>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.json"
                    className="hidden"
                    disabled={isProcessing}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      setIsProcessing(true);
                      setImportError(null);
                      
                      try {
                        const ext = file.name.split('.').pop()?.toLowerCase();
                        
                        if (ext === 'json') {
                          // JSON
                          const text = await file.text();
                          const result = importFromJSON(text);
                          if (result) {
                            saveToCache(result.players, { ...result.status, fileName: file.name });
                            onListoneChange();
                          } else {
                            setImportError('File JSON non valido. Controlla il formato.');
                          }
                        } else {
                          // Excel/CSV
                          const result = await parseExcelFile(file);
                          saveToCache(result.players, { ...result.status, fileName: file.name });
                          onListoneChange();
                        }
                      } catch (err) {
                        setImportError(err instanceof Error ? err.message : 'Errore nel caricamento del file');
                      } finally {
                        setIsProcessing(false);
                        // Reset the input so the same file can be re-selected
                        e.target.value = '';
                      }
                    }}
                  />
                </label>

                {isProcessing && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-emerald-400">
                    <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    Elaborazione file in corso...
                  </div>
                )}
                
                {importError && (
                  <p className="mt-3 text-xs text-red-400 bg-red-500/10 p-2 rounded">{importError}</p>
                )}
              </div>

              {/* Delete & Export */}
              <div className="border-t border-slate-700 pt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    if (confirm('Sei sicuro di voler eliminare il listone caricato? Dovrai caricarne uno nuovo per continuare.')) {
                      clearCache();
                      onListoneChange();
                    }
                  }}
                  className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  🗑️ Elimina listone
                </button>
                <button
                  onClick={() => {
                    const json = exportToJSON(availablePlayers);
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'listone_fantacalcio.json';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  📤 Esporta come JSON
                </button>
              </div>

              {/* Info box */}
              <div className="bg-slate-700/30 rounded-lg p-3 text-xs text-slate-400">
                <p className="font-medium text-slate-300 mb-1">💡 Formato file Excel supportato:</p>
                <p>Il file deve contenere colonne per: <strong>Calciatore</strong> (nome), <strong>Squadra</strong>, <strong>Ruolo</strong> (P/D/C/A), <strong>Quotazione</strong>.</p>
                <p className="mt-1">Il listone caricato rimane salvato nel browser e viene riutilizzato ad ogni accesso finché non lo elimini o ne carichi uno nuovo.</p>
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative z-[9999] bg-slate-800/60 backdrop-blur-sm rounded-xl border border-emerald-500/20 p-4 mb-6">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="🔍 Cerca giocatore (nome, cognome, squadra)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/80 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {searchResults.length > 0 && (
              createPortal(
                <div
                  className="fixed bg-slate-700 border border-slate-600 rounded-xl shadow-xl z-[99999] max-h-64 overflow-y-auto"
                  style={{ top: searchMenuPosition.top, left: searchMenuPosition.left, width: searchMenuPosition.width }}
                >
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
                </div>,
                document.body
              )
            )}
          </div>
        </div>

        {/* Empty roster message */}
        {localRoster.length === 0 && (
          <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-emerald-500/20 p-6 mb-6 text-center">
            <div className="text-4xl mb-3">⚽</div>
            <h3 className="text-white font-semibold text-lg mb-2">La tua rosa è vuota</h3>
            <p className="text-slate-400 text-sm mb-4">
              Usa la barra di ricerca qui sotto per aggiungere i giocatori del listone Serie A 2026/27.<br/>
              Puoi cercare per nome, cognome o squadra.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <span className="text-xs text-slate-500">Squadre: {['Atalanta', 'Bologna', 'Cagliari', 'Como', 'Fiorentina', 'Frosinone', 'Genoa', 'Inter', 'Juventus', 'Lazio', 'Lecce', 'Milan', 'Monza', 'Napoli', 'Parma', 'Roma', 'Sassuolo', 'Torino', 'Udinese', 'Venezia'].join(', ')}</span>
            </div>
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
                      <p className="text-slate-500 text-sm text-center py-4">Nessun giocatore. Usa la ricerca per aggiungerne.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {players.map(player => (
                          <div
                            key={player.id}
                            className="flex items-center justify-between p-3 bg-slate-700/40 rounded-lg hover:bg-slate-700/60 transition-colors"
                          >
                            <div>
                              <div className="text-white font-medium text-sm">{player.name} {player.surname}</div>
                              <div className="text-slate-400 text-xs">{player.team} • FM: {player.fantamedia} • Tit: {player.titolarita}%</div>
                            </div>
                            <button
                              onClick={() => removePlayer(player.id)}
                              className="text-red-400 hover:text-red-300 p-1 transition-colors"
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
                <span className="text-emerald-400 font-medium">✓ Rosa completa (25 giocatori)</span>
              ) : hasMinimumPlayers ? (
                <span className="text-amber-400 font-medium">⚠ Rosa parziale - puoi procedere</span>
              ) : (
                <span className="text-red-400 font-medium">✗ Aggiungi almeno 11 giocatori</span>
              )}
            </div>
            <div className="text-sm text-slate-400">
              {localRoster.length}/25 giocatori
            </div>
          </div>

          {/* Role breakdown */}
          <div className="flex gap-3 mb-3 text-xs">
            <span className="text-yellow-400">P: {rosterByRole.P.length}/3</span>
            <span className="text-blue-400">D: {rosterByRole.D.length}/8</span>
            <span className="text-green-400">C: {rosterByRole.C.length}/8</span>
            <span className="text-red-400">A: {rosterByRole.A.length}/6</span>
          </div>
          
          {/* Progress bar */}
          <div className="w-full h-2 bg-slate-700 rounded-full mb-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isRosterComplete ? 'bg-emerald-500' : hasMinimumPlayers ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min((localRoster.length / 25) * 100, 100)}%` }}
            />
          </div>

          {!isRosterComplete && hasMinimumPlayers && (
            <p className="text-xs text-slate-500 mb-3">
              💡 Puoi procedere con una rosa parziale. L'algoritmo selezionerà i migliori tra i giocatori disponibili.
            </p>
          )}

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
