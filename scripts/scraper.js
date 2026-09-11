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
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  
  console.log('📡 Navigazione su Fantacalcio.it...');
  await page.goto('https://www.fantacalcio.it/probabili-formazioni-serie-a', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });
  
  await page.waitForSelector('li.match.match-item', { timeout: 20000 });
  await new Promise(r => setTimeout(r, 3000));
  
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
      
      const homeEl = matchEl.querySelector('.team-home');
      if (homeEl) {
        risultato[matchId].casa.titolari = estraiGiocatori(homeEl);
      }
      
      const awayEl = matchEl.querySelector('.team-away') 
                  || matchEl.querySelectorAll('.team')[1];
      if (awayEl) {
        risultato[matchId].trasferta.titolari = estraiGiocatori(awayEl);
      }
    });
    
    function estraiGiocatori(teamEl) {
      const nomi = [];
      const elementi = teamEl.querySelectorAll('a.player-name span');
      elementi.forEach(el => {
        const nome = el.textContent.trim();
        if (nome && !nomi.includes(nome)) nomi.push(nome);
      });
      return nomi;
    }
    
    return risultato;
  });
  
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
    acc + p.casa.titolari.length + p.trasferta.titolari.length, 0
  );
  
  console.log(`✅ Fatto! ${numPartite} partite, ${numGiocatori} titolari totali`);
}

scrapeFormazioni().catch(err => {
  console.error('❌ Errore:', err);
  process.exit(1);
});
