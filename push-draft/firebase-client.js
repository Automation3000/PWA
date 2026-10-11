// firebase-client.js - Modular Firebase Client SDK for Tabreed PWA
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDKe62MqeAwRIcgKnw9RdOVwYSerZggRKs",
  authDomain: "push-24f80.firebaseapp.com",
  projectId: "push-24f80",
  storageBucket: "push-24f80.firebasestorage.app",
  messagingSenderId: "842767543058",
  appId: "1:842767543058:web:91f3905e4cbd64c3eca1cb",
  measurementId: "G-BJFJCC01VK"
};

export const app = initializeApp(firebaseConfig);

let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (e) {
  // Analytics is optional in sandboxes/non-browser contexts
}

let messaging = null;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
  try {
    messaging = getMessaging(app);
  } catch (e) {
    console.warn('[Firebase] Messaging init warning:', e.message);
  }
}

export { analytics, messaging };

/**
 * Request FCM Device Token & register with backend
 */
export async function requestFCMToken(vapidKey) {
  if (!messaging) {
    throw new Error('Firebase Messaging is not supported on this browser context.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied in browser.');
  }

  // Register or ensure firebase-messaging-sw.js is ready
  let swReg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
  if (!swReg) {
    swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  }
  await navigator.serviceWorker.ready;

  const tokenOptions = { serviceWorkerRegistration: swReg };
  if (vapidKey) {
    tokenOptions.vapidKey = vapidKey;
  }

  const token = await getToken(messaging, tokenOptions);
  if (!token) {
    throw new Error('No FCM registration token received from Firebase.');
  }

  // Save token locally
  localStorage.setItem('tabreed_fcm_token', token);

  // Send to backend
  const currentUser = (typeof TabreedAuth !== 'undefined' && TabreedAuth.getUser && TabreedAuth.getUser())
    ? (TabreedAuth.getUser().name || TabreedAuth.getUser().code)
    : 'Developer';

  const res = await fetch('/api/firebase/save-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      user: currentUser,
      projectId: firebaseConfig.projectId,
      timestamp: new Date().toISOString()
    })
  });

  const resData = await res.json();
  return { token, serverResponse: resData };
}

/**
 * Listen for foreground notifications when tab is open
 */
export function onFirebaseForegroundMessage(callback) {
  if (messaging) {
    return onMessage(messaging, callback);
  }
  return () => {};
}

// Expose globally on window for easy access
if (typeof window !== 'undefined') {
  window.TabreedFirebase = {
    config: firebaseConfig,
    app,
    analytics,
    messaging,
    requestToken: requestFCMToken,
    onForegroundMessage: onFirebaseForegroundMessage
  };
}
