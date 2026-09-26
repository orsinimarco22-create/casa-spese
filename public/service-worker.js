// service-worker.js - PWA Offline Shell, Caching & Notifiche Native per Casa & Spese
const CACHE_NAME = 'casa-spese-v2';
const STATIC_ASSETS = [
  '/',
  '/?source=pwa',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

// 1. Installazione: pre-caching della shell dell'applicazione per funzionamento offline
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Usa Promise.allSettled per non bloccare l'installazione se un singolo asset opzionale fallisce
      return Promise.allSettled(
        STATIC_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn(`Impossibile pre-caricare in cache: ${asset}`, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// 2. Attivazione: rimozione vecchie versioni della cache e presa in carico immediata
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log(`Pulizia vecchia cache PWA: ${key}`);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Intercettazione richieste (Fetch Strategy & Offline Shell)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignora le richieste verso il service worker stesso (lascia che il browser gestisca gli aggiornamenti nativi)
  if (url.pathname === '/service-worker.js') {
    return;
  }

  // Ignora le richieste SSE (Server-Sent Events) in tempo reale: devono passare sempre dirette
  if (url.pathname === '/api/events') {
    return;
  }

  // Ignora le richieste non-GET (POST, PUT, DELETE non devono essere gestite dalla cache)
  if (req.method !== 'GET') {
    return;
  }

  // Ignora richieste verso schemi non-http (es. chrome-extension://)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // A) Navigazione pagine HTML (index.html e percorsi SPA)
  // Network-First: prova prima la rete per avere dati freschi, fallback su shell in cache
  if (req.mode === 'navigate' || (req.headers.get('accept') && req.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(async () => {
          // Ricerca con ignoreSearch per gestire parametri come ?source=pwa
          const cachedRes = await caches.match(req, { ignoreSearch: true });
          if (cachedRes) return cachedRes;
          // Se non presente, ritorna la shell base index.html
          const rootCached = await caches.match('/index.html') || await caches.match('/');
          if (rootCached) return rootCached;
          return new Response('<h1>Casa & Spese Offline</h1><p>Connessione non disponibile. Riapri l\'app una volta ripristinata la connessione del PC.</p>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        })
    );
    return;
  }

  // B) Asset statici (CSS, JS, Immagini, Font, Manifest)
  // Stale-While-Revalidate: rispondi subito da cache se presente, poi aggiorna in background
  const isStaticAsset = url.pathname.endsWith('.css') ||
                        url.pathname.endsWith('.js') ||
                        url.pathname.endsWith('.png') ||
                        url.pathname.endsWith('.svg') ||
                        url.pathname.endsWith('.jpg') ||
                        url.pathname.endsWith('.ico') ||
                        url.pathname.endsWith('.json') ||
                        url.hostname.includes('fonts.googleapis.com') ||
                        url.hostname.includes('fonts.gstatic.com');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(req).then((cachedRes) => {
        const fetchPromise = fetch(req)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              const resClone = networkRes.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
            }
            return networkRes;
          })
          .catch(() => cachedRes);

        return cachedRes || fetchPromise;
      })
    );
    return;
  }

  // C) Chiamate API GET (/api/state, /api/settings, /api/categories, ecc.)
  // Network-First con fallback su cache o risposta 503 Service Unavailable
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(async () => {
          const cachedRes = await caches.match(req);
          if (cachedRes) return cachedRes;
          return new Response(JSON.stringify({ offline: true, error: 'Dispositivo non connesso alla rete o server PC spento' }), {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // Default: normale fetch
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

// 4. Gestione click sulle notifiche per portare in primo piano l'app o aprire una sezione
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// 5. Ricezione messaggi di notifica dal client (SHOW_NOTIFICATION & SKIP_WAITING)
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    const notifPromise = self.registration.showNotification(title, {
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      ...options,
      data: {
        url: options?.data?.url || '/',
        ...options?.data
      }
    }).catch((err) => {
      console.warn('ServiceWorker showNotification fallito:', err);
    });

    if (event.waitUntil) {
      event.waitUntil(notifPromise);
    }
  }
});

// 6. Gestione eventi Push (Web Push standard)
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || '🏡 Casa & Spese';
  const options = {
    body: data.body || 'Nuovo aggiornamento spese',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.warn('Push showNotification error:', err);
    })
  );
});
