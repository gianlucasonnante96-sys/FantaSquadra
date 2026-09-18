import { useState, useEffect } from 'react';
import { AppStep, LeagueRules, Player } from './types';
import { loadListone, ListoneStatus } from './services/listoneService';
import { initializeProbabiliFormazioni, applyProbabiliFormazioni } from './services/probabiliFormazioniService';
import Home from './components/Home';
import Setup from './components/Setup';
import Roster from './components/Roster';
import Dashboard from './components/Dashboard';
import Infortunati from './components/Infortunati';

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

const RULES_KEY = 'fantaconsiglio_rules';
const ROSTER_KEY = 'fantaconsiglio_roster';
const STEP_KEY = 'fantaconsiglio_step';

function ricollegaRosterAlListone(
  rosterSalvato: Player[],
  listoneFresco: Player[]
): Player[] {
  if (!Array.isArray(rosterSalvato) || rosterSalvato.length === 0) return [];
  if (!Array.isArray(listoneFresco) || listoneFresco.length === 0) return rosterSalvato;
  
  const mappaListone = new Map<string, Player>();
  listoneFresco.forEach(p => {
    if (p && p.id) mappaListone.set(p.id, p);
  });
  
  let aggiornati = 0;
  const rosterAggiornato = rosterSalvato.map(playerSalvato => {
    if (!playerSalvato || !playerSalvato.id) return playerSalvato;
    
    const fresco = mappaListone.get(playerSalvato.id);
    if (fresco) {
      aggiornati++;
      return {
        ...fresco,
        titolarita: playerSalvato.titolarita ?? fresco.titolarita,
      };
    }
    
    return playerSalvato;
  });
  
  console.log(`🔄 Roster ricollegato: ${aggiornati}/${rosterSalvato.length} giocatori aggiornati dal listone`);
  return rosterAggiornato;
}

export default function App() {
  const [step, setStep] = useState<AppStep>('home');
  const [rules, setRules] = useState<LeagueRules>(defaultRules);
  const [roster, setRoster] = useState<Player[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [listoneStatus, setListoneStatus] = useState<ListoneStatus | null>(null);
  const [formazioniInizializzate, setFormazioniInizializzate] = useState(false);

  useEffect(() => {
    const initFormazioni = async () => {
      try {
        console.log('🚀 Inizializzazione probabili formazioni...');
        await initializeProbabiliFormazioni();
        console.log('✅ Probabili formazioni inizializzate');
        setFormazioniInizializzate(true);
      } catch (e) {
        console.error('❌ Errore inizializzazione formazioni:', e);
        setFormazioniInizializzate(false);
      }
    };
    initFormazioni();
  }, []);

  useEffect(() => {
    try {
      const savedRules = localStorage.getItem(RULES_KEY);
      if (savedRules) setRules(JSON.parse(savedRules));
    } catch (e) {
      console.error('Errore caricamento regole:', e);
    }

    const { players: listoneFresco, status } = loadListone();
    setAvailablePlayers(listoneFresco);
    setListoneStatus(status);

    try {
      const savedRoster = localStorage.getItem(ROSTER_KEY);
      if (savedRoster) {
        const rosterParsato = JSON.parse(savedRoster);
        if (Array.isArray(rosterParsato) && rosterParsato.length > 0) {
          console.log('📂 Roster salvato trovato:', rosterParsato.length, 'giocatori');
          
          const rosterAggiornato = ricollegaRosterAlListone(rosterParsato, listoneFresco);
          
          let rosterFinale = rosterAggiornato;
          try {
            rosterFinale = applyProbabiliFormazioni(rosterAggiornato);
            console.log('✅ Roster aggiornato con formazioni');
          } catch (e) {
            console.warn('⚠️ Errore applicazione formazioni:', e);
          }
          
          setRoster(rosterFinale);
        }
      }
    } catch (e) {
      console.error('Errore caricamento roster:', e);
    }

    try {
      const savedStep = localStorage.getItem(STEP_KEY) as AppStep | null;
      if (savedStep && ['home', 'setup', 'roster', 'dashboard', 'infortunati'].includes(savedStep)) {
        setStep(savedStep);
      }
    } catch (e) {
      console.error('Errore caricamento step:', e);
    }
  }, []);

  useEffect(() => {
    if (!formazioniInizializzate) return;
    if (!Array.isArray(roster) || roster.length === 0) return;
    
    try {
      const rosterAggiornato = applyProbabiliFormazioni(roster);
      setRoster(rosterAggiornato);
    } catch (e) {
      console.error('Errore applicazione formazioni:', e);
    }
  }, [formazioniInizializzate]);

  useEffect(() => {
    try { localStorage.setItem(RULES_KEY, JSON.stringify(rules)); } catch (e) {}
  }, [rules]);

  useEffect(() => {
    try { localStorage.setItem(ROSTER_KEY, JSON.stringify(roster)); } catch (e) {}
  }, [roster]);

  useEffect(() => {
    try { localStorage.setItem(STEP_KEY, step); } catch (e) {}
  }, [step]);

  const reloadListone = () => {
    const { players, status } = loadListone();
    setAvailablePlayers(players);
    setListoneStatus(status);
  };

  const handleReset = () => {
    setStep('home');
  };

  return (
    <div className="min-h-screen">
      {listoneStatus && (
        <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-[10px] md:text-xs text-center ${
          listoneStatus.error
            ? 'bg-amber-600/90 text-amber-100'
            : 'bg-emerald-700/90 text-emerald-100'
        }`}>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span>{listoneStatus.error ? '⚠️' : '✅'}</span>
            <span>{listoneStatus.playerCount} giocatori • {listoneStatus.source}</span>
          </div>
        </div>
      )}

      <div className={listoneStatus ? 'pt-8' : ''}>
        {step === 'home' && (
          <Home
            roster={roster}
            rules={rules}
            listoneStatus={listoneStatus}
            onNavigate={(target) => setStep(target)}
          />
        )}

        {step === 'setup' && (
          <Setup
            rules={rules}
            onSave={setRules}
            onNext={() => setStep('home')}
            onBack={() => setStep('home')}
          />
        )}

        {step === 'roster' && (
          <Roster
            roster={roster}
            onSave={setRoster}
            onNext={() => setStep('dashboard')}
            onBack={() => setStep('home')}
            availablePlayers={availablePlayers}
            listoneStatus={listoneStatus}
            onListoneChange={reloadListone}
          />
        )}

        {step === 'dashboard' && (
          <Dashboard
            roster={roster}
            rules={rules}
            onBack={() => setStep('home')}
            onReset={handleReset}
          />
        )}

        {step === 'infortunati' && (
          <Infortunati
            onBack={() => setStep('home')}
          />
        )}
      </div>
    </div>
  );
}
