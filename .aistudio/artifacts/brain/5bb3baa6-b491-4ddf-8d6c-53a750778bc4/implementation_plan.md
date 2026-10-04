# Implementation Plan: Comprehensive TABREED Architecture & DeepSeek Audit Prompt

Provide an authoritative, detailed technical dossier and ready-to-copy DeepSeek prompt that explains the entire TABREED Automation application architecture, and instructs DeepSeek to perform an exhaustive audit covering security vulnerabilities, logic bugs, architectural bottlenecks, and performance optimizations.

---

## 1. System Architecture Overview

The dossier and prompt will document the complete full-stack topology of the project:

### Frontend Layer (PWA & SAP Fiori Design)
- **Core Dashboard (`index.html`)**: SAP Fiori-inspired tile launchpad with user-customizable arrangement, live offline indicators, multi-theme selector, and Developer Tools panel.
- **Centralized Authentication (`auth-module.js`)**: Single authoritative singleton (`window.TabreedAuth`) loaded across all HTML views. Handles session persistence, roles (`user`, `supervisor`, `developer`/`super_admin`), time-based PIN calculation (UAE UTC+4 $\pm 10$ minutes window), master PIN (`lkku`), and automatic logging to Google Sheets.
- **Operational Modules**:
  - `Operation_Request.html`: Shift work orders, attendees tracking, cloud sync engine with diff verification, export engine (PDF via jsPDF, Excel via SheetJS), and archive filtering.
  - `ETS_Locator.html`: Energy Transfer Station directory, plant filtering, geolocation routing (Google Maps, Waze, 2GIS), stats calculation, and hidden location flags for developers.
  - `DocumentFolder.html`: Document library categorized into Drawings, PDFs, Images, and Videos with Google Drive proxy uploading.
  - `Team_Contacts.html`: Operations phone and WhatsApp directory with in-place modal editing.
  - `Share_FeedBack.html`: Structured feedback collection linked to employee profiles.
  - `PM_Checklist_Generator.html`: Field equipment PM checklist generation.
- **Offline & Worker Layer (`sw.js`)**: Service Worker (`tabreed-pro-v21`) providing full asset pre-caching, offline fallback routing, and Web Push notifications (VAPID).
- **Styling Architecture (`themes.css`)**: Dynamic CSS variable tokens supporting 10+ color schemes, dark mode toggle, animated security lock, and universal high-contrast red hover states on dismiss/close controls.

### Backend Layer (`server.js`)
- **Runtime**: Node.js Express server running on port 3000.
- **Data Persistence (`data/*.json`)**: Flat-file JSON databases (`employees.json`, `team_contacts.json`, `documents.json`, `login_logs.json`, `pwa_preferences.json`).
- **Google Apps Script (GAS) Bridges**:
  - `MIX_DATA_GAS_URL`: Primary Google Sheets bridge for real-time `Login Log` logging.
  - `OPERATION_REQUEST_GAS_URL`: Bi-directional Google Sheets sync for shift work orders and historical audit logs.
  - Proxy endpoints handling CORS decoupling, SSL termination, and offline fallback queueing.

---

## 2. API Endpoints & Data Schemas

The prompt will outline all HTTP endpoints and data models for DeepSeek:

| Endpoint | Method | Description | Payload / Schema |
| :--- | :--- | :--- | :--- |
| `/api/log-login` | POST / GET | Logs authentication events to local disk and forwards to Mix Data GAS | `{ timestamp, code, name, role, plantShift, device }` |
| `/api/operation-requests` | GET / POST / PUT / DELETE | CRUD and differential sync for operational requests | Array of work order objects with timestamps and attendees |
| `/api/team-contacts` | GET / POST | Retrieves or updates employee phone, email, and WhatsApp | `{ code, full, short, email, phone, whatsapp, role }` |
| `/api/instruments` | GET / POST | Retrieves instrument master list records | `{ tag, plant, type, range, location, status }` |
| `/api/documents` | GET / POST | Document metadata and category listings | `{ id, title, category, driveUrl, mimeType, size }` |
| `/api/pwa-preferences` | GET / POST | User-level tile ordering, themes, and notification preferences | Keyed by Employee Code `{ theme, tileOrder, gasUrl }` |
| `/api/subscribe` & `/api/vapid-key` | GET / POST | Web Push registration and notification broadcast | `{ subscription: PushSubscription }` |

---

## 3. DeepSeek Audit Scope & Directives

The generated prompt will command DeepSeek to execute a structured 4-pillar analysis:

1. **Security Vulnerability Audit**:
   - Client-side PIN and password verification analysis (`auth-module.js`).
   - Privilege escalation risks between `user`, `supervisor`, and `developer`.
   - File upload security and Google Drive proxy validation in `server.js` and `DocumentFolder.html`.
   - LocalStorage and sessionStorage exposure of employee records.
   - CORS, CSRF, and HTTP header protections on the Express backend.

2. **Data Integrity & Bug Hunting**:
   - Differential sync edge cases between browser IndexedDB/LocalStorage and Google Apps Script backend.
   - Race conditions during multi-device edits or offline reconnection.
   - Time-based PIN edge cases (timezone drift across UTC vs UAE UTC+4).
   - Deletion sync discrepancies between cloud sheets and local storage.

3. **Architectural & Code Quality Audit**:
   - Decoupling of legacy inline script blocks in HTML files.
   - Separation of concerns between UI rendering, state management, and network proxies.
   - Service worker lifecycle handling and cache invalidation strategies (`sw.js`).

4. **Performance & Resiliency Enhancements**:
   - DOM rendering performance with large tables (500+ instruments or work orders).
   - Bundle size reduction, asset compression, and lazy loading strategies.
   - Offline fallback guarantees when Google Apps Script endpoints experience latency or rate limits.

---

## 4. Output Deliverables

Upon approval of this plan, the following will be delivered:
1. **Full DeepSeek Ready-to-Copy Master Prompt**: Formatted in clean markdown with clear delimiters, role definitions, architectural context, code snippets, schemas, and structured question templates.
2. **Usage Instructions**: Guidance on how to feed the prompt to DeepSeek (or DeepSeek-R1) and how to prompt for incremental, actionable code patches.
