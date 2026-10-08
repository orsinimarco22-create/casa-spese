// server.js - Server HTTP & Real-time SSE per Gestione Spese di Coppia
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
const DatabaseManager = require('./database');
const CloudflareTunnelManager = require('./tunnel');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Ascolta su tutte le interfacce per permettere l'accesso da smartphone su Wi-Fi
const PUBLIC_DIR = path.join(__dirname, 'public');

const db = new DatabaseManager();

// Elenco dei client SSE connessi in tempo reale
const sseClients = new Set();

function broadcastEvent(type, data = {}, senderClientId = null) {
  const payload = `data: ${JSON.stringify({ type, data, senderClientId, timestamp: Date.now() })}\n\n`;
  for (const client of sseClients) {
    try {
      if (!client.writableEnded && !client.destroyed) {
        client.write(payload, (err) => {
          if (err) sseClients.delete(client);
        });
      } else {
        sseClients.delete(client);
      }
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// Heartbeat periodico per mantenere attiva la connessione SSE attraverso Cloudflare (timeout 100s) e router NAT
const sseHeartbeat = setInterval(() => {
  for (const client of sseClients) {
    try {
      if (!client.writableEnded && !client.destroyed) {
        client.write(': ping\n\n', (err) => {
          if (err) sseClients.delete(client);
        });
      } else {
        sseClients.delete(client);
      }
    } catch (e) {
      sseClients.delete(client);
    }
  }
}, 20000);
sseHeartbeat.unref();

// Inizializza il gestore del tunnel Cloudflare (supporta Named Tunnel fisso e Quick Tunnel)
const tunnel = new CloudflareTunnelManager({
  port: PORT,
  onUrl: (url) => {
    const cur = tunnel.getStatus();
    broadcastEvent('TUNNEL_UPDATED', {
      tunnelUrl: url,
      tunnelStatus: cur.status,
      isPermanent: cur.isPermanent,
      mode: cur.mode,
      lastError: cur.lastError,
      fallbackToQuick: cur.fallbackToQuick
    });
  },
  onStatus: (status, url) => {
    const cur = tunnel.getStatus();
    broadcastEvent('TUNNEL_UPDATED', {
      tunnelUrl: url,
      tunnelStatus: status,
      isPermanent: cur.isPermanent,
      mode: cur.mode,
      lastError: cur.lastError,
      fallbackToQuick: cur.fallbackToQuick
    });
  }
});

// Trova l'indirizzo IP locale (es. 192.168.1.X) per l'accesso da smartphone
function getLocalNetworkIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // Cerca IPv4 non interno (127.0.0.1)
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Utility per leggere body JSON
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 2 * 1024 * 1024) { // Limite 2MB
        reject(new Error('Body payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Client-Id'
  });
  res.end(JSON.stringify(data));
}

// Mime types per i file statici
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

function serveStaticFile(res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const headers = {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    };
    if (filePath.endsWith('manifest.json')) {
      headers['Content-Type'] = 'application/manifest+json; charset=utf-8';
    }
    if (filePath.endsWith('service-worker.js')) {
      headers['Content-Type'] = 'application/javascript; charset=utf-8';
      headers['Service-Worker-Allowed'] = '/';
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    }

    res.writeHead(200, headers);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || `localhost:${PORT}`;
  const parsedUrl = new URL(req.url, `http://${host}`);
  const pathname = (parsedUrl.pathname || '/').replace(/\/+/g, '/');
  parsedUrl.query = Object.fromEntries(parsedUrl.searchParams.entries());
  const method = req.method;

  // Gestione CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Client-Id'
    });
    res.end();
    return;
  }

  // Identificativo client richiedente per evitare self-notification
  const requestClientId = req.headers['x-client-id'] || parsedUrl.query.clientId || null;

  // --- 1. SERVER-SENT EVENTS (SSE) STREAM ---
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('retry: 3000\n\n: heartbeat\n\n');

    // Invia subito lo stato corrente del tunnel al client che si collega
    const curStatus = tunnel.getStatus();
    res.write(`data: ${JSON.stringify({ type: 'TUNNEL_UPDATED', data: { tunnelUrl: curStatus.url, tunnelStatus: curStatus.status, isPermanent: curStatus.isPermanent, mode: curStatus.mode, lastError: curStatus.lastError, fallbackToQuick: curStatus.fallbackToQuick }, timestamp: Date.now() })}\n\n`);

    sseClients.add(res);

    const cleanup = () => {
      sseClients.delete(res);
    };

    req.on('close', cleanup);
    req.on('end', cleanup);
    req.on('error', cleanup);
    res.on('close', cleanup);
    res.on('finish', cleanup);
    res.on('error', cleanup);
    return;
  }

  // --- 2. API ENDPOINTS ---
  try {
    // Info rete locale & Cloudflare tunnel / Cloud host per pairing smartphone
    if (pathname === '/api/network-info' && method === 'GET') {
      const localIp = getLocalNetworkIp();
      const tunnelInfo = tunnel.getStatus();
      const storageInfo = db.getStorageInfo();

      const hostHeader = req.headers.host || `localhost:${PORT}`;
      const isRender = !!(process.env.RENDER || process.env.RENDER_EXTERNAL_URL || hostHeader.includes('.onrender.com'));
      const isCloud = isRender || (process.env.NO_TUNNEL && !tunnelInfo.url);
      const publicCloudUrl = process.env.RENDER_EXTERNAL_URL || (isRender ? `https://${hostHeader}` : null);

      if (isCloud && (publicCloudUrl || !tunnelInfo.url)) {
        const cloudUrl = publicCloudUrl || `https://${hostHeader}`;
        return sendJson(res, 200, {
          localIp,
          port: PORT,
          mobileUrl: cloudUrl,
          tunnelUrl: cloudUrl,
          tunnelStatus: 'online',
          tunnelAvailable: true,
          isPermanent: true,
          mode: 'cloud',
          fixedUrl: cloudUrl,
          quickUrl: '',
          hasToken: true,
          tokenMasked: 'RENDER_CLOUD_24_7',
          lastError: null,
          fallbackToQuick: false,
          storage: storageInfo,
          cloudProvider: isRender ? 'Render.com' : 'Cloud Host'
        });
      }

      return sendJson(res, 200, {
        localIp,
        port: PORT,
        mobileUrl: `http://${localIp}:${PORT}`,
        tunnelUrl: tunnelInfo.url,
        tunnelStatus: tunnelInfo.status,
        tunnelAvailable: tunnelInfo.available,
        isPermanent: tunnelInfo.isPermanent,
        mode: tunnelInfo.mode,
        fixedUrl: tunnelInfo.fixedUrl,
        quickUrl: tunnelInfo.quickUrl,
        hasToken: tunnelInfo.hasToken,
        tokenMasked: tunnelInfo.tokenMasked,
        lastError: tunnelInfo.lastError,
        fallbackToQuick: tunnelInfo.fallbackToQuick,
        storage: storageInfo
      });
    }

    // Endpoint Backup Dati: Download archivio (.db o .json)
    if (pathname === '/api/backup/download' && method === 'GET') {
      const format = parsedUrl.query.format || 'json';
      const nowStr = new Date().toISOString().slice(0, 10);
      if (format === 'db') {
        const dbPath = db.filePath;
        if (fs.existsSync(dbPath)) {
          res.writeHead(200, {
            'Content-Type': 'application/x-sqlite3',
            'Content-Disposition': `attachment; filename="casa_spese_${nowStr}.db"`,
            'Cache-Control': 'no-cache'
          });
          return fs.createReadStream(dbPath).pipe(res);
        }
      }
      const backupData = db.exportAllData();
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="casa_spese_backup_${nowStr}.json"`,
        'Cache-Control': 'no-cache'
      });
      return res.end(JSON.stringify(backupData, null, 2));
    }

    // Endpoint Ripristino Dati da Backup JSON
    if (pathname === '/api/backup/restore' && method === 'POST') {
      const body = await parseJsonBody(req);
      const result = db.importAllData(body);
      broadcastEvent('BACKUP_RESTORED', {
        timestamp: Date.now(),
        expensesCount: result.countExpenses
      }, requestClientId);
      return sendJson(res, 200, {
        success: true,
        message: 'Dati ripristinati con successo!',
        ...result
      });
    }

    // Endpoint diagnostica archiviazione & backup
    if (pathname === '/api/backup/info' && method === 'GET') {
      return sendJson(res, 200, {
        storage: db.getStorageInfo(),
        backup: {
          lastExportAvailable: true,
          supportedFormats: ['json', 'db']
        }
      });
    }

    // Endpoint dedicato stato tunnel
    if (pathname === '/api/tunnel' && method === 'GET') {
      return sendJson(res, 200, tunnel.getStatus());
    }

    // Endpoint configurazione e gestione Link Fisso Permanente / Token Cloudflare
    if (pathname === '/api/tunnel/config' && method === 'GET') {
      return sendJson(res, 200, tunnel.getStatus());
    }

    if (pathname === '/api/tunnel/config' && method === 'POST') {
      const body = await parseJsonBody(req);
      tunnel.saveConfig(body);
      await tunnel.start();
      const finalStatus = tunnel.getStatus();
      broadcastEvent('TUNNEL_UPDATED', {
        tunnelUrl: finalStatus.url,
        tunnelStatus: finalStatus.status,
        isPermanent: finalStatus.isPermanent,
        mode: finalStatus.mode,
        lastError: finalStatus.lastError,
        fallbackToQuick: finalStatus.fallbackToQuick
      }, requestClientId);
      return sendJson(res, 200, { success: true, ...finalStatus });
    }

    // Endpoint test connettività URL
    if (pathname === '/api/tunnel/test' && method === 'POST') {
      const body = await parseJsonBody(req);
      const targetUrl = body.url || tunnel.tunnelUrl;
      const testResult = await tunnel.testReachability(targetUrl);
      return sendJson(res, 200, testResult);
    }

    // Endpoint diagnostica PWA & Service Worker Health
    if (pathname === '/api/pwa-health' && method === 'GET') {
      const manifestPath = path.join(PUBLIC_DIR, 'manifest.json');
      const swPath = path.join(PUBLIC_DIR, 'service-worker.js');
      return sendJson(res, 200, {
        status: 'healthy',
        app: 'Casa & Spese',
        pwa: {
          manifest: fs.existsSync(manifestPath),
          serviceWorker: fs.existsSync(swPath),
          icons: {
            icon192: fs.existsSync(path.join(PUBLIC_DIR, 'icon-192.png')),
            icon512: fs.existsSync(path.join(PUBLIC_DIR, 'icon-512.png')),
            appleTouchIcon: fs.existsSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'))
          }
        },
        tunnel: tunnel.getStatus(),
        timestamp: Date.now()
      });
    }

    // Endpoint riavvio tunnel
    if (pathname === '/api/tunnel/restart' && method === 'POST') {
      await tunnel.start();
      return sendJson(res, 200, { success: true, ...tunnel.getStatus() });
    }

    // Endpoint test notifica istantanea per tutti i client connessi
    if (pathname === '/api/notifications/test' && method === 'POST') {
      broadcastEvent('TEST_NOTIFICATION', {
        title: '🔔 Test Notifiche Casa & Spese',
        body: 'Le notifiche in tempo reale e il tunnel Cloudflare funzionano alla perfezione!'
      }, requestClientId);
      return sendJson(res, 200, { success: true, message: 'Notifica di test inviata a tutti i dispositivi connessi' });
    }

    // Endpoint promemoria scadenza affitto (5 del mese)
    if (pathname === '/api/notifications/rent-reminder' && method === 'POST') {
      const currentYearMonth = new Date().toISOString().slice(0, 7);
      const summary = db.calculateMonthSummary(currentYearMonth);
      const rent = summary.rent;
      const curMonthName = new Date().toLocaleString('it-IT', { month: 'long' });

      let title, body;
      if (rent.isPaid) {
        title = `✅ Affitto ${curMonthName} già pagato`;
        body = `L'affitto di 940,00 € risulta regolarmente saldato da ${rent.paidByName}.`;
      } else if (rent.status === 'OVERDUE') {
        title = `🚨 Affitto ${curMonthName} SCADUTO!`;
        body = `L'affitto di 940,00 € a carico di ${rent.expectedPayerName} andava pagato entro il 5 ${curMonthName}!`;
      } else if (rent.daysLeft === 0) {
        title = `⚠️ Scadenza Affitto OGGI (5 ${curMonthName})`;
        body = `Oggi è il 5! Tocca ad ${rent.expectedPayerName} versare l'affitto (940,00 €).`;
      } else {
        title = `🏠 Promemoria Affitto (${rent.daysLeft} gg al 5 ${curMonthName})`;
        body = `Scadenza affitto di 940,00 € a carico di ${rent.expectedPayerName} entro il 5 ${curMonthName}.`;
      }

      broadcastEvent('RENT_REMINDER', {
        month: currentYearMonth,
        rent,
        notification: { title, body }
      }, requestClientId);

      return sendJson(res, 200, { success: true, rent, notification: { title, body } });
    }

    // Stato completo del mese
    if (pathname === '/api/state' && method === 'GET') {
      const currentYearMonth = new Date().toISOString().slice(0, 7);
      const targetMonth = parsedUrl.query.month || currentYearMonth;

      const settings = db.getSettings();
      const categories = db.getCategories();
      const summary = db.calculateMonthSummary(targetMonth);
      const expenses = db.getExpenses(targetMonth);
      const incomes = db.getMonthlyIncomes(targetMonth);

      return sendJson(res, 200, {
        month: targetMonth,
        settings,
        categories,
        incomes,
        expenses,
        summary
      });
    }

    // Aggiornamento stipendi & budget
    if (pathname === '/api/incomes' && method === 'POST') {
      const body = await parseJsonBody(req);
      const { month, income_partner1, income_partner2, extra_income, notes, saveAsDefault } = body;
      if (!month) return sendJson(res, 400, { error: 'Mese obbligatorio' });

      const updated = db.updateMonthlyIncomes(month, income_partner1, income_partner2, extra_income, notes, !!saveAsDefault);
      const summary = db.calculateMonthSummary(month);
      const settings = db.getSettings();

      broadcastEvent('INCOMES_UPDATED', { month, incomes: updated, summary }, requestClientId);
      if (saveAsDefault) {
        broadcastEvent('SETTINGS_UPDATED', settings, requestClientId);
      }
      return sendJson(res, 200, { success: true, month, incomes: updated, summary, settings });
    }

    // Aggiungi Spesa
    if (pathname === '/api/expenses' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.month || !body.title || isNaN(Number(body.amount))) {
        return sendJson(res, 400, { error: 'Campi obbligatori: month, title, amount' });
      }

      const newExpense = db.addExpense(body);
      const settings = db.getSettings();
      const p1Name = settings.partner1_name || 'Marco';
      const p2Name = settings.partner2_name || 'Angela';
      const payerName = newExpense.paid_by === 'partner1' ? p1Name : (newExpense.paid_by === 'partner2' ? p2Name : 'Conto Comune');

      // Calcola stato budget per eventuale alert su superamento tetto spesa cibo
      const summary = db.calculateMonthSummary(body.month);
      let budgetAlert = null;
      if (summary.budget && summary.budget.food) {
        if (summary.budget.food.isOver) {
          budgetAlert = {
            title: '⚠️ Tetto Spesa Cibo Superato!',
            body: `Spesi ${summary.budget.food.spent.toFixed(2)} € su ${summary.budget.food.limit.toFixed(2)} € (+${summary.budget.food.overAmount.toFixed(2)} €)`
          };
        } else if (summary.budget.food.percent >= 90) {
          budgetAlert = {
            title: `⚠️ Tetto Spesa Cibo al ${summary.budget.food.percent}%`,
            body: `Rimangono solo ${summary.budget.food.remaining.toFixed(2)} € sul budget cibo.`
          };
        }
      }

      broadcastEvent('EXPENSE_ADDED', {
        month: body.month,
        expense: newExpense,
        payerName,
        budgetAlert,
        notification: {
          title: `🛒 Nuova spesa da ${payerName}!`,
          body: `${newExpense.title} • ${Number(newExpense.amount).toFixed(2)} €`
        }
      }, requestClientId);
      return sendJson(res, 201, newExpense);
    }

    // Modifica Spesa
    if (pathname.startsWith('/api/expenses/') && method === 'PUT') {
      const id = parseInt(pathname.split('/')[3], 10);
      const body = await parseJsonBody(req);
      const updated = db.updateExpense(id, body);
      const settings = db.getSettings();
      const p1Name = settings.partner1_name || 'Marco';
      const p2Name = settings.partner2_name || 'Angela';
      const payerName = updated ? (updated.paid_by === 'partner1' ? p1Name : (updated.paid_by === 'partner2' ? p2Name : 'Conto Comune')) : '';

      let budgetAlert = null;
      if (updated) {
        const summary = db.calculateMonthSummary(updated.month);
        if (summary.budget && summary.budget.food && summary.budget.food.isOver) {
          budgetAlert = {
            title: '⚠️ Tetto Spesa Cibo Superato!',
            body: `Spesi ${summary.budget.food.spent.toFixed(2)} € su ${summary.budget.food.limit.toFixed(2)} € (+${summary.budget.food.overAmount.toFixed(2)} €)`
          };
        }
      }

      broadcastEvent('EXPENSE_UPDATED', {
        id,
        month: updated ? updated.month : null,
        expense: updated,
        budgetAlert,
        notification: updated ? {
          title: `✏️ Spesa modificata da ${payerName}`,
          body: `${updated.title} • ${Number(updated.amount).toFixed(2)} €`
        } : null
      }, requestClientId);
      return sendJson(res, 200, updated);
    }

    // Elimina Spesa
    if (pathname.startsWith('/api/expenses/') && method === 'DELETE') {
      const id = parseInt(pathname.split('/')[3], 10);
      const exp = db.getExpenseById(id);
      db.deleteExpense(id);
      broadcastEvent('EXPENSE_DELETED', { id, month: exp ? exp.month : null }, requestClientId);
      return sendJson(res, 200, { success: true, id });
    }

    // Copia spese fisse da mese precedente
    if (pathname === '/api/month/copy-fixed' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.month) return sendJson(res, 400, { error: 'Mese target obbligatorio' });
      const result = db.copyFixedExpensesFromPreviousMonth(body.month);
      broadcastEvent('FIXED_EXPENSES_COPIED', { month: body.month }, requestClientId);
      return sendJson(res, 200, result);
    }

    // Registrazione Saldo / Conguaglio
    if (pathname === '/api/settlements' && method === 'POST') {
      const body = await parseJsonBody(req);
      const { month, amount, from_partner, to_partner, notes } = body;
      const settlement = db.addSettlement(month, amount, from_partner, to_partner, notes);
      broadcastEvent('SETTLEMENT_RECORDED', { month, settlement }, requestClientId);
      return sendJson(res, 201, settlement);
    }

    // Eliminazione Saldo / Annulla Conguaglio
    if (pathname.startsWith('/api/settlements/') && method === 'DELETE') {
      const id = parseInt(pathname.split('/')[3], 10);
      const row = db.deleteSettlement(id);
      broadcastEvent('SETTLEMENT_DELETED', { id, month: row ? row.month : null }, requestClientId);
      return sendJson(res, 200, { success: true, id, settlement: row });
    }

    if (pathname === '/api/settlements/clear' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.month) return sendJson(res, 400, { error: 'Parametro month obbligatorio' });
      db.clearMonthSettlements(body.month);
      broadcastEvent('SETTLEMENT_DELETED', { month: body.month }, requestClientId);
      return sendJson(res, 200, { success: true, month: body.month });
    }

    // Impostazioni
    if (pathname === '/api/settings' && method === 'GET') {
      return sendJson(res, 200, db.getSettings());
    }

    if (pathname === '/api/settings' && method === 'POST') {
      const body = await parseJsonBody(req);
      const currentYearMonth = new Date().toISOString().slice(0, 7);
      const targetMonth = body.month || parsedUrl.query.month || currentYearMonth;
      const updated = db.updateSettings(body, targetMonth);
      const summary = db.calculateMonthSummary(targetMonth);

      broadcastEvent('SETTINGS_UPDATED', updated, requestClientId);
      broadcastEvent('INCOMES_UPDATED', { month: targetMonth, summary }, requestClientId);
      return sendJson(res, 200, { ...updated, _summary: summary });
    }

    // Categorie
    if (pathname === '/api/categories' && method === 'GET') {
      return sendJson(res, 200, db.getCategories());
    }

    if (pathname === '/api/categories' && method === 'POST') {
      const body = await parseJsonBody(req);
      const cats = db.addCategory(body.id, body.name, body.icon, body.color);
      broadcastEvent('CATEGORIES_UPDATED', cats, requestClientId);
      return sendJson(res, 201, cats);
    }

    // Storico mesi passati
    if (pathname === '/api/history' && method === 'GET') {
      const limit = parseInt(parsedUrl.query.limit, 10) || 12;
      return sendJson(res, 200, db.getHistory(limit));
    }
  } catch (apiErr) {
    console.error('API Error:', apiErr);
    return sendJson(res, 500, { error: apiErr.message });
  }

  // --- 3. SERVING FILE STATICI (FRONTEND) ---
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  const requestedFile = path.join(PUBLIC_DIR, safePath);

  // Se il file esiste, servilo; altrimenti fallback su index.html (SPA)
  if (fs.existsSync(requestedFile) && fs.statSync(requestedFile).isFile()) {
    return serveStaticFile(res, requestedFile);
  } else {
    return serveStaticFile(res, path.join(PUBLIC_DIR, 'index.html'));
  }
});

server.listen(PORT, HOST, () => {
  const localIp = getLocalNetworkIp();
  console.log(`\n======================================================`);
  console.log(`   🏡 CASA & SPESE - GESTIONE COPPIA IN TEMPO REALE   `);
  console.log(`======================================================`);
  console.log(` > Accesso Locale (PC):        http://localhost:${PORT}`);
  console.log(` > Accesso Smartphone (Wi-Fi):  http://${localIp}:${PORT}`);
  console.log(`======================================================\n`);

  if (!process.env.NO_TUNNEL) {
    tunnel.start();
  }
});

function cleanupAndExit() {
  console.log('\n🛑 Arresto server e chiusura tunnel Cloudflare...');
  try {
    tunnel.stop();
  } catch (e) {}
  process.exit(0);
}

process.on('SIGINT', cleanupAndExit);
process.on('SIGTERM', cleanupAndExit);
process.on('exit', () => {
  try {
    tunnel.stop();
  } catch (e) {}
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception protetta:', err && err.message ? err.message : err);
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection protetta:', reason && reason.message ? reason.message : reason);
});
