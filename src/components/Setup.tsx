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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <span className="text-5xl">⚽</span>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
              FANTA<span className="text-emerald-400">CONSIGLIO</span>
            </h1>
          </div>
          <p className="text-emerald-400/70 text-xs md:text-sm tracking-widest uppercase">
            Configura le regole della tua lega
          </p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-6 md:p-8 shadow-2xl">
          {/* ============================================================
              SEZIONE 1: MODIFICATORE DI DIFESA
              ============================================================ */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-black font-black text-sm shadow-lg shadow-emerald-500/50">
                1
              </span>
              <span className="tracking-tight">Modificatore di Difesa</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => updateRules({ modificatoreDifesa: 'off' })}
                className={`p-3 rounded-xl border-2 transition-all ${
                  localRules.modificatoreDifesa === 'off'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-lg shadow-emerald-500/30'
                    : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                <div className="font-bold">Disattivato</div>
                <div className="text-xs mt-1 opacity-70">Nessun bonus</div>
              </button>
              <button
                onClick={() => updateRules({ modificatoreDifesa: 'standard' })}
                className={`p-3 rounded-xl border-2 transition-all ${
                  localRules.modificatoreDifesa === 'standard'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-lg shadow-emerald-500/30'
                    : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                <div className="font-bold">Standard</div>
                <div className="text-xs mt-1 opacity-70">+1 / +3 / +6</div>
              </button>
              <button
                onClick={() => updateRules({ modificatoreDifesa: 'custom' })}
                className={`p-3 rounded-xl border-2 transition-all ${
                  localRules.modificatoreDifesa === 'custom'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-lg shadow-emerald-500/30'
                    : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                <div className="font-bold">Personalizzato</div>
                <div className="text-xs mt-1 opacity-70">Soglie custom</div>
              </button>
            </div>

            {localRules.modificatoreDifesa === 'custom' && (
              <div className="mt-3 p-4 bg-slate-800/60 backdrop-blur-md rounded-xl border border-white/5 animate-fadeIn">
                <p className="text-sm text-slate-300 mb-3 font-medium">Configura soglie personalizzate:</p>
                <div className="space-y-2">
                  {localRules.modificatoreCustom.map((t, i) => (
                    <div key={i} className="flex items-center gap-3 flex-wrap">
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
                        className="w-20 px-2 py-1 bg-slate-900/80 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all"
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
                        className="w-20 px-2 py-1 bg-slate-900/80 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all"
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
                    className="text-emerald-400 text-sm hover:text-emerald-300 font-medium transition-colors"
                  >
                    + Aggiungi soglia
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ============================================================
              SEZIONE 2: BONUS IMBATTIBILITÀ
              ============================================================ */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-black font-black text-sm shadow-lg shadow-emerald-500/50">
                2
              </span>
              <span className="tracking-tight">Bonus Imbattibilità Portiere</span>
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => updateRules({ bonusImbattibilita: 'off' })}
                className={`p-3 rounded-xl border-2 transition-all ${
                  localRules.bonusImbattibilita === 'off'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-lg shadow-emerald-500/30'
                    : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                <div className="font-bold">Disattivato</div>
              </button>
              <button
                onClick={() => updateRules({ bonusImbattibilita: '0.5' })}
                className={`p-3 rounded-xl border-2 transition-all ${
                  localRules.bonusImbattibilita === '0.5'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-lg shadow-emerald-500/30'
                    : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                <div className="font-bold">+0.5</div>
              </button>
              <button
                onClick={() => updateRules({ bonusImbattibilita: '1' })}
                className={`p-3 rounded-xl border-2 transition-all ${
                  localRules.bonusImbattibilita === '1'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-lg shadow-emerald-500/30'
                    : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                <div className="font-bold">+1</div>
              </button>
            </div>
          </div>

          {/* ============================================================
              SEZIONE 3: MODULI CONSENTITI
              ============================================================ */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-black font-black text-sm shadow-lg shadow-emerald-500/50">
                3
              </span>
              <span className="tracking-tight">Moduli Consentiti</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {allModules.map(module => (
                <button
                  key={module}
                  onClick={() => toggleModule(module)}
                  className={`px-4 py-2 rounded-xl border-2 font-bold transition-all ${
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

          {/* ============================================================
              SEZIONE 4: ALTRE REGOLE
              ============================================================ */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-black font-black text-sm shadow-lg shadow-emerald-500/50">
                4
              </span>
              <span className="tracking-tight">Altre Regole</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Assist */}
              <div className="bg-slate-800/60 backdrop-blur-md p-4 rounded-xl border border-white/5">
                <label className="text-slate-300 text-sm font-bold tracking-wide">Bonus Assist</label>
                <div className="flex gap-2 mt-3">
                  {['off', '0.5', '1'].map(val => (
                    <button
                      key={val}
                      onClick={() => updateRules({ assist: val as LeagueRules['assist'] })}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
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

              {/* 🔥 FIX: dicitura cambiata in "Solo P" */}
              <div className="bg-slate-800/60 backdrop-blur-md p-4 rounded-xl border border-white/5">
                <label className="text-slate-300 text-sm font-bold tracking-wide">Malus Gol Subito (Solo P)</label>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="number"
                    step="0.5"
                    value={localRules.golSubito}
                    onChange={(e) => updateRules({ golSubito: parseFloat(e.target.value) || 0 })}
                    className="w-20 px-2 py-1 bg-slate-900/80 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                  <span className="text-slate-400 text-sm">per gol</span>
                </div>
              </div>

              {/* Rigore Parato */}
              <div className="bg-slate-800/60 backdrop-blur-md p-4 rounded-xl border border-white/5">
                <label className="text-slate-300 text-sm font-bold tracking-wide">Bonus Rigore Parato</label>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="number"
                    step="0.5"
                    value={localRules.rigoreParato}
                    onChange={(e) => updateRules({ rigoreParato: parseFloat(e.target.value) || 0 })}
                    className="w-20 px-2 py-1 bg-slate-900/80 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                  <span className="text-slate-400 text-sm">punti</span>
                </div>
              </div>

              {/* Rigore Sbagliato */}
              <div className="bg-slate-800/60 backdrop-blur-md p-4 rounded-xl border border-white/5">
                <label className="text-slate-300 text-sm font-bold tracking-wide">Malus Rigore Sbagliato</label>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="number"
                    step="0.5"
                    value={localRules.rigoreSbagliato}
                    onChange={(e) => updateRules({ rigoreSbagliato: parseFloat(e.target.value) || 0 })}
                    className="w-20 px-2 py-1 bg-slate-900/80 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                  <span className="text-slate-400 text-sm">punti</span>
                </div>
              </div>

            </div>
          </div>

          {/* ============================================================
              BOTTONE SALVA
              ============================================================ */}
          <button
            onClick={handleSave}
            className="w-full py-4 bg-gradient-to-r from-emerald-400 to-green-600 hover:from-emerald-300 hover:to-green-500 text-black font-black rounded-xl transition-all transform hover:scale-[1.02] shadow-lg shadow-emerald-500/50 tracking-wide uppercase text-sm"
          >
            Salva e Continua → Inserisci Rosa
          </button>
        </div>
      </div>
    </div>
  );
}
