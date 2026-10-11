// firebase-messaging-sw.js - Firebase Cloud Messaging Background Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDKe62MqeAwRIcgKnw9RdOVwYSerZggRKs",
  authDomain: "push-24f80.firebaseapp.com",
  projectId: "push-24f80",
  storageBucket: "push-24f80.firebasestorage.app",
  messagingSenderId: "842767543058",
  appId: "1:842767543058:web:91f3905e4cbd64c3eca1cb",
  measurementId: "G-BJFJCC01VK"
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw] Received background message:', payload);
    const title = payload.notification?.title || payload.data?.title || 'Tabreed Alert 🔔';
    const options = {
      body: payload.notification?.body || payload.data?.body || 'New update from Tabreed Automation.',
      icon: payload.notification?.icon || '/icon-192.png',
      badge: '/icon-72.png',
      vibrate: [200, 100, 200],
      data: {
        url: payload.data?.url || (payload.fcmOptions && payload.fcmOptions.link) || '/index.html'
      }
    };

    self.registration.showNotification(title, options);
  });
} catch (e) {
  console.warn('[firebase-messaging-sw] Init notice:', e.message);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
