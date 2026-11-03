const CACHE_NAME = 'tabreed-pro-v26';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/AFT/index.html',
  '/AFT/generator.html',
  '/AFT/scanner.html',
  '/app-documentation.html',
  '/Operation_Request.html',
  '/Petty_Cash_Voucher.html',
  '/Team_Contacts.html',
  '/DocumentFolder.html',
  '/PM_Checklist_Generator.html',
  '/ETS_Locator.html',
  '/themes.css',
  '/auth-module.js',
  '/config.js',
  '/storage.js',
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
  '/offline.html',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/icon?family=Material+Icons+Round'
];

function isScriptOrStyle(url) {
  return /\.(js|css|json|png|jpg|jpeg|gif|svg|ico)$/i.test(url);
}

// ==========================================
// 1. INSTALL & CACHE (With strict HTML poison filter)
// ==========================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log('[Service Worker] Caching Core Assets safely');
      await Promise.allSettled(
        STATIC_ASSETS.map(async url => {
          try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (!response || !response.ok) return;
            if (response.redirected && response.url.includes('__cookie_check')) {
              console.warn('[Service Worker] Skipping cookie-check redirect for asset:', url);
              return;
            }
            const contentType = response.headers.get('content-type') || '';
            if (isScriptOrStyle(url) && contentType.includes('text/html')) {
              console.warn('[Service Worker] Rejected caching HTML for script/asset:', url);
              return;
            }
            await cache.put(url, response);
          } catch (err) {
            console.warn('[Service Worker] Optional asset cache skip:', url, err.message);
          }
        })
      );
    })
  );
  self.skipWaiting();
});

// ==========================================
// 2. ACTIVATE & CLEANUP
// ==========================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(async cacheName => {
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
// 3. SMART FETCH STRATEGY
// ==========================================
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const reqUrl = event.request.url;

  // Immediately ignore Cloud Run cookie checks, /api/ routes, and external Google scripts
  if (
    reqUrl.includes('__cookie_check') ||
    reqUrl.includes('/api/') ||
    reqUrl.includes('script.google.com') ||
    reqUrl.includes('googleusercontent.com')
  ) {
    return;
  }

  const isHtml = event.request.mode === 'navigate' || 
                 reqUrl.endsWith('.html') || 
                 (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

  // HTML Pages: Network-First to guarantee immediate updates
  if (isHtml) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && !networkResponse.url.includes('__cookie_check')) {
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

  // Static Assets (scripts, stylesheets, icons, fonts)
  event.respondWith(
    caches.match(event.request).then(async cachedResponse => {
      if (cachedResponse) {
        const cType = cachedResponse.headers.get('content-type') || '';
        const resUrl = cachedResponse.url || '';
        // If an asset was previously poisoned by an HTML redirect, purge it immediately
        if ((isScriptOrStyle(reqUrl) && cType.includes('text/html')) || resUrl.includes('__cookie_check')) {
          console.warn('[Service Worker] Purging poisoned cache entry for:', reqUrl);
          const cache = await caches.open(CACHE_NAME);
          await cache.delete(event.request);
        } else {
          return cachedResponse;
        }
      }

      return fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const cType = networkResponse.headers.get('content-type') || '';
            const resUrl = networkResponse.url || '';
            // Only cache if valid asset response and not an HTML cookie check redirect
            if (!resUrl.includes('__cookie_check') && !(isScriptOrStyle(reqUrl) && cType.includes('text/html'))) {
              const cacheCopy = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, cacheCopy)).catch(() => {});
            }
          }
          return networkResponse;
        })
        .catch(() => {
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
      new Promise((resolve) => {
        console.log('[Service Worker] Fetching latest instrument data...');
        resolve();
      })
    );
  } else if (event.tag === 'clear-old-logs') {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
        if (clients && clients.length) {
          clients.forEach(client => {
            client.postMessage({ type: 'CLEAR_OLD_LOGS', maxAgeDays: 7 });
          });
        }
      })
    );
  }
});
