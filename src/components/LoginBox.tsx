import { useState } from 'react';
import { loginUtente, registraUtente } from '../services/authService';

interface LoginBoxProps {
  onClose: () => void;
}

export default function LoginBox({ onClose }: LoginBoxProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isRegistering) {
        await registraUtente(email, password);
      } else {
        await loginUtente(email, password);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Errore durante l\'accesso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full">
        <h2 className="text-white font-bold text-lg mb-2">
          {isRegistering ? 'Crea un account' : 'Accedi'}
        </h2>
        <p className="text-slate-400 text-xs mb-4">
          {isRegistering
            ? 'Registrati per salvare la tua rosa'
            : 'Accedi per recuperare la tua rosa'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 bg-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <input
            type="password"
            placeholder="Password (min 6 caratteri)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-3 bg-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />

          {error && (
            <p className="text-red-400 text-xs bg-red-500/10 p-2 rounded">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-black font-bold rounded-xl transition-colors"
          >
            {loading ? 'Attendi...' : isRegistering ? 'Registrati' : 'Accedi'}
          </button>
        </form>

        <button
          onClick={() => { setIsRegistering(!isRegistering); setError(null); }}
          className="mt-3 text-emerald-400 text-xs hover:text-emerald-300 w-full text-center"
        >
          {isRegistering ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}
        </button>

        <button onClick={onClose} className="mt-4 text-slate-400 text-xs w-full text-center hover:text-slate-300">
          Chiudi
        </button>
      </div>
    </div>
  );
}
