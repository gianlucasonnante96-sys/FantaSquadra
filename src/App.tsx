import { useState, useEffect, useMemo } from 'react';
import { AppStep, LeagueRules, Player } from './types';
import { loadListone, ListoneStatus } from './services/listoneService';
import { getCurrentMatchDay, updatePlayersWithMatchData, MatchDay } from './services/apiService';
import Setup from './components/Setup';
import Roster from './components/Roster';
import Dashboard from './components/Dashboard';
import MatchDaySetup from './components/MatchDaySetup';

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
  const [step, setStep] = useState<AppStep>(() => localStorage.getItem('fanta_step') as AppStep || 'setup');
  
  const [rules, setRules] = useState<LeagueRules>(() => {
    const saved = localStorage.getItem('fanta_rules');
    return saved ? JSON.parse(saved) : defaultRules;
  });
  
  const [roster, setRoster] = useState<Player[]>(() => {
    const saved = localStorage.getItem('fanta_roster');
    return saved ? JSON.parse(saved) : [];
  });

  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [listoneStatus, setListoneStatus] = useState<ListoneStatus | null>(null);
  const [currentMatchDay, setCurrentMatchDay] = useState<MatchDay | null>(null);
  const [probableFormations, setProbableFormations] = useState<Record<string, string[]>>({});
  const [isLoadingMatchData, setIsLoadingMatchData] = useState(false);

  useEffect(() => localStorage.setItem('fanta_roster', JSON.stringify(roster)), [roster]);
  useEffect(() => localStorage.setItem('fanta_rules', JSON.stringify(rules)), [rules]);
  useEffect(() => localStorage.setItem('fanta_step', step), [step]);

  useEffect(() => {
    const { players, status } = loadListone();
    setAvailablePlayers(players);
    setListoneStatus(status);
  }, []);

  useEffect(() => {
    const savedMatchDay = localStorage.getItem('fanta_matchday');
    if (savedMatchDay) setCurrentMatchDay(JSON.parse(savedMatchDay));
    const savedFormations = localStorage.getItem('fanta_formations');
    if (savedFormations) setProbableFormations(JSON.parse(savedFormations));
  }, []);

  const reloadListone = () => {
    const { players, status } = loadListone();
    setAvailablePlayers(players);
    setListoneStatus(status);
  };

  const loadMatchDayData = async () => {
    setIsLoadingMatchData(true);
    try {
      const matchDay = await getCurrentMatchDay();
      if (matchDay) {
        setCurrentMatchDay(matchDay);
        localStorage.setItem('fanta_matchday', JSON.stringify(matchDay));
      }
    } catch (error) {
      console.error('Errore caricamento giornata:', error);
    } finally {
      setIsLoadingMatchData(false);
    }
  };

  const handleReset = () => {
    if (confirm('Resettare rosa e regole?')) {
      localStorage.removeItem('fanta_roster');
      localStorage.removeItem('fanta_rules');
      localStorage.removeItem('fanta_step');
      setRoster([]);
      setRules(defaultRules);
      setStep('setup');
    }
  };

  const updatedAvailablePlayers = useMemo(() => {
    if (!currentMatchDay || availablePlayers.length === 0) return availablePlayers;
    return updatePlayersWithMatchData(availablePlayers, currentMatchDay, probableFormations);
  }, [availablePlayers, currentMatchDay, probableFormations]);

  return (
    <div className="min-h-screen bg-slate-900">
      {listoneStatus && (
        <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-xs text-center ${listoneStatus.error ? 'bg-amber-600/90 text-amber-100' : 'bg-emerald-700/90 text-emerald-100'}`}>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span>{listoneStatus.error ? '⚠️' : '✅'}</span>
            <span>{listoneStatus.fileName ? `📄 ${listoneStatus.fileName} • ${listoneStatus.playerCount} giocatori` : `${listoneStatus.playerCount} giocatori • ${listoneStatus.source}`}</span>
          </div>
        </div>
      )}

      <div className={listoneStatus ? 'pt-8' : ''}>
        {step === 'setup' && (
          <>
            <MatchDaySetup currentMatchDay={currentMatchDay} isLoading={isLoadingMatchData} onLoadMatchDay={loadMatchDayData} onFormationsUpdate={setProbableFormations} />
            <Setup rules={rules} onSave={setRules} onNext={() => setStep('roster')} />
          </>
        )}
        
        {step === 'roster' && (
          <Roster roster={roster} onSave={setRoster} onNext={() => setStep('dashboard')} onBack={() => setStep('setup')} availablePlayers={updatedAvailablePlayers} listoneStatus={listoneStatus} onListoneChange={reloadListone} />
        )}
        
        {step === 'dashboard' && (
          <Dashboard roster={roster} rules={rules} onBack={() => setStep('roster')} onReset={handleReset} />
        )}
      </div>
    </div>
  );
}
