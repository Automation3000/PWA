const CACHE_NAME = 'tabreed-pro-v21'; // v21: Unified centralized auth module & cache bust
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app-documentation.html',
  '/Operation_Request.html',
  '/Team_Contacts.html',
  '/DocumentFolder.html',
  '/PM_Checklist_Generator.html',
  '/ETS_Locator.html',
  '/themes.css',
  '/auth-module.js',
  '/data/employees.json',
  '/employees.json',
  '/data/ets_cache.json',
  '/manifest.json',
  '/icon-72.png',
  '/icon-96.png',
  '/icon-128.png',
  '/icon-144.png',
  '/icon-192.png',
  '/icon-512.png',
  '/data/documents.json',
  '/documents.json',
  '/config.js',
  '/storage.js',
  '/offline.html',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/icon?family=Material+Icons+Round'
];

// ==========================================
// 1. INSTALL & CACHE (Offline Support)
// ==========================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log('[Service Worker] Caching Core Assets');
      await Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => {
            console.warn('[Service Worker] Optional asset cache skip:', url, err.message);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// ==========================================
// 2. ACTIVATE & CLEANUP (Logic)
// ==========================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ==========================================
// 3. SMART FETCH STRATEGY (Offline Support)
// ==========================================
self.addEventListener('fetch', event => {
  // Ignore non-GET requests
  if (event.request.method !== 'GET') return;

  // Do NOT intercept /api/ routes, external Google Apps Script, or user content
  if (
    event.request.url.includes('/api/') ||
    event.request.url.includes('script.google.com') ||
    event.request.url.includes('googleusercontent.com')
  ) {
    return;
  }

  const isHtml = event.request.mode === 'navigate' || 
                 event.request.url.endsWith('.html') || 
                 (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

  // HTML Pages: Network-First to guarantee immediate visibility of latest changes
  if (isHtml) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cacheCopy)).catch(() => {});
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request).then(cachedResponse => {
          return cachedResponse || caches.match('/index.html') || caches.match('/');
        });
      })
    );
    return;
  }

  // Static Assets (icons, styles, scripts): Cache-First with Network Fallback
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const cacheCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, cacheCopy)).catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => {
          // Return a safe neutral response instead of Promise.reject to prevent unhandled Failed to fetch
          return new Response('', { status: 503, statusText: 'Offline' });
        });
    })
  );
});

// ==========================================
// 4. BACKGROUND SYNC (Data syncs when online)
// ==========================================
self.addEventListener('sync', event => {
  console.log('[Service Worker] Background Sync Triggered:', event.tag);
  
  if (event.tag === 'tabreed-sync-queue') {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
        if (clients && clients.length) {
          clients.forEach(client => {
            client.postMessage({ type: 'PROCESS_SYNC_QUEUE' });
          });
        }
      })
    );
  }
});

// ==========================================
// 5. PERIODIC BACKGROUND SYNC (Auto Refresh Data)
// ==========================================
self.addEventListener('periodicsync', event => {
  console.log('[Service Worker] Periodic Sync Triggered:', event.tag);
  
  if (event.tag === 'update-inventory') {
    event.waitUntil(
      // Yahan background me inventory refresh karne ka logic aayega
      new Promise((resolve) => {
        console.log('[Service Worker] Fetching latest instrument data...');
        resolve();
      })
    );
  }
});

// ==========================================
// 6. BACKGROUND SYNC & UTILITIES
// ==========================================
// Push notification handlers moved to /push-draft/sw-push-handlers.js as per user draft isolation.

