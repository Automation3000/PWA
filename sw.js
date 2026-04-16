importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

const CACHE = "pwabuilder-offline-page";
const offlineFallbackPage = "offline.html";

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener('install', async (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(offlineFallbackPage))
  );
});

if (workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

// Asset Caching (Purple Fix)
workbox.routing.registerRoute(
  ({request}) => request.destination === 'image' || request.destination === 'script' || request.destination === 'style',
  new workbox.strategies.CacheFirst({
    cacheName: 'assets-cache',
  })
);

// Background Sync (Purple Fix)
const bgSyncPlugin = new workbox.backgroundSync.BackgroundSyncPlugin('offline-queue', {
  maxRetentionTime: 24 * 60
});
workbox.routing.registerRoute(
  /\/api\/.*\/*.json/,
  new workbox.strategies.NetworkOnly({
    plugins: [bgSyncPlugin]
  }),
  'POST'
);

// Periodic Background Sync (Purple Fix)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'content-sync') {
    console.log('Periodic sync triggered!');
  }
});

// Push Notifications
self.addEventListener('push', function(event) {
  if (event.data) {
    const options = {
      body: event.data.text(),
      icon: 'https://automation3000.github.io/PWA/icon-192.png',
      badge: 'https://automation3000.github.io/PWA/icon-192.png'
    };
    event.waitUntil(self.registration.showNotification('Automation 3000', options));
  }
});

// Default Offline Routing
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
