import { useState } from 'react';
import { Player } from '../types';
import { extractPlayersFromText } from '../services/fuzzyMatch';
import * as XLSX from 'xlsx';

interface AIImportProps {
  availablePlayers: Player[];
  currentRoster: Player[];
  onPlayersFound: (players: Player[]) => void;
}

export default function AIImport({ availablePlayers, currentRoster, onPlayersFound }: AIImportProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'image'>('file');
  const [isProcessing, setIsProcessing] = useState(false);
  const [text, setText] = useState('');
  const [foundPlayers, setFoundPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);

  const processText = (rawText: string) => {
    setIsProcessing(true);
    setError(null);
    
    setTimeout(() => {
      try {
        const players = extractPlayersFromText(rawText, availablePlayers);
        setFoundPlayers(players.map(p => p.player));
        if (players.length === 0) {
          setError('Nessun giocatore riconosciuto. Prova a verificare i nomi o a usare un formato più chiaro.');
        }
      } catch (err) {
        setError('Errore durante l\'analisi del testo.');
      } finally {
        setIsProcessing(false);
      }
    }, 300);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setFoundPlayers([]);
    setText('');

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'csv' || ext === 'txt' || ext === 'json') {
        const rawText = await file.text();
        setText(rawText);
        processText(rawText);
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawText = XLSX.utils.sheet_to_csv(firstSheet);
        setText(rawText);
        processText(rawText);
      } else {
        setError('Formato non supportato. Usa .xlsx, .csv, .txt o .json');
        setIsProcessing(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nella lettura del file');
      setIsProcessing(false);
    } finally {
      e.target.value = '';
    }
  };

  const handleAddAll = () => {
    const currentIds = new Set(currentRoster.map(p => p.id));
    const newPlayers = foundPlayers.filter(p => !currentIds.has(p.id));
    
    if (newPlayers.length > 0) {
      onPlayersFound(newPlayers);
      setFoundPlayers([]);
      setText('');
      setError(null);
    }
  };

  return (
    <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-purple-500/20 p-4 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">✨</span>
        <div>
          <h3 className="text-white font-semibold">Importazione Intelligente</h3>
          <p className="text-sm text-slate-400">Carica un file o incolla i nomi da uno screenshot</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4 bg-slate-700/50 p-1 rounded-lg">
        <button
          onClick={() => { setActiveTab('file'); setFoundPlayers([]); setError(null); }}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'file' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
          }`}
        >
          📄 Carica File (Excel/CSV)
        </button>
        <button
          onClick={() => { setActiveTab('image'); setFoundPlayers([]); setError(null); }}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'image' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
          }`}
        >
          📸 Da Screenshot (Copia/Incolla)
        </button>
      </div>

      {activeTab === 'file' && (
        <div className="space-y-3">
          <label className="block cursor-pointer">
            <div className="flex items-center justify-center gap-3 p-6 border-2 border-dashed border-purple-500/50 rounded-xl hover:border-purple-400 hover:bg-purple-500/5 transition-all">
              <span className="text-3xl">📊</span>
              <div className="text-left">
                <div className="text-white font-medium">Clicca per caricare il file</div>
                <div className="text-xs text-slate-400">Supporta .xlsx, .csv, .txt, .json</div>
              </div>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.txt,.json"
              className="hidden"
              disabled={isProcessing}
              onChange={handleFileUpload}
            />
          </label>
        </div>
      )}

      {activeTab === 'image' && (
        <div className="space-y-3">
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-xs text-purple-200">
            <strong>💡 Suggerimento Pro:</strong> Fai uno screenshot della tua squadra, usa la funzione nativa "Copia testo" del tuo telefono (iOS/Android) o PC, e incollalo qui sotto. Il nostro algoritmo troverà i giocatori anche se il testo è disordinato!
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Incolla qui il testo copiato dallo screenshot...&#10;Esempio:&#10;Sommer&#10;Pavard&#10;Lautaro Martinez&#10;Kvara"
            className="w-full h-32 px-4 py-3 bg-slate-700/80 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition-colors resize-none text-sm"
          />
          <button
            onClick={() => processText(text)}
            disabled={!text.trim() || isProcessing}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Analisi in corso...
              </>
            ) : (
              '🔍 Trova giocatori nel listone'
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {foundPlayers.length > 0 && (
        <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-emerald-400 font-medium">
              ✅ Trovati {foundPlayers.length} giocatori corrispondenti
            </div>
            <button
              onClick={handleAddAll}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm transition-colors font-medium shadow-lg shadow-emerald-500/20"
            >
              + Aggiungi tutti alla rosa
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {foundPlayers.map(player => (
              <div
                key={player.id}
                className="flex items-center justify-between p-3 bg-slate-700/40 rounded-lg border border-slate-600/50 hover:bg-slate-700/60 transition-colors"
              >
                <div>
                  <div className="text-white text-sm font-medium">{player.name} {player.surname}</div>
                  <div className="text-slate-400 text-xs">{player.team}</div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  player.role === 'P' ? 'bg-yellow-500/20 text-yellow-400' :
                  player.role === 'D' ? 'bg-blue-500/20 text-blue-400' :
                  player.role === 'C' ? 'bg-green-500/20 text-green-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {player.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
