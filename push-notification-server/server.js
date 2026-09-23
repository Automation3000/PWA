import express from 'express';
import cors from 'cors';
import webpush from 'web-push';

const app = express();
const PORT = process.env.PORT || 4000;

// Enable CORS & JSON parsing
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 1. VAPID CONFIGURATION
// ==========================================
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BF1FJVnaTi9Zd1Bl4sjSrz9ALDS9LI__Bl5JjKL0cHkHt-UcR38IX0CXVLO_jw18AGubhNI2a-i7Nr8FbC3wluk';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'uJ3D-WWMjIYp_9Xm7xdu1OCsx2caeN9ZIauS825BUjQ';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:qadriabdulmajid@gmail.com';

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

console.log('[PushServer] VAPID details configured successfully.');

// ==========================================
// 2. HEALTH CHECK
// ==========================================
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Tabreed Web Push Notification Encryption Server',
    time: new Date().toISOString(),
    vapidPublicKey: VAPID_PUBLIC_KEY
  });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// ==========================================
// 3. SINGLE NOTIFICATION ENDPOINT
// Called by Google Apps Script UrlFetchApp.fetch()
// ==========================================
app.post('/send-notification', async (req, res) => {
  try {
    let { subscription, title, message, url, icon, badge, tag } = req.body;

    if (!subscription) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: "subscription"'
      });
    }

    // Parse subscription if sent as JSON string
    let subObj = subscription;
    if (typeof subscription === 'string') {
      try {
        subObj = JSON.parse(subscription);
      } catch (err) {
        return res.status(400).json({
          success: false,
          error: 'Invalid subscription JSON format'
        });
      }
    }

    // Validate endpoint
    if (!subObj.endpoint) {
      return res.status(400).json({
        success: false,
        error: 'Subscription object must contain an "endpoint"'
      });
    }

    // Build notification payload
    const payload = JSON.stringify({
      title: title || 'Tabreed Notification',
      body: message || req.body.body || 'You have a new update in the system.',
      url: url || '/index.html',
      icon: icon || '/icon-192.png',
      badge: badge || '/icon-72.png',
      tag: tag || ('notif-' + Date.now()),
      timestamp: Date.now()
    });

    // Send push notification via web-push
    const result = await webpush.sendNotification(subObj, payload);

    return res.status(200).json({
      success: true,
      statusCode: result.statusCode,
      message: 'Notification sent successfully to device'
    });

  } catch (error) {
    console.error('[PushServer] Error sending push notification:', error.statusCode || error.message);

    // If subscription is expired / revoked by browser (404 or 410 Gone)
    if (error.statusCode === 404 || error.statusCode === 410) {
      return res.status(410).json({
        success: false,
        expired: true,
        statusCode: error.statusCode,
        error: 'Subscription is no longer valid (expired or unregistered)'
      });
    }

    return res.status(500).json({
      success: false,
      statusCode: error.statusCode || 500,
      error: error.message || 'Failed to deliver push notification'
    });
  }
});

// ==========================================
// 4. BATCH NOTIFICATION ENDPOINT (Optional Bulk)
// Allows Google Apps Script to send 1 request for all devices
// ==========================================
app.post('/send-batch', async (req, res) => {
  try {
    const { subscriptions, title, message, url } = req.body;

    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Field "subscriptions" must be a non-empty array'
      });
    }

    const payload = JSON.stringify({
      title: title || 'Tabreed Notification',
      body: message || 'You have a new update.',
      url: url || '/index.html',
      timestamp: Date.now()
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        let subObj = typeof sub === 'string' ? JSON.parse(sub) : sub;
        try {
          return await webpush.sendNotification(subObj, payload);
        } catch (err) {
          throw { endpoint: subObj.endpoint, statusCode: err.statusCode, message: err.message };
        }
      })
    );

    let sent = 0;
    let failed = 0;
    const expiredEndpoints = [];

    results.forEach((r) => {
      if (r.status === 'fulfilled') {
        sent++;
      } else {
        failed++;
        const reason = r.reason || {};
        if (reason.statusCode === 404 || reason.statusCode === 410) {
          expiredEndpoints.push(reason.endpoint);
        }
      }
    });

    return res.status(200).json({
      success: true,
      total: subscriptions.length,
      sent,
      failed,
      expiredCount: expiredEndpoints.length,
      expiredEndpoints
    });

  } catch (error) {
    console.error('[PushServer] Error processing batch push:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Tabreed Push Server listening on port ${PORT}`);
  console.log(`🌐 Public VAPID Key: ${VAPID_PUBLIC_KEY.substring(0, 15)}...`);
  console.log(`====================================================`);
});
