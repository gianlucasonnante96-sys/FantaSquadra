// scripts/scraper.js
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://www.fantacalcio.it/probabili-formazioni-serie-a';
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'formazioni.json');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const BLOCKED_DOMAINS = [
  'quantcast.com',
  'cmp.quantcast',
  'googletagmanager.com',
  'googlesyndication.com',
  'google-analytics.com',
  'doubleclick.net',
  'facebook.net',
  'rubiconproject.com',
  'criteo.com',
  'taboola.com',
  'outbrain.com',
  'adskindiv',
  'revive',
];

/**
 * 🔥 Legge il file formazioni.json esistente (se c'è).
 * Serve per il MERGE cumulativo.
 */
function leggiFormazioniEsistenti() {
  try {
    if (!fs.existsSync(OUTPUT_PATH)) {
      console.log('📂 Nessun formazioni.json esistente, parto da zero');
      return { partite: {} };
    }
    
    const content = fs.readFileSync(OUTPUT_PATH, 'utf-8');
    const data = JSON.parse(content);
    
    if (!data || !data.partite) {
      return { partite: {} };
    }
    
    const numPartite = Object.keys(data.partite).length;
    console.log(`📂 Caricate ${numPartite} partite esistenti da formazioni.json`);
    return data;
  } catch (e) {
    console.warn('⚠️ Errore lettura formazioni.json, parto da zero:', e.message);
    return { partite: {} };
  }
}

/**
 * 🔥 MERGE: combina le formazioni vecchie con quelle nuove.
 * 
 * Logica:
 * - Se una partita è già presente: aggiorna con i dati NUOVI (freschi)
 * - Se una partita è nuova: aggiungila
 * - Se una partita era presente ma non è più nel sito (giocata): MANTIENILA
 */
function mergeFormazioni(esistenti, nuove) {
  const risultato = { ...esistenti.partite };
  let nuoveCount = 0;
  let aggiornateCount = 0;
  
  for (const [key, nuovaPartita] of Object.entries(nuove)) {
    if (risultato[key]) {
      // Già esisteva → aggiorna
      risultato[key] = nuovaPartita;
      aggiornateCount++;
    } else {
      // Nuova → aggiungi
      risultato[key] = nuovaPartita;
      nuoveCount++;
    }
  }
  
  console.log(`🔀 Merge: ${nuoveCount} nuove, ${aggiornateCount} aggiornate, ${Object.keys(risultato).length} totali`);
  return risultato;
}

async function scrapeFormazioni() {
  console.log('🚀 Avvio browser headless...');
  
  // 🔥 STEP 1: Leggi le formazioni esistenti (per il merge)
  const esistenti = leggiFormazioniEsistenti();
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ]
  });
  
  const page = await browser.newPage();
  
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1920, height: 1080 });
  
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.__tcfapi = function() {};
    window.__gpp = function() {};
    window.__cmp = function() {};
  });
  
  console.log('🛡️ Attivo blocco domini (Quantcast + tracker)...');
  await page.setRequestInterception(true);
  
  page.on('request', (req) => {
    const url = req.url().toLowerCase();
    if (BLOCKED_DOMAINS.some(d => url.includes(d))) {
      req.abort();
    } else {
      req.continue();
    }
  });
  
  console.log('📡 Navigazione pagina principale...');
  try {
    await page.goto(BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });
  } catch (e) {
    console.log('⚠️ Errore goto:', e.message);
  }
  
  console.log('✅ Titolo pagina:', await page.title());
  console.log('⏳ Attesa rendering formazioni...');
  await sleep(8000);
  
  // Rimuovi banner Quantcast residui
  await page.evaluate(() => {
    document.querySelectorAll('[class*="qc-cmp"], [id*="qc-cmp"]').forEach(el => el.remove());
    document.body.style.overflow = 'auto';
    document.body.style.position = 'static';
  });
  
  console.log('⏳ Attesa selettore match...');
  try {
    await page.waitForSelector('li.match.match-item[data-match-id]', { timeout: 30000 });
    console.log('✅ Selettore trovato!');
  } catch (e) {
    console.log('⚠️ Selettore non trovato entro 30s');
  }
  
  // === Estrazione ===
  console.log('🔍 Estrazione dati...');
  
  const matchesData = await page.evaluate(() => {
    const lista = [];
    const allMatches = Array.from(document.querySelectorAll('li.match.match-item[data-match-id]'));
    const seenIds = new Set();
    
    for (const el of allMatches) {
      const matchId = el.getAttribute('data-match-id');
      const matchHash = el.getAttribute('data-match-hash') || el.getAttribute('data-match-has') || '';
      
      if (!matchId || seenIds.has(matchId)) continue;
      
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      
      seenIds.add(matchId);
      
      const homeEl = el.querySelector('.pitch .team.team-home');
      const awayEl = el.querySelector('.pitch .team.team-away');
      
      function estraiGiocatori(teamEl) {
        if (!teamEl) return [];
        const nomi = [];
        const links = teamEl.querySelectorAll('ul.team-lineup li.player a.player-name span');
        links.forEach(el => {
          const nome = el.textContent?.trim() || '';
          if (nome && !nomi.includes(nome)) nomi.push(nome);
        });
        return nomi;
      }
      
      const casaTitolari = estraiGiocatori(homeEl);
      const trasfertaTitolari = estraiGiocatori(awayEl);
      
      let casaSigla = '';
      let trasfertaSigla = '';
      
      if (matchHash && matchHash.includes('-')) {
        [casaSigla, trasfertaSigla] = matchHash.split('-');
      }
      
      if (!casaSigla && homeEl) {
        const teamLink = homeEl.querySelector('a.team-name, a.team-link');
        if (teamLink) casaSigla = teamLink.textContent?.trim() || '';
      }
      if (!trasfertaSigla && awayEl) {
        const teamLink = awayEl.querySelector('a.team-name, a.team-link');
        if (teamLink) trasfertaSigla = teamLink.textContent?.trim() || '';
      }
      
      lista.push({
        matchId,
        matchHash,
        casaSigla,
        trasfertaSigla,
        casaTitolari,
        trasfertaTitolari,
      });
    }
    
    return lista;
  });
  
  console.log(`\n📋 Risultati estrazione:`);
  
  const nuoveFormazioni = {};
  for (const m of matchesData) {
    const key = m.matchHash || `${m.casaSigla}-${m.trasfertaSigla}_${m.matchId}`;
    nuoveFormazioni[key] = {
      matchId: m.matchId,
      casa: { sigla: m.casaSigla, titolari: m.casaTitolari },
      trasferta: { sigla: m.trasfertaSigla, titolari: m.trasfertaTitolari },
    };
    
    console.log(`  ${key}: casa=${m.casaTitolari.length}, trasferta=${m.trasfertaTitolari.length}`);
  }
  
  await browser.close();
  
  // 🔥 STEP 2: MERGE con i dati esistenti
  const partiteFinali = mergeFormazioni(esistenti, nuoveFormazioni);
  
  // === SALVATAGGIO ===
  const output = {
    aggiornato: new Date().toISOString(),
    fonte: 'fantacalcio.it',
    partite: partiteFinali
  };
  
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  
  const totalGiocatori = Object.values(partiteFinali).reduce((acc, p) => 
    acc + (p.casa?.titolari?.length || 0) + (p.trasferta?.titolari?.length || 0), 0
  );
  
  console.log(`\n✅ Fatto!`);
  console.log(`   Partite totali nel file: ${Object.keys(partiteFinali).length}`);
  console.log(`   Giocatori totali nel file: ${totalGiocatori}`);
  console.log(`   Partite aggiornate in questo run: ${Object.keys(nuoveFormazioni).length}`);
}

scrapeFormazioni().catch(err => {
  console.error('❌ Errore fatale:', err);
  process.exit(1);
});
