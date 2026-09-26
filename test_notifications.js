// test_notifications.js - Suite di Test Profonda per Notifiche, SSE, Promemoria Affitto e Cloudflare
const http = require('http');
const DatabaseManager = require('./database');
const path = require('path');
const fs = require('fs');

function request(options, postData = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...headers
      }
    };
    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function run() {
  console.log('🧪 AVVIO VERIFICA PROFONDA NOTIFICHE, SSE, AFFITTO & TUNNEL');

  // 1. Check service-worker.js
  console.log('\n--- 1. Verifica Service Worker ---');
  const swRes = await request({ host: '127.0.0.1', port: 3000, path: '/service-worker.js', method: 'GET' });
  console.log('   Status:', swRes.statusCode);
  if (swRes.statusCode !== 200) throw new Error('SW not 200');
  if (swRes.headers['service-worker-allowed'] !== '/') throw new Error('Service-Worker-Allowed header mancante');
  if (!swRes.headers['content-type'].includes('application/javascript')) throw new Error('Content-Type SW errato');
  if (!swRes.body.includes('SHOW_NOTIFICATION')) throw new Error('SW privo di handler SHOW_NOTIFICATION');
  if (!swRes.body.includes('notificationclick')) throw new Error('SW privo di handler notificationclick');
  if (!swRes.body.includes('push')) throw new Error('SW privo di handler push');
  console.log('   ✅ Service Worker verificato con successo (headers, push, notificationclick)!');

  // 2. Connessione SSE e verifica sync iniziale
  console.log('\n--- 2. Verifica SSE Stream & Sync Iniziale ---');
  let sseEvents = [];
  const sseReq = http.request({
    host: '127.0.0.1',
    port: 3000,
    path: '/api/events?clientId=test_client_alpha',
    method: 'GET'
  }, (res) => {
    if (res.statusCode !== 200) throw new Error('SSE status ' + res.statusCode);
    if (!res.headers['content-type'].includes('text/event-stream')) throw new Error('SSE invalid content type');
    if (res.headers['x-accel-buffering'] !== 'no') throw new Error('SSE manca X-Accel-Buffering: no');

    res.on('data', chunk => {
      const text = chunk.toString();
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            sseEvents.push(parsed);
          } catch (e) {}
        }
      }
    });
  });
  sseReq.on('error', (e) => console.warn('SSE req error:', e.message));
  sseReq.end();

  // Attendi connessione e ricezione evento iniziale di sync
  await new Promise(r => setTimeout(r, 600));
  const initTunnelEvent = sseEvents.find(e => e.type === 'TUNNEL_UPDATED');
  if (!initTunnelEvent) throw new Error('SSE non ha inviato TUNNEL_UPDATED all\'apertura connessione!');
  console.log('   ✅ Evento sync iniziale ricevuto:', initTunnelEvent.type, 'status:', initTunnelEvent.data.tunnelStatus);

  // 3. Test API /api/notifications/test
  console.log('\n--- 3. Test Broadcast Notifica di Prova ---');
  const testNotifRes = await request({
    host: '127.0.0.1',
    port: 3000,
    path: '/api/notifications/test',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client-Id': 'test_client_alpha' }
  });
  if (testNotifRes.statusCode !== 200) throw new Error('Test notif endpoint failed');
  await new Promise(r => setTimeout(r, 500));

  const testNotifEvent = sseEvents.find(e => e.type === 'TEST_NOTIFICATION');
  if (!testNotifEvent) throw new Error('SSE non ha ricevuto TEST_NOTIFICATION broadcast!');
  if (testNotifEvent.senderClientId !== 'test_client_alpha') throw new Error('senderClientId mancante in TEST_NOTIFICATION');
  console.log('   ✅ TEST_NOTIFICATION broadcast ricevuto con senderClientId corretto!');

  // 4. Test API /api/notifications/rent-reminder
  console.log('\n--- 4. Test Promemoria Affitto (/api/notifications/rent-reminder) ---');
  const rentNotifRes = await request({
    host: '127.0.0.1',
    port: 3000,
    path: '/api/notifications/rent-reminder',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client-Id': 'test_client_beta' }
  });
  if (rentNotifRes.statusCode !== 200) throw new Error('Rent reminder endpoint fallito');
  const rentJson = JSON.parse(rentNotifRes.body);
  console.log('   Esito rent-reminder:', rentJson.notification.title);
  if (!rentJson.rent || rentJson.rent.dueDay !== 5) throw new Error('Struttura rent non valida');

  await new Promise(r => setTimeout(r, 500));
  const rentEvent = sseEvents.find(e => e.type === 'RENT_REMINDER');
  if (!rentEvent) throw new Error('SSE non ha ricevuto RENT_REMINDER!');
  if (rentEvent.senderClientId !== 'test_client_beta') throw new Error('senderClientId errato in RENT_REMINDER');
  console.log('   ✅ RENT_REMINDER broadcast ricevuto via SSE!');

  // 5. Test Spesa con Alert Tetto Spesa Cibo Superato
  console.log('\n--- 5. Test Alert Superamento Tetto Spesa Cibo ---');
  const addExpRes = await request({
    host: '127.0.0.1',
    port: 3000,
    path: '/api/expenses',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client-Id': 'test_client_gamma' }
  }, {
    month: '2026-09',
    date: '2026-09-26',
    title: 'Spesa Maxi Supermercato Test',
    amount: 500.00, // Supera ampiamente il budget cibo (limite 400 €)
    category_id: 'spesa',
    paid_by: 'partner2',
    split_type: '60_40'
  });
  if (addExpRes.statusCode !== 201) throw new Error('Inserimento spesa fallito: ' + addExpRes.statusCode);
  const createdExp = JSON.parse(addExpRes.body);

  await new Promise(r => setTimeout(r, 500));
  const expAddedEvent = sseEvents.find(e => e.type === 'EXPENSE_ADDED' && e.data.expense.id === createdExp.id);
  if (!expAddedEvent) throw new Error('SSE non ha ricevuto EXPENSE_ADDED!');
  if (!expAddedEvent.data.budgetAlert) throw new Error('Manca budgetAlert nell\'evento EXPENSE_ADDED con tetto superato!');
  console.log('   ✅ budgetAlert generato con successo:', expAddedEvent.data.budgetAlert.title);

  // Pulizia spesa di test
  await request({
    host: '127.0.0.1',
    port: 3000,
    path: `/api/expenses/${createdExp.id}`,
    method: 'DELETE',
    headers: { 'X-Client-Id': 'test_client_gamma' }
  });
  console.log('   ✅ Spesa di test eliminata.');

  // Chiudi la connessione SSE
  sseReq.destroy();

  // 6. Test reale di calculateMonthSummary per la logica dell'affitto nel Database
  console.log('\n--- 6. Verifica Logica Affitto Reale nel Database ---');
  const testDbFile = path.join(__dirname, 'test_rent_db.db');
  if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);
  const db = new DatabaseManager(testDbFile);

  // Test mese senza affitto registrato (es. 2026-11)
  const sumNov = db.calculateMonthSummary('2026-11');
  if (sumNov.rent.isPaid !== false) throw new Error('Affitto Novembre dovrebbe essere non pagato');
  if (sumNov.rent.amount !== 940) throw new Error('Importo affitto non 940 €');
  if (sumNov.rent.dueDay !== 5) throw new Error('Giorno scadenza non 5');
  if (sumNov.rent.expectedPayer !== 'partner1') throw new Error('Novembre dovrebbe essere a turno Marco (p1)');
  console.log('   ✅ Novembre 2026 (non pagato):', sumNov.rent.expectedPayerName, sumNov.rent.status, sumNov.rent.amount, '€');

  // Aggiungi affitto a Novembre
  db.addExpense({
    month: '2026-11',
    date: '2026-11-02',
    title: 'Affitto Novembre',
    amount: 940.00,
    category_id: 'affitto',
    paid_by: 'partner1',
    split_type: 'turn_rent',
    is_fixed: 1
  });

  const sumNovPaid = db.calculateMonthSummary('2026-11');
  if (sumNovPaid.rent.isPaid !== true) throw new Error('Affitto Novembre ora dovrebbe essere pagato');
  if (sumNovPaid.rent.status !== 'PAID') throw new Error('Stato affitto dovrebbe essere PAID');
  console.log('   ✅ Novembre 2026 (pagato):', sumNovPaid.rent.status, 'da', sumNovPaid.rent.paidByName);

  db.close();
  if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);

  // 7. Test network-info e stato tunnel
  console.log('\n--- 7. Verifica Network Info & Cloudflare ---');
  const netRes = await request({ host: '127.0.0.1', port: 3000, path: '/api/network-info', method: 'GET' });
  const netJson = JSON.parse(netRes.body);
  console.log('   Local IP:', netJson.localIp);
  console.log('   Mobile URL (Wi-Fi):', netJson.mobileUrl);
  console.log('   Tunnel Status:', netJson.tunnelStatus);
  console.log('   Tunnel URL:', netJson.tunnelUrl || '(in connessione)');
  if (netJson.tunnelAvailable !== true) throw new Error('cloudflared.exe non rilevato');

  console.log('\n🎉 TUTTI I TEST APPROFONDITI DI NOTIFICHE, AFFITTO, SSE E TUNNEL SONO STATI SUPERATI CON SUCCESSO!');
}

run().catch(err => {
  console.error('\n❌ ERRORE TEST NOTIFICHE:', err);
  process.exit(1);
});
