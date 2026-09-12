// scripts/scraper.js
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://www.fantacalcio.it/probabili-formazioni-serie-a';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// 🔥 Domini da bloccare (banner cookie + tracker + ads)
const BLOCKED_DOMAINS = [
  'quantcast.com',
  'qc-cmp2',
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
];

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
    // 🔥 Override di window.__tcfapi e simili per far credere alla pagina che i cookie siano già accettati
    window.__tcfapi = function() {};
    window.__gpp = function() {};
    window.__cmp = function() {};
  });
  
  // 🔥 BLOCCA richieste verso domini di banner/tracker
  console.log('🛡️ Attivo blocco domini (Quantcast + tracker)...');
  await page.setRequestInterception(true);
  
  page.on('request', (req) => {
    const url = req.url().toLowerCase();
    const shouldBlock = BLOCKED_DOMAINS.some(domain => url.includes(domain));
    
    if (shouldBlock) {
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
  
  // 🔥 Rimuovi fisicamente qualsiasi traccia del banner Quantcast
  await page.evaluate(() => {
    // Rimuovi tutti gli elementi con classi Quantcast
    document.querySelectorAll('[class*="qc-cmp"], [id*="qc-cmp"], [class*="qc-cmp2"], [id*="qc-cmp2"]').forEach(el => el.remove());
    
    // Rimuovi overlay e modal
    document.querySelectorAll('[class*="overlay"], [class*="modal"]').forEach(el => {
      const cls = (el.className || '').toString();
      if (cls.toLowerCase().includes('qc-') || cls.toLowerCase().includes('cmp')) {
        el.remove();
      }
    });
    
    // Sblocca lo scroll
    document.body.style.overflow = 'auto';
    document.body.style.position = 'static';
    document.documentElement.style.overflow = 'auto';
  });
  
  // 🔥 Aspetta che le partite appaiano
  console.log('⏳ Attesa selettore match-item...');
  try {
    await page.waitForSelector('li.match.match-item', { timeout: 30000 });
    console.log('✅ Selettore trovato!');
  } catch (e) {
    console.log('⚠️ Selettore non trovato entro 30s');
  }
  
  // === Trova tutte le partite ===
  const matchIds = await page.evaluate(() => {
    const ids = [];
    document.querySelectorAll('li.match.match-item').forEach(el => {
      const id = el.getAttribute('data-match-has');
      if (id) ids.push(id);
    });
    return ids;
  });
  
  console.log(`📋 Trovate ${matchIds.length} partite:`, matchIds);
  
  // Se ancora 0, prova altri selettori
  if (matchIds.length === 0) {
    console.log('🚨 0 partite. Provo selettori alternativi...');
    const alternatives = await page.evaluate(() => {
      const selectors = [
        'li.match',
        '.match-item',
        'li[data-match-has]',
        'li[data-match-id]',
        '[data-match-has]',
        '[data-match-id]',
      ];
      const result = {};
      for (const sel of selectors) {
        result[sel] = document.querySelectorAll(sel).length;
      }
      return result;
    });
    console.log('📊 Selettori alternativi:', JSON.stringify(alternatives, null, 2));
    
    // Dump HTML
    const html = await page.evaluate(() => document.body.innerHTML.substring(0, 5000));
    console.log('📄 HTML (primi 5000 char):', html);
    
    await browser.close();
    process.exit(1);
  }
  
  // === Estrazione ===
  console.log('🔍 Estrazione dati...');
  
  const formazioni = await page.evaluate(() => {
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
  
  for (const [matchId, dati] of Object.entries(formazioni)) {
    console.log(`  ${matchId}: casa=${dati.casa.titolari.length}, trasferta=${dati.trasferta.titolari.length}`);
  }
  
  const totalGiocatori = Object.values(formazioni).reduce((acc, p) => 
    acc + p.casa.titolari.length + p.trasferta.titolari.length, 0
  );
  
  // Se 0 giocatori, dump HTML di una partita
  if (totalGiocatori === 0 && matchIds.length > 0) {
    console.log('\n🚨 0 giocatori. Dump HTML della prima partita:');
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
