// test_cloud_and_backup.js - Test suite per compatibilità cloud 24/7, Render e Backup/Restore
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const DatabaseManager = require('./database');

console.log('🧪 AVVIO TEST CLOUD 24/7, STORAGE PERSISTENTE E BACKUP/RESTORE...\n');

// 1. Test Storage Info & Custom DB Path
console.log('--- 1. Verifica DatabaseManager Storage & DB_PATH ---');
const testDbPath = path.join(__dirname, 'test_cloud.db');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const db = new DatabaseManager(testDbPath);
const storageInfo = db.getStorageInfo();
assert.strictEqual(storageInfo.filePath, testDbPath, 'filePath corrisponde');
assert(storageInfo.sizeBytes > 0, 'sizeBytes calcolato');
console.log('✅ SUPERATO: Storage info generato correttamente:', storageInfo.storageType);

// 2. Test Export All Data
console.log('\n--- 2. Verifica Export Dati ---');
// Inizializza un mese per avere entrate
db.getMonthlyIncomes('2026-09');
const exportData = db.exportAllData();
assert.strictEqual(exportData.app, 'Casa & Spese', 'App name corretto in export');
assert(exportData.data.settings.length > 0, 'Settings presenti in export');
assert(exportData.data.categories.length > 0, 'Categories presenti in export');
assert(exportData.data.monthly_incomes.length > 0, 'Monthly incomes presenti');
console.log('✅ SUPERATO: Export dati completo generato con successo (categorie: ' + exportData.data.categories.length + ')');

// 3. Test Modifica & Restore
console.log('\n--- 3. Verifica Ripristino Dati (importAllData) ---');
// Aggiungiamo una spesa di test
const testExpense = db.addExpense({
  month: '2026-09',
  date: '2026-09-27',
  title: 'Test Spesa Cloud Backup',
  amount: 99.99,
  category_id: 'spesa',
  paid_by: 'partner1',
  split_type: '60_40'
});
assert.strictEqual(testExpense.title, 'Test Spesa Cloud Backup', 'Spesa creata');

const backupWithExpense = db.exportAllData();
assert(backupWithExpense.data.expenses.some(e => e.title === 'Test Spesa Cloud Backup'), 'Spesa presente nel backup');

// Eliminiamo la spesa
db.deleteExpense(testExpense.id);
assert(!db.getExpenseById(testExpense.id), 'Spesa eliminata');

// Ripristiniamo dal backup
const restoreResult = db.importAllData(backupWithExpense);
assert.strictEqual(restoreResult.success, true, 'Restore riuscito');
const restoredExp = db.getExpenses('2026-09').find(e => e.title === 'Test Spesa Cloud Backup');
assert(restoredExp, 'Spesa ripristinata con successo dopo import');
assert.strictEqual(Number(restoredExp.amount), 99.99, 'Importo ripristinato esattamente a 99.99 €');
console.log('✅ SUPERATO: Restore transazionale completato con successo!');

// Pulizia spesa test
db.deleteExpense(restoredExp.id);
db.close();
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

// 4. Test Simulazione Cloud Render su Server HTTP
console.log('\n--- 4. Verifica Endpoint Server in Modalità Cloud Render ---');
// Avviamo il server in un processo isolato con RENDER=1 e NO_TUNNEL=1
process.env.PORT = '3005';
process.env.NO_TUNNEL = '1';
process.env.RENDER = 'true';
process.env.RENDER_EXTERNAL_URL = 'https://casa-spese.onrender.com';

const server = require('./server');

setTimeout(async () => {
  try {
    // Test GET /api/network-info
    const networkRes = await makeRequest('GET', '/api/network-info');
    assert.strictEqual(networkRes.status, 200, 'network-info risponde 200');
    assert.strictEqual(networkRes.body.mode, 'cloud', 'Mode impostato su cloud');
    assert.strictEqual(networkRes.body.isPermanent, true, 'isPermanent è true');
    assert.strictEqual(networkRes.body.tunnelUrl, 'https://casa-spese.onrender.com', 'tunnelUrl punta a Render HTTPS');
    assert.strictEqual(networkRes.body.mobileUrl, 'https://casa-spese.onrender.com', 'mobileUrl per smartphone punta a Render HTTPS');
    assert.strictEqual(networkRes.body.cloudProvider, 'Render.com', 'Provider identificato come Render.com');
    assert(networkRes.body.storage, 'Storage info presente');
    console.log('✅ SUPERATO: /api/network-info restituisce configurazione Cloud 24/7 permanente!');

    // Test GET /api/backup/download (JSON)
    const backupJsonRes = await makeRequest('GET', '/api/backup/download?format=json');
    assert.strictEqual(backupJsonRes.status, 200, 'backup/download risponde 200');
    assert(backupJsonRes.body.data.settings, 'Backup JSON contiene settings');
    assert(backupJsonRes.body.data.categories, 'Backup JSON contiene categories');
    console.log('✅ SUPERATO: GET /api/backup/download fornisce dump completo JSON!');

    // Test GET /api/backup/info
    const backupInfoRes = await makeRequest('GET', '/api/backup/info');
    assert.strictEqual(backupInfoRes.status, 200, 'backup/info risponde 200');
    assert(backupInfoRes.body.storage, 'Storage info presente');
    console.log('✅ SUPERATO: GET /api/backup/info fornisce diagnostica volume e formati!');

    // Test POST /api/backup/restore
    const restoreApiRes = await makeRequest('POST', '/api/backup/restore', backupJsonRes.body);
    assert.strictEqual(restoreApiRes.status, 200, 'backup/restore risponde 200');
    assert.strictEqual(restoreApiRes.body.success, true, 'restore success true');
    console.log('✅ SUPERATO: POST /api/backup/restore ripristina i dati da API!');

    console.log('\n🎉 TUTTI I TEST CLOUD 24/7, PERSISTENZA E BACKUP SUPERATI AL 100%!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test fallito:', err);
    process.exit(1);
  }
}, 1000);

function makeRequest(method, pathStr, bodyObj = null) {
  return new Promise((resolve, reject) => {
    const dataStr = bodyObj ? JSON.stringify(bodyObj) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3005,
      path: pathStr,
      method,
      headers: {
        'Host': 'casa-spese.onrender.com',
        ...(dataStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(dataStr) } : {})
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (dataStr) req.write(dataStr);
    req.end();
  });
}
