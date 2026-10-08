// test_fixed_pwa.js - Test Suite Completa per PWA, Offline Shell, Link Fisso e Token Cloudflare
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const HOST = '127.0.0.1';

function request(options, postData = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      host: HOST,
      port: PORT,
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

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FALLITO: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ SUPERATO: ${message}`);
  }
}

async function runTests() {
  console.log('🧪 AVVIO TEST COMPLETO PWA, OFFLINE SHELL & LINK FISSO PERMANENTE...\n');

  // --- 1. VERIFICA MANIFEST PWA ---
  console.log('--- 1. Verifica Manifest PWA (manifest.json) ---');
  const mfRes = await request({ path: '/manifest.json', method: 'GET' });
  assert(mfRes.statusCode === 200, 'Manifest risponde con 200 OK');
  assert(mfRes.headers['content-type'].includes('application/manifest+json') || mfRes.headers['content-type'].includes('application/json'), 'Content-Type corretto per manifest');

  const manifest = JSON.parse(mfRes.body);
  assert(manifest.id === 'casa-e-spese-app', 'ID stabile dell\'app presente nel manifest');
  assert(manifest.display === 'standalone', 'Display standalone configurato');
  assert(manifest.theme_color === '#10b981', 'Theme color emerald impostato (#10b981)');
  assert(manifest.background_color === '#0f172a', 'Background color dark (#0f172a)');
  assert(manifest.icons && manifest.icons.length >= 4, `Almeno 4 definizioni icone presenti (${manifest.icons.length})`);
  assert(manifest.icons.some(i => i.sizes === '192x192' && i.purpose === 'maskable'), 'Icona 192x192 maskable presente');
  assert(manifest.icons.some(i => i.sizes === '512x512' && i.purpose === 'maskable'), 'Icona 512x512 maskable presente');
  assert(manifest.icons.some(i => i.sizes === '512x512' && i.purpose === 'any'), 'Icona 512x512 any presente');
  assert(manifest.shortcuts && manifest.shortcuts.length >= 2, 'Scorciatoie rapide (Shortcuts) definite nel manifest');

  // --- 2. VERIFICA FILE ICONE PWA (PNG REALI) ---
  console.log('\n--- 2. Verifica File Icone PWA (PNG Reali) ---');
  const icon192Res = await request({ path: '/icon-192.png', method: 'GET' });
  assert(icon192Res.statusCode === 200, 'icon-192.png servita con 200 OK');
  assert(icon192Res.headers['content-type'] === 'image/png', 'icon-192.png ha MIME image/png');
  assert(icon192Res.body.length > 500, 'icon-192.png dimensione valida');

  const icon512Res = await request({ path: '/icon-512.png', method: 'GET' });
  assert(icon512Res.statusCode === 200, 'icon-512.png servita con 200 OK');
  assert(icon512Res.headers['content-type'] === 'image/png', 'icon-512.png ha MIME image/png');
  assert(icon512Res.body.length > 1000, 'icon-512.png dimensione valida');

  const appleRes = await request({ path: '/apple-touch-icon.png', method: 'GET' });
  assert(appleRes.statusCode === 200, 'apple-touch-icon.png servita con 200 OK');
  assert(appleRes.headers['content-type'] === 'image/png', 'apple-touch-icon.png ha MIME image/png');

  // --- 3. VERIFICA SERVICE WORKER & OFFLINE CACHING STRATEGY ---
  console.log('\n--- 3. Verifica Service Worker & Offline Caching Strategy ---');
  const swRes = await request({ path: '/service-worker.js', method: 'GET' });
  assert(swRes.statusCode === 200, 'service-worker.js servito con 200 OK');
  assert(swRes.headers['service-worker-allowed'] === '/', 'Service-Worker-Allowed header impostato su root /');
  assert(swRes.headers['cache-control'].includes('no-cache'), 'Cache-Control SW impedisce stale cache');
  assert(swRes.body.includes('casa-spese-v3') || swRes.body.includes('casa-spese-v2'), 'Cache name versione PWA presente in SW');
  assert(swRes.body.includes('STATIC_ASSETS'), 'Lista STATIC_ASSETS per pre-caching presente');
  assert(swRes.body.includes('/icon-512.png'), 'icon-512.png incluso nel precaching offline');
  assert(swRes.body.includes('/?source=pwa'), '/?source=pwa incluso nel precaching offline');
  assert(swRes.body.includes('url.pathname === \'/service-worker.js\''), 'Bypass esplicito per /service-worker.js presente');
  assert(swRes.body.includes('/api/events'), 'Bypass esplicito per SSE /api/events nel fetch handler');
  assert(swRes.body.includes('ignoreSearch: true'), 'ignoreSearch abilitato per fallback navigazione offline');
  assert(swRes.body.includes('status: 503'), 'Status 503 Service Unavailable ritornato su fetch API offline');
  assert(swRes.body.includes('SHOW_NOTIFICATION'), 'Handler messaggi notifica presente in SW');
  assert(swRes.body.includes('notificationclick'), 'Handler click su notifica presente');
  assert(swRes.body.includes('push'), 'Handler Web Push presente');

  // --- 4. VERIFICA ENDPOINT DIAGNOSTICA PWA HEALTH ---
  console.log('\n--- 4. Verifica Endpoint /api/pwa-health ---');
  const healthRes = await request({ path: '/api/pwa-health', method: 'GET' });
  assert(healthRes.statusCode === 200, '/api/pwa-health risponde con 200 OK');
  const health = JSON.parse(healthRes.body);
  assert(health.status === 'healthy', 'Stato salute healthy');
  assert(health.pwa.manifest === true, 'PWA Manifest verificato dal server');
  assert(health.pwa.serviceWorker === true, 'PWA ServiceWorker verificato dal server');
  assert(health.pwa.icons.icon192 === true, 'Icona 192 presente su disco');
  assert(health.pwa.icons.icon512 === true, 'Icona 512 presente su disco');
  assert(health.pwa.icons.appleTouchIcon === true, 'Icona Apple Touch presente su disco');
  assert(health.tunnel && health.tunnel.status !== undefined, 'Stato tunnel incluso nel report di salute');

  // --- 5. VERIFICA GESTIONE LINK FISSO PERMANENTE & CONFIG API ---
  console.log('\n--- 5. Verifica API Configurazione Link Fisso (/api/tunnel/config) ---');
  const cfgGetRes = await request({ path: '/api/tunnel/config', method: 'GET' });
  assert(cfgGetRes.statusCode === 200, 'GET /api/tunnel/config risponde con 200 OK');
  const initialCfg = JSON.parse(cfgGetRes.body);
  console.log('   Stato tunnel iniziale:', initialCfg.mode, 'Url:', initialCfg.url, 'isPermanent:', initialCfg.isPermanent);

  // Test salvataggio configurazione URL Fisso con sanitizzazione (senza https e con trailing slash)
  const rawTestUrl = 'spese.famigliamarco.it/sub/';
  const expectedNormalized = 'https://spese.famigliamarco.it/sub';
  const cfgPostRes = await request({
    path: '/api/tunnel/config',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    fixedUrl: rawTestUrl,
    mode: 'custom'
  });
  assert(cfgPostRes.statusCode === 200, 'POST /api/tunnel/config aggiorna con successo');
  const updatedCfg = JSON.parse(cfgPostRes.body);
  assert(updatedCfg.isPermanent === true, 'isPermanent diventa true con fixedUrl configurato');
  assert(updatedCfg.fixedUrl === expectedNormalized, `fixedUrl normalizzato correttamente: ${updatedCfg.fixedUrl}`);

  // Verifica persistenza su file tunnel_config.json
  const configFile = path.join(__dirname, 'tunnel_config.json');
  assert(fs.existsSync(configFile), 'File tunnel_config.json creato');
  const savedOnDisk = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  assert(savedOnDisk.fixedUrl === expectedNormalized, 'fixedUrl persistito su disco');

  // Verifica persistenza su cloudflare_url.txt
  const urlFile = path.join(__dirname, 'cloudflare_url.txt');
  assert(fs.existsSync(urlFile), 'File cloudflare_url.txt aggiornato');
  const savedUrl = fs.readFileSync(urlFile, 'utf8').trim();
  assert(savedUrl === expectedNormalized, 'cloudflare_url.txt aggiornato con URL permanente');

  // Verifica /api/network-info con URL fisso permanente
  const netRes = await request({ path: '/api/network-info', method: 'GET' });
  const net = JSON.parse(netRes.body);
  assert(net.isPermanent === true, 'Network-info riporta isPermanent: true');
  assert(net.tunnelUrl === expectedNormalized, 'Network-info riporta URL fisso permanente');
  assert(net.fixedUrl === expectedNormalized, 'Network-info riporta fixedUrl corrispondente');

  // Test Endpoint /api/tunnel/test con trailing slash
  console.log('\n--- 6. Test Endpoint /api/tunnel/test ---');
  const testReachRes = await request({
    path: '/api/tunnel/test',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    url: `http://${HOST}:${PORT}/` // Con trailing slash
  });
  assert(testReachRes.statusCode === 200, 'POST /api/tunnel/test risponde con 200 OK');
  const reachJson = JSON.parse(testReachRes.body);
  assert(reachJson.success === true, 'Reachability test locale ha avuto successo');
  assert(reachJson.statusCode === 200, 'Reachability status code 200');

  // Test Ripristino modalità quick tunnel
  console.log('\n--- 7. Test Ripristino Quick Tunnel ---');
  const resetRes = await request({
    path: '/api/tunnel/config',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    token: '',
    fixedUrl: '',
    mode: 'quick'
  });
  assert(resetRes.statusCode === 200, 'POST reset quick risponde 200 OK');
  const resetCfg = JSON.parse(resetRes.body);
  assert(resetCfg.isPermanent === false, 'isPermanent è false dopo il reset');
  assert(resetCfg.mode === 'quick', 'mode è quick dopo il reset');
  assert(!resetCfg.fixedUrl, 'fixedUrl è vuoto dopo il reset');
  console.log('   ✅ Configurazione ripristinata a Quick Tunnel per continuità d\'esercizio.');

  // --- 8. VERIFICA HTML & ELEMENTI UI PER ANGELA E MARCO ---
  console.log('\n--- 8. Verifica HTML, Banners PWA & Controlli UI ---');
  const htmlRes = await request({ path: '/', method: 'GET' });
  assert(htmlRes.statusCode === 200, 'Index HTML risponde con 200 OK');
  assert(htmlRes.body.includes('id="pwaInstallBanner"'), 'Banner installazione PWA presente in HTML');
  assert(htmlRes.body.includes('id="btnInstallPwa"'), 'Pulsante "Installa App" presente');
  assert(htmlRes.body.includes('id="offlineIndicator"'), 'Indicatore connettività offline presente');
  assert(htmlRes.body.includes('id="btnShareWhatsApp"'), 'Pulsante condivisione WhatsApp per Angela presente');
  assert(htmlRes.body.includes('id="headerFixedConfigToggle"'), 'Pannello configurazione Link Fisso permanente presente');
  assert(htmlRes.body.includes('id="inputTunnelToken"'), 'Campo inserimento Cloudflare Tunnel Token presente');
  assert(htmlRes.body.includes('id="inputFixedUrl"'), 'Campo inserimento URL Fisso permanente presente');
  assert(htmlRes.body.includes('id="btnResetTunnelConfig"'), 'Pulsante "Ripristina Quick Tunnel" presente in HTML');
  assert(htmlRes.body.includes('apple-mobile-web-app-capable'), 'Meta tag iOS apple-mobile-web-app-capable presente');
  assert(htmlRes.body.includes('rel="manifest"'), 'Link tag manifest.json presente');

  console.log('\n🎉 TUTTI I TEST END-TO-END SU LINK FISSO, TOKEN CLOUDFLARE E PWA COMPLETATI CON SUCCESSO!');
}

runTests().catch(err => {
  console.error('\n❌ ERRORE TEST SUITE PWA & LINK FISSO:', err);
  process.exit(1);
});
