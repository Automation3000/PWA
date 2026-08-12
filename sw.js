const CACHE_NAME = 'tabreed-pro-v8'; // v8: Added offline capability & push handling
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/NEW.html',
  '/DocumentFolder.html',
  '/PM_Checklist_Generator.html',
  '/manifest.json',
  '/icon-72.png',
  '/icon-96.png',
  '/icon-128.png',
  '/icon-144.png',
  '/icon-192.png',
  '/icon-512.png',
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
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Caching Core Assets');
      return cache.addAll(STATIC_ASSETS);
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

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const networkFetch = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cacheCopy));
        }
        return networkResponse;
      }).catch(() => {
        if (cachedResponse) return cachedResponse;
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html') || caches.match('/');
        }
        return Promise.reject('offline');
      });
      return cachedResponse || networkFetch;
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
      // Yahan hum future me offline to online API push logic add kar sakte hain
      new Promise((resolve) => {
        console.log('[Service Worker] Processing offline data queue...');
        resolve();
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
// 6. PUSH NOTIFICATIONS
// ==========================================
self.addEventListener('push', event => {
  console.log('[Service Worker] Push Notification Received');
  
  let notificationData = { title: 'Automation App', body: 'New update available in the system.' };
  
  try {
    if (event.data) {
      notificationData = event.data.json();
    }
  } catch (e) {
    console.log('[Service Worker] Push data is text, not JSON');
    notificationData.body = event.data.text();
  }

  const options = {
    body: notificationData.body,
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 'tabreed-app'
    },
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// ==========================================
// 7. NOTIFICATION CLICK HANDLING
// ==========================================
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification Clicked');
  event.notification.close();

  if (event.action !== 'close') {
    // Open app logic
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
        // If app is already open, focus it
        for (let i = 0; i < windowClients.length; i++) {
          let client = windowClients[i];
          if (client.url.includes('/NEW.html') && 'focus' in client) {
            return client.focus();
          }
        }
        // If app is closed, open a new window
        if (clients.openWindow) {
          return clients.openWindow('/NEW.html');
        }
      })
    );
  }
});
