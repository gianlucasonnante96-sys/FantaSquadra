// scripts/scraper.js
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://www.fantacalcio.it/probabili-formazioni-serie-a';
const QUOTAZIONI_URL = 'https://www.fantacalcio.it/quotazioni-fantacalcio';
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'formazioni.json');
const LISTONE_OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'listone.json');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const BLOCKED_DOMAINS = [
  'quantcast.com', 'cmp.quantcast', 'googletagmanager.com',
  'googlesyndication.com', 'google-analytics.com', 'doubleclick.net',
  'facebook.net', 'rubiconproject.com', 'criteo.com', 'taboola.com',
  'outbrain.com', 'adskindiv', 'revive',
];

function leggiFormazioniEsistenti() {
  try {
    if (!fs.existsSync(OUTPUT_PATH)) {
      console.log('📂 Nessun formazioni.json esistente, parto da zero');
      return { partite: {} };
    }
    const content = fs.readFileSync(OUTPUT_PATH, 'utf-8');
    const data = JSON.parse(content);
    if (!data || !data.partite) return { partite: {} };
    const numPartite = Object.keys(data.partite).length;
    console.log(`📂 Caricate ${numPartite} partite esistenti da formazioni.json`);
    return data;
  } catch (e) {
    console.warn('⚠️ Errore lettura formazioni.json:', e.message);
    return { partite: {} };
  }
}

function mergeFormazioni(esistenti, nuove) {
  const risultato = { ...esistenti.partite };
  let nuoveCount = 0;
  let aggiornateCount = 0;
  for (const [key, nuovaPartita] of Object.entries(nuove)) {
    if (risultato[key]) {
      risultato[key] = nuovaPartita;
      aggiornateCount++;
    } else {
      risultato[key] = nuovaPartita;
      nuoveCount++;
    }
  }
  console.log(`🔀 Merge: ${nuoveCount} nuove, ${aggiornateCount} aggiornate, ${Object.keys(risultato).length} totali`);
  return risultato;
}

// ============================================================
// 🔥 NUOVA FUNZIONE: SCRAPING LISTONE QUOTAZIONI
// ============================================================

async function scrapeListone(page) {
  console.log('\n📋 Recupero listone quotazioni...');
  
  try {
    await page.goto(QUOTAZIONI_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });
    
    console.log('✅ Titolo pagina quotazioni:', await page.title());
    await sleep(5000);
    
    // Rimuovi banner cookie
    await page.evaluate(() => {
      document.querySelectorAll('[class*="qc-cmp"], [id*="qc-cmp"]').forEach(el => el.remove());
    });
    
    // 🔥 SCROLL per caricare tutti i giocatori (paginazione lazy)
    console.log('⏳ Scroll per caricare tutti i giocatori...');
    
    let previousCount = 0;
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      const currentCount = await page.evaluate(() => {
        return document.querySelectorAll('tr.player-row').length;
      });
      
      console.log(`  📊 Giocatori caricati: ${currentCount}`);
      
      if (currentCount === previousCount && attempts > 3) {
        console.log('  ✅ Nessun nuovo giocatore, scroll completato');
        break;
      }
      
      previousCount = currentCount;
      
      // Scroll fino in fondo
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      await sleep(2000);
      attempts++;
    }
    
    const totalGiocatori = await page.evaluate(() => {
      return document.querySelectorAll('tr.player-row').length;
    });
    
    console.log(`✅ Scroll completato: ${totalGiocatori} giocatori visibili`);
    
    // 🔥 ESTRAZIONE DATI
    console.log('🔍 Estrazione dati dal listone...');
    
    const listoneData = await page.evaluate(() => {
      const giocatori = [];
      
      const rows = document.querySelectorAll('tr.player-row');
      
      rows.forEach(row => {
        try {
          // Ruolo
          const roleEl = row.querySelector('th.player-role');
          const role = roleEl ? roleEl.textContent?.trim() || '' : '';
          
          // Nome
          const nameEl = row.querySelector('th.player-name a span');
          const nome = nameEl ? nameEl.textContent?.trim() || '' : '';
          
          // Squadra
          const teamEl = row.querySelector('td.player-team');
          const squadra = teamEl ? teamEl.textContent?.trim() || '' : '';
          
          // Quotazione iniziale
          const qiEl = row.querySelector('td.player-classic-initial-price');
          const qiText = qiEl ? qiEl.textContent?.trim() || '0' : '0';
          const quotazioneIniziale = parseInt(qiText) || 0;
          
          // Quotazione attuale
          const qaEl = row.querySelector('td.player-classic-current-price');
          const qaText = qaEl ? qaEl.textContent?.trim() || '0' : '0';
          const quotazioneAttuale = parseInt(qaText) || 0;
          
          // FVM
          const fvmEl = row.querySelector('td.player-classic-fvm');
          const fvmText = fvmEl ? fvmEl.textContent?.trim() || '0' : '0';
          const fvm = parseInt(fvmText) || 0;
          
          if (nome && squadra) {
            giocatori.push({
              nome,
              squadra,
              ruolo: role,
              quotazioneIniziale,
              quotazioneAttuale,
              fvm,
            });
          }
        } catch (e) {
          // Ignora righe malformate
        }
      });
      
      return giocatori;
    });
    
    console.log(`✅ Estratti ${listoneData.length} giocatori dal listone`);
    
    // Log di esempio
    if (listoneData.length > 0) {
      console.log('📊 Esempio primi 3 giocatori:');
      listoneData.slice(0, 3).forEach(g => {
        console.log(`  - ${g.nome} (${g.squadra}, ${g.ruolo}): Qi=${g.quotazioneIniziale}, Qa=${g.quotazioneAttuale}, FVM=${g.fvm}`);
      });
    }
    
    // Salva in listone.json
    const output = {
      aggiornato: new Date().toISOString(),
      fonte: 'fantacalcio.it',
      giocatori: listoneData,
    };
    
    fs.mkdirSync(path.dirname(LISTONE_OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(LISTONE_OUTPUT_PATH, JSON.stringify(output, null, 2));
    
    console.log(`✅ Listone salvato: ${listoneData.length} giocatori in listone.json`);
    
    return listoneData;
  } catch (e) {
    console.error('❌ Errore scraping listone:', e.message);
    return [];
  }
}

// ============================================================
// SCRAPING FORMAZIONI (esistente)
// ============================================================

async function scrapeFormazioni(page) {
  console.log('\n🚀 Navigazione pagina formazioni...');
  
  const esistenti = leggiFormazioniEsistenti();
  
  try {
    await page.goto(BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });
  } catch (e) {
    console.log('⚠️ Errore goto formazioni:', e.message);
  }
  
  console.log('✅ Titolo pagina:', await page.title());
  console.log('⏳ Attesa rendering formazioni...');
  await sleep(8000);
  
  await page.evaluate(() => {
    document.querySelectorAll('[class*="qc-cmp"], [id*="qc-cmp"]').forEach(el => el.remove());
    document.body.style.overflow = 'auto';
    document.body.style.position = 'static';
  });
  
  try {
    await page.waitForSelector('li.match.match-item[data-match-id]', { timeout: 30000 });
    console.log('✅ Selettore match trovato!');
  } catch (e) {
    console.log('⚠️ Selettore non trovato entro 30s');
  }
  
  console.log('🔍 Estrazione dati formazioni...');
  
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
      
      const teamCards = el.querySelectorAll('.card.team-card');
      if (teamCards.length < 2) continue;
      
      function estraiGiocatoriDaCard(cardEl) {
        const giocatori = [];
        const allItems = cardEl.querySelectorAll('ul.player-list li.player-item');
        
        allItems.forEach(item => {
          const nomeEl = item.querySelector('a.player-name span');
          const percEl = item.querySelector('.progress-value');
          const roleEl = item.querySelector('span.role');
          const listParent = item.closest('ul');
          
          const nome = nomeEl ? nomeEl.textContent?.trim() : '';
          const percText = percEl ? percEl.textContent?.trim().replace('%', '').trim() : '';
          const perc = parseInt(percText) || 0;
          const role = roleEl ? roleEl.textContent?.trim() : '';
          const isStarter = listParent?.classList.contains('starters') || false;
          
          if (nome) {
            giocatori.push({
              nome,
              perc,
              role,
              starter: isStarter,
            });
          }
        });
        
        return giocatori;
      }
      
      function estraiNomeSquadra(cardEl) {
        const headerEl = cardEl.querySelector('header');
        if (!headerEl) return '';
        const text = headerEl.textContent || '';
        return text.trim().split('\n')[0].trim();
      }
      
      const cardCasa = teamCards[0];
      const cardTrasferta = teamCards[1];
      
      const nomeCasa = estraiNomeSquadra(cardCasa);
      const nomeTrasferta = estraiNomeSquadra(cardTrasferta);
      
      let casaSigla = '';
      let trasfertaSigla = '';
      if (matchHash && matchHash.includes('-')) {
        [casaSigla, trasfertaSigla] = matchHash.split('-');
      }
      
      const casaGiocatori = estraiGiocatoriDaCard(cardCasa);
      const trasfertaGiocatori = estraiGiocatoriDaCard(cardTrasferta);
      
      lista.push({
        matchId,
        matchHash,
        casaSigla,
        trasfertaSigla,
        nomeCasa,
        nomeTrasferta,
        casaGiocatori,
        trasfertaGiocatori,
      });
    }
    
    return lista;
  });
  
  console.log(`\n📋 Risultati estrazione formazioni:`);
  
  const nuoveFormazioni = {};
  for (const m of matchesData) {
    const key = m.matchHash || `${m.casaSigla}-${m.trasfertaSigla}_${m.matchId}`;
    nuoveFormazioni[key] = {
      matchId: m.matchId,
      casa: { sigla: m.casaSigla, nome: m.nomeCasa, giocatori: m.casaGiocatori },
      trasferta: { sigla: m.trasfertaSigla, nome: m.nomeTrasferta, giocatori: m.trasfertaGiocatori },
    };
    
    const casaTit = m.casaGiocatori.filter(g => g.starter).length;
    const casaRis = m.casaGiocatori.filter(g => !g.starter).length;
    const trasfTit = m.trasfertaGiocatori.filter(g => g.starter).length;
    const trasfRis = m.trasfertaGiocatori.filter(g => !g.starter).length;
    
    console.log(`  ${key}: ${m.nomeCasa} (${casaTit} tit + ${casaRis} ris) vs ${m.nomeTrasferta} (${trasfTit} tit + ${trasfRis} ris)`);
  }
  
  const partiteFinali = mergeFormazioni(esistenti, nuoveFormazioni);
  
  const output = {
    aggiornato: new Date().toISOString(),
    fonte: 'fantacalcio.it',
    partite: partiteFinali
  };
  
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  
  const totalGiocatori = Object.values(partiteFinali).reduce((acc, p) => 
    acc + (p.casa?.giocatori?.length || 0) + (p.trasferta?.giocatori?.length || 0), 0
  );
  
  console.log(`\n✅ Formazioni salvate: ${Object.keys(partiteFinali).length} partite, ${totalGiocatori} giocatori`);
}

// ============================================================
// MAIN
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
  
  // 1. Scraping formazioni
  await scrapeFormazioni(page);
  
  // 2. Scraping listone
  await scrapeListone(page);
  
  await browser.close();
  console.log('\n🎉 Tutti gli scraping completati!');
}

main().catch(err => {
  console.error('❌ Errore fatale:', err);
  process.exit(1);
});
