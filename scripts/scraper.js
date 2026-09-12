// scripts/scraper.js
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://www.fantacalcio.it/probabili-formazioni-serie-a';
const DELAY_BETWEEN_MATCHES = 2000;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function scrapeFormazioni() {
  console.log('🚀 Avvio browser headless...');
  
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
  });
  
  console.log('📡 Navigazione pagina principale...');
  await page.goto(BASE_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 90000
  });
  
  console.log('✅ Titolo pagina:', await page.title());
  
  // === STEP 1: Gestione banner cookie Quantcast ===
  console.log('🍪 Ricerca banner cookie...');
  await sleep(3000); // Aspetta che il banner appaia
  
  const cookieHandled = await page.evaluate(() => {
    // Prova diversi selettori per il pulsante "Accetta" del banner Quantcast
    const selettori = [
      // Quantcast CMP - pulsante "Consenti"
      'button[title="Consenti"]',
      'button[aria-label="Consenti"]',
      'button[title="Accept"]',
      'button[aria-label="Accept"]',
      // Quantcast CMP - selettori generici
      '.qc-cmp2-summary-buttons button:first-child',
      '.qc-cmp2-buttons-container button:first-child',
      '[class*="qc-cmp2"] button[class*="accept"]',
      // Fallback generico
      'button[class*="accept"]',
      'button[class*="consent"]',
    ];
    
    for (const sel of selettori) {
      try {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null) { // visibile
          btn.click();
          return { clicked: true, selector: sel };
        }
      } catch (e) {
        // Ignora e continua
      }
    }
    return { clicked: false, selector: null };
  });
  
  if (cookieHandled.clicked) {
    console.log(`✅ Cookie accettati (selettore: ${cookieHandled.selector})`);
    await sleep(3000); // Aspetta che il banner sparisca e la pagina ricarichi
  } else {
    console.log('⚠️ Nessun banner cookie trovato (forse già accettato)');
  }
  
  // === STEP 2: Aspetta il caricamento delle formazioni ===
  console.log('⏳ Attesa rendering formazioni...');
  await sleep(5000);
  
  // === STEP 3: Trova tutte le partite ===
  const matchIds = await page.evaluate(() => {
    const ids = [];
    document.querySelectorAll('li.match.match-item').forEach(el => {
      const id = el.getAttribute('data-match-has');
      if (id) ids.push(id);
    });
    return ids;
  });
  
  console.log(`📋 Trovate ${matchIds.length} partite:`, matchIds);
  
  if (matchIds.length === 0) {
    console.log('🚨 Ancora 0 partite. Controllo HTML...');
    const html = await page.evaluate(() => document.body.innerHTML.substring(0, 5000));
    console.log('📄 HTML (primi 5000 char):', html);
    await browser.close();
    process.exit(1);
  }
  
  const formazioni = {};
  
  // === STEP 4: Estrai i dati (senza click, se sono tutte visibili) ===
  console.log('🔍 Estrazione dati da tutte le partite...');
  
  const datiEstratti = await page.evaluate(() => {
    const risultato = {};
    
    document.querySelectorAll('li.match.match-item').forEach(matchEl => {
      const matchId = matchEl.getAttribute('data-match-has');
      if (!matchId) return;
      
      const [casa, trasferta] = matchId.split('-');
      
      risultato[matchId] = {
        casa: { sigla: casa, titolari: [] },
        trasferta: { sigla: trasferta, titolari: [] }
      };
      
      function estraiGiocatori(teamEl) {
        if (!teamEl) return [];
        const nomi = [];
        const selettori = [
          'a.player-name span',
          'a.player-name',
          'span.player-name',
          '.player-name span',
          '.player-name',
        ];
        for (const sel of selettori) {
          const elementi = teamEl.querySelectorAll(sel);
          if (elementi.length > 0) {
            elementi.forEach(el => {
              const nome = el.textContent?.trim() || '';
              if (nome && !nomi.includes(nome)) nomi.push(nome);
            });
            if (nomi.length > 0) break;
          }
        }
        return nomi;
      }
      
      const homeEl = matchEl.querySelector('.team-home');
      const awayEl = matchEl.querySelector('.team-away');
      
      risultato[matchId].casa.titolari = estraiGiocatori(homeEl);
      risultato[matchId].trasferta.titolari = estraiGiocatori(awayEl);
    });
    
    return risultato;
  });
  
  for (const [matchId, dati] of Object.entries(datiEstratti)) {
    formazioni[matchId] = dati;
    console.log(`  ${matchId}: casa=${dati.casa.titolari.length}, trasferta=${dati.trasferta.titolari.length}`);
  }
  
  const totalGiocatori = Object.values(formazioni).reduce((acc, p) => 
    acc + p.casa.titolari.length + p.trasferta.titolari.length, 0
  );
  
  // === STEP 5: Se ancora 0 giocatori, dump HTML di una partita ===
  if (totalGiocatori === 0 && matchIds.length > 0) {
    console.log('\n🚨 0 giocatori trovati. Dump HTML della prima partita:');
    const htmlPartita = await page.evaluate((id) => {
      const el = document.querySelector(`li.match.match-item[data-match-has="${id}"]`);
      return el ? el.outerHTML.substring(0, 5000) : 'elemento non trovato';
    }, matchIds[0]);
    console.log(htmlPartita);
  }
  
  await browser.close();
  
  // === SALVATAGGIO ===
  const output = {
    aggiornato: new Date().toISOString(),
    fonte: 'fantacalcio.it',
    partite: formazioni
  };
  
  const outputPath = path.join(__dirname, '..', 'src', 'data', 'formazioni.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`\n✅ Fatto! ${Object.keys(formazioni).length} partite, ${totalGiocatori} titolari totali`);
}

scrapeFormazioni().catch(err => {
  console.error('❌ Errore fatale:', err);
  process.exit(1);
});
