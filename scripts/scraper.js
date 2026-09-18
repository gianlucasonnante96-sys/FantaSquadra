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
const CLASSIFICA_URL = 'https://www.fantacalcio.it/serie-a/classifica';
const INFORTUNATI_URL = 'https://www.fantacalcio.it/infortunati-serie-a';

const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'formazioni.json');
const LISTONE_OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'listone.json');
const STATISTICHE_OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'statistiche.json');
const SQUADRE_OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'squadre.json');
const INFORTUNI_OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'infortuni.json');

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
    if (!fs.existsSync(OUTPUT_PATH)) return { partite: {} };
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
// SCRAPING FORMAZIONI
// ============================================================

async function scrapeFormazioni(page) {
  console.log('\n🚀 Navigazione pagina formazioni...');
  const esistenti = leggiFormazioniEsistenti();
  
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  } catch (e) {
    console.log('⚠️ Errore goto formazioni:', e.message);
  }
  
  console.log('✅ Titolo pagina:', await page.title());
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
          const listParent = item.closest('ul');
          
          const nome = nomeEl ? nomeEl.textContent?.trim() : '';
          const percText = percEl ? percEl.textContent?.trim().replace('%', '').trim() : '';
          const perc = parseInt(percText) || 0;
          const isStarter = listParent?.classList.contains('starters') || false;
          
          if (nome) {
            giocatori.push({ nome, perc, starter: isStarter });
          }
        });
        
        return giocatori;
      }
      
      function estraiNomeSquadra(cardEl) {
        const headerEl = cardEl.querySelector('header');
        if (!headerEl) return '';
        return (headerEl.textContent || '').trim().split('\n')[0].trim();
      }
      
      const cardCasa = teamCards[0];
      const cardTrasferta = teamCards[1];
      
      let casaSigla = '';
      let trasfertaSigla = '';
      if (matchHash && matchHash.includes('-')) {
        [casaSigla, trasfertaSigla] = matchHash.split('-');
      }
      
      lista.push({
        matchId, matchHash, casaSigla, trasfertaSigla,
        nomeCasa: estraiNomeSquadra(cardCasa),
        nomeTrasferta: estraiNomeSquadra(cardTrasferta),
        casaGiocatori: estraiGiocatoriDaCard(cardCasa),
        trasfertaGiocatori: estraiGiocatoriDaCard(cardTrasferta),
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
// SCRAPING LISTONE
// ============================================================

async function scrapeListone(page) {
  console.log('\n📋 Recupero listone quotazioni...');
  
  try {
    await page.goto(QUOTAZIONI_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    console.log('✅ Titolo pagina quotazioni:', await page.title());
    await sleep(5000);
    
    await page.evaluate(() => {
      document.querySelectorAll('[class*="qc-cmp"], [id*="qc-cmp"]').forEach(el => el.remove());
    });
    
    console.log('⏳ Scroll per caricare tutti i giocatori...');
    
    let previousCount = 0;
    let attempts = 0;
    while (attempts < 30) {
      const currentCount = await page.evaluate(() => document.querySelectorAll('tr.player-row').length);
      console.log(`  📊 Giocatori caricati: ${currentCount}`);
      if (currentCount === previousCount && attempts > 3) {
        console.log('  ✅ Nessun nuovo giocatore, scroll completato');
        break;
      }
      previousCount = currentCount;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(2000);
      attempts++;
    }
    
    console.log('🔍 Estrazione dati dal listone...');
    
    const listoneData = await page.evaluate(() => {
      const giocatori = [];
      const rows = document.querySelectorAll('tr.player-row');
      
      rows.forEach(row => {
        try {
          let role = '';
          const roleAttr = row.getAttribute('data-filter-role-classic');
          if (roleAttr) role = roleAttr.toUpperCase().trim();
          
          if (!['P', 'D', 'C', 'A'].includes(role)) role = '';
          
          const nameEl = row.querySelector('th.player-name a span');
          const nome = nameEl ? nameEl.textContent?.trim() || '' : '';
          
          const teamEl = row.querySelector('td.player-team');
          const squadra = teamEl ? teamEl.textContent?.trim() || '' : '';
          
          const qiEl = row.querySelector('td.player-classic-initial-price');
          const quotazioneIniziale = parseInt(qiEl?.textContent?.trim() || '0') || 0;
          
          const qaEl = row.querySelector('td.player-classic-current-price');
          const quotazioneAttuale = parseInt(qaEl?.textContent?.trim() || '0') || 0;
          
          const fvmEl = row.querySelector('td.player-classic-fvm');
          const fvm = parseInt(fvmEl?.textContent?.trim() || '0') || 0;
          
          if (nome && squadra) {
            giocatori.push({ nome, squadra, ruolo: role, quotazioneIniziale, quotazioneAttuale, fvm });
          }
        } catch (e) {}
      });
      
      return giocatori;
    });
    
    console.log(`✅ Estratti ${listoneData.length} giocatori dal listone`);
    
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
// SCRAPING STATISTICHE
// ============================================================

async function scrapeStatistiche(page) {
  console.log('\n📊 Recupero statistiche (MV + FM reali)...');
  
  try {
    await page.goto(STATISTICHE_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    console.log('✅ Titolo pagina statistiche:', await page.title());
    console.log('✅ URL statistiche:', page.url());
    await sleep(5000);
    
    await page.evaluate(() => {
      document.querySelectorAll('[class*="qc-cmp"], [id*="qc-cmp"]').forEach(el => el.remove());
    });
    
    console.log('⏳ Scroll per caricare tutti i giocatori...');
    
    let previousCount = 0;
    let attempts = 0;
    while (attempts < 20) {
      const currentCount = await page.evaluate(() => document.querySelectorAll('tr.player-row').length);
      console.log(`  📊 Righe statistiche caricate: ${currentCount}`);
      if (currentCount === previousCount && attempts > 3) {
        console.log('  ✅ Nessun nuovo dato, scroll completato');
        break;
      }
      previousCount = currentCount;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(2000);
      attempts++;
    }
    
    console.log('🔍 Estrazione dati statistiche...');
    
    const statisticheData = await page.evaluate(() => {
      const mappa = {};
      const rows = document.querySelectorAll('tr.player-row');
      
      function parseNumeroItaliano(testo) {
        if (!testo) return 0;
        const clean = testo.replace(',', '.').replace(/[^\d.]/g, '').trim();
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
      }
      
      rows.forEach(row => {
        try {
          const nameEl = row.querySelector('th.player-name a span');
          const nome = nameEl ? nameEl.textContent?.trim() : '';
          if (!nome) return;
          
          const roleAttr = row.getAttribute('data-filter-role-classic') || '';
          const role = roleAttr.toUpperCase().trim();
          
          const teamEl = row.querySelector('td.player-team');
          const squadra = teamEl ? teamEl.textContent?.trim() : '';
          
          const mvEl = row.querySelector('td.player-grade-avg');
          const mediaVoto = parseNumeroItaliano(mvEl?.textContent?.trim());
          
          const fmEl = row.querySelector('td.player-fanta-grade-avg');
          const fantamedia = parseNumeroItaliano(fmEl?.textContent?.trim());
          
          const pgEl = row.querySelector('td.player-match-played');
          const partiteGiocate = parseInt(pgEl?.textContent?.trim() || '0') || 0;
          
          mappa[nome] = { ruolo: role, squadra, mediaVoto, fantamedia, partiteGiocate };
        } catch (e) {}
      });
      
      return mappa;
    });
    
    const numGiocatori = Object.keys(statisticheData).length;
    console.log(`✅ Estratte statistiche per ${numGiocatori} giocatori`);
    
    const output = {
      aggiornato: new Date().toISOString(),
      fonte: 'fantacalcio.it',
      statistiche: statisticheData,
    };
    
    fs.mkdirSync(path.dirname(STATISTICHE_OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(STATISTICHE_OUTPUT_PATH, JSON.stringify(output, null, 2));
    
    console.log(`✅ Statistiche salvate: ${numGiocatori} giocatori in statistiche.json`);
    return statisticheData;
  } catch (e) {
    console.error('❌ Errore scraping statistiche:', e.message);
    return {};
  }
}

// ============================================================
// SCRAPING CLASSIFICA
// ============================================================

async function scrapeClassifica(page) {
  console.log('\n📊 Recupero classifica (punti, gol, forma)...');
  
  try {
    await page.goto(CLASSIFICA_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    console.log('✅ Titolo pagina classifica:', await page.title());
    await sleep(5000);
    
    await page.evaluate(() => {
      document.querySelectorAll('[class*="qc-cmp"], [id*="qc-cmp"]').forEach(el => el.remove());
    });

    const classificaData = await page.evaluate(() => {
      const mappa = {};
      
      let rows = document.querySelectorAll('#classifica table tbody tr');
      if (rows.length === 0) rows = document.querySelectorAll('table.serie-a-table tbody tr');
      if (rows.length === 0) rows = document.querySelectorAll('table tbody tr');
      
      rows.forEach(row => {
        try {
          let squadra = '';
          const teamLink = row.querySelector('a.team-name');
          if (teamLink) {
            squadra = teamLink.textContent?.trim() || '';
          } else {
            squadra = row.getAttribute('data-name') || '';
          }
          if (!squadra) return;
          
          const cells = row.querySelectorAll('td');
          
          const punti = parseInt(row.querySelector('td.points')?.textContent?.trim() || '') || 
                        parseInt(cells[2]?.textContent?.trim() || '') || 0;
          
          const g = parseInt(row.querySelector('td.played')?.textContent?.trim() || '') || 
                    parseInt(cells[3]?.textContent?.trim() || '') || 0;
          
          let gf = 0;
          const gfByClass = row.querySelector('td.goalscored');
          if (gfByClass && gfByClass.textContent?.trim()) {
            gf = parseInt(gfByClass.textContent.trim()) || 0;
          } else if (cells[7] && cells[7].textContent?.trim()) {
            gf = parseInt(cells[7].textContent.trim()) || 0;
          }
          
          let gs = 0;
          const gsByClass = row.querySelector('td.goalsconceded');
          if (gsByClass && gsByClass.textContent?.trim()) {
            gs = parseInt(gsByClass.textContent.trim()) || 0;
          } else if (cells[8] && cells[8].textContent?.trim()) {
            gs = parseInt(cells[8].textContent.trim()) || 0;
          }
          
          const forma = [];
          const formDots = row.querySelectorAll('td.form ul.dot-stripe li');
          formDots.forEach(li => {
            const cls = li.className || '';
            if (cls.includes('status-w')) forma.push('W');
            else if (cls.includes('status-d')) forma.push('D');
            else if (cls.includes('status-l')) forma.push('L');
          });
          
          if (g > 0) {
            mappa[squadra] = { punti, g, gf, gs, forma };
          }
        } catch (e) {}
      });
      
      return mappa;
    });
    
    const numSquadre = Object.keys(classificaData).length;
    console.log(`✅ Estratti dati per ${numSquadre} squadre`);
    
    if (numSquadre > 0) {
      console.log('📊 Esempio primi 5:');
      Object.entries(classificaData).slice(0, 5).forEach(([nome, dati]) => {
        const formaStr = (dati.forma || []).join('-') || 'nessuna';
        console.log(`  - ${nome}: ${dati.punti}pt, G=${dati.g}, GF=${dati.gf}, GS=${dati.gs}, Forma=${formaStr}`);
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
// 🔥 SCRAPING INFORTUNATI
// ============================================================

/**
 * Estrae la data di rientro dalla descrizione testuale.
 * Pattern riconosciuti:
 * - "inizio <mese>" → 01/<mese>
 * - "metà <mese>" / "metà di <mese>" → 15/<mese>
 * - "fine <mese>" / "fine di <mese>" → 30/<mese>
 * - "da <mese>" / "a <mese>" → 01/<mese>
 * - "in settimana" / "da valutare" → "In settimana"
 * - "lungo stop" / "lungodegenza" → "Lungo stop"
 */
function estraiDataRientro(descrizione) {
  const desc = (descrizione || '').toLowerCase();
  
  const mesi = {
    'gennaio': '01', 'febbraio': '02', 'marzo': '03', 'aprile': '04',
    'maggio': '05', 'giugno': '06', 'luglio': '07', 'agosto': '08',
    'settembre': '09', 'ottobre': '10', 'novembre': '11', 'dicembre': '12'
  };
  
  // Prova i pattern con prefisso (ordine di priorità)
  for (const [meseNome, meseNum] of Object.entries(mesi)) {
    const patterns = [
      { regex: new RegExp(`inizio\\s+(?:di\\s+)?${meseNome}`, 'i'), giorno: '01' },
      { regex: new RegExp(`metà\\s+(?:di\\s+)?${meseNome}`, 'i'), giorno: '15' },
      { regex: new RegExp(`fine\\s+(?:di\\s+)?${meseNome}`, 'i'), giorno: '30' },
      { regex: new RegExp(`da\\s+${meseNome}`, 'i'), giorno: '01' },
      { regex: new RegExp(`a\\s+${meseNome}`, 'i'), giorno: '01' },
    ];
    
    for (const { regex, giorno } of patterns) {
      if (regex.test(desc)) {
        return `${giorno}/${meseNum}`;
      }
    }
  }
  
  // Fallback: cerca solo il nome del mese
  for (const [meseNome, meseNum] of Object.entries(mesi)) {
    if (desc.includes(meseNome)) {
      return `01/${meseNum}`;
    }
  }
  
  // Pattern speciali
  if (desc.includes('in settimana') || desc.includes('da valutare') || desc.includes('in dubbio')) {
    return 'In settimana';
  }
  if (desc.includes('lungo stop') || desc.includes('lungodegenza') || desc.includes('lunga assenza')) {
    return 'Lungo stop';
  }
  
  return 'N/D';
}

/**
 * Determina lo stato del giocatore dalla descrizione.
 */
function estraiStato(descrizione) {
  const desc = (descrizione || '').toLowerCase();
  
  if (desc.includes('da valutare') || desc.includes('in settimana') || desc.includes('in dubbio') || desc.includes('ballottaggio')) {
    return 'dubbio';
  }
  if (desc.includes('lungo stop') || desc.includes('lungodegenza') || desc.includes('stagione finita') || desc.includes('operato')) {
    return 'out-lungo';
  }
  return 'out';
}

async function scrapeInfortunati(page) {
  console.log('\n🏥 Recupero lista infortunati...');
  
  try {
    await page.goto(INFORTUNATI_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    console.log('✅ Titolo pagina infortunati:', await page.title());
    await sleep(5000);
    
    await page.evaluate(() => {
      document.querySelectorAll('[class*="qc-cmp"], [id*="qc-cmp"]').forEach(el => el.remove());
    });

    const infortunatiData = await page.evaluate(() => {
      const mappa = {};
      
      // 🔥 Ogni squadra è in un .card.team-card
      const teamCards = document.querySelectorAll('.card.team-card');
      
      console.log(`📊 Trovati ${teamCards.length} blocchi squadra`);
      
      teamCards.forEach(card => {
        try {
          // Nome squadra
          const teamNameEl = card.querySelector('.team-name');
          const squadra = teamNameEl ? teamNameEl.textContent?.trim() : '';
          if (!squadra) return;
          
          // Lista infortunati (ul.unstyled > li)
          const items = card.querySelectorAll('ul.unstyled li');
          
          items.forEach(item => {
            const nomeEl = item.querySelector('strong.item-name');
            const descEl = item.querySelector('.item-description p');
            
            const nome = nomeEl ? nomeEl.textContent?.trim() : '';
            const descrizione = descEl ? descEl.textContent?.trim() : '';
            
            if (nome) {
              mappa[nome] = {
                squadra,
                descrizione,
              };
            }
          });
        } catch (e) {}
      });
      
      return mappa;
    });
    
    const numInfortunati = Object.keys(infortunatiData).length;
    console.log(`✅ Estratti ${numInfortunati} infortunati`);
    
    // 🔥 Arricchisci con stato + data rientro
    const risultato = {};
    Object.entries(infortunatiData).forEach(([nome, dati]) => {
      risultato[nome] = {
        squadra: dati.squadra,
        stato: estraiStato(dati.descrizione),
        rientro: estraiDataRientro(dati.descrizione),
        descrizione: dati.descrizione,
      };
    });
    
    if (numInfortunati > 0) {
      console.log('📊 Esempio primi 5:');
      Object.entries(risultato).slice(0, 5).forEach(([nome, dati]) => {
        console.log(`  - ${nome} (${dati.squadra}): stato=${dati.stato}, rientro=${dati.rientro}`);
      });
    }
    
    const output = {
      aggiornato: new Date().toISOString(),
      fonte: 'fantacalcio.it',
      infortunati: risultato,
    };
    
    fs.mkdirSync(path.dirname(INFORTUNI_OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(INFORTUNI_OUTPUT_PATH, JSON.stringify(output, null, 2));
    
    console.log(`✅ Infortunati salvati: ${numInfortunati} in infortuni.json`);
    
    return risultato;
  } catch (e) {
    console.error('❌ Errore scraping infortunati:', e.message);
    return {};
  }
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
  
  await scrapeFormazioni(page);
  await scrapeListone(page);
  await scrapeStatistiche(page);
  await scrapeClassifica(page);
  await scrapeInfortunati(page);
  
  await browser.close();
  console.log('\n🎉 Tutti gli scraping completati!');
}

main().catch(err => {
  console.error('❌ Errore fatale:', err);
  process.exit(1);
});
