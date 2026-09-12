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
  
  // === Estrazione con selettori CORRETTI ===
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
      
      // 🔥 FIX: usa `.pitch .team-home` e `.pitch .team-away` (specifici!)
      const homeEl = el.querySelector('.pitch .team.team-home');
      const awayEl = el.querySelector('.pitch .team.team-away');
      
      // Estrai i giocatori
      function estraiGiocatori(teamEl) {
        if (!teamEl) return [];
        const nomi = [];
        // 🔥 Selettore corretto basato sull'HTML dump
        const links = teamEl.querySelectorAll('ul.team-lineup li.player a.player-name span');
        links.forEach(el => {
          const nome = el.textContent?.trim() || '';
          if (nome && !nomi.includes(nome)) nomi.push(nome);
        });
        return nomi;
      }
      
      const casaTitolari = estraiGiocatori(homeEl);
      const trasfertaTitolari = estraiGiocatori(awayEl);
      
      // Estrai sigle squadre dall'hash (VEN-FIO) o dai nomi
      let casaSigla = '';
      let trasfertaSigla = '';
      
      if (matchHash && matchHash.includes('-')) {
        [casaSigla, trasfertaSigla] = matchHash.split('-');
      }
      
      // Se non c'è l'hash, estrai dai nomi
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
  
  const formazioni = {};
  for (const m of matchesData) {
    const key = m.matchHash || `${m.casaSigla}-${m.trasfertaSigla}_${m.matchId}`;
    formazioni[key] = {
      matchId: m.matchId,
      casa: { sigla: m.casaSigla, titolari: m.casaTitolari },
      trasferta: { sigla: m.trasfertaSigla, titolari: m.trasfertaTitolari },
    };
    
    console.log(`  ${key}: casa=${m.casaTitolari.length}, trasferta=${m.trasfertaTitolari.length}`);
  }
  
  const totalGiocatori = Object.values(formazioni).reduce((acc, p) => 
    acc + p.casa.titolari.length + p.trasferta.titolari.length, 0
  );
  
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
