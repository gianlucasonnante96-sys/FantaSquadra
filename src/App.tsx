import { useState, useEffect } from 'react';
import { AppStep, LeagueRules, Player } from './types';
import { loadListone, ListoneStatus } from './services/listoneService';
import { initializeProbabiliFormazioni, applyProbabiliFormazioni } from './services/probabiliFormazioniService';
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

// Chiavi localStorage
const RULES_KEY = 'fantaconsiglio_rules';
const ROSTER_KEY = 'fantaconsiglio_roster';
const STEP_KEY = 'fantaconsiglio_step';
const FORMAZIONI_INIT_KEY = 'fantaconsiglio_formazioni_init';

export default function App() {
  const [step, setStep] = useState<AppStep>('setup');
  const [rules, setRules] = useState<LeagueRules>(defaultRules);
  const [roster, setRoster] = useState<Player[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [listoneStatus, setListoneStatus] = useState<ListoneStatus | null>(null);
  const [formazioniInizializzate, setFormazioniInizializzate] = useState(false);

  // 🔥 INIZIALIZZAZIONE FORMAZIONI (una volta sola all'avvio)
  useEffect(() => {
    const initFormazioni = async () => {
      try {
        console.log('🚀 Inizializzazione probabili formazioni...');
        
        // Chiama il servizio che legge formazioni.json e le salva in localStorage
        await initializeProbabiliFormazioni();
        
        console.log('✅ Probabili formazioni inizializzate');
        setFormazioniInizializzate(true);
        localStorage.setItem(FORMAZIONI_INIT_KEY, 'true');
      } catch (e) {
        console.error('❌ Errore inizializzazione formazioni:', e);
        setFormazioniInizializzate(false);
      }
    };

    initFormazioni();
  }, []);

  // Carica configurazione, rosa e listone all'avvio
  useEffect(() => {
    // Carica configurazione salvata
    try {
      const savedRules = localStorage.getItem(RULES_KEY);
      if (savedRules) {
        setRules(JSON.parse(savedRules));
      }
    } catch (e) {
      console.error('Errore caricamento regole:', e);
    }

    // Carica rosa salvata
    try {
      const savedRoster = localStorage.getItem(ROSTER_KEY);
      if (savedRoster) {
        const parsedRoster = JSON.parse(savedRoster);
        // 🔥 Applica le formazioni anche al roster già salvato
        if (Array.isArray(parsedRoster) && parsedRoster.length > 0) {
          try {
            const rosterConFormazioni = applyProbabiliFormazioni(parsedRoster);
            setRoster(rosterConFormazioni);
            console.log('✅ Roster salvato aggiornato con formazioni');
          } catch (e) {
            console.warn('⚠️ Errore applicazione formazioni a roster salvato:', e);
            setRoster(parsedRoster);
          }
        }
      }
    } catch (e) {
      console.error('Errore caricamento rosa:', e);
    }

    // Carica step salvato
    try {
      const savedStep = localStorage.getItem(STEP_KEY) as AppStep | null;
      if (savedStep && ['setup', 'roster', 'dashboard'].includes(savedStep)) {
        setStep(savedStep);
      }
    } catch (e) {
      console.error('Errore caricamento step:', e);
    }

    // Carica il listone
    const { players, status } = loadListone();
    setAvailablePlayers(players);
    setListoneStatus(status);
  }, []);

  // 🔥 Quando le formazioni sono inizializzate E c'è un roster, applicale
  useEffect(() => {
    if (!formazioniInizializzate) return;
    if (!Array.isArray(roster) || roster.length === 0) return;
    
    try {
      console.log('🔄 Applicazione formazioni al roster...');
      const rosterAggiornato = applyProbabiliFormazioni(roster);
      setRoster(rosterAggiornato);
    } catch (e) {
      console.error('Errore applicazione formazioni:', e);
    }
  }, [formazioniInizializzate]);

  // Salva configurazione quando cambia
  useEffect(() => {
    try {
      localStorage.setItem(RULES_KEY, JSON.stringify(rules));
    } catch (e) {
      console.error('Errore salvataggio regole:', e);
    }
  }, [rules]);

  // Salva rosa quando cambia
  useEffect(() => {
    try {
      localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
    } catch (e) {
      console.error('Errore salvataggio rosa:', e);
    }
  }, [roster]);

  // Salva step quando cambia
  useEffect(() => {
    try {
      localStorage.setItem(STEP_KEY, step);
    } catch (e) {
      console.error('Errore salvataggio step:', e);
    }
  }, [step]);

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
