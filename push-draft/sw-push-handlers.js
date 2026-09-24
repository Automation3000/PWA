// ==========================================
// PUSH DRAFT: ARCHIVED SERVICE WORKER PUSH LISTENERS
// ==========================================
// To re-enable push in sw.js, paste these listeners back into /sw.js

self.addEventListener('push', event => {
  console.log('[Service Worker] Push Notification Received');
  
  let notificationData = { 
    title: 'Tabreed Pro Alert', 
    body: 'New notification from system.',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    url: '/index.html'
  };
  
  try {
    if (event.data) {
      const parsed = event.data.json();
      notificationData = { ...notificationData, ...parsed };
    }
  } catch (e) {
    console.log('[Service Worker] Push data is text, not JSON');
    if (event.data) {
      notificationData.body = event.data.text();
    }
  }

  // Cross-Platform Options (Windows, Android, iOS 16.4+)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const options = {
    body: notificationData.body,
    icon: notificationData.icon || '/icon-192.png',
    badge: notificationData.badge || '/icon-72.png',
    tag: notificationData.tag || ('tabreed-' + Date.now()),
    renotify: true,
    data: {
      dateOfArrival: Date.now(),
      url: notificationData.url || '/index.html'
    }
  };

  if (!isIOS) {
    options.vibrate = [200, 100, 200];
    options.actions = [
      { action: 'open', title: 'Open App' },
      { action: 'close', title: 'Dismiss' }
    ];
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = (event.notification.data && event.notification.data.url) || '/index.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let i = 0; i < windowClients.length; i++) {
        let client = windowClients[i];
        if ('focus' in client) {
          if (client.url.includes(targetUrl) || client.url.includes('/index.html') || client.url.endsWith('/')) {
            return client.focus();
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
