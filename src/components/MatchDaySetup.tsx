import { useState } from 'react';
import { MatchDay, parseProbableFormations } from '../services/apiService';

interface Props {
  currentMatchDay: MatchDay | null;
  isLoading: boolean;
  onLoadMatchDay: () => void;
  onFormationsUpdate: (formations: Record<string, string[]>) => void;
}

export default function MatchDaySetup({ currentMatchDay, isLoading, onLoadMatchDay, onFormationsUpdate }: Props) {
  const [formationText, setFormationText] = useState('');

  const handleParseFormations = () => {
    const formations = parseProbableFormations(formationText);
    onFormationsUpdate(formations);
    localStorage.setItem('fanta_formations', JSON.stringify(formations));
    alert(`✅ Probabili formazioni caricate per ${Object.keys(formations).length} squadre!`);
  };

  return (
    <div className="bg-gradient-to-br from-blue-900/60 to-purple-900/60 backdrop-blur-sm rounded-xl border border-blue-500/30 p-6 mb-6">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        📅 Gestione Giornata
      </h2>

      <div className="mb-6">
        <button
          onClick={onLoadMatchDay}
          disabled={isLoading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? 'Caricamento...' : '🔄 Carica avversari reali (API)'}
        </button>
        
        {currentMatchDay && (
          <div className="mt-3 bg-blue-800/30 rounded-lg p-3 text-sm text-blue-100">
            <div className="font-medium mb-2">Giornata {currentMatchDay.round} - Partite:</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentMatchDay.fixtures.map((f, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span>{f.homeTeam}</span>
                  <span className="text-blue-300">vs</span>
                  <span>{f.awayTeam}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-blue-700/50 pt-4">
        <h3 className="text-white font-medium mb-2">📋 Probabili Formazioni</h3>
        <p className="text-sm text-blue-200 mb-3">Copia e incolla da fantacalcio.it</p>
        <textarea
          value={formationText}
          onChange={(e) => setFormationText(e.target.value)}
          placeholder="Esempio:\nMilan\nMaignan 90%\nTheo 85%\n\nInter\nMartinez 95%"
          className="w-full h-32 px-4 py-3 bg-slate-800/80 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors resize-none text-sm mb-3"
        />
        <button
          onClick={handleParseFormations}
          disabled={!formationText.trim()}
          className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-xl transition-colors"
        >
          🎯 Aggiorna titolarità
        </button>
      </div>
    </div>
  );
}
