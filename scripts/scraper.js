// scripts/scraper.js
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://www.fantacalcio.it/probabili-formazioni-serie-a';
const DELAY_BETWEEN_MATCHES = 2500; // ms tra una partita e l'altra

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
    waitUntil: 'networkidle2',
    timeout: 90000
  });
  
  console.log('📊 Titolo pagina:', await page.title());
  console.log('⏳ Attesa rendering iniziale...');
  await sleep(5000);
  
  // === STEP 1: Trova tutte le partite ===
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
    console.log('🚨 Nessuna partita trovata. Controllo HTML...');
    const html = await page.evaluate(() => document.body.innerHTML.substring(0, 3000));
    console.log('📄 HTML (primi 3000 char):', html);
    await browser.close();
    process.exit(1);
  }
  
  const formazioni = {};
  
  // === STEP 2: Per ogni partita, clicca e estrai ===
  for (const matchId of matchIds) {
    console.log(`\n🔍 Elaboro ${matchId}...`);
    
    try {
      // Ricarica la pagina principale per essere sicuro
      if (!page.url().includes(BASE_URL)) {
        await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(2000);
      }
      
      // Clicca sulla partita
      const clicked = await page.evaluate((id) => {
        const el = document.querySelector(`li.match.match-item[data-match-has="${id}"]`);
        if (!el) return false;
        
        // Cerca un elemento cliccabile dentro (spesso è un input radio o un link)
        const clickable = el.querySelector('input[type="radio"]') || 
                         el.querySelector('a') || 
                         el.querySelector('label') ||
                         el;
        clickable.click();
        return true;
      }, matchId);
      
      if (!clicked) {
        console.log(`  ⚠️ Impossibile cliccare ${matchId}`);
        continue;
      }
      
      console.log(`  👆 Cliccato, attendo rendering...`);
      await sleep(DELAY_BETWEEN_MATCHES);
      
      // Estrai i giocatori della partita corrente
      const datiPartita = await page.evaluate((id) => {
        const matchEl = document.querySelector(`li.match.match-item[data-match-has="${id}"]`);
        if (!matchEl) return null;
        
        const [casa, trasferta] = id.split('-');
        const risultato = {
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
        
        risultato.casa.titolari = estraiGiocatori(homeEl);
        risultato.trasferta.titolari = estraiGiocatori(awayEl);
        
        return risultato;
      }, matchId);
      
      if (datiPartita) {
        formazioni[matchId] = datiPartita;
        console.log(`  ✅ ${matchId}: casa=${datiPartita.casa.titolari.length}, trasferta=${datiPartita.trasferta.titolari.length}`);
      } else {
        console.log(`  ⚠️ Nessun dato per ${matchId}`);
      }
      
    } catch (e) {
      console.log(`  ❌ Errore su ${matchId}:`, e.message);
    }
  }
  
  // === STEP 3: Se ancora 0 giocatori, dump dell'HTML di una partita ===
  const totalGiocatori = Object.values(formazioni).reduce((acc, p) => 
    acc + p.casa.titolari.length + p.trasferta.titolari.length, 0
  );
  
  if (totalGiocatori === 0 && matchIds.length > 0) {
    console.log('\n🚨 Ancora 0 giocatori. Dump HTML della prima partita:');
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
