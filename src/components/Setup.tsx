import { useState } from 'react';
import { LeagueRules } from '../types';
import { getAvailableModules } from '../utils/optimizer';

interface SetupProps {
  rules: LeagueRules;
  onSave: (rules: LeagueRules) => void;
  onNext: () => void;
}

export default function Setup({ rules, onSave, onNext }: SetupProps) {
  const [localRules, setLocalRules] = useState<LeagueRules>(rules);
  const allModules = getAvailableModules();

  const updateRules = (updates: Partial<LeagueRules>) => {
    setLocalRules(prev => ({ ...prev, ...updates }));
  };

  const toggleModule = (module: string) => {
    const current = localRules.moduliConsentiti;
    if (current.includes(module)) {
      if (current.length > 1) {
        updateRules({ moduliConsentiti: current.filter(m => m !== module) });
      }
    } else {
      updateRules({ moduliConsentiti: [...current, module] });
    }
  };

  const handleSave = () => {
    onSave(localRules);
    onNext();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-slate-900 to-emerald-950 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="text-4xl">⚽</span>
            <h1 className="text-3xl md:text-4xl font-bold text-white">FantaConsiglio</h1>
          </div>
          <p className="text-emerald-300 text-lg">Configura le regole della tua lega</p>
        </div>

        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-emerald-500/20 p-6 md:p-8 shadow-2xl">
          {/* Modificatore di Difesa */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm">1</span>
              Modificatore di Difesa
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => updateRules({ modificatoreDifesa: 'off' })}
                className={`p-3 rounded-xl border-2 transition-all ${
                  localRules.modificatoreDifesa === 'off'
                    ? 'border-emerald-500 bg-emerald-500/20 text-white'
                    : 'border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                <div className="font-medium">Disattivato</div>
                <div className="text-xs mt-1 opacity-70">Nessun bonus</div>
              </button>
              <button
                onClick={() => updateRules({ modificatoreDifesa: 'standard' })}
                className={`p-3 rounded-xl border-2 transition-all ${
                  localRules.modificatoreDifesa === 'standard'
                    ? 'border-emerald-500 bg-emerald-500/20 text-white'
                    : 'border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                <div className="font-medium">Standard</div>
                <div className="text-xs mt-1 opacity-70">+1 a 6.0 / +3 a 6.5 / +6 a 7.0</div>
              </button>
              <button
                onClick={() => updateRules({ modificatoreDifesa: 'custom' })}
                className={`p-3 rounded-xl border-2 transition-all ${
                  localRules.modificatoreDifesa === 'custom'
                    ? 'border-emerald-500 bg-emerald-500/20 text-white'
                    : 'border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                <div className="font-medium">Personalizzato</div>
                <div className="text-xs mt-1 opacity-70">Soglie custom</div>
              </button>
            </div>
            {localRules.modificatoreDifesa === 'custom' && (
              <div className="mt-3 p-4 bg-slate-700/50 rounded-xl">
                <p className="text-sm text-slate-300 mb-2">Configura soglie personalizzate:</p>
                <div className="space-y-2">
                  {localRules.modificatoreCustom.map((t, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-slate-400 text-sm">Media ≥</span>
                      <input
                        type="number"
                        step="0.5"
                        value={t.threshold}
                        onChange={(e) => {
                          const newCustom = [...localRules.modificatoreCustom];
                          newCustom[i] = { ...newCustom[i], threshold: parseFloat(e.target.value) || 0 };
                          updateRules({ modificatoreCustom: newCustom });
                        }}
                        className="w-20 px-2 py-1 bg-slate-600 rounded text-white text-sm"
                      />
                      <span className="text-slate-400 text-sm">→ Bonus</span>
                      <input
                        type="number"
                        step="0.5"
                        value={t.bonus}
                        onChange={(e) => {
                          const newCustom = [...localRules.modificatoreCustom];
                          newCustom[i] = { ...newCustom[i], bonus: parseFloat(e.target.value) || 0 };
                          updateRules({ modificatoreCustom: newCustom });
                        }}
                        className="w-20 px-2 py-1 bg-slate-600 rounded text-white text-sm"
                      />
                      <button
                        onClick={() => {
                          const newCustom = localRules.modificatoreCustom.filter((_, idx) => idx !== i);
                          updateRules({ modificatoreCustom: newCustom });
                        }}
                        className="ml-2 w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-red-300 transition-colors text-sm"
                        title="Rimuovi soglia"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => updateRules({
                      modificatoreCustom: [...localRules.modificatoreCustom, { threshold: 6, bonus: 1 }]
                    })}
                    className="text-emerald-400 text-sm hover:text-emerald-300"
                  >
                    + Aggiungi soglia
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bonus Imbattibilità */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm">2</span>
              Bonus Imbattibilità Portiere
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => updateRules({ bonusImbattibilita: 'off' })}
                className={`p-3 rounded-xl border-2 transition-all ${
                  localRules.bonusImbattibilita === 'off'
                    ? 'border-emerald-500 bg-emerald-500/20 text-white'
                    : 'border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                <div className="font-medium">Disattivato</div>
              </button>
              <button
                onClick={() => updateRules({ bonusImbattibilita: '0.5' })}
                className={`p-3 rounded-xl border-2 transition-all ${
                  localRules.bonusImbattibilita === '0.5'
                    ? 'border-emerald-500 bg-emerald-500/20 text-white'
                    : 'border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                <div className="font-medium">+0.5</div>
              </button>
              <button
                onClick={() => updateRules({ bonusImbattibilita: '1' })}
                className={`p-3 rounded-xl border-2 transition-all ${
                  localRules.bonusImbattibilita === '1'
                    ? 'border-emerald-500 bg-emerald-500/20 text-white'
                    : 'border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                <div className="font-medium">+1</div>
              </button>
            </div>
          </div>

          {/* Moduli Consentiti */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm">3</span>
              Moduli Consentiti
            </h3>
            <div className="flex flex-wrap gap-2">
              {allModules.map(module => (
                <button
                  key={module}
                  onClick={() => toggleModule(module)}
                  className={`px-4 py-2 rounded-xl border-2 font-medium transition-all ${
                    localRules.moduliConsentiti.includes(module)
                      ? 'border-emerald-500 bg-emerald-500/20 text-white'
                      : 'border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {module}
                </button>
              ))}
            </div>
          </div>

          {/* Altre Regole */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm">4</span>
              Altre Regole
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Assist */}
              <div className="bg-slate-700/50 p-4 rounded-xl">
                <label className="text-slate-300 text-sm font-medium">Bonus Assist</label>
                <div className="flex gap-2 mt-2">
                  {['off', '0.5', '1'].map(val => (
                    <button
                      key={val}
                      onClick={() => updateRules({ assist: val as LeagueRules['assist'] })}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        localRules.assist === val
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      }`}
                    >
                      {val === 'off' ? 'Off' : `+${val}`}
                    </button>
                  ))}
                </div>
              </div>
              {/* Gol Subito */}
              <div className="bg-slate-700/50 p-4 rounded-xl">
                <label className="text-slate-300 text-sm font-medium">Malus Gol Subito (P/D)</label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    step="0.5"
                    value={localRules.golSubito}
                    onChange={(e) => updateRules({ golSubito: parseFloat(e.target.value) || 0 })}
                    className="w-20 px-2 py-1 bg-slate-600 rounded text-white text-sm"
                  />
                  <span className="text-slate-400 text-sm">per gol</span>
                </div>
              </div>
              {/* Rigore Parato */}
              <div className="bg-slate-700/50 p-4 rounded-xl">
                <label className="text-slate-300 text-sm font-medium">Bonus Rigore Parato</label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    step="0.5"
                    value={localRules.rigoreParato}
                    onChange={(e) => updateRules({ rigoreParato: parseFloat(e.target.value) || 0 })}
                    className="w-20 px-2 py-1 bg-slate-600 rounded text-white text-sm"
                  />
                  <span className="text-slate-400 text-sm">punti</span>
                </div>
              </div>
              {/* Rigore Sbagliato */}
              <div className="bg-slate-700/50 p-4 rounded-xl">
                <label className="text-slate-300 text-sm font-medium">Malus Rigore Sbagliato</label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    step="0.5"
                    value={localRules.rigoreSbagliato}
                    onChange={(e) => updateRules({ rigoreSbagliato: parseFloat(e.target.value) || 0 })}
                    className="w-20 px-2 py-1 bg-slate-600 rounded text-white text-sm"
                  />
                  <span className="text-slate-400 text-sm">punti</span>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold rounded-xl transition-all transform hover:scale-[1.02] shadow-lg shadow-emerald-500/25"
          >
            Salva e Continua → Inserisci Rosa
          </button>
        </div>
      </div>
    </div>
  );
}
