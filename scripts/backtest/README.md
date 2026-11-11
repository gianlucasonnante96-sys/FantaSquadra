# Backtest dell'algoritmo

Misura quanto sarebbero state buone le formazioni consigliate nelle giornate già giocate.

Il repository non salva i voti per giornata, ma il workflow committa le statistiche ogni
2 ore: confrontando due commit consecutivi si ricava il fantavoto di ogni giocatore
(`FM_dopo × PG_dopo − FM_prima × PG_prima`). Per ogni partita le previsioni usano solo i
dati presenti nel repository **prima** del fischio d'inizio.

## Come si lancia

```bash
git fetch --depth=3000 origin main      # serve la storia dei commit
npm i -g tsx                            # se non è già installato
node scripts/backtest/backtest.mjs                 # codice attuale (cartella src/)
node scripts/backtest/backtest.mjs origin/main     # versione pubblicata, per confronto
```

I risultati finiscono in `scripts/backtest/out/` (ignorata da git).

## Cosa misura

- **titolarità**: quanti giocatori hanno giocato davvero, per fascia di probabilità prevista
- **voto previsto**: errore medio rispetto al fantavoto reale (solo chi ha giocato)
- **simulazione**: 400 rose casuali per giornata (pescate in base alla quotazione), l'algoritmo
  sceglie modulo e titolari, si contano i punti veri con massimo 3 cambi dalla panchina.
  Il confronto è con una formazione casuale e con quella perfetta "col senno di poi".

## Limiti

- Dati disponibili solo dalla giornata 6 in poi: il campione è piccolo.
- I pesi in `src/utils/scoring.ts` sono stati tarati su queste stesse giornate, quindi il
  miglioramento reale sulle prossime sarà probabilmente un po' più basso di quello misurato.
- Il modificatore difesa non è simulato.
