// test_cdp_real_browser.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const tempProfile = path.join(process.env.TEMP || 'C:\\temp', 'chrome_cdp_test_' + Date.now());
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  console.log('====================================================');
  console.log('🧪 TEST AUTOMATIZZATO REALE END-TO-END (CHROME CDP)');
  console.log('====================================================\n');

  console.log('1. Avvio istanza reale di Google Chrome (headless)...');
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${tempProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=390,844', // Dimensioni reali smartphone (iPhone 14 / modern Android)
    'http://localhost:3000'
  ], { stdio: 'ignore' });

  // Attendi che Chrome sia pronto
  let versionData = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/list');
      if (res.ok) {
        versionData = await res.json();
        if (versionData && versionData.length > 0) break;
      }
    } catch (e) {}
    await sleep(500);
  }

  if (!versionData || versionData.length === 0) {
    console.error('❌ Chrome non ha risposto sulla porta 9222!');
    chromeProc.kill();
    process.exit(1);
  }

  const pageTarget = versionData.find(t => t.type === 'page') || versionData[0];
  console.log('✅ Connesso al browser Chrome target:', pageTarget.url);

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let msgId = 1;
  const callbacks = new Map();

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      callbacks.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  const consoleLogs = [];
  const exceptions = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      const { resolve, reject } = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
      consoleLogs.push(`[CONSOLE ${msg.params.type}] ${text}`);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const desc = msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text;
      exceptions.push(desc);
      console.error(`❌ [BROWSER EXCEPTION]`, desc);
    }
  };

  await new Promise(resolve => ws.onopen = resolve);

  console.log('2. Abilitazione domini CDP (Page, Runtime, Console)...');
  await sendCommand('Page.enable');
  await sendCommand('Runtime.enable');
  await sendCommand('Console.enable');

  // Helper per leggere lo stato DOM
  async function getDomState() {
    const res = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const month = document.getElementById('monthNameText')?.textContent + ' ' + document.getElementById('monthYearText')?.textContent;
        const count = document.getElementById('expenseCountBadge')?.textContent;
        const total = document.getElementById('totalExpensesDisplay')?.textContent;
        const p1Savings = document.getElementById('partner1SavingsDisplay')?.textContent;
        const p2Savings = document.getElementById('partner2SavingsDisplay')?.textContent;
        const empty = !!document.querySelector('.empty-state');
        const items = Array.from(document.querySelectorAll('.expense-row-card')).map(card => ({
          id: card.dataset.id,
          title: card.querySelector('.expense-title-text span')?.textContent,
          amount: card.querySelector('.expense-amount-badge')?.textContent
        }));
        return { month, count, total, p1Savings, p2Savings, empty, itemsCount: items.length, items };
      })()`,
      returnByValue: true
    });
    return res.result.value;
  }

  // Attendi che l'applicazione completi il caricamento iniziale e l'API /api/state
  let initial = null;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    initial = await getDomState();
    if (initial && !initial.empty && initial.itemsCount > 0 && initial.total !== '0,00 €') {
      break;
    }
  }

  // --- TEST STEP 1: VERIFICA CARICAMENTO INIZIALE ---
  console.log('\n--- PASSO 1: VERIFICA CARICAMENTO INIZIALE APP ---');
  if (!initial) initial = await getDomState();
  console.log('Mese visualizzato:', initial.month);
  console.log('Totale spese:', initial.total);
  console.log('Numero spese:', initial.itemsCount);
  if (initial.empty) throw new Error('ERRORE: La lista spese è vuota al caricamento iniziale!');
  console.log('✅ Passo 1 superato con successo.');

  // --- TEST STEP 2: INSERIMENTO SPESA 1 (Spesa Alimentare 60/40) ---
  console.log('\n--- PASSO 2: INSERIMENTO SPESA REALE 1 (Supermercato 60/40) ---');
  await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      document.getElementById('btnOpenNewExpenseModal').click();
      document.getElementById('expenseTitle').value = 'Spesa Coop Settimanale';
      document.getElementById('expenseAmount').value = '84.50';
      document.getElementById('expenseCategory').value = 'spesa';
      document.getElementById('expenseNotes').value = 'Verdura, pasta e latte';
      const p1Radio = document.querySelector('input[name="paidBy"][value="partner1"]');
      if (p1Radio) p1Radio.checked = true;
      const splitRadio = document.querySelector('input[name="splitType"][value="60_40"]');
      if (splitRadio) splitRadio.checked = true;
      document.getElementById('expenseForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()`
  });
  await sleep(1500);

  const afterAdd1 = await getDomState();
  console.log('Totale dopo inserimento 1:', afterAdd1.total, `(${afterAdd1.itemsCount} spese)`);
  const found1 = afterAdd1.items.find(i => i.title === 'Spesa Coop Settimanale');
  if (!found1) throw new Error('ERRORE: Spesa Coop Settimanale non trovata nel DOM dopo inserimento!');
  console.log('✅ Spesa Coop trovata con ID:', found1.id);

  // --- TEST STEP 3: RICARICA DELLA PAGINA (F5 / PULL-TO-REFRESH) ---
  console.log('\n--- PASSO 3: RICARICA BROWSER (Page.reload) E TEST PERSISTENZA ---');
  await sendCommand('Page.reload', { ignoreCache: false });
  await sleep(2500);

  const afterReload1 = await getDomState();
  console.log('Totale dopo ricarica F5:', afterReload1.total, `(${afterReload1.itemsCount} spese)`);
  const foundAfterReload1 = afterReload1.items.find(i => i.id === found1.id);
  if (!foundAfterReload1) throw new Error('ERRORE CRITICO: La spesa è scomparsa dopo il reload della pagina web!');
  console.log('✅ PERSISTENZA VERIFICATA AL 100%: La spesa inserita è presente intatta dopo il reload!');

  // --- TEST STEP 4: INSERIMENTO SECONDA SPESA DA ANGELA (100% P2) ---
  console.log('\n--- PASSO 4: INSERIMENTO SECONDA SPESA (Angela, Pizzeria Asporto) ---');
  await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      document.getElementById('btnOpenNewExpenseModal').click();
      document.getElementById('expenseTitle').value = 'Pizzeria Napoletana';
      document.getElementById('expenseAmount').value = '32.00';
      document.getElementById('expenseCategory').value = 'ristoranti';
      document.getElementById('expenseNotes').value = 'Sabato sera';
      const p2Radio = document.querySelector('input[name="paidBy"][value="partner2"]');
      if (p2Radio) p2Radio.checked = true;
      const splitRadio = document.querySelector('input[name="splitType"][value="100_p2"]');
      if (splitRadio) splitRadio.checked = true;
      document.getElementById('expenseForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()`
  });
  await sleep(1500);

  const afterAdd2 = await getDomState();
  const found2 = afterAdd2.items.find(i => i.title === 'Pizzeria Napoletana');
  if (!found2) throw new Error('ERRORE: Pizzeria Napoletana non trovata nel DOM!');
  console.log('✅ Spesa Pizzeria aggiunta con ID:', found2.id);

  // Seconda ricarica browser
  console.log('Seconda ricarica browser (Page.reload)...');
  await sendCommand('Page.reload', { ignoreCache: false });
  await sleep(2500);

  const afterReload2 = await getDomState();
  if (!afterReload2.items.find(i => i.id === found1.id) || !afterReload2.items.find(i => i.id === found2.id)) {
    throw new Error('ERRORE CRITICO: Una o più spese sono andate perse al secondo reload!');
  }
  console.log('✅ ENTRAMBE LE SPESE PERSISTONO DOPO IL SECONDO RELOAD!');

  // --- TEST STEP 5: TEST CAMBIO MESE (Settembre) E RICARICA ---
  console.log('\n--- PASSO 5: NAVIGAZIONE MESE E RICARICA CON PERSISTENZA LOCALSTORAGE ---');
  await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      document.getElementById('btnPrevMonth').click();
    })()`
  });
  await sleep(1500);

  const septState = await getDomState();
  console.log('Mese corrente dopo click indietro:', septState.month, `(${septState.itemsCount} spese)`);
  if (!septState.month.includes('Settembre')) throw new Error('ERRORE: Mese non cambiato a Settembre!');

  // Ricarica la pagina mentre siamo su Settembre
  console.log('Ricarica pagina mentre si visualizza Settembre...');
  await sendCommand('Page.reload', { ignoreCache: false });
  await sleep(2500);

  const septStateReload = await getDomState();
  console.log('Mese corrente dopo ricarica:', septStateReload.month, `(${septStateReload.itemsCount} spese)`);
  if (!septStateReload.month.includes('Settembre')) {
    throw new Error('ERRORE: Il mese visualizzato non è stato preservato su Settembre dopo il reload!');
  }
  if (septStateReload.itemsCount === 0) {
    throw new Error('ERRORE: Le spese di Settembre si sono azzerate dopo il reload!');
  }
  console.log('✅ PERSISTENZA MESE E SPESE VERIFICATA PER SETTEMBRE!');

  // Ritorna a Ottobre
  await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      document.getElementById('btnCurrentMonth').click();
    })()`
  });
  await sleep(1500);

  // --- TEST STEP 6: VERIFICA MODIFICA STIPENDI & RICALCOLO SCHERMATA IN TEMPO REALE ---
  console.log('\n--- PASSO 6: VERIFICA MODIFICA STIPENDI & RICALCOLO SCHERMATA IN TEMPO REALE ---');
  
  // 6.1 Modifica tramite modale stipendi
  console.log('Modifica stipendi tramite modale generale (Marco: 3000 €, Angela: 2400 €)...');
  await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      document.getElementById('btnEditIncomes').click();
      document.getElementById('inputIncomeP1').value = '3000';
      document.getElementById('inputIncomeP2').value = '2400';
      document.getElementById('incomesForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()`
  });
  await sleep(1500);

  let curDom = await sendCommand('Runtime.evaluate', {
    expression: `(() => ({
      total: document.getElementById('totalIncomeDisplay')?.textContent,
      breakdown: document.getElementById('incomesBreakdownText')?.textContent,
      p1Ratio: document.getElementById('partner1RatioDisplay')?.textContent,
      p2Ratio: document.getElementById('partner2RatioDisplay')?.textContent,
      p1Base: document.getElementById('partner1BaseIncomeDisplay')?.textContent,
      p2Base: document.getElementById('partner2BaseIncomeDisplay')?.textContent,
      p1Savings: document.getElementById('partner1SavingsDisplay')?.textContent,
      p2Savings: document.getElementById('partner2SavingsDisplay')?.textContent
    }))()`,
    returnByValue: true
  });
  console.log('Valori a schermo dopo modale generale:', curDom.result.value);
  if (!curDom.result.value.total.includes('5400') && !curDom.result.value.total.includes('5.400')) {
    throw new Error('ERRORE: Totale entrate non aggiornato a 5.400 € a schermo!');
  }
  if (!curDom.result.value.p1Base.includes('3000') && !curDom.result.value.p1Base.includes('3.000')) {
    throw new Error('ERRORE: Stipendio iniziale Marco non aggiornato a 3.000 € a schermo!');
  }
  if (!curDom.result.value.p2Base.includes('2400') && !curDom.result.value.p2Base.includes('2.400')) {
    throw new Error('ERRORE: Stipendio iniziale Angela non aggiornato a 2.400 € a schermo!');
  }
  console.log('✅ Modale generale aggiorna tutte le card e scontrini a schermo immediatamente.');

  // 6.2 Modifica tramite click diretto su riga stipendio Marco con valore decimale (2850.50 €)
  console.log('Modifica stipendio tramite click su riga Marco (2850.50 € con decimali)...');
  await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      document.getElementById('partner1BaseIncomeRow').click();
      document.getElementById('inputIncomeP1').value = '2850.50';
      document.getElementById('incomesForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()`
  });
  await sleep(1500);

  curDom = await sendCommand('Runtime.evaluate', {
    expression: `(() => ({
      total: document.getElementById('totalIncomeDisplay')?.textContent,
      p1Ratio: document.getElementById('partner1RatioDisplay')?.textContent,
      p1Base: document.getElementById('partner1BaseIncomeDisplay')?.textContent
    }))()`,
    returnByValue: true
  });
  console.log('Stipendio Marco aggiornato a schermo:', curDom.result.value);
  if (!curDom.result.value.p1Base.includes('2850,50') && !curDom.result.value.p1Base.includes('2.850,50')) {
    throw new Error('ERRORE: Stipendio decimale Marco non aggiornato a 2.850,50 € a schermo!');
  }
  console.log('✅ Click diretto su riga stipendio Marco con decimali aggiorna lo schermo con successo.');

  // 6.3 Modifica tramite click diretto su riga stipendio Angela con valore decimale (2149.50 €)
  console.log('Modifica stipendio tramite click su riga Angela (2149.50 € con decimali)...');
  await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      document.getElementById('partner2BaseIncomeRow').click();
      document.getElementById('inputIncomeP2').value = '2149.50';
      document.getElementById('incomesForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()`
  });
  await sleep(1500);

  curDom = await sendCommand('Runtime.evaluate', {
    expression: `(() => ({
      total: document.getElementById('totalIncomeDisplay')?.textContent,
      p2Ratio: document.getElementById('partner2RatioDisplay')?.textContent,
      p2Base: document.getElementById('partner2BaseIncomeDisplay')?.textContent
    }))()`,
    returnByValue: true
  });
  console.log('Stipendio Angela aggiornato a schermo:', curDom.result.value);
  if (!curDom.result.value.p2Base.includes('2149,50') && !curDom.result.value.p2Base.includes('2.149,50')) {
    throw new Error('ERRORE: Stipendio decimale Angela non aggiornato a 2.149,50 € a schermo!');
  }
  if (!curDom.result.value.total.includes('5000') && !curDom.result.value.total.includes('5.000')) {
    throw new Error('ERRORE: Somma stipendi decimali non aggiornata a 5.000,00 €!');
  }
  console.log('✅ Click diretto su riga stipendio Angela con decimali aggiorna lo schermo con successo.');

  // 6.4 Modifica tramite modale Impostazioni (Base default: Marco 2700 €, Angela 2200 €)
  console.log('Modifica stipendi base tramite modale Impostazioni (Marco: 2700 €, Angela: 2200 €)...');
  await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      document.getElementById('btnOpenSettings').click();
      document.getElementById('settingDefIncomeP1').value = '2700';
      document.getElementById('settingDefIncomeP2').value = '2200';
      document.getElementById('settingsForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()`
  });
  await sleep(1500);

  curDom = await sendCommand('Runtime.evaluate', {
    expression: `(() => ({
      total: document.getElementById('totalIncomeDisplay')?.textContent,
      p1Ratio: document.getElementById('partner1RatioDisplay')?.textContent,
      p2Ratio: document.getElementById('partner2RatioDisplay')?.textContent,
      p1Base: document.getElementById('partner1BaseIncomeDisplay')?.textContent,
      p2Base: document.getElementById('partner2BaseIncomeDisplay')?.textContent
    }))()`,
    returnByValue: true
  });
  console.log('Totale entrate dopo impostazioni:', curDom.result.value.total);
  if (!curDom.result.value.total.includes('4900') && !curDom.result.value.total.includes('4.900')) {
    throw new Error('ERRORE: Le impostazioni non hanno aggiornato il totale entrate a 4.900 €!');
  }
  if (!curDom.result.value.p1Base.includes('2700') && !curDom.result.value.p1Base.includes('2.700')) {
    throw new Error('ERRORE: Base Marco non tornata a 2.700 €!');
  }
  console.log('✅ Modale Impostazioni aggiorna la schermata istantaneamente.');

  // 6.5 Persistenza dopo reload della pagina (F5)
  console.log('Ricarica pagina (Page.reload) per testare persistenza definitiva...');
  await sendCommand('Page.reload', { ignoreCache: false });
  await sleep(2500);

  const afterSalaryReload = await sendCommand('Runtime.evaluate', {
    expression: `(() => ({
      total: document.getElementById('totalIncomeDisplay')?.textContent,
      p1Ratio: document.getElementById('partner1RatioDisplay')?.textContent,
      p2Ratio: document.getElementById('partner2RatioDisplay')?.textContent,
      p1Base: document.getElementById('partner1BaseIncomeDisplay')?.textContent,
      p2Base: document.getElementById('partner2BaseIncomeDisplay')?.textContent,
      p1Savings: document.getElementById('partner1SavingsDisplay')?.textContent,
      p2Savings: document.getElementById('partner2SavingsDisplay')?.textContent
    }))()`,
    returnByValue: true
  });
  console.log('Valori a schermo dopo reload:', afterSalaryReload.result.value);
  if (!afterSalaryReload.result.value.total.includes('4900') && !afterSalaryReload.result.value.total.includes('4.900')) {
    throw new Error('ERRORE: I valori degli stipendi non persistono dopo il reload!');
  }
  if (!afterSalaryReload.result.value.p1Base.includes('2700') && !afterSalaryReload.result.value.p1Base.includes('2.700')) {
    throw new Error('ERRORE: Stipendio Marco non persiste a 2.700 € dopo il reload!');
  }
  console.log('✅ PERSISTENZA STIPENDI & RICALCOLI VERIFICATA AL 100%!');

  // 6.6 Verifica protezione mesi passati (Settembre deve aver conservato i suoi valori storici)
  console.log('Controllo integrità storico: navigazione a Settembre 2026...');
  await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      document.getElementById('btnPrevMonth').click();
    })()`
  });
  await sleep(1500);

  const septCheck = await sendCommand('Runtime.evaluate', {
    expression: `(() => ({
      month: document.getElementById('monthNameText')?.textContent,
      total: document.getElementById('totalIncomeDisplay')?.textContent,
      p1Base: document.getElementById('partner1BaseIncomeDisplay')?.textContent,
      p2Base: document.getElementById('partner2BaseIncomeDisplay')?.textContent
    }))()`,
    returnByValue: true
  });
  console.log('Stato Settembre 2026:', septCheck.result.value);
  if (!septCheck.result.value.p1Base.includes('2700') && !septCheck.result.value.p1Base.includes('2.700')) {
    throw new Error('ERRORE: Lo stipendio storico di Marco in Settembre è stato corrotto!');
  }
  if (!septCheck.result.value.p2Base.includes('1800') && !septCheck.result.value.p2Base.includes('1.800')) {
    throw new Error('ERRORE: Lo stipendio storico di Angela (1.800 €) in Settembre è stato sovrascritto!');
  }
  console.log('✅ INTEGRITÀ STORICA DEI MESI PASSATI PROTETTA AL 100%!');

  // Torna ad Ottobre
  await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      document.getElementById('btnCurrentMonth').click();
    })()`
  });
  await sleep(1500);

  // --- TEST STEP 7: VERIFICA ERRORI JAVASCRIPT ---
  console.log('\n--- PASSO 7: VERIFICA ECCEZIONI CONSOLE BROWSER ---');
  if (exceptions.length > 0) {
    throw new Error(`Rilevate ${exceptions.length} eccezioni JavaScript: ` + exceptions.join('; '));
  }
  console.log('✅ ZERO errori o eccezioni JavaScript nel browser.');

  // Pulizia
  ws.close();
  chromeProc.kill();
  try {
    fs.rmSync(tempProfile, { recursive: true, force: true });
  } catch (e) {}

  console.log('\n====================================================');
  console.log('🎉 TUTTI I TEST END-TO-END SONO STATI SUPERATI AL 100%!');
  console.log('====================================================\n');
}

run().catch(err => {
  console.error('\n❌ TEST FALLITO:', err.message);
  process.exit(1);
});
