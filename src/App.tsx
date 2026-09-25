import { useState, useEffect } from 'react';
import { AppStep, LeagueRules, Player } from './types';
import { loadListone, ListoneStatus } from './services/listoneService';
import { initializeProbabiliFormazioni, applyProbabiliFormazioni } from './services/probabiliFormazioniService';
import { onAuthChange, logoutUtente } from './services/authService';
import Home from './components/Home';
import Setup from './components/Setup';
import Roster from './components/Roster';
import Dashboard from './components/Dashboard';
import Infortunati from './components/Infortunati';
import LoginBox from './components/LoginBox';

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

function normalizzaChiave(valore: string): string {
  return (valore || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function chiaveNomeGiocatore(p: Player): string {
  return `${normalizzaChiave(p.name)}_${normalizzaChiave(p.surname)}_${normalizzaChiave(p.team)}`;
}

function ricollegaRosterAlListone(
  rosterSalvato: Player[],
  listoneFresco: Player[]
): Player[] {
  if (!Array.isArray(rosterSalvato) || rosterSalvato.length === 0) return [];
  if (!Array.isArray(listoneFresco) || listoneFresco.length === 0) return rosterSalvato;

  const mappaPerId = new Map<string, Player>();
  const mappaPerNome = new Map<string, Player>();

  listoneFresco.forEach(p => {
    if (!p) return;
    if (p.id) mappaPerId.set(p.id, p);
    const k = chiaveNomeGiocatore(p);
    if (k && k !== '__') mappaPerNome.set(k, p);
  });

  let aggiornati = 0;
  let aggiornatiPerNome = 0;

  const rosterAggiornato = rosterSalvato.map(playerSalvato => {
    if (!playerSalvato) return playerSalvato;

    let fresco = playerSalvato.id ? mappaPerId.get(playerSalvato.id) : undefined;

    if (!fresco) {
      const k = chiaveNomeGiocatore(playerSalvato);
      if (k && k !== '__') {
        fresco = mappaPerNome.get(k);
        if (fresco) aggiornatiPerNome++;
      }
    }

    if (fresco) {
      aggiornati++;
      return {
        ...fresco,
        titolarita: playerSalvato.titolarita ?? fresco.titolarita,
      };
    }

    return playerSalvato;
  });

  console.log(
    `🔄 Roster ricollegato: ${aggiornati}/${rosterSalvato.length} aggiornati ` +
    `(${aggiornatiPerNome} via nome)`
  );
  return rosterAggiornato;
}

export default function App() {
  const [step, setStep] = useState<AppStep>('home');
  const [rules, setRules] = useState<LeagueRules>(defaultRules);
  const [roster, setRoster] = useState<Player[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [listoneStatus, setListoneStatus] = useState<ListoneStatus | null>(null);
  const [formazioniInizializzate, setFormazioniInizializzate] = useState(false);

  // 🆕 Login / utente
  const [user, setUser] = useState<any>(null);
  const [showLogin, setShowLogin] = useState(false);

  // 🆕 Ascolta i cambiamenti di sessione Supabase
  useEffect(() => {
    const unsubscribe = onAuthChange((u) => {
      setUser(u);
      if (u) console.log('👤 Utente loggato:', u.email);
      else console.log('👤 Nessun utente loggato');
    });
    return () => unsubscribe();
  }, []);

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

  const handleLogout = async () => {
    if (confirm('Vuoi davvero uscire?')) {
      await logoutUtente();
      setUser(null);
    }
  };

  return (
    <div className="min-h-screen">
      {/* 🆕 LoginBox modale */}
      {showLogin && <LoginBox onClose={() => setShowLogin(false)} />}

      {/* 🆕 Banner listone + user badge */}
      {listoneStatus && (
        <div className={`fixed top-0 left-0 right-0 z-40 px-4 py-2 text-[10px] md:text-xs ${
          listoneStatus.error
            ? 'bg-amber-600/90 text-amber-100'
            : 'bg-emerald-700/90 text-emerald-100'
        }`}>
          <div className="flex items-center justify-between gap-2 flex-wrap max-w-6xl mx-auto">
            <div className="flex items-center gap-2">
              <span>{listoneStatus.error ? '⚠️' : '✅'}</span>
              <span>{listoneStatus.playerCount} giocatori • {listoneStatus.source}</span>
            </div>

            {/* 🆕 User badge */}
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <span className="hidden md:inline opacity-80">👤 {user.email}</span>
                  <span className="md:hidden">👤</span>
                  <button
                    onClick={handleLogout}
                    className="bg-black/30 hover:bg-black/50 px-2 py-0.5 rounded text-[10px] md:text-xs transition-colors"
                  >
                    Esci
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowLogin(true)}
                  className="bg-black/30 hover:bg-black/50 px-2 py-0.5 rounded text-[10px] md:text-xs transition-colors font-bold"
                >
                  🔐 Accedi
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🆕 Fallback: se non c'è listoneStatus, mostra solo user badge in alto a destra */}
      {!listoneStatus && (
        <div className="fixed top-2 right-2 z-40">
          {user ? (
            <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur rounded-lg px-3 py-1.5 border border-white/10">
              <span className="text-xs text-emerald-400">👤 {user.email}</span>
              <button
                onClick={handleLogout}
                className="text-xs text-slate-400 hover:text-red-400"
              >
                Esci
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold px-3 py-1.5 rounded-lg"
            >
              🔐 Accedi
            </button>
          )}
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
            user={user}
            onLoginRequest={() => setShowLogin(true)}
          />
        )}

        {step === 'dashboard' && (
          <Dashboard
            roster={roster}
            rules={rules}
            onBack={() => setStep('home')}
            onReset={handleReset}
            user={user}
            onLoginRequest={() => setShowLogin(true)}
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
