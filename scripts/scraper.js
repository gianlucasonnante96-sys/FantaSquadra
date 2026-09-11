// scripts/scraper.js
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function scrapeFormazioni() {
  console.log('🚀 Avvio browser headless...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ]
  });
  
  const page = await browser.newPage();
  
  // User-Agent realistico
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  
  // Viewport realistico
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Rimuovi tracce di automazione
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['it-IT', 'it', 'en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  });
  
  console.log('📡 Navigazione su Fantacalcio.it...');
  const response = await page.goto('https://www.fantacalcio.it/probabili-formazioni-serie-a', {
    waitUntil: 'networkidle2',
    timeout: 90000
  });
  
  // === DEBUG 1: Info sulla risposta ===
  console.log('📊 Status HTTP:', response?.status());
  console.log('📊 URL finale:', page.url());
  console.log('📊 Titolo pagina:', await page.title());
  
  // Aspetta un po' di più per far caricare tutto
  console.log('⏳ Attesa 8 secondi per il rendering...');
  await new Promise(r => setTimeout(r, 8000));
  
  // === DEBUG 2: Quanti match-item ci sono? ===
  const matchCount = await page.evaluate(() => {
    return document.querySelectorAll('li.match.match-item').length;
  });
  console.log('📊 Match trovati (li.match.match-item):', matchCount);
  
  // === DEBUG 3: Se 0, prova altri selettori ===
  if (matchCount === 0) {
    const alternatives = await page.evaluate(() => {
      const selectors = [
        'li.match',
        '.match-item',
        '.pitch',
        '[class*="match"]',
        '[class*="formation"]',
        'li[data-match-id]',
        'li[data-match-has]',
      ];
      const result = {};
      for (const sel of selectors) {
        result[sel] = document.querySelectorAll(sel).length;
      }
      return result;
    });
    console.log('📊 Selettori alternativi:', JSON.stringify(alternatives, null, 2));
  }
  
  // === DEBUG 4: Primi 5000 caratteri di HTML ===
  const htmlSnippet = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    return main.innerHTML.substring(0, 5000);
  });
  console.log('📄 HTML (primi 5000 char):', htmlSnippet.substring(0, 5000));
  
  // === DEBUG 5: Controlla se c'è un blocco/CAPTCHA ===
  const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());
  if (pageText.includes('captcha') || pageText.includes('access denied') || 
      pageText.includes('forbidden') || pageText.includes('blocked')) {
    console.log('🚨 POSSIBILE BLOCCO/CAPTCHA RILEVATO!');
  }
  
  // === ESTRAZIONE ===
  console.log('🔍 Estrazione dati...');
  
  const formazioni = await page.evaluate(() => {
    const risultato = {};
    const matches = document.querySelectorAll('li.match.match-item');
    
    matches.forEach((matchEl, idx) => {
      const matchId = matchEl.getAttribute('data-match-has');
      if (!matchId) {
        console.log(`⚠️ Match ${idx}: no data-match-has`);
        return;
      }
      
      const [casa, trasferta] = matchId.split('-');
      
      risultato[matchId] = {
        casa: { sigla: casa, titolari: [] },
        trasferta: { sigla: trasferta, titolari: [] }
      };
      
      const homeEl = matchEl.querySelector('.team-home');
      const awayEl = matchEl.querySelector('.team-away');
      
      if (homeEl) {
        risultato[matchId].casa.titolari = estraiGiocatori(homeEl);
      }
      if (awayEl) {
        risultato[matchId].trasferta.titolari = estraiGiocatori(awayEl);
      }
    });
    
    function estraiGiocatori(teamEl) {
      const nomi = [];
      // Prova diversi selettori in ordine di preferenza
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
    
    return risultato;
  });
  
  // Log cosa abbiamo trovato per ogni partita
  console.log('📊 Formazioni estratte:');
  for (const [matchId, dati] of Object.entries(formazioni)) {
    console.log(`  ${matchId}: casa=${dati.casa.titolari.length}, trasferta=${dati.trasferta.titolari.length}`);
  }
  
  await browser.close();
  
  const output = {
    aggiornato: new Date().toISOString(),
    fonte: 'fantacalcio.it',
    partite: formazioni
  };
  
  const outputPath = path.join(__dirname, '..', 'src', 'data', 'formazioni.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  const numPartite = Object.keys(formazioni).length;
  const numGiocatori = Object.values(formazioni).reduce((acc, p) => 
    acc + (p.casa?.titolari?.length || 0) + (p.trasferta?.titolari?.length || 0), 0
  );
  
  console.log(`✅ Fatto! ${numPartite} partite, ${numGiocatori} titolari totali`);
  
  if (numPartite === 0) {
    console.log('🚨 ATTENZIONE: 0 partite trovate. Controlla i log DEBUG sopra.');
  }
  if (numGiocatori === 0 && numPartite > 0) {
    console.log('🚨 ATTENZIONE: partite trovate ma 0 giocatori. I selettori dei giocatori sono da aggiornare.');
  }
}

scrapeFormazioni().catch(err => {
  console.error('❌ Errore fatale:', err);
  process.exit(1);
});
