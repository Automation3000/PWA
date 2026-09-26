# Central Data Store (`/data`)

This directory houses all local persistent cache, fallback configurations, and synchronization stores for the **TABREED Automation Platform**.

---

## Overview of Stored Files

| File | Purpose | Consumers / References | Sync Behavior |
| :--- | :--- | :--- | :--- |
| **`employees.json`** | Base employee directory, authentication credentials, PINs, role mappings (developer, super_admin, admin, user, etc.) | `server.js`, `index.html`, `Operation_Request.html`, `ETS_Locator.html`, `Team_Contacts.html`, `sw.js` | Loaded as authoritative baseline for authentication and team lookups. Updates merge into `team_contacts.json` and sync with Google Apps Script. |
| **`team_contacts.json`** | Dynamic team contact cache with phone numbers, plants, shifts, active status, and custom contact edits. | `server.js`, `Team_Contacts.html` | Synced bi-directionally between local server disk cache and Google Sheet via Mix Data GAS API. |
| **`operation_requests.json`** | Cache of all active and historical operational work orders, tickets, and plant maintenance requests. | `server.js`, `Operation_Request.html`, `index.html` | Two-way synchronized with Google Sheets. Local disk cache ensures instant offline readiness and sub-millisecond response times. |
| **`operation_history.json`** | Audit trail and changelog of every action (creation, status update, deletion, deduplication). | `server.js`, `Operation_Request.html` | Appended automatically on every operational request mutation. Synced to Cloud Sheet. |
| **`deleted_requests.json`** | Soft-deleted operational requests preserved for audit compliance and recovery. | `server.js` | Preserves deleted items with deletion timestamp and actor metadata. |
| **`status_overrides.json`** | Real-time status overrides for work orders pending cloud synchronization. | `server.js` | Applied over incoming sheet data to guarantee immediate UI consistency before cloud round-trip finishes. |
| **`inventory_cache.json`** | Cached catalog of instrumentation spare parts, transmitter modules, RTD sensors, calibration valves, and stock levels. | `server.js`, `index.html` (Native Instrument module) | Proxy-cached from Google Apps Script (`getItems`). Fallback for offline catalog browsing. |
| **`inventory_history_cache.json`** | Transaction history for inventory checkouts, returns, and calibration checks. | `server.js`, `index.html` | Proxy-cached from Google Apps Script (`getHistory`). |
| **`pwa_preferences.json`** | User-specific and global dashboard tile orders, themes (light/dark/custom), toast preferences, and Developer Defaults. | `server.js`, `index.html` | Multi-master synced between server cache and Google Drive `PWA.json` (File ID: `1AlvVbRj3DOQIMOQ2DaWikRoOlilJMmlX`). |
| **`documents.json`** | Categorized technical documents, P&IDs, manuals, standard operating procedures, and wiring diagrams. | `server.js`, `NEW.html`, `DocumentFolder.html`, `sw.js` | Pre-cached for offline access; downloadable PDF/DOC/DWG references. |

---

## Directory Access & Backward Compatibility
- In code, client files fetch from `data/<filename>` or `/data/<filename>`.
- `server.js` automatically maps root requests (e.g. `/employees.json`) to `/data/employees.json` for full backward compatibility with older cached clients and service workers.
- Both lowercase `data/` and capitalized `Data/` (symlink) are supported on the filesystem.
