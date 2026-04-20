const CACHE_NAME = 'tabreed-pro-v3'; 
const STATIC_ASSETS = [
  '/',                // <-- Yahan se dot hataya
  '/index.html',      // <-- Yahan se dot hataya
  '/manifest.json',   // <-- Yahan se dot hataya
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.brandfetch.io/idYzxNpaam/w/400/h/400/theme/dark/icon.jpeg?c=1bxid64Mup7aczewSAYMX&t=1763636632146'
];

// 1. Install & Pre-cache (Speed badhane ke liye)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// 2. Smart Fetch Strategy
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Static Assets: Cache-First (Fastest)
  if (STATIC_ASSETS.includes(url.pathname) || event.request.destination === 'font') {
    event.respondWith(
      caches.match(event.request).then(response => response || fetch(event.request))
    );
  } 
  // Baki everything: Stale-While-Revalidate (Offline + Background Update)
  else {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
          return networkResponse;
        });
        return cachedResponse || fetchPromise;
      })
    );
  }
});
