# 🔔 Tabreed 100% Self-Hosted Web Push Notification Architecture

Zero 3rd-party hosting required (no Render, Railway, or Glitch).
Everything runs directly between your **GitHub Repository (`server.js`)**, **PWA App**, and **Google Sheets (`Code.gs`)**.

---

## 🏗 System Architecture (Zero 3rd Party Dependencies)

```
[ PWA App / Employee Devices ]
       │
       │ 1. Device Subscribes (VAPID Public Key)
       ▼
[ Self-Hosted Express Server (server.js in your GitHub Repo) ]
       │
       ├─▶ Saves device to local subscriptions.json
       ├─▶ Syncs backup record to Google Sheets ("Subscriptions")
       │
       ▼ (When Developer broadcasts in PWA or clicks "Send Push" in Google Sheet)
[ Native 'web-push' Module in server.js ]
       │
       │ 2. Signs & Encrypts VAPID Payload with Private Key (RFC 8291 / 8292)
       ▼
[ Direct Browser Push Service (Google FCM / Mozilla / Apple APNs) ]
       │
       │ 3. Delivers Instant Alert (Even if Browser/Tab is Closed)
       ▼
[ Service Worker (sw.js) ] ──▶ Push Banner, Sound & Vibration Popup
```

---

## 🔑 Your VAPID Credentials
- **Public Key:** `BF1FJVnaTi9Zd1Bl4sjSrz9ALDS9LI__Bl5JjKL0cHkHt-UcR38IX0CXVLO_jw18AGubhNI2a-i7Nr8FbC3wluk`
- **Private Key:** `uJ3D-WWMjIYp_9Xm7xdu1OCsx2caeN9ZIauS825BUjQ`
- **Subject:** `mailto:qadriabdulmajid@gmail.com`

---

## 📱 Multi-Platform Support: Windows, iOS, and Android

The self-hosted push architecture works across **Windows**, **Android**, and **Apple iOS (16.4+)**:

### 1. 💻 Windows (Windows 10 & 11)
- **Supported Browsers:** Google Chrome, Microsoft Edge, Mozilla Firefox, Brave, and installed PWA.
- **Experience:** Notifications appear natively in the **Windows Action Center** (bottom right corner banner) with sounds, badges, and click-to-open actions.
- **How to Subscribe:** Open app in Chrome/Edge, click **"Enable Permission"**, and allow notifications in the browser prompt.

### 2. 🤖 Android (Smartphones & Tablets)
- **Supported Browsers:** Chrome, Edge, Samsung Internet, Firefox, and installed PWA.
- **Experience:** Push notifications appear in the **Android System Notification Shade** with vibration pattern `[200, 100, 200]`, app icon, and action buttons. Works even when the browser or phone screen is locked/sleeping!
- **How to Subscribe:** Open app in Android Chrome/Edge, tap **"Enable Permission"**, and tap **"Allow"**.

### 3. 🍎 Apple iOS (iPhone & iPad - iOS 16.4+)
- **Apple's Requirement:** Apple APNs requires web apps to be installed as a **Standalone PWA on the Home Screen** to receive Push Notifications. Standard Safari browser tabs do not receive background push.
- **How to Subscribe on iPhone / iPad:**
  1. Open the app URL in **Safari** on iOS 16.4+.
  2. Tap the **Share icon (⎋)** at the bottom of Safari.
  3. Scroll down and tap **"Add to Home Screen" (⊞)**.
  4. Tap **"Add"** in the top right.
  5. Close Safari and tap the new **Tabreed** icon on your iPhone Home Screen.
  6. In the app, go to **Offline Tools ➔ Push Dispatcher** (or open `/push-tester.html`) and tap **"Enable Permission"**.
  7. When Apple's native prompt appears: *"Tabreed would like to send you notifications"*, tap **"Allow"**.
  8. Your iPhone token is now registered with Apple APNs and Google Sheets!

---

## 🚀 How It Works (100% Self-Contained)

1. **Native App Engine (`server.js`):**
   - Installed `web-push` npm package directly into this repository.
   - Provides native routes:
     - `GET  /api/push/status` (Health check & subscriber count)
     - `POST /api/push/subscribe` (Saves browser device token)
     - `POST /api/push/broadcast` (Directly encrypts & sends push to all devices)
     - `POST /api/push/send-test` (Immediate test to your current screen)

2. **Google Sheets Integration (`Code.gs`):**
   - Saves all subscribed devices, names, and timestamps in your Google Sheet ("Subscriptions").
   - Can trigger broadcasts via `sendPushFromGoogleSheet()` by pinging your app's `/api/push/broadcast`.

3. **PWA Developer Console (`index.html`):**
   - Push Dispatcher tile in **"Offline Tools & Support"** (Developer-only).
   - Compose custom alerts, pick quick templates, and click "Send Push Notification". No external dashboard needed!

1. Create a repository on GitHub (e.g., `tabreed-push-server`).
2. Copy the files from `/push-notification-server/`:
   - `server.js`
   - `package.json`
3. Deploy to **Render.com** (Free) or **Railway.app**:
   - New Web Service ➜ Connect your GitHub repository.
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Set Environment Variables (optional, since keys are already configured in code):
     - `PORT`: `4000` (or host assigned)
     - `VAPID_PUBLIC_KEY`: `BF1FJVnaTi9Zd1Bl4sjSrz9ALDS9LI__Bl5JjKL0cHkHt-UcR38IX0CXVLO_jw18AGubhNI2a-i7Nr8FbC3wluk`
     - `VAPID_PRIVATE_KEY`: `uJ3D-WWMjIYp_9Xm7xdu1OCsx2caeN9ZIauS825BUjQ`
     - `VAPID_SUBJECT`: `mailto:qadriabdulmajid@gmail.com`
4. Copy your live server URL (e.g., `https://tabreed-push.onrender.com`).
5. Verify in browser: Visiting `https://your-node-server.onrender.com/` will return:
   ```json
   { "status": "online", "service": "Tabreed Web Push Notification Encryption Server" }
   ```

---

### STEP 2: Configure Google Apps Script Project

1. Open your Google Sheet (or create a dedicated Google Sheet named **"Tabreed Push Notifications"**).
2. Go to **Extensions ➜ Apps Script**.
3. Replace the contents of `Code.gs` with the exact code from:
   `/push-notification-server/Code.gs`
4. In `Code.gs`, line 24, replace:
   ```javascript
   var NODE_SERVER_URL = 'YOUR_NODEJS_PUSH_SERVER_URL';
   ```
   with your live Node.js server URL from Step 1 (e.g., `https://tabreed-push.onrender.com` without trailing slash).
5. Click **Deploy ➜ New deployment**:
   - Select type: **Web app**
   - Description: `Tabreed Push Webhook v1`
   - Execute as: **Me** (`your-email@gmail.com`)
   - Who has access: **Anyone** *(Crucial: allows client browsers to save subscription)*
   - Click **Deploy**.
6. Authorize permissions when prompted by Google.
7. Copy the **Web App URL** (e.g., `https://script.google.com/macros/s/AKfycb.../exec`).

---

### STEP 3: Configure Frontend (`/push-manager.js`)

1. Open `/push-manager.js` in your web application.
2. In line 15, update the placeholder:
   ```javascript
   gasWebhookUrl: 'YOUR_GOOGLE_APPS_SCRIPT_WEBAPP_URL',
   ```
   Paste the Web App URL obtained from Step 2.
3. Users can enable notifications directly from:
   - **Settings ➜ Web Push Notifications** switch.
   - Or by calling `PushNotificationManager.subscribe()` from anywhere in the app!

---

### STEP 4: How to Send Push Notifications

#### Method A: Directly from Google Sheets Menu
1. Open your Google Sheet and refresh the page.
2. You will see a new menu bar item: **🔔 Push Notifications**.
3. Click **🔔 Push Notifications ➜ Send Push to All Users**.
4. Enter the Title (e.g., `New Emergency WO #1042`).
5. Enter the Message (e.g., `ETS-04 chiller pump trip reported by Plant Operator.`).
6. Click **OK**. Google Apps Script sends the request to your Node.js encryption server, and all active devices will ring/vibrate with the notification!

#### Method B: From an automated Google Sheets Trigger / Script
Call the function inside any Google Apps Script automation:
```javascript
sendPushFromGoogleSheet(
  "Work Order Updated", 
  "WO #1088 has been signed by Lead Engineer.",
  "/index.html"
);
```

---

## 🛡 Automatic Cleanup of Expired Devices

If a user uninstalls the app or clears their browser permissions, the push service returns HTTP `410 Gone`. Both the Node.js server and Google Apps Script automatically detect this and set the device status in your Google Sheet to **`expired`**, preventing unnecessary requests and keeping your sheet pristine!
