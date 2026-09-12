import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://www.fantacalcio.it/probabili-formazioni-serie-a';
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'formazioni.json');
const LISTONE_OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'listone.json'); // 🔥 NUOVO FILE

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const BLOCKED_DOMAINS = [
  'quantcast.com', 'cmp.quantcast', 'googletagmanager.com',
  'googlesyndication.com', 'google-analytics.com', 'doubleclick.net',
  'facebook.net', 'rubiconproject.com', 'criteo.com', 'taboola.com',
  'outbrain.com', 'adskindiv', 'revive',
];

// ... (funzioni leggiFormazioniEsistenti e mergeFormazioni rimangono uguali) ...

async function scrapeFormazioni(page) {
  // ... (logica esistente per estrarre le probabili formazioni) ...
}

// 🔥 NUOVA FUNZIONE: Scarica il listone ufficiale
async function scrapeListone(page) {
  console.log('📋 Recupero listone ufficiale...');
  const listoneUrl = 'https://www.fantacalcio.it/quotazioni-fantacalcio';
  
  try {
    await page.goto(listoneUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(5000); // Attesa rendering
    
    // Estrai i dati dalla tabella del listone
    const listoneData = await page.evaluate(() => {
      const players = [];
      // Selettore basato sulla struttura della pagina delle quotazioni
      const rows = document.querySelectorAll('.table-responsive table tbody tr, table tbody tr');
      
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 6) {
          const nameRaw = cells[0]?.textContent?.trim() || '';
          const teamRaw = cells[1]?.textContent?.trim() || '';
          const roleRaw = cells[2]?.textContent?.trim() || '';
          const qtA = parseFloat(cells[3]?.textContent) || 0;
          const qtI = parseFloat(cells[4]?.textContent) || 0;
          const fvm = parseFloat(cells[5]?.textContent) || 0;
          
          if (nameRaw) {
            players.push({
              nome: nameRaw,
              squadra: teamRaw,
              ruolo: roleRaw,
              quotazioneAttuale: qtA,
              quotazioneIniziale: qtI,
              fvm: fvm
            });
          }
        }
      });
      return players;
    });
    
    console.log(`✅ Listone scaricato: ${listoneData.length} giocatori`);
    
    // Salva il listone in un file JSON separato
    fs.writeFileSync(LISTONE_OUTPUT_PATH, JSON.stringify({
      aggiornato: new Date().toISOString(),
      fonte: 'fantacalcio.it',
      giocatori: listoneData
    }, null, 2));
    
    return listoneData;
  } catch (e) {
    console.error('❌ Errore scraping listone:', e.message);
    return [];
  }
}

async function scrapeFormazioni() {
  // ... (setup browser) ...
  
  const page = await browser.newPage();
  
  // ... (configurazione user-agent, blocco domini) ...
  
  // Esegui entrambi gli scrape nella stessa sessione
  const nuoveFormazioni = await scrapeFormazioni(page); // La tua funzione esistente
  await scrapeListone(page); // 🔥 Chiama la nuova funzione
  
  await browser.close();
  
  // ... (merge e salvataggio formazioni come prima) ...
}

scrapeFormazioni().catch(err => {
  console.error('❌ Errore fatale:', err);
  process.exit(1);
});
