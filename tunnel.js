// tunnel.js - Cloudflare Tunnel Manager per Casa & Spese (Marco ed Angela)
// Supporta sia Cloudflare Named Tunnel (Token Fisso Permanente) sia Quick Tunnel (trycloudflare)
const { spawn, exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

class CloudflareTunnelManager {
  constructor(options = {}) {
    this.port = options.port || 3000;
    this.cloudflaredPath = options.cloudflaredPath || path.join(__dirname, 'cloudflared.exe');
    this.urlFile = path.join(__dirname, 'cloudflare_url.txt');
    this.configFile = path.join(__dirname, 'tunnel_config.json');

    this.process = null;
    this.tunnelUrl = null;
    this.status = 'idle'; // 'idle', 'starting', 'online', 'offline', 'error', 'unavailable'
    this.onUrlCallback = options.onUrl || null;
    this.onStatusCallback = options.onStatus || null;
    this.reconnectTimeout = null;
    this.isStopping = false;
    this.isColdBoot = true;

    // Monitoraggio tentativi ed errori
    this.tokenRetryCount = 0;
    this.lastError = null;
    this.fallbackToQuick = false;

    // Configurazione Link Fisso & Token
    this.token = process.env.CLOUDFLARE_TUNNEL_TOKEN || process.env.TUNNEL_TOKEN || '';
    this.fixedUrl = process.env.FIXED_TUNNEL_URL || process.env.TUNNEL_URL || '';
    this.quickUrl = null;
    this.mode = 'quick'; // 'token', 'custom', 'quick'
    this.isPermanent = false;

    this.loadConfig();

    // Solo se siamo in modalità permanente ripristiniamo l'URL precedentemente salvato
    if (this.isPermanent && this.fixedUrl) {
      this.tunnelUrl = this.fixedUrl;
    } else if (this.isPermanent && fs.existsSync(this.urlFile)) {
      try {
        const saved = fs.readFileSync(this.urlFile, 'utf8').trim();
        if (saved && saved.startsWith('https://')) {
          this.tunnelUrl = saved;
        }
      } catch (e) {}
    } else {
      // In modalità quick, NON ripristiniamo un URL scaduto dalla sessione precedente!
      this.tunnelUrl = null;
    }
  }

  // Sanitizza e normalizza gli URL (protocollo https e no trailing slash)
  normalizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    let cleaned = rawUrl.trim();
    if (!cleaned) return '';
    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      cleaned = 'https://' + cleaned;
    }
    return cleaned.replace(/\/+$/, '');
  }

  loadConfig() {
    if (fs.existsSync(this.configFile)) {
      try {
        const raw = fs.readFileSync(this.configFile, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.token !== undefined) this.token = (parsed.token || '').trim();
        if (parsed.fixedUrl !== undefined) this.fixedUrl = this.normalizeUrl(parsed.fixedUrl);
        if (parsed.quickUrl !== undefined) this.quickUrl = this.normalizeUrl(parsed.quickUrl);
        if (parsed.mode !== undefined) this.mode = parsed.mode;
      } catch (e) {
        console.warn('⚠️ Errore lettura tunnel_config.json:', e.message);
      }
    }

    if (this.fixedUrl) {
      this.fixedUrl = this.normalizeUrl(this.fixedUrl);
    }

    // Risoluzione modalità
    if (this.token && this.token.length > 10) {
      this.mode = 'token';
      this.isPermanent = true;
      if (this.fixedUrl) {
        this.tunnelUrl = this.fixedUrl;
      }
    } else if (this.fixedUrl && this.fixedUrl.startsWith('https://')) {
      this.mode = 'custom';
      this.isPermanent = true;
      this.tunnelUrl = this.fixedUrl;
    } else {
      this.mode = 'quick';
      this.isPermanent = false;
      this.tunnelUrl = null; // Un quick URL precedente non è più valido!
    }
  }

  saveConfig(newConfig = {}) {
    if (newConfig.token !== undefined) this.token = (newConfig.token || '').trim();
    if (newConfig.fixedUrl !== undefined) this.fixedUrl = this.normalizeUrl(newConfig.fixedUrl);
    if (newConfig.mode !== undefined) this.mode = newConfig.mode;

    // Reset indicatori di errore
    this.tokenRetryCount = 0;
    this.lastError = null;
    this.fallbackToQuick = false;

    if (this.mode === 'quick' || (!this.token && !this.fixedUrl)) {
      this.mode = 'quick';
      this.isPermanent = false;
      this.token = '';
      this.fixedUrl = '';
      this.tunnelUrl = null;
    } else if (this.token && this.token.length > 10) {
      this.mode = 'token';
      this.isPermanent = true;
      if (this.fixedUrl) this.tunnelUrl = this.fixedUrl;
    } else if (this.fixedUrl && this.fixedUrl.startsWith('https://')) {
      this.mode = 'custom';
      this.isPermanent = true;
      this.tunnelUrl = this.fixedUrl;
    }

    const toSave = {
      mode: this.mode,
      token: this.token,
      fixedUrl: this.fixedUrl,
      quickUrl: this.quickUrl || '',
      updatedAt: new Date().toISOString()
    };

    try {
      fs.writeFileSync(this.configFile, JSON.stringify(toSave, null, 2), 'utf8');
      if (this.tunnelUrl && this.isPermanent) {
        fs.writeFileSync(this.urlFile, this.tunnelUrl, 'utf8');
      } else if (!this.isPermanent && fs.existsSync(this.urlFile)) {
        try { fs.unlinkSync(this.urlFile); } catch (e) {}
      }
    } catch (e) {
      console.error('❌ Errore salvataggio tunnel_config.json:', e);
    }

    return this.getStatus();
  }

  getStatus() {
    return {
      status: this.status,
      url: this.tunnelUrl,
      tunnelUrl: this.tunnelUrl,
      mode: this.mode,
      isPermanent: this.isPermanent,
      fixedUrl: this.fixedUrl,
      quickUrl: this.quickUrl,
      hasToken: !!(this.token && this.token.length > 10),
      tokenMasked: (this.token && this.token.length > 12)
        ? (this.token.slice(0, 6) + '...' + this.token.slice(-4))
        : '',
      available: fs.existsSync(this.cloudflaredPath),
      lastError: this.lastError,
      fallbackToQuick: this.fallbackToQuick
    };
  }

  killStaleProcesses() {
    return new Promise((resolve) => {
      if (process.platform === 'win32') {
        exec('taskkill /IM cloudflared.exe /F', () => resolve());
      } else {
        exec('pkill -f cloudflared', () => resolve());
      }
    });
  }

  async start() {
    if (!fs.existsSync(this.cloudflaredPath)) {
      console.log('ℹ️ cloudflared.exe non trovato, tunnel Cloudflare disabilitato.');
      this.status = 'unavailable';
      if (this.onStatusCallback) this.onStatusCallback(this.status, null);
      return;
    }

    // Cancella eventuali timer di riconnessione pendenti
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Se c'è già un processo attivo gestito, stacca i listener ed arresta in modo sicuro
    if (this.process) {
      const oldProc = this.process;
      this.process = null;
      oldProc.removeAllListeners('exit');
      oldProc.removeAllListeners('error');
      try {
        oldProc.kill();
      } catch (e) {}
    }

    this.isStopping = false;
    this.status = 'starting';
    this.loadConfig(); // Rileggi config fresca

    if (this.onStatusCallback) this.onStatusCallback(this.status, this.tunnelUrl);

    // Chiudi eventuali processi orfani rimasti in memoria solo al cold boot iniziale
    if (this.isColdBoot) {
      this.isColdBoot = false;
      await this.killStaleProcesses();
    }

    // Determina se avviare Named Tunnel Permanente (tramite token) o Quick Tunnel (trycloudflare)
    if (this.mode === 'token' && this.token) {
      this.startTokenTunnel();
    } else {
      this.startQuickTunnel();
    }
  }

  // 1. AVVIO TUNNEL CON TOKEN (LINK FISSO PERMANENTE - zeroTrust / custom domain)
  startTokenTunnel() {
    console.log('\n🔒 Avvio Cloudflare Named Tunnel FISSO con Token permanente...');
    try {
      // Includiamo esplicitamente --url per garantire che il traffico sia inoltrato alla porta corretta
      this.process = spawn(this.cloudflaredPath, [
        'tunnel',
        'run',
        '--token',
        this.token,
        '--url',
        `http://localhost:${this.port}`
      ], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      const handleTokenOutput = (chunk) => {
        const text = chunk.toString();

        // 1. Controlla errori fatali di autenticazione del token
        const isAuthError = text.includes('Unauthorized') ||
                            text.includes('Cannot fetch tunnel certificate') ||
                            text.includes('Authentication failed') ||
                            text.includes('Error looking up tunnel') ||
                            text.includes('Tunnel credentials are not valid') ||
                            text.includes('failed to run the datagram handler') ||
                            text.includes('control stream encountered a failure while serving');

        if (isAuthError) {
          this.tokenRetryCount++;
          console.warn(`⚠️ Errore Named Tunnel rilevato (tentativo ${this.tokenRetryCount}):`, text.trim().slice(0, 140));

          if (this.tokenRetryCount >= 3 && !this.fallbackToQuick) {
            this.lastError = 'Token Cloudflare non valido o respinto da Cloudflare Edge.';
            console.error(`❌ ${this.lastError} Attivazione automatica Quick Tunnel di emergenza...`);
            this.fallbackToQuick = true;
            this.status = 'error';
            if (this.onStatusCallback) this.onStatusCallback(this.status, this.tunnelUrl);
            
            // Passa a Quick Tunnel per non lasciare Angela e Marco bloccati
            setTimeout(() => {
              if (!this.isStopping) {
                this.startQuickTunnel();
              }
            }, 1000);
            return;
          }
        }

        // 2. Cerca messaggi di connessione REALE all'Edge Cloudflare
        // NOTA BENE: NON usare "Starting tunnel" perché è solo il banner di boot iniziale!
        const isConnected = text.includes('Registered tunnel connection') ||
                            text.includes('Connection registered') ||
                            (text.includes('Connection') && text.includes('registered')) ||
                            text.includes('Updated to new configuration') ||
                            text.includes('INF Connected to');

        if (isConnected && this.status !== 'online') {
          this.status = 'online';
          this.tokenRetryCount = 0;
          this.lastError = null;
          this.fallbackToQuick = false;

          const effectiveUrl = this.fixedUrl || this.tunnelUrl;
          if (effectiveUrl) {
            this.tunnelUrl = effectiveUrl;
            try {
              fs.writeFileSync(this.urlFile, this.tunnelUrl, 'utf8');
            } catch (e) {}
          }

          console.log(`\n======================================================`);
          console.log(`   🔒 TUNNEL CLOUDFLARE FISSO PERMANENTE ATTIVO!`);
          console.log(`======================================================`);
          console.log(` > Link Fisso Permanente Smartphone (iOS / Android):`);
          console.log(`   👉 ${this.tunnelUrl || '(URL configurato nella dashboard Cloudflare)'}`);
          console.log(` > Stabilità: 100% GARANTITA ANCHE DOPO RIAVVIO DEL PC!`);
          console.log(` > Angela e Marco possono salvare l'icona una sola volta.`);
          console.log(` > PWA, Service Worker e Notifiche Push operative ovunque!`);
          console.log(`======================================================\n`);

          if (this.onUrlCallback) this.onUrlCallback(this.tunnelUrl);
          if (this.onStatusCallback) this.onStatusCallback(this.status, this.tunnelUrl);
        }
      };

      this.process.stdout.on('data', handleTokenOutput);
      this.process.stderr.on('data', handleTokenOutput);

      this.attachCommonProcessListeners();
    } catch (err) {
      console.error('❌ Eccezione durante avvio Named Tunnel:', err);
      this.status = 'error';
      this.lastError = err.message;
      if (this.onStatusCallback) this.onStatusCallback(this.status, null);
    }
  }

  // 2. AVVIO QUICK TUNNEL EPHEMERAL (trycloudflare.com)
  startQuickTunnel() {
    console.log('🌐 Connessione Cloudflare Quick Tunnel in corso (trycloudflare)...');
    try {
      this.process = spawn(this.cloudflaredPath, [
        'tunnel',
        '--url',
        `http://localhost:${this.port}`
      ], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      const urlRegex = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;

      const handleChunk = (chunk) => {
        const text = chunk.toString();
        const match = text.match(urlRegex);
        if (match && match[0]) {
          const quickUrl = match[0];
          this.quickUrl = quickUrl;

          // Se l'utente ha configurato un fixedUrl valido mantienilo prioritario
          const effectiveUrl = (this.isPermanent && this.fixedUrl && this.fixedUrl.startsWith('https://'))
            ? this.fixedUrl
            : quickUrl;

          const urlChanged = (this.tunnelUrl !== effectiveUrl);
          const wasNotOnline = (this.status !== 'online');

          this.tunnelUrl = effectiveUrl;
          this.status = 'online';

          if (urlChanged || wasNotOnline) {
            try {
              fs.writeFileSync(this.urlFile, this.tunnelUrl, 'utf8');
              const raw = fs.existsSync(this.configFile) ? JSON.parse(fs.readFileSync(this.configFile, 'utf8')) : {};
              raw.quickUrl = quickUrl;
              fs.writeFileSync(this.configFile, JSON.stringify(raw, null, 2), 'utf8');
            } catch (e) {}

            console.log(`\n======================================================`);
            console.log(`   🌍 TUNNEL CLOUDFLARE ATTIVO (HTTPS SICURO)`);
            console.log(`======================================================`);
            console.log(` > Link Remoto Smartphone (4G/5G):`);
            console.log(`   👉 ${this.tunnelUrl}`);
            if (!this.isPermanent) {
              console.log(`   ⚠️ NOTA: Questo link trycloudflare è provvisorio.`);
              console.log(`   💡 Per fissarlo PERMANENTEMENTE per Angela e Marco:`);
              console.log(`      Apri l'app -> Tocca "Collega Telefono" -> "Configura Link Fisso"`);
            }
            console.log(` > Notifiche PWA Web Push pienamente operative ovunque!`);
            console.log(`======================================================\n`);

            if (this.onUrlCallback) this.onUrlCallback(this.tunnelUrl);
            if (this.onStatusCallback) this.onStatusCallback(this.status, this.tunnelUrl);
          }
        }
      };

      this.process.stdout.on('data', handleChunk);
      this.process.stderr.on('data', handleChunk);

      this.attachCommonProcessListeners();
    } catch (err) {
      console.error('❌ Eccezione durante avvio Quick Tunnel:', err);
      this.status = 'error';
      this.lastError = err.message;
      if (this.onStatusCallback) this.onStatusCallback(this.status, null);
    }
  }

  attachCommonProcessListeners() {
    const curProc = this.process;
    if (!curProc) return;

    curProc.on('error', (err) => {
      if (this.process !== curProc) return;
      console.error('❌ Errore processo cloudflared:', err.message);
      this.status = 'error';
      this.lastError = err.message;
      if (this.onStatusCallback) this.onStatusCallback(this.status, null);
    });

    curProc.on('exit', (code, signal) => {
      if (this.isStopping) return;
      if (this.process !== curProc) return; // Ignora uscite di processi precedenti
      console.warn(`⚠️ Cloudflare tunnel terminato (code: ${code}, signal: ${signal}).`);
      this.status = 'offline';
      if (this.onStatusCallback) this.onStatusCallback(this.status, this.tunnelUrl);

      // Riconnessione automatica dopo 5 secondi solo per il processo attualmente attivo
      this.reconnectTimeout = setTimeout(() => {
        if (!this.isStopping && this.process === curProc) {
          console.log('🔄 Riconnessione automatica tunnel Cloudflare...');
          this.start();
        }
      }, 5000);
    });
  }

  // Verifica connettività esterna dell'URL
  testReachability(targetUrl = null) {
    let testUrl = this.normalizeUrl(targetUrl || this.tunnelUrl);
    if (!testUrl || !testUrl.startsWith('http')) {
      return Promise.resolve({ success: false, error: 'URL non configurato o non valido' });
    }

    return new Promise((resolve) => {
      const client = testUrl.startsWith('https://') ? https : http;
      const req = client.get(`${testUrl}/api/network-info`, { timeout: 6000 }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          resolve({
            success: res.statusCode >= 200 && res.statusCode < 400,
            statusCode: res.statusCode,
            url: testUrl
          });
        });
      });

      req.on('error', (err) => {
        resolve({ success: false, error: err.message, url: testUrl });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Timeout connessione (6s)', url: testUrl });
      });
    });
  }

  stop() {
    this.isStopping = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.process) {
      const proc = this.process;
      this.process = null;
      proc.removeAllListeners('exit');
      proc.removeAllListeners('error');
      try {
        proc.kill();
      } catch (e) {}
    }
    this.status = 'idle';
  }
}

module.exports = CloudflareTunnelManager;
