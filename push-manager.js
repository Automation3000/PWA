/**
 * Tabreed Pro - Web Push Notification Client Manager
 * Handles Service Worker registration, permission request, VAPID key conversion,
 * Push Subscription generation, and transmission to Google Apps Script.
 */

// 1. CONFIGURATION
const PUSH_CONFIG = {
  // Provided VAPID Public Key
  vapidPublicKey: 'BF1FJVnaTi9Zd1Bl4sjSrz9ALDS9LI__Bl5JjKL0cHkHt-UcR38IX0CXVLO_jw18AGubhNI2a-i7Nr8FbC3wluk',
  
  // Google Apps Script Web App for Google Sheets Sync (Optional / Automated)
  gasWebhookUrl: 'https://script.google.com/macros/s/AKfycbwnUqgWqfPwnPLtmsSXvXfqNj66wcOjVoft3ou_t4RDBQ-Iscyp3wuiv45Z1o9UND6OZQ/exec',
  
  // Self-Hosted Node.js Push Server (Uses the current app origin directly - NO 3rd party needed)
  nodeServerUrl: window.location.origin
};

/**
 * Utility to convert URL-safe base64 VAPID public key into a Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if Push Notifications and Service Workers are supported
 */
function isPushNotificationSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Get current push subscription if already active
 */
async function getExistingPushSubscription() {
  if (!isPushNotificationSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn('[PushManager] Error fetching existing subscription:', err);
    return null;
  }
}

/**
 * Request notification permission and subscribe device to Push Service
 * @param {string} [gasUrl] Optional override for Google Apps Script Web App URL
 * @returns {Promise<{success: boolean, subscription?: PushSubscription, error?: string}>}
 */
async function subscribeUserToPush(gasUrl) {
  if (!isPushNotificationSupported()) {
    return { success: false, error: 'Push notifications are not supported on this browser/device.' };
  }

  try {
    // Step 1: Ensure Service Worker is active
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js');
    }
    await navigator.serviceWorker.ready;

    // Step 2: Request User Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { 
        success: false, 
        error: permission === 'denied' 
          ? 'Notification permission was denied. Please allow notifications in your browser settings.' 
          : 'Notification permission request was dismissed.' 
      };
    }

    // Step 3: Check for existing subscription or create new
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(PUSH_CONFIG.vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
    }

    // Step 4: Prepare payload for Google Sheets / Google Apps Script
    const subJson = subscription.toJSON();
    const currentUser = (typeof currentAuthUser !== 'undefined' && currentAuthUser) 
      ? (currentAuthUser.name || currentAuthUser.email || currentAuthUser.code || 'User') 
      : 'Anonymous User';

    const payload = {
      action: 'subscribe',
      timestamp: new Date().toISOString(),
      user: currentUser,
      userAgent: navigator.userAgent,
      endpoint: subJson.endpoint,
      keys: {
        p256dh: (subJson.keys && subJson.keys.p256dh) || '',
        auth: (subJson.keys && subJson.keys.auth) || ''
      },
      rawSubscription: JSON.stringify(subJson)
    };

    // Step 5: Send subscription to local server engine & Google Apps Script
    // 5a. Save to self-hosted Node.js push engine (in GitHub repository)
    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log('[PushManager] Subscription registered on self-hosted push engine');
    } catch (localErr) {
      console.warn('[PushManager] Local registration note:', localErr);
    }

    // 5b. Also save directly to Google Sheets via Google Apps Script (if configured)
    const targetUrl = gasUrl || PUSH_CONFIG.gasWebhookUrl;
    if (targetUrl && targetUrl !== 'YOUR_GOOGLE_APPS_SCRIPT_WEBAPP_URL') {
      try {
        await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        console.log('[PushManager] Subscription successfully saved to Google Sheets');
      } catch (postErr) {
        console.warn('[PushManager] Webhook POST warning:', postErr);
      }
    }

    // Also store locally in localStorage for reference
    try {
      localStorage.setItem('tabreed_push_subscription', JSON.stringify(subJson));
      localStorage.setItem('tabreed_push_enabled', 'true');
    } catch(e) {}

    return { success: true, subscription: subJson };

  } catch (error) {
    console.error('[PushManager] Error during subscription flow:', error);
    return { success: false, error: error.message || 'Failed to complete push subscription.' };
  }
}

/**
 * Unsubscribe user from push notifications
 */
async function unsubscribeUserFromPush(gasUrl) {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      const subJson = subscription.toJSON();
      await subscription.unsubscribe();

      // Notify local server engine
      try {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subJson.endpoint })
        });
      } catch(e) {}

      // Notify Google Apps Script
      const targetUrl = gasUrl || PUSH_CONFIG.gasWebhookUrl;
      if (targetUrl && targetUrl !== 'YOUR_GOOGLE_APPS_SCRIPT_WEBAPP_URL') {
        try {
          await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'unsubscribe',
              endpoint: subJson.endpoint
            })
          });
        } catch(e) {}
      }

      localStorage.removeItem('tabreed_push_subscription');
      localStorage.setItem('tabreed_push_enabled', 'false');
      return { success: true };
    }
    return { success: true, message: 'No active subscription found.' };
  } catch (error) {
    console.error('[PushManager] Error unsubscribing:', error);
    return { success: false, error: error.message };
  }
}

// Helper: Get active endpoints (with localStorage override)
function getActiveGasUrl() {
  return localStorage.getItem('tabreed_gas_push_url') || PUSH_CONFIG.gasWebhookUrl;
}

function getActiveNodeUrl() {
  return localStorage.getItem('tabreed_node_push_url') || PUSH_CONFIG.nodeServerUrl;
}

/**
 * Dispatch broadcast push notification to all users
 * Direct execution via Self-Hosted Node.js Server (with Google Sheets backup)
 */
async function broadcastPushNotification({ title, message, url }) {
  const currentUser = (typeof currentAuthUser !== 'undefined' && currentAuthUser)
    ? (currentAuthUser.name || currentAuthUser.code || 'Developer')
    : 'Developer';

  const payload = {
    action: 'broadcast_push',
    title: title || 'Tabreed Alert',
    message: message || 'You have an important update.',
    url: url || '/index.html',
    sender: currentUser,
    timestamp: new Date().toISOString()
  };

  // Primary: Dispatch via Self-Hosted Server in current repo
  try {
    const res = await fetch('/api/push/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const resData = await res.json();

    if (res.ok && resData.success) {
      // Record in local dispatch log
      recordDispatchLog({
        title: payload.title,
        message: payload.message,
        url: payload.url,
        audience: 'All Registered Devices',
        status: 'Dispatched',
        result: resData.summary || 'Delivered to registered devices',
        timestamp: new Date().toISOString()
      });

      // Also trigger Google Apps Script if URL provided
      const gasUrl = getActiveGasUrl();
      if (gasUrl && gasUrl !== 'YOUR_GOOGLE_APPS_SCRIPT_WEBAPP_URL') {
        fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        }).catch(() => {});
      }

      return {
        success: true,
        summary: resData.summary || 'Broadcast delivered via self-hosted engine.',
        data: resData
      };
    }
  } catch (err) {
    console.warn('[PushManager] Direct server broadcast error, trying fallback:', err);
  }

  // Fallback: Google Apps Script Webhook
  const gasUrl = getActiveGasUrl();
  if (gasUrl && gasUrl !== 'YOUR_GOOGLE_APPS_SCRIPT_WEBAPP_URL') {
    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const resData = await res.json();
      recordDispatchLog({
        title: payload.title,
        message: payload.message,
        url: payload.url,
        audience: 'All Registered Devices',
        status: 'Dispatched',
        result: resData.summary || 'Broadcast triggered via Google Apps Script',
        timestamp: new Date().toISOString()
      });
      return { success: true, summary: resData.summary || 'Broadcast initiated via Google Apps Script.', data: resData };
    } catch (gasErr) {
      console.error('[PushManager] GAS Fallback error:', gasErr);
    }
  }

  recordDispatchLog({
    title: payload.title,
    message: payload.message,
    url: payload.url,
    audience: 'All Registered Devices',
    status: 'Failed',
    result: 'Could not connect to broadcast endpoint',
    timestamp: new Date().toISOString()
  });

  return { success: false, error: 'Failed to broadcast notification. Ensure the server is running.' };
}

/**
 * Send instant test push to the current device
 */
async function sendLocalDeviceTest({ title, message, url }) {
  const testTitle = title || 'Test Push Alert 🔔';
  const testMsg = message || 'This is a test notification from Tabreed PWA.';
  const testUrl = url || '/index.html';

  try {
    // 1. Check Service Worker permission
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        return { success: false, error: 'Notification permission is not granted in your browser.' };
      }
    }

    const reg = await navigator.serviceWorker.ready;

    // 2. Trigger notification via Service Worker
    await reg.showNotification(testTitle, {
      body: testMsg,
      icon: '/icon-192.png',
      badge: '/icon-72.png',
      vibrate: [200, 100, 200],
      tag: 'test-' + Date.now(),
      renotify: true,
      data: { url: testUrl }
    });

    // 3. Test through self-hosted VAPID push route
    const existingSub = await getExistingPushSubscription();
    let serverTested = false;

    if (existingSub) {
      try {
        const testRes = await fetch('/api/push/send-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: existingSub,
            title: testTitle + ' [Self-Hosted Echo]',
            message: testMsg,
            url: testUrl
          })
        });
        if (testRes.ok) serverTested = true;
      } catch(e) {}
    }

    recordDispatchLog({
      title: testTitle,
      message: testMsg,
      url: testUrl,
      audience: 'Current Test Device',
      status: 'Success',
      result: serverTested ? 'Delivered via SW & Self-Hosted Engine' : 'Delivered locally via Service Worker',
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      message: serverTested ? 'Notification delivered and verified through self-hosted VAPID engine!' : 'Notification delivered directly to this device.'
    };
  } catch (err) {
    console.error('[PushManager] Test error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Ping Self-Hosted Push Server to verify health & responsiveness
 */
async function pingNodeServer() {
  const start = Date.now();
  try {
    const res = await fetch('/api/push/status', { method: 'GET' });
    const latency = Date.now() - start;
    if (res.ok) {
      const data = await res.json();
      return { online: true, latency, status: res.status, activeSubscribers: data.activeSubscribers };
    }
  } catch (e) {}

  // Fallback to checking active node url if different
  const nodeUrl = getActiveNodeUrl();
  if (nodeUrl && nodeUrl !== window.location.origin) {
    const cleanUrl = nodeUrl.replace(/\/+$/, '');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${cleanUrl}/api/push/status`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const latency = Date.now() - start;
      return { online: res.ok, latency, status: res.status };
    } catch (e) {
      return { online: false, error: e.message || 'Connection failed' };
    }
  }

  return { online: false, error: 'Self-hosted server unreachable' };
}

/**
 * Query active subscribers count from self-hosted engine or Google Apps Script
 */
async function fetchSubscriberStats() {
  // Try self-hosted engine first
  try {
    const res = await fetch('/api/push/status');
    if (res.ok) {
      const data = await res.json();
      return { success: true, total: data.totalRegistered || 0, activeCount: data.activeSubscribers || 0 };
    }
  } catch (e) {}

  // Fallback to Google Apps Script
  const gasUrl = getActiveGasUrl();
  if (gasUrl && gasUrl !== 'YOUR_GOOGLE_APPS_SCRIPT_WEBAPP_URL') {
    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'get_stats' })
      });
      const data = await res.json();
      return { success: true, total: data.total || 0, activeCount: data.activeCount || 0 };
    } catch (err) {}
  }

  return { success: false, error: 'Subscriber stats unavailable' };
}

/**
 * Local Dispatch Log Management
 */
function recordDispatchLog(entry) {
  try {
    const logs = JSON.parse(localStorage.getItem('tabreed_push_dispatch_log') || '[]');
    logs.unshift(entry);
    localStorage.setItem('tabreed_push_dispatch_log', JSON.stringify(logs.slice(0, 30)));
  } catch (e) {}
}

function getDispatchLog() {
  try {
    return JSON.parse(localStorage.getItem('tabreed_push_dispatch_log') || '[]');
  } catch (e) {
    return [];
  }
}

// Expose globally to window
window.PushNotificationManager = {
  config: PUSH_CONFIG,
  getActiveGasUrl,
  getActiveNodeUrl,
  isSupported: isPushNotificationSupported,
  getExistingSubscription: getExistingPushSubscription,
  subscribe: subscribeUserToPush,
  unsubscribe: unsubscribeUserFromPush,
  broadcast: broadcastPushNotification,
  sendTest: sendLocalDeviceTest,
  pingNodeServer,
  fetchSubscriberStats,
  getDispatchLog,
  recordDispatchLog
};
