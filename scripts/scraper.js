const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function scrapeFormazioni() {
  console.log('🚀 Avvio browser headless...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // User-Agent realistico per evitare blocchi
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  
  console.log('📡 Navigazione su Fantacalcio.it...');
  await page.goto('https://www.fantacalcio.it/probabili-formazioni-serie-a', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });
  
  // Aspetta che le formazioni siano renderizzate
  await page.waitForSelector('li.match.match-item', { timeout: 20000 });
  
  // Piccola pausa per far caricare tutte le immagini/dati
  await new Promise(r => setTimeout(r, 3000));
  
  console.log('🔍 Estrazione dati...');
  
  const formazioni = await page.evaluate(() => {
    const risultato = {};
    
    // Itera su ogni partita
    document.querySelectorAll('li.match.match-item').forEach(matchEl => {
      const matchId = matchEl.getAttribute('data-match-has'); // es. "VEN-FIO"
      if (!matchId) return;
      
      const [casa, trasferta] = matchId.split('-');
      
      risultato[matchId] = {
        casa: { sigla: casa, titolari: [], panchina: [] },
        trasferta: { sigla: trasferta, titolari: [], panchina: [] }
      };
      
      // Estrai squadra in casa
      const homeEl = matchEl.querySelector('.team-home');
      if (homeEl) {
        risultato[matchId].casa.titolari = estraiGiocatori(homeEl, 'titolari');
        risultato[matchId].casa.panchina = estraiGiocatori(homeEl, 'panchina');
      }
      
      // Estrai squadra in trasferta
      const awayEl = matchEl.querySelector('.team-away') 
                  || matchEl.querySelectorAll('.team')[1];
      if (awayEl) {
        risultato[matchId].trasferta.titolari = estraiGiocatori(awayEl, 'titolari');
        risultato[matchId].trasferta.panchina = estraiGiocatori(awayEl, 'panchina');
      }
    });
    
    // Funzione interna per estrarre i nomi dai giocatori
    function estraiGiocatori(teamEl, tipo) {
      const nomi = [];
      // Prova vari selettori in base alla struttura osservata
      const selettori = [
        'ul.team-lineup li.player a.player-name span',
        'ul.team-lineup li.player span',
        '.player-name span'
      ];
      
      for (const sel of selettori) {
        const elementi = teamEl.querySelectorAll(sel);
        if (elementi.length > 0) {
          elementi.forEach(el => {
            const nome = el.textContent.trim();
            if (nome && !nomi.includes(nome)) nomi.push(nome);
          });
          break;
        }
      }
      return nomi;
    }
    
    return risultato;
  });
  
  await browser.close();
  
  // Prepara l'output
  const output = {
    aggiornato: new Date().toISOString(),
    fonte: 'fantacalcio.it',
    partite: formazioni
  };
  
  // Salva il file
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
