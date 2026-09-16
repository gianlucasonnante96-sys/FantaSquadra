// scripts/scraper.js
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://www.fantacalcio.it/probabili-formazioni-serie-a';
const QUOTAZIONI_URL = 'https://www.fantacalcio.it/quotazioni-fantacalcio';
const STATISTICHE_URL = 'https://www.fantacalcio.it/statistiche-serie-a/2026-27/fantacalcio';
const CLASSIFICA_URL = 'https://www.fantacalcio.it/serie-a/classifica'; // 🔥 URL classifica

const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'formazioni.json');
const LISTONE_OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'listone.json');
const STATISTICHE_OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'statistiche.json');
const SQUADRE_OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'squadre.json');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const BLOCKED_DOMAINS = [
  'quantcast.com', 'cmp.quantcast', 'googletagmanager.com',
  'googlesyndication.com', 'google-analytics.com', 'doubleclick.net',
  'facebook.net', 'rubiconproject.com', 'criteo.com', 'taboola.com',
  'outbrain.com', 'adskindiv', 'revive',
];

// ... (funzioni: leggiFormazioniEsistenti, mergeFormazioni, scrapeFormazioni, scrapeListone, scrapeStatistiche) ...

// ============================================================
// 🔥 NUOVA FUNZIONE: SCRAPING CLASSIFICA
// ============================================================

async function scrapeClassifica(page) {
  console.log('\n📊 Recupero classifica (gol fatti/subiti)...');
  
  try {
    await page.goto(CLASSIFICA_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    console.log('✅ Titolo pagina classifica:', await page.title());
    await sleep(5000);
    
    await page.evaluate(() => {
      document.querySelectorAll('[class*="qc-cmp"], [id*="qc-cmp"]').forEach(el => el.remove());
    });

    const classificaData = await page.evaluate(() => {
      const mappa = {}; // { "Inter": { gf: 13, gs: 6, g: 4 }, ... }
      
      const rows = document.querySelectorAll('table tbody tr');
      
      rows.forEach(row => {
        try {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 10) {
            const squadra = cells[1]?.textContent?.trim();
            const g = parseInt(cells[2]?.textContent?.trim()) || 0;
            const gf = parseInt(cells[6]?.textContent?.trim()) || 0;
            const gs = parseInt(cells[7]?.textContent?.trim()) || 0;
            
            if (squadra && g > 0) {
              mappa[squadra] = { gf, gs, g };
            }
          }
        } catch (e) {
          // Ignora righe malformate
        }
      });
      
      return mappa;
    });
    
    const numSquadre = Object.keys(classificaData).length;
    console.log(`✅ Estratti dati per ${numSquadre} squadre`);
    
    // Log di esempio
    if (numSquadre > 0) {
      console.log('📊 Esempio primi 3:');
      Object.entries(classificaData).slice(0, 3).forEach(([nome, dati]) => {
        console.log(`  - ${nome}: GF=${dati.gf}, GS=${dati.gs}, G=${dati.g}`);
      });
    }
    
    const output = {
      aggiornato: new Date().toISOString(),
      fonte: 'fantacalcio.it',
      squadre: classificaData,
    };
    
    fs.mkdirSync(path.dirname(SQUADRE_OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(SQUADRE_OUTPUT_PATH, JSON.stringify(output, null, 2));
    
    console.log(`✅ Classifica salvata: ${numSquadre} squadre in squadre.json`);
    
    return classificaData;
  } catch (e) {
    console.error('❌ Errore scraping classifica:', e.message);
    return {};
  }
}

// ============================================================
// MAIN (aggiornato per chiamare scrapeClassifica)
// ============================================================

async function main() {
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
    window.__tcfapi = function() {};
    window.__gpp = function() {};
    window.__cmp = function() {};
  });
  
  console.log('🛡️ Attivo blocco domini...');
  await page.setRequestInterception(true);
  
  page.on('request', (req) => {
    const url = req.url().toLowerCase();
    if (BLOCKED_DOMAINS.some(d => url.includes(d))) {
      req.abort();
    } else {
      req.continue();
    }
  });
  
  await scrapeFormazioni(page);
  await scrapeListone(page);
  await scrapeStatistiche(page);
  await scrapeClassifica(page);
  
  await browser.close();
  console.log('\n🎉 Tutti gli scraping completati!');
}

main().catch(err => {
  console.error('❌ Errore fatale:', err);
  process.exit(1);
});
