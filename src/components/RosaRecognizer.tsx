import { useState } from 'react';
import { Player } from '../types';
import { riconosciGiocatoriDaFile } from '../services/rosaRecognizerService';

interface RosaRecognizerProps {
  listaGiocatori: Player[];
  giocatoriGiaInRosa: Player[];
  onAggiungiGiocatori: (giocatori: Player[]) => void;
}

// ============================================================
// 🔥 PRE-PROCESSING IMMAGINE PER OCR
// ============================================================

/**
 * Pre-processa un'immagine per migliorare il riconoscimento OCR:
 * 1. Scala di grigi
 * 2. Aumento contrasto
 * 3. Inversione colori (se testo chiaro su fondo scuro)
 * 4. Binarizzazione (bianco/nero puro)
 */
async function preprocessImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        try {
          // Crea canvas con le stesse dimensioni dell'immagine
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas non supportato'));
            return;
          }

          // 🔥 SCALA 2x per migliorare la lettura di testi piccoli
          const scale = 2;
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Leggi i pixel
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          // 🔥 STEP 1: Scala di grigi + calcolo luminosità media
          let luminositaTotale = 0;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // Formula luminosità percettiva
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
            luminositaTotale += gray;
          }

          const luminositaMedia = luminositaTotale / (data.length / 4);

          // 🔥 STEP 2: Inversione colori se fondo SCURO (luminosità < 128)
          // Tesseract legge meglio testo SCURO su fondo CHIARO
          const inverti = luminositaMedia < 128;
          if (inverti) {
            for (let i = 0; i < data.length; i += 4) {
              data[i] = 255 - data[i];
              data[i + 1] = 255 - data[i + 1];
              data[i + 2] = 255 - data[i + 2];
            }
          }

          // 🔥 STEP 3: Aumento contrasto + Binarizzazione
          // Calcola soglia adattiva (media della luminosità)
          const soglia = inverti ? 255 - luminositaMedia : luminositaMedia;
          
          for (let i = 0; i < data.length; i += 4) {
            const gray = data[i];
            // Contrasto aggressivo: sotto soglia → nero, sopra → bianco
            const nuovoValore = gray < soglia - 20 ? 0 : 255;
            data[i] = nuovoValore;
            data[i + 1] = nuovoValore;
            data[i + 2] = nuovoValore;
          }

          // Riscrivi i pixel modificati
          ctx.putImageData(imageData, 0, 0);

          // Converti canvas in File (PNG)
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Errore conversione canvas'));
              return;
            }
            const processedFile = new File([blob], file.name, { type: 'image/png' });
            resolve(processedFile);
          }, 'image/png');
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Errore caricamento immagine'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Errore lettura file'));
    reader.readAsDataURL(file);
  });
}

// ============================================================
// COMPONENTE
// ============================================================

export default function RosaRecognizer({
  listaGiocatori,
  giocatoriGiaInRosa,
  onAggiungiGiocatori
}: RosaRecognizerProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [riconosciuti, setRiconosciuti] = useState<Player[]>([]);
  const [nonRiconosciuti, setNonRiconosciuti] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setRiconosciuti([]);
    setNonRiconosciuti([]);

    try {
      let fileDaElaborare = file;

      // 🔥 Pre-processa SOLO se è un'immagine
      if (file.type.startsWith('image/')) {
        console.log('🖼️ Pre-processing immagine per OCR...');
        try {
          fileDaElaborare = await preprocessImage(file);
          console.log('✅ Pre-processing completato');
        } catch (preprocessError) {
          console.warn('⚠️ Pre-processing fallito, uso immagine originale:', preprocessError);
          fileDaElaborare = file;
        }
      }

      const result = await riconosciGiocatoriDaFile(fileDaElaborare, listaGiocatori);
      setRiconosciuti(result.riconosciuti);
      setNonRiconosciuti(result.nonRiconosciuti);

      if (result.riconosciuti.length === 0 && result.nonRiconosciuti.length === 0) {
        setError('Nessun giocatore riconosciuto. Prova con un\'immagine più nitida o carica un file Excel.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel riconoscimento');
    } finally {
      setIsProcessing(false);
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

      {/* Upload Area */}
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
              <span className="text-slate-300 text-xs md:text-sm">Riconoscimento in corso...</span>
              <span className="text-[10px] md:text-xs text-emerald-400">Pre-processing immagine</span>
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

      {/* Error Message */}
      {error && (
        <div className="mt-3 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-xs md:text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Results */}
      {(riconosciuti.length > 0 || nonRiconosciuti.length > 0) && (
        <div className="mt-4 space-y-3 md:space-y-4">
          {/* Recognized Players */}
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

          {/* Unrecognized Players */}
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

      {/* Info Box */}
      <div className="mt-3 md:mt-4 p-3 bg-slate-800/40 rounded-lg text-[10px] md:text-xs text-slate-400">
        <p className="font-medium text-slate-300 mb-1">💡 Suggerimenti per foto:</p>
        <ul className="space-y-0.5 list-disc list-inside">
          <li>Usa immagini <strong>nitide</strong> e ben illuminate</li>
          <li><strong>Ritaglia</strong> solo la parte con i nomi dei giocatori</li>
          <li>Preferisci sfondi <strong>chiari</strong> con testo scuro</li>
          <li>L'app applica automaticamente contrasto e binarizzazione</li>
        </ul>
      </div>
    </div>
  );
}
