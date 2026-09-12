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
  
  // 🔥 Rimuovi banner Quantcast residui
  await page.evaluate(() => {
    document.querySelectorAll('[class*="qc-cmp"], [id*="qc-cmp"]').forEach(el => el.remove());
    document.body.style.overflow = 'auto';
    document.body.style.position = 'static';
  });
  
  console.log('⏳ Attesa selettore match...');
  try {
    await page.waitForSelector('li.match.match-item', { timeout: 30000 });
    console.log('✅ Selettore trovato!');
  } catch (e) {
    console.log('⚠️ Selettore non trovato entro 30s');
  }
  
  // 🔥 NUOVO: usa `[data-match-id]` invece di `[data-match-has]`
  const matchesData = await page.evaluate(() => {
    const lista = [];
    
    // 🔥 IMPORTANTE: prendi SOLO il primo set di 10 (probabile duplicato mobile/desktop)
    const allMatches = Array.from(document.querySelectorAll('li.match.match-item[data-match-id]'));
    const seenIds = new Set();
    
    for (const el of allMatches) {
      const matchId = el.getAttribute('data-match-id');
      if (!matchId || seenIds.has(matchId)) continue;
      
      // 🔥 Verifica che sia visibile (non un duplicato nascosto)
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      
      seenIds.add(matchId);
      
      // 🔥 Prova a estrarre le squadre dal DOM
      // Cerca: input radio con data-match, link, span con nomi squadre, ecc.
      let casaSigla = '';
      let trasfertaSigla = '';
      
      // Prova 1: attributi data-squadra, data-team, ecc.
      casaSigla = el.getAttribute('data-home-team') || el.getAttribute('data-casa') || '';
      trasfertaSigla = el.getAttribute('data-away-team') || el.getAttribute('data-trasferta') || '';
      
      // Prova 2: cerca input radio con name che contiene sigle
      if (!casaSigla) {
        const radio = el.querySelector('input[type="radio"]');
        if (radio) {
          const name = radio.getAttribute('name') || '';
          // es. "nav-match-17994" → non utile
          // Cerca nel label associato
          const label = radio.closest('label') || el.querySelector('label');
          if (label) {
            const labelText = label.textContent || '';
            // Cerca pattern tipo "VEN-FIO" o "Venezia - Fiorentina"
            const match = labelText.match(/([A-Z]{3})\s*[-–]\s*([A-Z]{3})/);
            if (match) {
              casaSigla = match[1];
              trasfertaSigla = match[2];
            }
          }
        }
      }
      
      // Prova 3: cerca img alt che contiene "Campioncino XXX"
      if (!casaSigla) {
        const imgs = el.querySelectorAll('img[alt*="Campioncino"]');
        if (imgs.length >= 2) {
          // Le squadre sono deducibili dal nome file immagine o dall'alt
          const firstImg = imgs[0];
          const src = firstImg.getAttribute('src') || '';
          // es. ".../venezia/adams-a/7484.png"
          const teamMatch = src.match(/\/([a-z-]+)\/[a-z-]+\/\d+\.png/);
          if (teamMatch) {
            casaSigla = teamMatch[1];
          }
          const lastImg = imgs[imgs.length - 1];
          const srcLast = lastImg.getAttribute('src') || '';
          const teamMatchLast = srcLast.match(/\/([a-z-]+)\/[a-z-]+\/\d+\.png/);
          if (teamMatchLast) {
            trasfertaSigla = teamMatchLast[1];
          }
        }
      }
      
      // Prova 4: cerca link squadra con href
      if (!casaSigla) {
        const links = el.querySelectorAll('a[href*="/squadre/"]');
        if (links.length >= 2) {
          const homeHref = links[0].getAttribute('href') || '';
          const awayHref = links[1].getAttribute('href') || '';
          const homeMatch = homeHref.match(/\/squadre\/([a-z-]+)/);
          const awayMatch = awayHref.match(/\/squadre\/([a-z-]+)/);
          if (homeMatch) casaSigla = homeMatch[1];
          if (awayMatch) trasfertaSigla = awayMatch[1];
        }
      }
      
      // Estrai i giocatori
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
      
      const homeEl = el.querySelector('.team-home');
      const awayEl = el.querySelector('.team-away');
      
      lista.push({
        matchId,
        casaSigla,
        trasfertaSigla,
        casaTitolari: estraiGiocatori(homeEl),
        trasfertaTitolari: estraiGiocatori(awayEl),
      });
    }
    
    return lista;
  });
  
  console.log(`📋 Trovate ${matchesData.length} partite uniche`);
  
  if (matchesData.length === 0) {
    console.log('🚨 Ancora 0 partite. Dump HTML...');
    const html = await page.evaluate(() => document.body.innerHTML.substring(0, 8000));
    console.log('📄 HTML:', html);
    await browser.close();
    process.exit(1);
  }
  
  // === Mostra i dati trovati ===
  const formazioni = {};
  
  for (const m of matchesData) {
    const key = `${m.casaSigla || 'HOME'}-${m.trasfertaSigla || 'AWAY'}_${m.matchId}`;
    formazioni[key] = {
      matchId: m.matchId,
      casa: { sigla: m.casaSigla, titolari: m.casaTitolari },
      trasferta: { sigla: m.trasfertaSigla, titolari: m.trasfertaTitolari },
    };
    
    console.log(`  Match ${m.matchId} (${m.casaSigla}-${m.trasfertaSigla}): casa=${m.casaTitolari.length}, trasferta=${m.trasfertaTitolari.length}`);
    
    // 🔥 Se 0 giocatori, dump dell'HTML del primo match per debug
    if (m.casaTitolari.length === 0 && m.trasfertaTitolari.length === 0 && matchesData.indexOf(m) === 0) {
      console.log('\n🚨 0 giocatori nel primo match. Dump HTML:');
      const htmlMatch = await page.evaluate((id) => {
        const el = document.querySelector(`li.match.match-item[data-match-id="${id}"]`);
        return el ? el.outerHTML.substring(0, 5000) : 'non trovato';
      }, m.matchId);
      console.log(htmlMatch);
    }
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
