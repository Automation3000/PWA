# PUSH DRAFT ARCHIVE (Tabreed Push Notification System)

This directory contains the complete Push Notification Studio & Dispatcher system, archived as per user request to decouple push notifications from the main application.

## Archived Components:
1. `push-manager.js`: Cross-platform push client engine (Chrome, Windows, Android, iOS 16.4+), auto-sync and permission handling.
2. `push-tester.html`: All-in-One Push Notification Studio and diagnostics console.
3. `push-notification-server/`:
   - `server.js`: Node.js self-hosted web-push server endpoints.
   - `Code.gs`: Google Apps Script webhook integration for Google Sheets.
   - `README.md`: Complete architecture and deployment documentation.

## How to Re-link in the Future:
1. Move `push-manager.js` and `push-tester.html` back to the app root directory.
2. Add `<script src="/push-manager.js"></script>` to `index.html` and any desired sub-pages.
3. Re-enable the Push Dispatcher tile in `index.html`.
