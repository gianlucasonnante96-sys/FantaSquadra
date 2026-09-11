
import { useState, useEffect } from 'react';
import { Player } from '../types';
import {
  fetchProbabiliFormazioni,
  importProbabiliFormazioni,
  loadProbabiliFormazioni,
  saveProbabiliFormazioni,
  applyProbabiliFormazioni
} from '../services/probabiliFormazioniService';

interface ProbabiliFormazioniManagerProps {
  players: Player[];
  onPlayersUpdated: (players: Player[]) => void;
}

export default function ProbabiliFormazioniManager({ players, onPlayersUpdated }: ProbabiliFormazioniManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [formazioniCount, setFormazioniCount] = useState(0);

  useEffect(() => {
    const formazioni = loadProbabiliFormazioni();
    setFormazioniCount(formazioni.length);
  }, []);

  const handleFetchOnline = async () => {
    setIsLoading(true);
    setStatus('Tentativo di download delle probabili formazioni...');

    try {
      const formazioni = await fetchProbabiliFormazioni();

      if (formazioni && formazioni.length > 0) {
        saveProbabiliFormazioni(formazioni);
        setFormazioniCount(formazioni.length);

        // Aggiorna la titolarità dei giocatori
        const updatedPlayers = applyProbabiliFormazioni(players);
        onPlayersUpdated(updatedPlayers);

        setStatus(`✅ Scaricate ${formazioni.length} probabili formazioni`);
      } else {
        setStatus('❌ Impossibile scaricare le probabili formazioni. Prova a caricare un file manualmente.');
      }
    } catch (error) {
      setStatus('❌ Errore nel download. Prova a caricare un file manualmente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setStatus('Elaborazione file...');

    try {
      const text = await file.text();
      const formazioni = importProbabiliFormazioni(text);

      if (formazioni) {
        setFormazioniCount(formazioni.length);

        // Aggiorna la titolarità dei giocatori
        const updatedPlayers = applyProbabiliFormazioni(players);
        onPlayersUpdated(updatedPlayers);

        setStatus(`✅ Caricate ${formazioni.length} probabili formazioni dal file`);
      } else {
        setStatus('❌ File non valido. Controlla il formato JSON.');
      }
    } catch (error) {
      setStatus('❌ Errore nella lettura del file.');
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  };

  const handleClear = () => {
    if (confirm('Sei sicuro di voler cancellare le probabili formazioni salvate?')) {
      localStorage.removeItem('fantaconsiglio_probabili_formazioni');
      setFormazioniCount(0);
      setStatus('Probabili formazioni cancellate');
    }
  };

  return (
    <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-emerald-500/20 p-4 mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-white"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📊</span>
          <div className="text-left">
            <div className="font-medium">Probabili Formazioni</div>
            <div className="text-sm text-slate-400">
              {formazioniCount > 0
                ? `${formazioniCount} squadre caricate • Titolarità aggiornata`
                : 'Nessuna probabile formazione caricata'
              }
            </div>
          </div>
        </div>
        <span className="text-emerald-400">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="mt-4 space-y-4">
          {/* Status */}
          {status && (
            <div className={`p-3 rounded-lg text-sm ${
              status.includes('✅') ? 'bg-emerald-500/20 text-emerald-300' :
              status.includes('❌') ? 'bg-red-500/20 text-red-300' :
              'bg-slate-700/50 text-slate-300'
            }`}>
              {status}
            </div>
          )}

          {/* Fetch Online */}
          <div>
            <p className="text-sm text-slate-300 mb-2">
              Scarica automaticamente le probabili formazioni da fonti online:
            </p>
            <button
              onClick={handleFetchOnline}
              disabled={isLoading}
              className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Download in corso...
                </>
              ) : (
                <>
                  🌐 Scarica da Internet
                </>
              )}
            </button>
          </div>

          {/* File Upload */}
          <div className="border-t border-slate-700 pt-4">
            <p className="text-sm text-slate-300 mb-2">
              Oppure carica un file JSON con le probabili formazioni:
            </p>
            <label className="block cursor-pointer">
              <div className="flex items-center justify-center gap-3 p-4 border-2 border-dashed border-slate-600 rounded-lg hover:border-emerald-500/50 transition-colors">
                <span className="text-2xl">📄</span>
                <div className="text-left">
                  <div className="text-white font-medium">Carica file JSON</div>
                  <div className="text-xs text-slate-400">Formato: [{"team": "Inter", "giocatori": ["Nome1", "Nome2", ...]}]</div>
                </div>
              </div>
              <input
                type="file"
                accept=".json"
                className="hidden"
                disabled={isLoading}
                onChange={handleFileUpload}
              />
            </label>
          </div>

          {/* Clear Button */}
          {formazioniCount > 0 && (
            <div className="border-t border-slate-700 pt-4">
              <button
                onClick={handleClear}
                className="w-full px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm transition-colors"
              >
                🗑️ Cancella probabili formazioni
              </button>
            </div>
          )}

          {/* Info */}
          <div className="bg-slate-700/30 rounded-lg p-3 text-xs text-slate-400">
            <p className="font-medium text-slate-300 mb-1">💡 Come funziona:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Le probabili formazioni aggiornano automaticamente la titolarità dei giocatori</li>
              <li>Giocatori titolari: 90% titolarità</li>
              <li>Giocatori in panchina: 20% titolarità</li>
              <li>La titolarità influenza il Voto Previsto</li>
              <li>I dati vengono salvati nel browser</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
