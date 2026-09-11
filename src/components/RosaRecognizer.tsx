
import { useState } from 'react';
import { Player } from '../types';
import { riconosciGiocatoriDaFile } from '../services/rosaRecognizerService';

interface RosaRecognizerProps {
  listaGiocatori: Player[];
  giocatoriGiaInRosa: Player[];
  onAggiungiGiocatori: (giocatori: Player[]) => void;
}

export default function RosaRecognizer({
  listaGiocatori,
  giocatoriGiaInRosa,
  onAggiungiGiocatori
}: RosaRecognizerProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [riconosciuti, setRiconosciuti] = useState<Player[]>([]);
  const [nonRiconosciuti, setNonRiconosciuti] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setRiconosciuti([]);
    setNonRiconosciuti([]);

    try {
      const result = await riconosciGiocatoriDaFile(file, listaGiocatori);
      setRiconosciuti(result.riconosciuti);
      setNonRiconosciuti(result.nonRiconosciuti);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel riconoscimento');
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const aggiungiTuttiRiconosciuti = () => {
    const nuoviGiocatori = riconosciuti.filter(
      g => !giocatoriGiaInRosa.some(gia => gia.id === g.id)
    );
    onAggiungiGiocatori(nuoviGiocatori);
    setRiconosciuti([]);
    setNonRiconosciuti([]);
  };

  const rimuoviRiconosciuto = (id: string) => {
    setRiconosciuti(prev => prev.filter(g => g.id !== id));
  };

  return (
    <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-emerald-500/20 p-4 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">🔍</span>
        <div>
          <h3 className="text-white font-semibold">Carica Rosa Completa</h3>
          <p className="text-sm text-slate-400">
            Carica un file Excel o una foto della tua squadra per aggiungere automaticamente i giocatori
          </p>
        </div>
      </div>

      {/* Upload Area */}
      <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-emerald-500/50 transition-colors">
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.png,.jpg,.jpeg"
          onChange={handleFileUpload}
          disabled={isProcessing}
          className="hidden"
          id="rosa-upload"
        />
        <label
          htmlFor="rosa-upload"
          className="cursor-pointer flex flex-col items-center gap-2"
        >
          {isProcessing ? (
            <>
              <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-300">Riconoscimento in corso...</span>
            </>
          ) : (
            <>
              <span className="text-4xl">📁</span>
              <span className="text-slate-300">Clicca per caricare un file</span>
              <span className="text-xs text-slate-500">
                Supporta Excel (.xlsx, .xls, .csv) o immagini (.png, .jpg, .jpeg)
              </span>
            </>
          )}
        </label>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Results */}
      {(riconosciuti.length > 0 || nonRiconosciuti.length > 0) && (
        <div className="mt-6 space-y-4">
          {/* Recognized Players */}
          {riconosciuti.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-white font-medium">
                  ✅ Giocatori Riconosciuti ({riconosciuti.length})
                </h4>
                <button
                  onClick={aggiungiTuttiRiconosciuti}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm transition-colors"
                >
                  Aggiungi Tutti
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {riconosciuti.map((giocatore) => {
                  const giaInRosa = giocatoriGiaInRosa.some(g => g.id === giocatore.id);
                  return (
                    <div
                      key={giocatore.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        giaInRosa ? 'bg-slate-700/30 opacity-50' : 'bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-lg ${
                          giocatore.role === 'P' ? 'text-yellow-400' :
                          giocatore.role === 'D' ? 'text-blue-400' :
                          giocatore.role === 'C' ? 'text-green-400' :
                          'text-red-400'
                        }`}>
                          {giocatore.role === 'P' ? '🧤' :
                           giocatore.role === 'D' ? '🛡️' :
                           giocatore.role === 'C' ? '🎯' :
                           '⚡'}
                        </span>
                        <div>
                          <div className="text-white font-medium">
                            {giocatore.name} {giocatore.surname}
                          </div>
                          <div className="text-xs text-slate-400">
                            {giocatore.team} • {giocatore.role}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {giaInRosa ? (
                          <span className="text-xs text-slate-500">Già in rosa</span>
                        ) : (
                          <button
                            onClick={() => onAggiungiGiocatori([giocatore])}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs transition-colors"
                          >
                            Aggiungi
                          </button>
                        )}
                        <button
                          onClick={() => rimuoviRiconosciuto(giocatore.id)}
                          className="px-2 py-1 bg-red-600/50 hover:bg-red-600 text-white rounded text-xs transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unrecognized Players */}
          {nonRiconosciuti.length > 0 && (
            <div>
              <h4 className="text-white font-medium mb-3">
                ❌ Giocatori Non Riconosciuti ({nonRiconosciuti.length})
              </h4>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-xs text-amber-300 mb-2">
                  Questi giocatori non sono stati trovati nel listone. Puoi aggiungerli manualmente usando la ricerca sopra.
                </p>
                <div className="flex flex-wrap gap-2">
                  {nonRiconosciuti.map((nome, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded text-xs"
                    >
                      {nome}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-4 p-3 bg-slate-700/30 rounded-lg text-xs text-slate-400">
        <p className="font-medium text-slate-300 mb-1">💡 Come funziona:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Il sistema riconosce i giocatori anche se scritti in modo diverso</li>
          <li>Usa nome, squadra e ruolo per migliorare il riconoscimento</li>
          <li>Per le immagini, usa l'OCR per estrarre il testo</li>
          <li>Puoi modificare i giocatori riconosciuti prima di aggiungerli</li>
        </ul>
      </div>
    </div>
  );
}
