# Tabreed PWA - Push Notification Module (Draft / Archive)

This folder contains the complete, production-ready Web Push Notification and Firebase Cloud Messaging (FCM) module archived as a draft for future activation as requested.

---

## Included Modules

1. **`push-studio.html` & `push-tester.html`**:
   - Full Developer Tools Push Studio UI.
   - Live diagnostics, Chrome permission requesting, subscription tokens viewer, and test-to-self / broadcast buttons.
   - Real-time subscriber count & diagnostic logs.

2. **`push-manager.js`**:
   - Client-side push coordinator (`window.PushNotificationManager`).
   - Handles VAPID subscriptions, fallback to local notifications, platform detection (Android, iOS, Windows, macOS), and backend API syncing.

3. **`server-push.js` & `server-push-routes.js`**:
   - Node.js Express routes for `/api/push/*`:
     - `GET /api/push/status`
     - `GET /api/push/public-key`
     - `GET /api/push/subscribers`
     - `POST /api/push/subscribe`
     - `POST /api/push/unsubscribe`
     - `POST /api/push/send-test`
     - `POST /api/push/broadcast`
   - Persistent subscriber storage in `/data/push_subscriptions.json`.

4. **`firebase-client.js` & `firebase-messaging-sw.js`**:
   - Firebase SDK client initialization with project `push-24f80`.
   - VAPID key: `BGYLdbt1Qwm1lCvdWE61sDdHwZHlIEs3oj9elDrXBUdoO37F0X12RJfiGJqrLyoNw74FwuDqetL17Ngo8GHMd3E`.
   - Background FCM Service Worker.

5. **`sw-push-handlers.js`**:
   - Service worker `push` and `notificationclick` listeners with custom vibrations and action buttons.

---

## How to Re-Activate Later

1. **Backend**:
   - In `server.js`, import and call `registerPushRoutes(app)` from `./push-draft/server-push.js`.
2. **Service Worker**:
   - In `sw.js`, import or append handlers from `./push-draft/sw-push-handlers.js`.
3. **Frontend**:
   - Link `push-studio.html` from `index.html` Developer Tools tile grid.
