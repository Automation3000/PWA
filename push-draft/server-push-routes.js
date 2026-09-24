// ==========================================
// PUSH DRAFT: ARCHIVED SERVER PUSH NOTIFICATION ROUTES & LOGIC
// ==========================================
// From server.js (Web Push Protocol endpoints)

import webpush from 'web-push';
import path from 'path';
import fs from 'fs';

const PUSH_SUBS_FILE = path.join(process.cwd(), 'push_subscriptions.json');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BF1FJVnaTi9Zd1Bl4sjSrz9ALDS9LI__Bl5JjKL0cHkHt-UcR38IX0CXVLO_jw18AGubhNI2a-i7Nr8FbC3wluk';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'uJ3D-WWMjIYp_9Xm7xdu1OCsx2caeN9ZIauS825BUjQ';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:qadriabdulmajid@gmail.com';
const PUSH_APPS_SCRIPT_URL = process.env.PUSH_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbxr-HQedn7rqxJ9zP7JmDnLtHnp8ad8PhQ0v8bpBI8pOvw8D4P14OI_ojVKyUBOzDdN/exec";

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (e) {
  console.warn('VAPID initialization notice:', e.message);
}

function loadSubscriptions() {
  try {
    if (fs.existsSync(PUSH_SUBS_FILE)) {
      const data = fs.readFileSync(PUSH_SUBS_FILE, 'utf8');
      return JSON.parse(data || '[]');
    }
  } catch (e) {
    console.error('Error loading subscriptions:', e.message);
  }
  return [];
}

function saveSubscriptions(subs) {
  try {
    fs.writeFileSync(PUSH_SUBS_FILE, JSON.stringify(subs, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving subscriptions:', e.message);
  }
}

export function registerPushRoutes(app) {
  // 1. Get Push Service Health & Stats
  app.get('/api/push/status', (req, res) => {
    const subs = loadSubscriptions();
    const activeSubs = subs.filter(s => s.status !== 'expired' && s.status !== 'unsubscribed');
    const platforms = {
      windows: activeSubs.filter(s => s.os === 'Windows' || /Windows/i.test(s.userAgent || '')).length,
      ios: activeSubs.filter(s => s.os === 'iOS' || /iPhone|iPad|iPod/i.test(s.userAgent || '')).length,
      android: activeSubs.filter(s => s.os === 'Android' || /Android/i.test(s.userAgent || '')).length,
      other: 0
    };
    platforms.other = Math.max(0, activeSubs.length - (platforms.windows + platforms.ios + platforms.android));

    res.json({
      status: 'online',
      service: 'Tabreed Self-Hosted Web Push Engine',
      repository: 'Automation3000/PWA',
      publicVapidKey: VAPID_PUBLIC_KEY,
      gasWebhookUrl: PUSH_APPS_SCRIPT_URL,
      totalRegistered: subs.length,
      activeSubscribers: activeSubs.length,
      platforms
    });
  });

  // 2. Register Device Subscription
  app.post('/api/push/subscribe', async (req, res) => {
    try {
      const { endpoint, keys, user, userAgent, rawSubscription, os, platform, isStandalone, browser } = req.body;
      if (!endpoint) {
        return res.status(400).json({ error: 'Missing subscription endpoint' });
      }

      const subs = loadSubscriptions();
      const existingIndex = subs.findIndex(s => s.endpoint === endpoint);
      const rawSubStr = rawSubscription || (typeof req.body.subscription === 'string' ? req.body.subscription : JSON.stringify(req.body.subscription || { endpoint, keys }));

      const detectedOs = os || (/iPhone|iPad|iPod/i.test(userAgent || '') ? 'iOS' : /Android/i.test(userAgent || '') ? 'Android' : /Windows/i.test(userAgent || '') ? 'Windows' : 'Other');

      const subRecord = {
        endpoint,
        keys: keys || {},
        user: user || 'Anonymous User',
        os: detectedOs,
        platform: platform || detectedOs,
        browser: browser || (/Chrome/i.test(userAgent || '') ? 'Chrome' : /Safari/i.test(userAgent || '') ? 'Safari' : /Edge/i.test(userAgent || '') ? 'Edge' : 'Browser'),
        isStandalone: !!isStandalone,
        userAgent: userAgent || '',
        rawSubscription: rawSubStr,
        subscribedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'active'
      };

      if (existingIndex >= 0) {
        subs[existingIndex] = { ...subs[existingIndex], ...subRecord, updatedAt: new Date().toISOString() };
      } else {
        subs.push(subRecord);
      }

      saveSubscriptions(subs);

      // Async sync to Google Sheets
      if (PUSH_APPS_SCRIPT_URL) {
        fetch(PUSH_APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'subscribe',
            endpoint,
            keys,
            user: subRecord.user,
            os: subRecord.os,
            platform: subRecord.platform,
            isStandalone: subRecord.isStandalone,
            browser: subRecord.browser,
            userAgent: subRecord.userAgent,
            timestamp: new Date().toISOString(),
            rawSubscription: rawSubStr
          })
        }).catch(err => console.warn('Push Google Sheets sync note:', err.message));
      }

      res.json({ success: true, message: 'Push subscription stored', record: subRecord });
    } catch (error) {
      console.error('Error in /api/push/subscribe:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 3. Unsubscribe Device
  app.post('/api/push/unsubscribe', async (req, res) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });

      const subs = loadSubscriptions();
      const updatedSubs = subs.map(s => s.endpoint === endpoint ? { ...s, status: 'unsubscribed', updatedAt: new Date().toISOString() } : s);
      saveSubscriptions(updatedSubs);

      if (PUSH_APPS_SCRIPT_URL) {
        fetch(PUSH_APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unsubscribe', endpoint })
        }).catch(e => console.warn('Unsubscribe GAS sync notice:', e.message));
      }

      res.json({ success: true, message: 'Unsubscribed successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 4. Send Test Push
  app.post('/api/push/send-test', async (req, res) => {
    try {
      let { subscription, title, message, url } = req.body;
      if (!subscription) return res.status(400).json({ error: 'Missing subscription object' });

      let subObj = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;
      const payload = JSON.stringify({
        title: title || 'Tabreed Alert 🔔',
        body: message || 'Test notification from Tabreed PWA',
        url: url || '/index.html',
        icon: '/icon-192.png',
        badge: '/icon-72.png',
        timestamp: Date.now()
      });

      const sendRes = await webpush.sendNotification(subObj, payload);
      res.json({ success: true, statusCode: sendRes.statusCode });
    } catch (error) {
      console.error('Error sending test push:', error);
      res.status(500).json({ error: error.message, statusCode: error.statusCode });
    }
  });

  // 5. Broadcast Push
  app.post('/api/push/broadcast', async (req, res) => {
    try {
      const { title, message, url, icon, badge } = req.body;
      const subs = loadSubscriptions();
      const payload = JSON.stringify({
        title: title || 'Tabreed Alert',
        body: message || 'You have an important update.',
        url: url || '/index.html',
        icon: icon || '/icon-192.png',
        badge: badge || '/icon-72.png',
        timestamp: Date.now()
      });

      let sent = 0, expired = 0, failed = 0, hasChanges = false;
      for (let i = 0; i < subs.length; i++) {
        const s = subs[i];
        if (s.status === 'expired' || s.status === 'unsubscribed') continue;
        let subObj = s.rawSubscription ? JSON.parse(s.rawSubscription) : { endpoint: s.endpoint, keys: s.keys };
        if (!subObj || !subObj.endpoint) continue;

        try {
          await webpush.sendNotification(subObj, payload);
          sent++;
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            subs[i].status = 'expired';
            expired++;
            hasChanges = true;
          } else {
            failed++;
          }
        }
      }

      if (hasChanges) saveSubscriptions(subs);

      const summary = `Delivered: ${sent} device(s) | Expired: ${expired} | Failed: ${failed}`;
      return res.json({ success: true, summary, stats: { sent, expired, failed, totalTargeted: sent + expired + failed } });
    } catch (error) {
      console.error('Error broadcasting push:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
