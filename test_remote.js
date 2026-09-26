// test_remote.js - Test completo di apertura remota e funzionamento sottocartelle
const http = require('http');

const LOCAL_IP = '192.168.1.139';
const PORT = 3000;
const BASE_URL = `http://${LOCAL_IP}:${PORT}`;

console.log(`🌐 AVVIO TEST DI APERTURA DA REMOTO SU: ${BASE_URL}\n`);

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
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

async function runRemoteTests() {
  let passed = 0;
  let total = 0;

  function check(desc, condition) {
    total++;
    if (condition) {
      console.log(`  ✅ [${total}] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [${total}] ${desc}`);
      process.exit(1);
    }
  }

  try {
    // 1. Test Home Page (index.html) da IP Remoto
    const home = await request({ host: LOCAL_IP, port: PORT, path: '/', method: 'GET' });
    check('Home page caricata (200 OK)', home.statusCode === 200);
    check('Home page contiene "Marco" ed "Angela"', home.body.includes('Marco') && home.body.includes('Angela'));
    check('Home page NON contiene "Compagna"', !home.body.includes('Compagna'));

    // 2. Test CSS (style.css)
    const css = await request({ host: LOCAL_IP, port: PORT, path: '/style.css', method: 'GET' });
    check('CSS caricato (200 OK)', css.statusCode === 200);
    check('CSS Content-Type corretto', css.headers['content-type'].includes('text/css'));
    check('CSS contiene stili scontrino partner-receipt', css.body.includes('partner-receipt'));

    // 3. Test JS (app.js)
    const js = await request({ host: LOCAL_IP, port: PORT, path: '/app.js', method: 'GET' });
    check('JavaScript caricato (200 OK)', js.statusCode === 200);
    check('JS Content-Type corretto', js.headers['content-type'].includes('application/javascript'));
    check('JS contiene logica 60_40 e turn_rent', js.body.includes('60_40') && js.body.includes('turn_rent'));

    // 4. Test Manifest PWA (manifest.json)
    const manifest = await request({ host: LOCAL_IP, port: PORT, path: '/manifest.json', method: 'GET' });
    check('Manifest PWA caricato (200 OK)', manifest.statusCode === 200);
    const manifestJson = JSON.parse(manifest.body);
    check('Manifest PWA nome corretto', manifestJson.short_name === 'Casa&Spese');

    // 5. Test API Network Info
    const net = await request({ host: LOCAL_IP, port: PORT, path: '/api/network-info', method: 'GET' });
    check('API Network-info risponde (200 OK)', net.statusCode === 200);
    const netJson = JSON.parse(net.body);
    check('IP locale corretto in network info', netJson.localIp === LOCAL_IP);

    // 6. Test API State per Settembre 2026
    const stateRes = await request({ host: LOCAL_IP, port: PORT, path: '/api/state?month=2026-09', method: 'GET' });
    check('API /api/state?month=2026-09 risponde (200 OK)', stateRes.statusCode === 200);
    const stateData = JSON.parse(stateRes.body);

    check('Partner 1 è Marco (2700 €)', stateData.summary.partners.partner1.name === 'Marco' && stateData.summary.partners.partner1.income === 2700);
    check('Partner 2 è Angela (1800 € o 2200 €)', stateData.summary.partners.partner2.name === 'Angela' && (stateData.summary.partners.partner2.income === 1800 || stateData.summary.partners.partner2.income === 2200));
    check('Affitto presente tra le spese', stateData.expenses.some(e => e.category_id === 'affitto' && e.amount === 940));
    check('Bilancio esclude l\'affitto dal confronto spese comuni', stateData.summary.balance.explanation.includes('escluso affitto'));

    // 7. Test Inserimento ed Eliminazione Spesa Remota
    const addRes = await request({
      host: LOCAL_IP,
      port: PORT,
      path: '/api/expenses',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      month: '2026-09',
      date: '2026-09-07',
      title: 'Test Spesa Remota Caffè',
      amount: 4.50,
      category_id: 'ristoranti',
      paid_by: 'partner1',
      split_type: '50_50',
      is_fixed: 0,
      notes: 'Test automatico'
    });
    check('POST /api/expenses crea spesa (201 Created)', addRes.statusCode === 201);
    const addedExp = JSON.parse(addRes.body);
    check('ID spesa valida', addedExp.id > 0);

    // Elimina la spesa di test
    const delRes = await request({ host: LOCAL_IP, port: PORT, path: `/api/expenses/${addedExp.id}`, method: 'DELETE' });
    check('DELETE /api/expenses/:id elimina spesa (200 OK)', delRes.statusCode === 200);

    // 8. Test Copia Spese Fisse su Ottobre 2026
    const copyRes = await request({
      host: LOCAL_IP,
      port: PORT,
      path: '/api/month/copy-fixed',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { month: '2026-10' });
    check('POST /api/month/copy-fixed risponde (200 OK)', copyRes.statusCode === 200);

    // 9. Test API History
    const histRes = await request({ host: LOCAL_IP, port: PORT, path: '/api/history?limit=12', method: 'GET' });
    check('GET /api/history risponde (200 OK)', histRes.statusCode === 200);

    // 10. Test API Categories
    const catRes = await request({ host: LOCAL_IP, port: PORT, path: '/api/categories', method: 'GET' });
    check('GET /api/categories risponde (200 OK)', catRes.statusCode === 200);

    console.log(`\n🎉 TUTTI I ${passed}/${total} TEST DI APERTURA DA REMOTO HANNO AVUTO SUCCESSO!`);
    console.log(`   L'app è accessibile, stabile e reattiva su: ${BASE_URL}\n`);
  } catch (err) {
    console.error('Errore durante i test remoti:', err);
    process.exit(1);
  }
}

runRemoteTests();
