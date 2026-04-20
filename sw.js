importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

const CACHE = "automation-hub-cache-v2";
const offlineFallbackPage = "./index.html"; // Updated to index.html for SPA

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Install & Cache Core App Shell
self.addEventListener('install', async (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      // Pre-cache core files to ensure offline load
      return cache.addAll([
        offlineFallbackPage,
        './manifest.json',
        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
      ]);
    })
  );
});

if (workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

// 1. ASSET CACHING (Styles, Scripts, Workers)
workbox.routing.registerRoute(
  ({request}) => request.destination === 'style' || request.destination === 'script' || request.destination === 'worker',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'assets',
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [200],
      }),
    ],
  })
);

// 2. IMAGE CACHING
workbox.routing.registerRoute(
  ({request}) => request.destination === 'image',
  new workbox.strategies.CacheFirst({
    cacheName: 'images',
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [200],
      }),
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);

// 3. BACKGROUND SYNC (For offline data submission queuing)
const bgSyncPlugin = new workbox.backgroundSync.BackgroundSyncPlugin('offline-queue', {
  maxRetentionTime: 24 * 60 // Retry for up to 24 hours
});

// Setup background sync for Google Apps Script execution URLs
workbox.routing.registerRoute(
  /https:\/\/script\.google\.com\/macros\/s\/.*\/exec/,
  new workbox.strategies.NetworkOnly({
    plugins: [bgSyncPlugin]
  }),
  'POST'
);

// 4. PERIODIC BACKGROUND SYNC
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'content-sync') {
    console.log('Periodic sync triggered!');
  }
});

// 5. PUSH NOTIFICATIONS
self.addEventListener('push', function(event) {
  if (event.data) {
    const options = {
      body: event.data.text(),
      icon: 'https://automation3000.github.io/PWA/icon-192.png',
      badge: 'https://automation3000.github.io/PWA/icon-192.png'
    };
    event.waitUntil(self.registration.showNotification('Automation 3000 Tabreed', options));
  }
});

// 6. DEFAULT OFFLINE ROUTING & NAVIGATION
workbox.routing.registerRoute(
  new RegExp('/*'),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: CACHE
  })
);

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preloadResp = await event.preloadResponse;
        if (preloadResp) return preloadResp;
        return await fetch(event.request);
      } catch (error) {
        const cache = await caches.open(CACHE);
        return await cache.match(offlineFallbackPage);
      }
    })());
  }
});
