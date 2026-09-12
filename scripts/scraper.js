// scripts/scraper.js
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://www.fantacalcio.it/probabili-formazioni-serie-a';
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'formazioni.json');

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
    
    if (!data || !data.partite) {
      return { partite: {} };
    }
    
    const numPartite = Object.keys(data.partite).length;
    console.log(`📂 Caricate ${numPartite} partite esistenti da formazioni.json`);
    return data;
  } catch (e) {
    console.warn('⚠️ Errore lettura formazioni.json, parto da zero:', e.message);
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

async function scrapeFormazioni() {
  console.log('🚀 Avvio browser headless...');
  
  const esistenti = leggiFormazioniEsistenti();
  
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
  
  await page.evaluate(() => {
    document.querySelectorAll('[class*="qc-cmp"], [id*="qc-cmp"]').forEach(el => el.remove());
    document.body.style.overflow = 'auto';
    document.body.style.position = 'static';
  });
  
  console.log('⏳ Attesa selettore match...');
  try {
    await page.waitForSelector('li.match.match-item[data-match-id]', { timeout: 30000 });
    console.log('✅ Selettore match trovato!');
  } catch (e) {
    console.log('⚠️ Selettore non trovato entro 30s');
  }
  
  console.log('🔍 Estrazione dati...');
  
  // 🔥 NUOVA LOGICA: usa la sezione `.card.team-card` con `ul.player-list`
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
      
      // 🔥 Cerca i DUE card.team-card (una per squadra) dentro questo match
      const teamCards = el.querySelectorAll('.card.team-card');
      
      if (teamCards.length < 2) {
        console.warn(`Match ${matchId}: trovate solo ${teamCards.length} team-card`);
        continue;
      }
      
      // Funzione per estrarre i giocatori da una team-card
      function estraiGiocatoriDaCard(cardEl) {
        const giocatori = [];
        
        // Estrai titolari (ul.player-list.starters)
        const starterItems = cardEl.querySelectorAll('ul.player-list.starters li.player-item');
        starterItems.forEach(item => {
          const nomeEl = item.querySelector('a.player-name span');
          const percEl = item.querySelector('.progress-value');
          const roleEl = item.querySelector('span.role');
          
          const nome = nomeEl ? nomeEl.textContent?.trim() : '';
          const percText = percEl ? percEl.textContent?.trim().replace('%', '').trim() : '';
          const perc = parseInt(percText) || 0;
          const role = roleEl ? roleEl.textContent?.trim() : '';
          
          if (nome) {
            giocatori.push({
              nome: nome,
              perc: perc,
              role: role,
              starter: true,
            });
          }
        });
        
        // Estrai panchina (ul.player-list.reserves)
        const reserveItems = cardEl.querySelectorAll('ul.player-list.reserves li.player-item');
        reserveItems.forEach(item => {
          const nomeEl = item.querySelector('a.player-name span');
          const percEl = item.querySelector('.progress-value');
          const roleEl = item.querySelector('span.role');
          
          const nome = nomeEl ? nomeEl.textContent?.trim() : '';
          const percText = percEl ? percEl.textContent?.trim().replace('%', '').trim() : '';
          const perc = parseInt(percText) || 0;
          const role = roleEl ? roleEl.textContent?.trim() : '';
          
          if (nome) {
            giocatori.push({
              nome: nome,
              perc: perc,
              role: role,
              starter: false,
            });
          }
        });
        
        return giocatori;
      }
      
      // Estrai nome squadra da una card
      function estraiNomeSquadra(cardEl) {
        const headerEl = cardEl.querySelector('header');
        if (!headerEl) return '';
        const text = headerEl.textContent || '';
        // Il primo testo è il nome squadra
        return text.trim().split('\n')[0].trim();
      }
      
      // Le prime due card dovrebbero essere casa e trasferta
      const cardCasa = teamCards[0];
      const cardTrasferta = teamCards[1];
      
      const nomeCasa = estraiNomeSquadra(cardCasa);
      const nomeTrasferta = estraiNomeSquadra(cardTrasferta);
      
      // Estrai le sigle dall'hash
      let casaSigla = '';
      let trasfertaSigla = '';
      if (matchHash && matchHash.includes('-')) {
        [casaSigla, trasfertaSigla] = matchHash.split('-');
      }
      
      // Se non c'è hash, genera dalle prime 3 lettere del nome
      if (!casaSigla && nomeCasa) {
        casaSigla = nomeCasa.substring(0, 3).toUpperCase();
      }
      if (!trasfertaSigla && nomeTrasferta) {
        trasfertaSigla = nomeTrasferta.substring(0, 3).toUpperCase();
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
  
  console.log(`\n📋 Risultati estrazione:`);
  
  const nuoveFormazioni = {};
  for (const m of matchesData) {
    const key = m.matchHash || `${m.casaSigla}-${m.trasfertaSigla}_${m.matchId}`;
    nuoveFormazioni[key] = {
      matchId: m.matchId,
      casa: { sigla: m.casaSigla, nome: m.nomeCasa, giocatori: m.casaGiocatori },
      trasferta: { sigla: m.trasfertaSigla, nome: m.nomeTrasferta, giocatori: m.trasfertaGiocatori },
    };
    
    const casaTitolari = m.casaGiocatori.filter(g => g.starter).length;
    const casaRiserve = m.casaGiocatori.filter(g => !g.starter).length;
    const trasfTitolari = m.trasfertaGiocatori.filter(g => g.starter).length;
    const trasfRiserve = m.trasfertaGiocatori.filter(g => !g.starter).length;
    
    console.log(`  ${key}: ${m.nomeCasa} (${casaTitolari} tit + ${casaRiserve} ris) vs ${m.nomeTrasferta} (${trasfTitolari} tit + ${trasfRiserve} ris)`);
    
    // Log esempio dettagliato del primo match
    if (Object.keys(nuoveFormazioni).length === 1) {
      console.log(`  📊 Esempio ${m.nomeCasa}:`, 
        m.casaGiocatori.slice(0, 4).map(g => `${g.nome} (${g.role}, ${g.perc}%)`).join(', ')
      );
    }
  }
  
  await browser.close();
  
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
  
  console.log(`\n✅ Fatto!`);
  console.log(`   Partite totali nel file: ${Object.keys(partiteFinali).length}`);
  console.log(`   Giocatori totali nel file: ${totalGiocatori}`);
  console.log(`   Partite aggiornate in questo run: ${Object.keys(nuoveFormazioni).length}`);
}

scrapeFormazioni().catch(err => {
  console.error('❌ Errore fatale:', err);
  process.exit(1);
});
