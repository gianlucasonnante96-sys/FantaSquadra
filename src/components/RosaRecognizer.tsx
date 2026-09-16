import { useState, useRef } from 'react';
import { Player } from '../types';
import { riconosciGiocatoriDaImmagine, RiconoscimentoResult } from '../services/rosaRecognizerService';

interface RosaRecognizerProps {
  listaGiocatori: Player[];
  giocatoriGiaInRosa: Player[];
  onAggiungiGiocatori: (giocatori: Player[]) => void;
}

export default function RosaRecognizer({
  listaGiocatori,
  giocatoriGiaInRosa,
  onAggiungiGiocatori
}: RosaRecognizerProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [riconosciuti, setRiconosciuti] = useState<Player[]>([]);
  const [nonRiconosciuti, setNonRiconosciuti] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const ocrRef = useRef<any>(null);

  const loadOCREngine = async () => {
    if (ocrRef.current) return ocrRef.current;

    try {
      setLoadingMessage('Caricamento motore OCR...');
      console.log('📦 Caricamento @paddleocr/paddleocr-js...');

      const { PaddleOCR } = await import('@paddleocr/paddleocr-js');

      setLoadingMessage('Inizializzazione OCR (prima volta: ~15MB)...');

      const ocr = await PaddleOCR.create({
        lang: 'latin',           // 🔥 Usa 'latin' per l'italiano
        ocrVersion: 'PP-OCRv4',  // 🔥 Usa la versione v4 che supporta il latino
        ortOptions: {
          backend: 'wasm',
          wasmPaths: 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/',
        },
      });

      console.log('✅ PaddleOCR inizializzato');
      ocrRef.current = ocr;
      return ocr;
    } catch (e) {
      console.error('Errore caricamento PaddleOCR:', e);
      throw new Error('Impossibile caricare il motore OCR. Ricarica la pagina e riprova.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setRiconosciuti([]);
    setNonRiconosciuti([]);
    setLoadingMessage('');

    try {
      let result: RiconoscimentoResult;

      if (file.type.startsWith('image/')) {
        const ocr = await loadOCREngine();

        setLoadingMessage('Riconoscimento testo in corso...');
        console.log('🖼️ Elaborazione immagine con PaddleOCR...');

        const [ocrResult] = await ocr.predict(file);

        const testoEstratto = ocrResult.items
          .map((item: any) => item.text)
          .join('\n');

        console.log('📝 Testo estratto:', testoEstratto);

        setLoadingMessage('Match giocatori...');
        result = await riconosciGiocatoriDaImmagine(file, listaGiocatori, testoEstratto);

      } else {
        setLoadingMessage('Lettura file...');
        const { riconosciGiocatoriDaFile } = await import('../services/rosaRecognizerService');
        result = await riconosciGiocatoriDaFile(file, listaGiocatori);
      }

      setRiconosciuti(result.riconosciuti);
      setNonRiconosciuti(result.nonRiconosciuti);

      if (result.riconosciuti.length === 0 && result.nonRiconosciuti.length === 0) {
        setError('Nessun giocatore riconosciuto. Prova con un\'immagine più nitida o carica un file Excel.');
      }
    } catch (err) {
      console.error('Errore:', err);
      setError(err instanceof Error ? err.message : 'Errore nel riconoscimento');
    } finally {
      setIsProcessing(false);
      setLoadingMessage('');
      e.target.value = '';
    }
  };

  const aggiungiTuttiRiconosciuti = () => {
    const nuoviGiocatori = riconosciuti.filter(
      g => !giocatoriGiaInRosa.some(gia => gia.id === g.id)
    );
    onAggiungiGiocatori(nuoviGiocatori);
    setRiconosciuti([]);
    setNonRiconosciuti([]);
  };

  const rimuoviRiconosciuto = (id: string) => {
    setRiconosciuti(prev => prev.filter(g => g.id !== id));
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-md rounded-xl md:rounded-2xl border border-white/10 p-3 md:p-4 mb-4 md:mb-6">
      <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
        <span className="text-xl md:text-2xl">🔍</span>
        <div>
          <h3 className="text-white font-bold text-sm md:text-base">Carica Rosa Completa</h3>
          <p className="text-xs md:text-sm text-slate-400">
            Carica un file Excel o una foto della tua squadra
          </p>
        </div>
      </div>

      <div className="border-2 border-dashed border-slate-600 rounded-xl p-4 md:p-6 text-center active:border-emerald-500/50 transition-colors">
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.png,.jpg,.jpeg"
          onChange={handleFileUpload}
          disabled={isProcessing}
          className="hidden"
          id="rosa-upload"
        />
        <label
          htmlFor="rosa-upload"
          className="cursor-pointer flex flex-col items-center gap-2"
        >
          {isProcessing ? (
            <>
              <div className="w-10 h-10 md:w-12 md:h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-300 text-xs md:text-sm">{loadingMessage || 'Riconoscimento in corso...'}</span>
            </>
          ) : (
            <>
              <span className="text-3xl md:text-4xl">📁</span>
              <span className="text-slate-300 text-xs md:text-sm">Clicca per caricare un file</span>
              <span className="text-[10px] md:text-xs text-slate-500">
                Supporta Excel (.xlsx, .xls, .csv) o immagini (.png, .jpg, .jpeg)
              </span>
            </>
          )}
        </label>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-xs md:text-sm">
          ⚠️ {error}
        </div>
      )}

      {(riconosciuti.length > 0 || nonRiconosciuti.length > 0) && (
        <div className="mt-4 space-y-3 md:space-y-4">
          {riconosciuti.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <h4 className="text-white font-bold text-xs md:text-sm">
                  ✅ Riconosciuti ({riconosciuti.length})
                </h4>
                <button
                  onClick={aggiungiTuttiRiconosciuti}
                  className="px-3 py-2 min-h-[36px] bg-gradient-to-r from-emerald-400 to-green-600 active:scale-95 text-black font-bold rounded-lg text-xs transition-all"
                >
                  Aggiungi Tutti
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {riconosciuti.map((giocatore) => {
                  const giaInRosa = giocatoriGiaInRosa.some(g => g.id === giocatore.id);
                  return (
                    <div
                      key={giocatore.id}
                      className={`flex items-center justify-between p-2 md:p-3 rounded-lg ${
                        giaInRosa ? 'bg-slate-700/30 opacity-50' : 'bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                        <span className="text-base md:text-lg flex-shrink-0">
                          {giocatore.role === 'P' ? '🧤' :
                           giocatore.role === 'D' ? '🛡️' :
                           giocatore.role === 'C' ? '🎯' : '⚡'}
                        </span>
                        <div className="min-w-0">
                          <div className="text-white font-medium text-xs md:text-sm truncate">
                            {giocatore.name} {giocatore.surname}
                          </div>
                          <div className="text-[10px] md:text-xs text-slate-400">
                            {giocatore.team} • {giocatore.role}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0 ml-2">
                        {giaInRosa ? (
                          <span className="text-[10px] md:text-xs text-slate-500">Già in rosa</span>
                        ) : (
                          <button
                            onClick={() => onAggiungiGiocatori([giocatore])}
                            className="px-2 md:px-3 py-1.5 min-h-[32px] bg-emerald-600 active:bg-emerald-500 text-white rounded text-[10px] md:text-xs font-bold transition-colors"
                          >
                            Aggiungi
                          </button>
                        )}
                        <button
                          onClick={() => rimuoviRiconosciuto(giocatore.id)}
                          className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-red-600/30 active:bg-red-600 text-red-300 rounded transition-colors text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {nonRiconosciuti.length > 0 && (
            <div>
              <h4 className="text-white font-bold text-xs md:text-sm mb-2 md:mb-3">
                ❌ Non Riconosciuti ({nonRiconosciuti.length})
              </h4>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-[10px] md:text-xs text-amber-300 mb-2">
                  Questi giocatori non sono stati trovati. Prova a cercarli manualmente.
                </p>
                <div className="flex flex-wrap gap-1.5 md:gap-2">
                  {nonRiconosciuti.map((nome, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded text-[10px] md:text-xs"
                    >
                      {nome}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 md:mt-4 p-3 bg-slate-800/40 rounded-lg text-[10px] md:text-xs text-slate-400">
        <p className="font-medium text-slate-300 mb-1">💡 Suggerimenti per foto:</p>
        <ul className="space-y-0.5 list-disc list-inside">
          <li>Usa immagini <strong>nitide</strong> e ben illuminate</li>
          <li><strong>Ritaglia</strong> solo la parte con i nomi dei giocatori</li>
          <li>Preferisci sfondi <strong>chiari</strong> con testo scuro</li>
          <li>PaddleOCR funziona <strong>direttamente nel browser</strong> (prima volta: scarica ~15MB)</li>
        </ul>
      </div>
    </div>
  );
}
