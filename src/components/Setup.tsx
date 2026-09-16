import { useState } from 'react';
import { LeagueRules } from '../types';
import { getAvailableModules } from '../utils/optimizer';

interface SetupProps {
  rules: LeagueRules;
  onSave: (rules: LeagueRules) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Setup({ rules, onSave, onNext, onBack }: SetupProps) {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black p-3 md:p-8 pt-16 md:pt-12">
      <div className="max-w-3xl mx-auto">
        {/* 🔥 Bottone HOME */}
        <div className="relative mb-4 md:mb-6">
          <button 
            onClick={onBack} 
            className="absolute left-0 top-0 text-slate-400 hover:text-emerald-400 transition-colors text-sm font-medium bg-slate-900/80 backdrop-blur-md w-10 h-10 md:w-auto md:h-auto md:px-3 md:py-2 rounded-lg border border-white/10 flex items-center justify-center"
          >
            <span className="md:hidden text-lg">🏠</span>
            <span className="hidden md:inline">🏠 Home</span>
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-6 md:mb-8">
          <div className="inline-flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
            <span className="text-3xl md:text-5xl">⚙️</span>
            <h1 className="text-2xl md:text-5xl font-black text-white tracking-tight">
              REGOLE <span className="text-emerald-400">LEGA</span>
            </h1>
          </div>
          <p className="text-emerald-400/70 text-[10px] md:text-sm tracking-widest uppercase">
            Configura le regole della tua lega
          </p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-4 md:p-8 shadow-2xl">
          {/* SEZIONE 1: MODIFICATORE DI DIFESA */}
          <div className="mb-6 md:mb-8">
            <h3 className="text-base md:text-lg font-bold text-white mb-3 md:mb-4 flex items-center gap-2 md:gap-3">
              <span className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-black font-black text-xs md:text-sm shadow-lg shadow-emerald-500/50">
                1
              </span>
              <span className="tracking-tight">Modificatore di Difesa</span>
            </h3>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-3">
              <button
                onClick={() => updateRules({ modificatoreDifesa: 'off' })}
                className={`p-3 min-h-[60px] rounded-xl border-2 transition-all ${
                  localRules.modificatoreDifesa === 'off'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-lg shadow-emerald-500/30'
                    : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                <div className="font-bold text-sm md:text-base">Disattivato</div>
                <div className="text-[10px] md:text-xs mt-1 opacity-70">Nessun bonus</div>
              </button>
              <button
                onClick={() => updateRules({ modificatoreDifesa: 'standard' })}
                className={`p-3 min-h-[60px] rounded-xl border-2 transition-all ${
                  localRules.modificatoreDifesa === 'standard'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-lg shadow-emerald-500/30'
                    : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                <div className="font-bold text-sm md:text-base">Standard</div>
                <div className="text-[10px] md:text-xs mt-1 opacity-70">+1 / +3 / +6</div>
              </button>
              <button
                onClick={() => updateRules({ modificatoreDifesa: 'custom' })}
                className={`p-3 min-h-[60px] rounded-xl border-2 transition-all ${
                  localRules.modificatoreDifesa === 'custom'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-lg shadow-emerald-500/30'
                    : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                <div className="font-bold text-sm md:text-base">Personalizzato</div>
                <div className="text-[10px] md:text-xs mt-1 opacity-70">Soglie custom</div>
              </button>
            </div>

            {localRules.modificatoreDifesa === 'custom' && (
              <div className="mt-3 p-3 md:p-4 bg-slate-800/60 backdrop-blur-md rounded-xl border border-white/5 animate-fadeIn">
                <p className="text-xs md:text-sm text-slate-300 mb-3 font-medium">Configura soglie personalizzate:</p>
                <div className="space-y-2">
                  {localRules.modificatoreCustom.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 md:gap-3 flex-wrap">
                      <span className="text-slate-400 text-xs md:text-sm">Media ≥</span>
                      <input
                        type="number"
                        step="0.25"
                        value={t.threshold}
                        onChange={(e) => {
                          const newCustom = [...localRules.modificatoreCustom];
                          newCustom[i] = { ...newCustom[i], threshold: parseFloat(e.target.value) || 0 };
                          updateRules({ modificatoreCustom: newCustom });
                        }}
                        className="w-16 md:w-20 px-2 py-1 bg-slate-900/80 border border-slate-700/50 rounded-lg text-white text-xs md:text-sm focus:outline-none focus:border-emerald-500/60"
                      />
                      <span className="text-slate-400 text-xs md:text-sm">→ Bonus</span>
                      <input
                        type="number"
                        step="0.5"
                        value={t.bonus}
                        onChange={(e) => {
                          const newCustom = [...localRules.modificatoreCustom];
                          newCustom[i] = { ...newCustom[i], bonus: parseFloat(e.target.value) || 0 };
                          updateRules({ modificatoreCustom: newCustom });
                        }}
                        className="w-16 md:w-20 px-2 py-1 bg-slate-900/80 border border-slate-700/50 rounded-lg text-white text-xs md:text-sm focus:outline-none focus:border-emerald-500/60"
                      />
                      <button
                        onClick={() => {
                          const newCustom = localRules.modificatoreCustom.filter((_, idx) => idx !== i);
                          updateRules({ modificatoreCustom: newCustom });
                        }}
                        className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => updateRules({
                      modificatoreCustom: [...localRules.modificatoreCustom, { threshold: 6, bonus: 1 }]
                    })}
                    className="text-emerald-400 text-xs md:text-sm hover:text-emerald-300 font-medium transition-colors py-2"
                  >
                    + Aggiungi soglia
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SEZIONE 2: BONUS IMBATTIBILITÀ */}
          <div className="mb-6 md:mb-8">
            <h3 className="text-base md:text-lg font-bold text-white mb-3 md:mb-4 flex items-center gap-2 md:gap-3">
              <span className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-black font-black text-xs md:text-sm shadow-lg shadow-emerald-500/50">
                2
              </span>
              <span className="tracking-tight">Bonus Imbattibilità Portiere</span>
            </h3>
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              <button
                onClick={() => updateRules({ bonusImbattibilita: 'off' })}
                className={`p-3 min-h-[56px] rounded-xl border-2 transition-all ${
                  localRules.bonusImbattibilita === 'off'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-lg shadow-emerald-500/30'
                    : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                <div className="font-bold text-xs md:text-base">Off</div>
              </button>
              <button
                onClick={() => updateRules({ bonusImbattibilita: '0.5' })}
                className={`p-3 min-h-[56px] rounded-xl border-2 transition-all ${
                  localRules.bonusImbattibilita === '0.5'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-lg shadow-emerald-500/30'
                    : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                <div className="font-bold text-sm md:text-base">+0.5</div>
              </button>
              <button
                onClick={() => updateRules({ bonusImbattibilita: '1' })}
                className={`p-3 min-h-[56px] rounded-xl border-2 transition-all ${
                  localRules.bonusImbattibilita === '1'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-lg shadow-emerald-500/30'
                    : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                <div className="font-bold text-sm md:text-base">+1</div>
              </button>
            </div>
          </div>

          {/* SEZIONE 3: MODULI CONSENTITI */}
          <div className="mb-6 md:mb-8">
            <h3 className="text-base md:text-lg font-bold text-white mb-3 md:mb-4 flex items-center gap-2 md:gap-3">
              <span className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-black font-black text-xs md:text-sm shadow-lg shadow-emerald-500/50">
                3
              </span>
              <span className="tracking-tight">Moduli Consentiti</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {allModules.map(module => (
                <button
                  key={module}
                  onClick={() => toggleModule(module)}
                  className={`px-4 py-2.5 min-h-[44px] rounded-xl border-2 font-bold transition-all text-sm md:text-base ${
                    localRules.moduliConsentiti.includes(module)
                      ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-lg shadow-emerald-500/30'
                      : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                  }`}
                >
                  {module}
                </button>
              ))}
            </div>
          </div>

          {/* SEZIONE 4: ALTRE REGOLE */}
          <div className="mb-6 md:mb-8">
            <h3 className="text-base md:text-lg font-bold text-white mb-3 md:mb-4 flex items-center gap-2 md:gap-3">
              <span className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-black font-black text-xs md:text-sm shadow-lg shadow-emerald-500/50">
                4
              </span>
              <span className="tracking-tight">Altre Regole</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">

              <div className="bg-slate-800/60 backdrop-blur-md p-3 md:p-4 rounded-xl border border-white/5">
                <label className="text-slate-300 text-xs md:text-sm font-bold tracking-wide">Bonus Assist</label>
                <div className="flex gap-2 mt-2 md:mt-3">
                  {['off', '0.5', '1'].map(val => (
                    <button
                      key={val}
                      onClick={() => updateRules({ assist: val as LeagueRules['assist'] })}
                      className={`flex-1 px-3 py-2 min-h-[44px] rounded-lg text-xs md:text-sm font-bold transition-all ${
                        localRules.assist === val
                          ? 'bg-gradient-to-r from-emerald-400 to-green-600 text-black shadow-lg shadow-emerald-500/30'
                          : 'bg-slate-900/80 text-slate-400 hover:bg-slate-700/80 hover:text-white border border-slate-700/50'
                      }`}
                    >
                      {val === 'off' ? 'Off' : `+${val}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/60 backdrop-blur-md p-3 md:p-4 rounded-xl border border-white/5">
                <label className="text-slate-300 text-xs md:text-sm font-bold tracking-wide">Malus Gol Subito (Solo P)</label>
                <div className="flex items-center gap-2 mt-2 md:mt-3">
                  <input
                    type="number"
                    step="0.5"
                    value={localRules.golSubito}
                    onChange={(e) => updateRules({ golSubito: parseFloat(e.target.value) || 0 })}
                    className="w-20 px-3 py-2 bg-slate-900/80 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/60"
                  />
                  <span className="text-slate-400 text-xs md:text-sm">per gol</span>
                </div>
              </div>

              <div className="bg-slate-800/60 backdrop-blur-md p-3 md:p-4 rounded-xl border border-white/5">
                <label className="text-slate-300 text-xs md:text-sm font-bold tracking-wide">Bonus Rigore Parato</label>
                <div className="flex items-center gap-2 mt-2 md:mt-3">
                  <input
                    type="number"
                    step="0.5"
                    value={localRules.rigoreParato}
                    onChange={(e) => updateRules({ rigoreParato: parseFloat(e.target.value) || 0 })}
                    className="w-20 px-3 py-2 bg-slate-900/80 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/60"
                  />
                  <span className="text-slate-400 text-xs md:text-sm">punti</span>
                </div>
              </div>

              <div className="bg-slate-800/60 backdrop-blur-md p-3 md:p-4 rounded-xl border border-white/5">
                <label className="text-slate-300 text-xs md:text-sm font-bold tracking-wide">Malus Rigore Sbagliato</label>
                <div className="flex items-center gap-2 mt-2 md:mt-3">
                  <input
                    type="number"
                    step="0.5"
                    value={localRules.rigoreSbagliato}
                    onChange={(e) => updateRules({ rigoreSbagliato: parseFloat(e.target.value) || 0 })}
                    className="w-20 px-3 py-2 bg-slate-900/80 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/60"
                  />
                  <span className="text-slate-400 text-xs md:text-sm">punti</span>
                </div>
              </div>

            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full py-4 min-h-[56px] bg-gradient-to-r from-emerald-400 to-green-600 hover:from-emerald-300 hover:to-green-500 text-black font-black rounded-xl transition-all transform active:scale-[0.98] md:hover:scale-[1.02] shadow-lg shadow-emerald-500/50 tracking-wide uppercase text-xs md:text-sm"
          >
            Salva Regole →
          </button>
        </div>
      </div>
    </div>
  );
}
