import { useState, useEffect } from 'react';
import { AppStep, LeagueRules, Player } from './types';
import { loadListone, ListoneStatus, getPlayers, getCurrentStatus } from './services/listoneService';
import Setup from './components/Setup';
import Roster from './components/Roster';
import Dashboard from './components/Dashboard';

const defaultRules: LeagueRules = {
  modificatoreDifesa: 'standard',
  modificatoreCustom: [{ threshold: 6.0, bonus: 1 }, { threshold: 6.5, bonus: 3 }, { threshold: 7.0, bonus: 6 }],
  bonusImbattibilita: '1',
  moduliConsentiti: ['4-3-3', '3-4-3', '4-4-2', '5-3-2'],
  assist: '1',
  golSubito: -1,
  rigoreParato: 3,
  rigoreSbagliato: -3,
};

export default function App() {
  const [step, setStep] = useState<AppStep>('setup');
  const [rules, setRules] = useState<LeagueRules>(defaultRules);
  const [roster, setRoster] = useState<Player[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [listoneStatus, setListoneStatus] = useState<ListoneStatus | null>(null);

  // Carica il listone all'avvio (da cache o fallback)
  useEffect(() => {
    const { players, status } = loadListone();
    setAvailablePlayers(players);
    setListoneStatus(status);
  }, []);

  // Funzione per ricaricare il listone (dopo importazione o eliminazione)
  const reloadListone = () => {
    const { players, status } = loadListone();
    setAvailablePlayers(players);
    setListoneStatus(status);
  };

  const handleReset = () => {
    setStep('setup');
  };

  return (
    <div className="min-h-screen">
      {/* Status Bar */}
      {listoneStatus && (
        <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-xs text-center ${
          listoneStatus.error 
            ? 'bg-amber-600/90 text-amber-100' 
            : 'bg-emerald-700/90 text-emerald-100'
        }`}>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span>{listoneStatus.error ? '⚠️' : '✅'}</span>
            <span>
              {listoneStatus.fileName 
                ? `📄 ${listoneStatus.fileName} • ${listoneStatus.playerCount} giocatori`
                : `${listoneStatus.playerCount} giocatori • ${listoneStatus.source}`
              }
            </span>
            {listoneStatus.lastUpdated && (
              <span className="opacity-75">• {listoneStatus.lastUpdated}</span>
            )}
          </div>
        </div>
      )}

      <div className={listoneStatus ? 'pt-8' : ''}>
        {step === 'setup' && (
          <Setup
            rules={rules}
            onSave={setRules}
            onNext={() => setStep('roster')}
          />
        )}
        {step === 'roster' && (
          <Roster
            roster={roster}
            onSave={setRoster}
            onNext={() => setStep('dashboard')}
            onBack={() => setStep('setup')}
            availablePlayers={availablePlayers}
            listoneStatus={listoneStatus}
            onListoneChange={reloadListone}
          />
        )}
        {step === 'dashboard' && (
          <Dashboard
            roster={roster}
            rules={rules}
            onBack={() => setStep('roster')}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}
