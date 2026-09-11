import { useState, useMemo } from 'react';
import { Player, Role } from '../types';
import { ListoneStatus, importFromJSON, exportToJSON, saveToCache, clearCache } from '../services/listoneService';
import AIImport from './AIImport';
import * as XLSX from 'xlsx';

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

  const addPlayer = (player: Player) => { setLocalRoster(prev => [...prev, player]); setSearchTerm(''); };
  const removePlayer = (playerId: string) => { setLocalRoster(prev => prev.filter(p => p.id !== playerId)); };
  const handleSave = () => { onSave(localRoster); onNext(); };

  const isRosterComplete = Object.entries(rosterByRole).every(([role, players]) => players.length >= roleCounts[role as Role]);
  const hasMinimumPlayers = localRoster.length >= 11;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setImportError(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'json') {
        const text = await file.text();
        const result = importFromJSON(text);
        if (result) { saveToCache(result.players, { ...result.status, fileName: file.name }); onListoneChange(); }
        else { setImportError('File JSON non valido.'); }
      } else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
        const headerRowIndex = json.findIndex(row => row.some((cell: any) => typeof cell === 'string' && (cell.toLowerCase().includes('calciatore') || cell.toLowerCase().includes('nome'))));
        if (headerRowIndex === -1) throw new Error('Colonna "Calciatore" o "Nome" non trovata.');
        
        const nameCol = json[headerRowIndex].findIndex((c: any) => typeof c === 'string' && (c.toLowerCase().includes('calciatore') || c.toLowerCase().includes('nome')));
        const teamCol = json[headerRowIndex].findIndex((c: any) => typeof c === 'string' && c.toLowerCase().includes('squadra'));
        const roleCol = json[headerRowIndex].findIndex((c: any) => typeof c === 'string' && c.toLowerCase().includes('ruolo'));
        const qiCol = json[headerRowIndex].findIndex((c: any) => typeof c === 'string' && (c.toLowerCase().includes('quotazione') || c.toLowerCase().includes('qi')));

        const players: Player[] = [];
        for (const row of json.slice(headerRowIndex + 1)) {
          if (!row || !Array.isArray(row)) continue;
          const nameRaw = row[nameCol];
          if (!nameRaw || nameRaw.toString().trim() === '') continue;
          const fullName = nameRaw.toString().trim();
          const team = teamCol >= 0 ? row[teamCol]?.toString().trim() : 'Sconosciuta';
          const roleRaw = roleCol >= 0 ? row[roleCol]?.toString().trim().toUpperCase() : 'C';
          const qi = qiCol >= 0 ? (parseFloat(row[qiCol]) || 1) : 1;
          const role: Role = (roleRaw === 'P' || roleRaw === 'POR') ? 'P' : (roleRaw === 'D' || roleRaw === 'DIF') ? 'D' : (roleRaw === 'A' || roleRaw === 'ATT') ? 'A' : 'C';
          const parts = fullName.split(' ');
          const surname = parts.pop() || '';
          const name = parts.join(' ');

          players.push({
            id: `xl_${name}_${surname}_${team}`.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
            name, surname, team, role,
            fantamedia: qi * 0.3 + (role === 'A' ? 2.5 : role === 'C' ? 2 : role === 'D' ? 1.5 : 1),
            mediaVoto: Math.min(7.5, 5.5 + (qi * 0.15)),
            titolarita: qi >= 15 ? 95 : qi >= 10 ? 85 : qi >= 6 ? 70 : qi >= 3 ? 50 : 20,
            forma: [6, 6, 6, 6, 6], inCasa: Math.random() > 0.5, avversario: 'Da definire', difficoltaAvversario: 3,
            cleanSheetOdds: role === 'P' ? (qi > 15 ? 0.5 : 0.3) : 0, isStarter: qi > 5,
          });
        }
        saveToCache(players, { source: 'Importazione Excel', lastUpdated: new Date().toLocaleDateString(), playerCount: players.length, isOnline: false, fileName: file.name });
        onListoneChange();
      } else { setImportError('Formato non supportato. Usa .xlsx, .csv o .json'); }
    } catch (err) { setImportError(err instanceof Error ? err.message : 'Errore nella lettura del file'); }
    finally { setIsProcessing(false); e.target.value = ''; }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-slate-900 to-emerald-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6 relative">
          <button onClick={onBack} className="absolute left-0 top-0 text-slate-400 hover:text-white transition-colors">← Indietro</button>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Gestione Rosa</h1>
          <p className="text-emerald-300">Aggiungi o rimuovi giocatori dalla tua rosa</p>
        </div>

        {/* 1. PANNELLO IMPORTAZIONE INTELLIGENTE */}
        <AIImport availablePlayers={availablePlayers} currentRoster={localRoster} onPlayersFound={(newPlayers) => setLocalRoster(prev => [...prev, ...newPlayers])} />

        {/* 2. Listone Status & Import Manuale */}
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-emerald-500/20 p-4 mb-6">
          <button onClick={() => setShowUpload(!showUpload)} className="w-full flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{listoneStatus?.error ? '⚠️' : '📋'}</span>
              <div className="text-left">
                <div className="font-medium">Listone Serie A</div>
                <div className="text-sm text-slate-400">{listoneStatus?.fileName ? `📄 ${listoneStatus.fileName} • ${listoneStatus.playerCount} giocatori` : `${listoneStatus?.playerCount || 0} giocatori caricati`}</div>
              </div>
            </div>
            <span className="text-emerald-400">{showUpload ? '▲' : '▼'}</span>
          </button>
          {showUpload && (
            <div className="mt-4 space-y-4">
              <label className="block cursor-pointer">
                <div className="flex items-center justify-center gap-3 p-6 border-2 border-dashed border-emerald-500/50 rounded-xl hover:border-emerald-400 hover:bg-emerald-500/5 transition-all">
                  <span className="text-3xl">📊</span>
                  <div className="text-left"><div className="text-white font-medium">Carica file Excel o JSON</div><div className="text-xs text-slate-400">Supporta .xlsx, .xls, .csv, .json</div></div>
                </div>
                <input type="file" accept=".xlsx,.xls,.csv,.json" className="hidden" disabled={isProcessing} onChange={handleFileUpload} />
              </label>
              {isProcessing && <div className="text-sm text-emerald-400 text-center">Elaborazione in corso...</div>}
              {importError && <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded">{importError}</p>}
              <div className="border-t border-slate-700 pt-4 flex gap-2">
                <button onClick={() => { if (confirm('Eliminare il listone?')) { clearCache(); onListoneChange(); } }} className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm">🗑️ Elimina listone</button>
                <button onClick={() => { const json = exportToJSON(availablePlayers); const blob = new Blob([json], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'listone.json'; a.click(); }} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm">📤 Esporta JSON</button>
              </div>
            </div>
          )}
        </div>

        {/* 3. Barra di Ricerca (FIX z-50) */}
        <div className="relative z-50 bg-slate-800/60 backdrop-blur-sm rounded-xl border border-emerald-500/20 p-4 mb-6">
          <div className="relative">
            <input type="text" placeholder="🔍 Cerca giocatore (nome, cognome, squadra)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-4 py-3 bg-slate-700/80 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors" />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-700 border border-slate-600 rounded-xl shadow-xl z-[9999] max-h-96 overflow-y-auto">
                {searchResults.map(player => (
                  <button key={player.id} onClick={() => addPlayer(player)} className="w-full px-4 py-3 text-left hover:bg-slate-600/50 transition-colors flex items-center justify-between border-b border-slate-600/50 last:border-0">
                    <div><span className="text-white font-medium">{player.name} {player.surname}</span><span className="text-slate-400 text-sm ml-2">({player.team})</span></div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${player.role === 'P' ? 'bg-yellow-500/20 text-yellow-400' : player.role === 'D' ? 'bg-blue-500/20 text-blue-400' : player.role === 'C' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{player.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 4. Lista Giocatori */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button onClick={() => setActiveRole(null)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeRole === null ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>Tutti ({localRoster.length})</button>
          {(['P', 'D', 'C', 'A'] as Role[]).map(role => (
            <button key={role} onClick={() => setActiveRole(role)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeRole === role ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>{roleLabels[role].icon} {roleLabels[role].label} ({rosterByRole[role].length}/{roleCounts[role]})</button>
          ))}
        </div>

        <div className="space-y-4">
          {(['P', 'D', 'C', 'A'] as Role[]).filter(role => activeRole === null || activeRole === role).map(role => {
            const players = rosterByRole[role];
            if (players.length === 0 && activeRole !== null) return null;
            return (
              <div key={role} className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
                <div className={`px-4 py-3 bg-gradient-to-r ${roleLabels[role].color} bg-opacity-20`}>
                  <h3 className="text-white font-semibold flex items-center gap-2"><span>{roleLabels[role].icon}</span> {roleLabels[role].label}<span className="text-sm opacity-75 ml-auto">{players.length}/{roleCounts[role]}</span></h3>
                </div>
                <div className="p-2">
                  {players.length === 0 ? <p className="text-slate-500 text-sm text-center py-4">Nessun giocatore. Usa la ricerca per aggiungerne.</p> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {players.map(player => (
                        <div key={player.id} className="flex items-center justify-between p-3 bg-slate-700/40 rounded-lg hover:bg-slate-700/60 transition-colors">
                          <div><div className="text-white font-medium text-sm">{player.name} {player.surname}</div><div className="text-slate-400 text-xs">{player.team} • FM: {player.fantamedia} • Tit: {player.titolarita}% • Avv: {player.avversario}</div></div>
                          <button onClick={() => removePlayer(player.id)} className="text-red-400 hover:text-red-300 p-1 transition-colors" title="Rimuovi">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 5. Footer e Continua */}
        <div className="mt-6 bg-slate-800/60 backdrop-blur-sm rounded-xl border border-emerald-500/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-slate-300">{isRosterComplete ? <span className="text-emerald-400 font-medium">✓ Rosa completa (25 giocatori)</span> : hasMinimumPlayers ? <span className="text-amber-400 font-medium">⚠ Rosa parziale - puoi procedere</span> : <span className="text-red-400 font-medium">✗ Aggiungi almeno 11 giocatori</span>}</div>
            <div className="text-sm text-slate-400">{localRoster.length}/25 giocatori</div>
          </div>
          <div className="flex gap-3 mb-3 text-xs">
            <span className="text-yellow-400">P: {rosterByRole.P.length}/3</span>
            <span className="text-blue-400">D: {rosterByRole.D.length}/8</span>
            <span className="text-green-400">C: {rosterByRole.C.length}/8</span>
            <span className="text-red-400">A: {rosterByRole.A.length}/6</span>
          </div>
          <div className="w-full h-2 bg-slate-700 rounded-full mb-4 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${isRosterComplete ? 'bg-emerald-500' : hasMinimumPlayers ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min((localRoster.length / 25) * 100, 100)}%` }} />
          </div>
          <button onClick={handleSave} disabled={!hasMinimumPlayers} className={`w-full py-4 font-bold rounded-xl transition-all transform shadow-lg ${hasMinimumPlayers ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white hover:scale-[1.02] shadow-emerald-500/25' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
            {isRosterComplete ? 'Calcola Formazione Consigliata →' : hasMinimumPlayers ? 'Procedi con rosa parziale →' : `Aggiungi almeno ${11 - localRoster.length} giocatori`}
          </button>
        </div>
      </div>
    </div>
  );
}
