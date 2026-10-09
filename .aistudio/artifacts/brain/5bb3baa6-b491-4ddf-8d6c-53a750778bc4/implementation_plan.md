# Web Push Notification System & Developer Push Studio

Implement an end-to-end Web Push Notification System for the Tabreed PWA, featuring a standalone Developer Push Management Studio, browser notification permission request workflow, hybrid VAPID server dispatch with client broadcast fallback, and subscriber targeting.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were clarified and confirmed during interactive discovery:

- **Integration Surface (Confirmed)**: Dedicated standalone Developer Push Management page (`push-studio.html` / `push-manager`), linked directly from the Developer Tools grid in the main dashboard (`index.html`).
- **Delivery Architecture (Confirmed)**: Hybrid delivery model combining full background Web Push (VAPID keys + Service Worker `push` event) with instant local Notification API fallback for active browser sessions.
- **Targeting & Controls (Confirmed)**: Interactive control panel with single-device self-test ("Test Send to Self") and mass broadcast ("Broadcast to All Subscribed Users"), complete with customizable notification title, message body, target URL, and dispatch statistics.

---

### 1. Overview & Core Concept

- **What It Does**: Enables the Tabreed Automation WebApp to request Chrome/browser notification permissions from users, store push subscriptions securely, and allow authorized developers/admins to compose and dispatch push notifications that wake up devices even when the app is in the background or closed.
- **Target Audience / Persona**: Lead developers, plant supervisors, and automation engineers (Abdul Majeed / Developer role) dispatching critical operational announcements, work order notices, and calibration alerts.
- **Key Value**: Immediate delivery of critical industrial updates directly to mobile and desktop system trays without relying on external third-party messaging services.

---

### 2. User Experience & Visual Design

#### A. Key User Flows

1. **Permission Request & Subscription Flow**:
   - User visits the WebApp (or the Developer Push Studio).
   - A non-intrusive permission card or header banner displays current notification status (`Default`, `Granted`, or `Denied`).
   - Clicking **"Enable Push Notifications"** triggers the native Chrome permission dialog (`Notification.requestPermission()`).
   - On approval, the Service Worker subscribes to PushManager using the server's public VAPID key and registers the subscription endpoint with `/api/push/subscribe`.
   - The UI updates immediately with a verified status indicator (`Subscribed & Active`).

2. **Developer Tools Access Flow**:
   - The developer logs in with Super Admin / Master Developer credentials (`lkku` / `41764`).
   - The Developer Tools section reveals a dedicated tile: **Push Notification Studio** (with subtitle *"Broadcast & Device Manager"* and a bell icon).
   - Clicking the tile navigates to `push-studio.html` (or opens full-page standalone management).

3. **Notification Composition & Dispatch Flow**:
   - The Developer Push Studio features:
     - **Quick Templates**: One-click preset chips (e.g. *"🚨 Urgent Plant Alarm"*, *"🛠️ Work Order Assigned"*, *"⚡ Calibration Due Alert"*).
     - **Notification Composer**: Form with Title, Body message, Destination URL (e.g., `/Operation_Request.html`), Icon picker, and Tag deduplication.
     - **Live Notification Preview**: Realistic simulated Android/Windows lock screen notification card that updates live as the developer types.
     - **Self-Test Action**: *"Send Test to This Device"* to verify formatting and sound without spamming all subscribers.
     - **Broadcast Action**: *"Broadcast to All Subscribed Devices"* with confirmation modal showing active recipient count, delivering via backend server route `/api/push/broadcast`.
     - **Delivery Feedback & Log**: Real-time delivery counter (`Delivered: X | Expired: Y | Failed: Z`) and persistent dispatch history table.

#### B. Visual Identity & Theme

- **Design Tone**: High-density industrial developer console conforming to Tabreed's dark palette (`#0a0f1d` page background, `#131c31` surface cards, `#1e2c4a` hairline dividers).
- **Typography**: `Plus Jakarta Sans` for titles and labels; monospace tabular figures (`font-mono tabular-nums`) for subscriber counts, device stats, and timestamps.
- **Layout Rhythm**: 2-column desktop layout on widescreen (Left: Composer & Subscriber Stats; Right: Live Device Preview & Dispatch Log), gracefully collapsing to a single-column flow on mobile devices.
- **Color Accent Discipline**: Primary action blue (`#3b82f6`), success emerald (`#10b981`), caution amber (`#f59e0b`), and danger crimson (`#ef4444`) strictly reserved for functional status.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Native Web-Push Node Route Integration over External Push Vendors**
  - *Chosen Approach*: Mount the VAPID push endpoints directly inside `server.js` (`/api/push/*`) using the pre-installed `web-push` library.
  - *Why*: 100% self-hosted, zero subscription costs, no third-party data leakage, and works offline/locally in the AI Studio environment.
  - *Alternatives Considered*: Firebase Cloud Messaging (FCM) or OneSignal were bypassed to keep the app fully standalone and zero-dependency on external cloud credentials.

- **Decision 2: Hybrid Delivery Fallback**
  - *Chosen Approach*: If a user's browser has granted notification permission but background push service worker registration is throttled or offline, the client can still trigger instant local notification via `new Notification(title, options)`.
  - *Why*: Guarantees testability and immediate developer feedback inside local sandboxes, iframes, and varying browser permission states.

- **Decision 3: Standalone Developer Page vs. Inline Modal**
  - *Chosen Approach*: Standalone dedicated page (`push-studio.html`) promoted from `/push-draft/push-tester.html` and integrated into Developer Tools.
  - *Why*: Mobile browser permission prompts inside nested modals or iframes are often blocked by Chrome security policies; a top-level page ensures reliable native OS notification prompts.

---

### 4. Technical Architecture & Data Strategy

#### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          TABREED WEB APPLICATION                       │
│                                                                        │
│   [index.html]                  [push-studio.html]                     │
│   - Developer Tools Tile        - Push Composer & Templates            │
│   - Permission Prompt Hook      - Live Android/Windows Preview         │
│   - BackgroundSync Init         - Dispatcher (Test & Broadcast)        │
└───────────────┬───────────────────────────────┬────────────────────────┘
                │                               │
                │ Web Push Subscription Object  │ Push Broadcast Request
                ▼                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        NODE.JS BACKEND (server.js)                     │
│                                                                        │
│   GET  /api/push/status     --> Active subscribers, OS distribution    │
│   POST /api/push/subscribe  --> Persist device endpoint in /data/      │
│   POST /api/push/send-test  --> Single-device VAPID web-push           │
│   POST /api/push/broadcast  --> Multi-device loop with prune logic     │
│                                                                        │
│   Storage: /data/push_subscriptions.json                               │
└───────────────┬───────────────────────────────┬────────────────────────┘
                │                               │
                │ VAPID Payload                 │ Web Push Protocol
                ▼                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 BROWSER SERVICE WORKER (sw.js)                         │
│                                                                        │
│   - self.addEventListener('push')         --> showNotification()       │
│   - self.addEventListener('notificationclick') --> focus / openWindow() │
│   - Periodic Sync & Log Cleaner                                        │
└────────────────────────────────────────────────────────────────────────┘
```

#### Component & Implementation Tasks

1. **Backend Integration (`server.js`)**:
   - Import and mount push routes from `push-draft/server-push-routes.js` (refactored to store subscriptions in `data/push_subscriptions.json`).
   - Expose public VAPID key via `/api/push/status` and `/api/push/public-key`.
   - Provide prune logic for expired subscriptions (HTTP 404 / 410 Gone).

2. **Service Worker Push Handlers (`sw.js`)**:
   - Merge active push listeners from `push-draft/sw-push-handlers.js` into `/sw.js`.
   - Handle notification clicks to focus existing app windows or open the target URL.

3. **Standalone Developer Push Studio (`push-studio.html`)**:
   - Create production-ready `push-studio.html` based on the validated tester in `/push-draft/push-tester.html`.
   - Add authentication guard (Super Admin / Developer access only).
   - Wire up live subscriber statistics, self-test sender, and broadcast dispatcher.

4. **Dashboard Integration (`index.html`)**:
   - Add the **Push Notification Studio** tile inside the `#dev-tools-group` section.
   - Wire up click navigation to `push-studio.html`.
   - Add prompt capability in the client app so normal users can grant Chrome notification permission.
