# TABREED AUTOMATION SYSTEM — DEEPSEEK AUDIT MASTER PROMPT
# Instructions: Copy and paste the entire block below into DeepSeek (DeepSeek-V3 or DeepSeek-R1).

```markdown
# Role & Mission
You are an Elite Principal Software Architect, Senior Security Auditor, and Full-Stack Systems Engineer.
You are tasked with conducting an exhaustive, zero-fluff code audit, vulnerability assessment, architecture review, and optimization roadmap for the **TABREED Automation Progressive Web Application (PWA)**.

---

## 1. System Overview & Technology Stack

The project is an industrial enterprise automation suite deployed for TABREED (District Cooling Operations in the UAE). It manages field instrumentation, shift work orders, emergency contacts, plant manuals, and Energy Transfer Stations (ETS).

- **Frontend**: Single-Page / Multi-Page hybrid PWA using Vanilla ES6+ JavaScript, HTML5, CSS3 with modern CSS custom property themes, Tailwind CSS, FontAwesome 6, SheetJS (xlsx), jsPDF, and Service Worker offline caching.
- **Backend**: Node.js (Express server running on port 3000), serving REST endpoints and acting as a reverse proxy to Google Apps Script (GAS) endpoints.
- **Data Persistence**:
  - Local disk storage: JSON flat files (`/data/employees.json`, `/data/team_contacts.json`, `/data/login_logs.json`, `/data/pwa_preferences.json`, `/data/documents.json`).
  - Cloud storage & sheets: Multi-tab Google Sheets accessed through Google Apps Script web apps (executables) handling real-time login audit trails and bi-directional work order syncing.
  - Client storage: `localStorage`, `sessionStorage`, and Service Worker Cache (`tabreed-pro-v21`).
- **Security & Authentication Model**:
  - Single centralized module: `auth-module.js` (`window.TabreedAuth`).
  - Roles: `user` (Standard technician), `supervisor` (Plant Supervisor), `developer` / `super_admin` (Full system control).
  - Credentials:
    - Master Developer key: strictly `lkku` (unlocks developer profile for Abdul Majeed Ansari `41764`).
    - Dynamic Time-based PIN: `41764HHMM` (Developer) and `40078HHMM` (Supervisor Bibin Ipe Abraham) using a 20-minute rolling UTC+4 window ($\pm 10$ minutes from current UAE time).
    - Plain Employee Code (e.g. `41764`, `40078`, `40311`, `40334`): Logs the user in with a strictly standard `user` role (no developer or supervisor elevation).
  - UI Standards: Rotating lock animation on login modal, zero placeholder text in password inputs, universal high-contrast red hover styling on all close (`X`) buttons.

---

## 2. File Topology & Component Breakdown

1. **`auth-module.js`**: Centralized authentication, session management, modal rendering, DOM cleanup of legacy text, UAE time-based PIN math, and Google Sheets audit logging.
2. **`server.js`**: Express backend with routes for operations, login logs, push notifications (VAPID/web-push), team contacts, and file proxies.
3. **`index.html`**: Main SAP Fiori-styled dashboard, tile ordering engine, theme selector (10+ palettes), instrument browser, and dev-mode controls.
4. **`Operation_Request.html`**: Work order tracking, attendee counting, real-time cloud-to-local differential sync, PDF and Excel export engine, and historical audit log viewer.
5. **`ETS_Locator.html`**: Energy Transfer Station directory, 2GIS/Waze/Google Maps GPS dispatch, hidden developer locations, and plant filtering.
6. **`DocumentFolder.html`**: Categorized technical manual library (Drawings, PDFs, Images, Videos) with Google Drive proxy upload.
7. **`Team_Contacts.html`**: Operations directory with phone/WhatsApp links and in-place contact editing.
8. **`Share_FeedBack.html`**: User feedback submission with automatic employee metadata tagging.
9. **`PM_Checklist_Generator.html`**: Generator for preventive maintenance checklists.
10. **`sw.js`**: Service Worker caching core assets, managing offline fallbacks, and handling background sync.
11. **`GAS/Mix_Data_GAS.gs.txt` & `GAS/Operation_Request_GAS.gs.txt`**: Google Apps Script server-side code powering Google Sheets integration.

---

## 3. Data Schemas & API Specifications

### Core Endpoints (`server.js`):
- `POST /api/log-login`: Receives `{ action: 'logLogin', timestamp, code, name, role, plantShift, device }`, stores to `data/login_logs.json`, and proxies to Mix Data GAS.
- `GET /api/log-login`: Returns the recent 200 login entries.
- `GET /api/operation-requests`: Returns cloud-synced work orders.
- `POST /api/operation-requests`: Saves/updates work orders and triggers differential synchronization.
- `GET /api/team-contacts` & `POST /api/team-contacts`: Fetches and updates contact records `{ code, full, short, email, phone, whatsapp, role }`.
- `GET /api/pwa-preferences` & `POST /api/pwa-preferences`: Saves user-specific launchpad tile order and UI themes keyed by employee code.
- `POST /api/subscribe`: Stores Web Push subscriptions for critical operations broadcasts.

### Client-Side State & Storage Keys:
- `tabreed_currentUser`: Active authenticated user object `{ code, full, short, email, phone, role }`.
- `tabreed_admin_unlocked`: Boolean flag indicating elevated privileges.
- `tabreed_selected_theme`: Active CSS theme ID.
- `tabreed_settings_<empCode>`: User preferences.
- `tabreed_offline_queue`: Stored mutations waiting for network reconnection.

---

## 4. Key Logic Snippets

### A. Centralized Verification & UAE Rolling PIN Logic (`auth-module.js`):
```javascript
isTimebaseCode(clean, prefixCode) {
    if (!clean || !clean.startsWith(prefixCode) || clean.length <= prefixCode.length) return false;
    const timePart = clean.substring(prefixCode.length);
    const now = new Date();

    for (let offset = -10; offset <= 10; offset++) {
        const targetMs = now.getTime() + offset * 60000;
        const dLocal = new Date(targetMs);
        const uaeMs = targetMs + (dLocal.getTimezoneOffset() * 60000) + (4 * 3600000);
        const dUae = new Date(uaeMs);

        for (const d of [dLocal, dUae]) {
            const h24 = d.getHours();
            const m = d.getMinutes();
            const h12 = h24 % 12 || 12;
            const mm = String(m).padStart(2, '0');
            const hh24 = String(h24).padStart(2, '0');
            const hh12 = String(h12).padStart(2, '0');
            const validPatterns = [`${hh24}${mm}`, `${h24}${mm}`, `${hh12}${mm}`, `${h12}${mm}`];
            if (validPatterns.includes(timePart)) return true;
        }
    }
    return false;
}

verifyUserLogin(pass) {
    if (!pass) return null;
    const clean = pass.toString().trim();
    if (clean === "lkku") return { code: "41764", full: "Abdul Majeed Ansari", short: "Majeed", role: "super_admin" };
    if (this.isTimebaseCode(clean, "41764")) return { code: "41764", full: "Abdul Majeed Ansari", short: "Majeed", role: "super_admin" };
    if (this.isTimebaseCode(clean, "40078")) return { code: "40078", full: "Bibin Ipe Abraham", short: "Bibin", role: "supervisor" };
    for (const emp of this.employees) {
        if (clean === String(emp.code).trim()) {
            return { ...emp, full: (clean === "41764" ? "Abdul Majeed Ansari" : emp.full), role: "user" };
        }
    }
    return null;
}
```

### B. Cloud Differential Sync Engine (`Operation_Request.html`):
```javascript
function diffAndUpdateRequests(cloudData, isManual = false) {
    if (!Array.isArray(cloudData)) return;
    const localMap = new Map(requests.map(r => [String(r.id || r.workOrder), r]));
    const cloudMap = new Map();
    let hasChanges = false;

    cloudData.forEach(cReq => {
        const key = String(cReq.id || cReq.workOrder);
        cloudMap.set(key, cReq);
        const local = localMap.get(key);
        if (!local || JSON.stringify(local) !== JSON.stringify(cReq)) {
            hasChanges = true;
        }
    });

    // Detect entries deleted from Cloud
    for (const [key, localReq] of localMap.entries()) {
        if (!cloudMap.has(key)) {
            hasChanges = true;
            break;
        }
    }

    if (hasChanges) {
        requests = cloudData;
        saveRequestsToLocal();
        refreshTable(false);
    }
}
```

---

## 5. Your Audit Assignment

Please provide an in-depth, structured report divided into the following 5 sections:

### Section 1: Security & Access Control Vulnerability Audit
1. **Client-Side Auth Exposure**: Analyze the risks of client-side PIN and password verification (`auth-module.js` and `verifyUserLogin`). How can an attacker bypass client-side checks or tamper with `localStorage` (`tabreed_currentUser`, `tabreed_admin_unlocked`) to escalate privileges to Developer or Supervisor?
2. **Server-Side Authorization Gaps**: Evaluate `server.js` endpoints (`/api/log-login`, `/api/operation-requests`, `/api/team-contacts`). Are mutations properly validated, authenticated, and rate-limited on the server, or can arbitrary clients modify data?
3. **Information Disclosure & Token Leakage**: Inspect the Google Apps Script bridge and hardcoded Web App URLs. What happens if a malicious actor directly queries the Google Apps Script endpoint?
4. **Concrete Hardening Recommendations**: Provide exact code patches to secure authentication (e.g. moving PIN/session verification to `/api/auth/verify`, using HTTP-only cookies or signed JWTs, and enforcing role middleware).

### Section 2: Bug Hunting & Data Integrity Analysis
1. **Time-Based PIN Drift & Boundary Bugs**: Examine `isTimebaseCode()`. Are there edge cases during midnight rollover (00:00 vs 23:59), daylight saving differences (if user device clock is desynced), or single-digit hour representations?
2. **Offline-to-Cloud Sync Race Conditions**: In `diffAndUpdateRequests()`, analyze what happens if a user makes offline edits while another technician modifies the same record in Google Sheets. How should conflict resolution (Last-Write-Wins with version vector or timestamp) be implemented?
3. **Stale Cache & Deletion Discrepancies**: Investigate potential issues where deleted entries from Google Sheets might resurrect from stale `localStorage` or Service Worker cache.

### Section 3: Architecture & Maintainability Review
1. **Decoupling Legacy Inline Scripts**: Many HTML pages have inline JavaScript scripts. What is the recommended strategy to refactor these into modular ES modules (`src/modules/*`) without breaking PWA offline compatibility?
2. **Centralized State Management**: How can cross-tab communication (currently handled by raw `storage` window events) be modernized using `BroadcastChannel` or IndexedDB?
3. **PWA & Service Worker Lifecycle**: Critique the Service Worker strategy in `sw.js`. Is cache versioning (`tabreed-pro-v21`) robust against zombie service workers, and does it properly handle stale-while-revalidate for dynamic JSON APIs?

### Section 4: Performance & Scalability Optimizations
1. **Large Dataset DOM Rendering**: As instruments (1,000+ rows) and work requests grow, the tables currently re-render raw HTML strings. How should virtual scrolling or paginated micro-rendering be introduced?
2. **Asset Compression & Network Throttling**: How to optimize PDF/Excel export memory footprint (jsPDF & SheetJS) on low-end mobile devices in the field?

### Section 5: Prioritized Actionable Action Plan
Provide a prioritized table (P0 Critical, P1 High, P2 Medium, P3 Enhancement) outlining the exact step-by-step improvements to implement in the next sprint, including before-and-after code snippets.
```
