/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT: PUSH NOTIFICATION DISPATCHER & SUBSCRIPTION REPOSITORY
 * ==============================================================================
 * Project Name: "Push Notification" (Google Apps Script)
 *
 * INSTRUCTIONS:
 * 1. Open your Google Sheet (or create a new one for Push Notifications).
 * 2. Go to: Extensions > Apps Script.
 * 3. Replace all existing code in Code.gs with this file.
 * 4. Replace NODE_SERVER_URL below with your deployed Node.js Server URL.
 * 5. Click "Deploy" > "New deployment" > Select type: "Web app":
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 6. Copy the resulting Web App URL and paste it into your frontend config.
 */

// ==============================================================================
// 1. CONFIGURATION
// ==============================================================================
// Your Tabreed App URL (Hosted from GitHub repo: Automation3000/PWA)
// No 3rd party service (Render/Railway/Glitch) required! Your app's own server.js handles push encryption.
// Development App URL:
var TABREED_APP_URL = 'https://ais-dev-tbyiuhehvatfspwpkrkka7-505128504808.europe-west2.run.app';
// Deployment Web App Script URL (Fixed):
// https://script.google.com/macros/s/AKfycbxr-HQedn7rqxJ9zP7JmDnLtHnp8ad8PhQ0v8bpBI8pOvw8D4P14OI_ojVKyUBOzDdN/exec

// Sheet name where browser subscriptions are stored
var SHEET_NAME = 'Subscriptions';

// ==============================================================================
// 2. RECEIVE SUBSCRIPTIONS FROM FRONTEND (doPost)
// ==============================================================================
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Wait up to 10 seconds for lock to avoid write collisions
    lock.waitLock(10000);
    
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ status: 'error', message: 'No POST data received' });
    }

    var data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse({ status: 'error', message: 'Malformed JSON payload' });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSubscriptionSheet(ss);

    // If request is from PWA App to broadcast a push notification to all users
    if (data.action === 'broadcast_push') {
      var pushTitle = data.title || 'Tabreed Alert';
      var pushMsg = data.message || 'New update in the system.';
      var pushUrl = data.url || '/index.html';
      var dispatchSummary = sendPushFromGoogleSheet(pushTitle, pushMsg, pushUrl);
      return jsonResponse({
        status: 'success',
        action: 'broadcast_push',
        summary: dispatchSummary,
        timestamp: new Date().toISOString()
      });
    }

    // If request is to get subscriber stats
    if (data.action === 'get_stats') {
      var allRows = sheet.getDataRange().getValues();
      var activeCount = 0;
      for (var r = 1; r < allRows.length; r++) {
        var st = (allRows[r][7] || '').toString().toLowerCase();
        if (st === 'active' || st === '') activeCount++;
      }
      return jsonResponse({
        status: 'success',
        total: Math.max(0, allRows.length - 1),
        activeCount: activeCount
      });
    }

    // If user is unsubscribing
    if (data.action === 'unsubscribe' && data.endpoint) {
      markSubscriptionStatus(sheet, data.endpoint, 'unsubscribed');
      return jsonResponse({ status: 'success', message: 'Device unsubscribed successfully' });
    }

    // Standard subscription registration
    var endpoint = data.endpoint || '';
    if (!endpoint) {
      return jsonResponse({ status: 'error', message: 'Missing subscription endpoint' });
    }

    var user = data.user || 'Anonymous User';
    var userAgent = data.userAgent || 'Unknown Device';
    var p256dh = (data.keys && data.keys.p256dh) ? data.keys.p256dh : '';
    var authKey = (data.keys && data.keys.auth) ? data.keys.auth : '';
    var rawSub = data.rawSubscription || JSON.stringify({
      endpoint: endpoint,
      keys: { p256dh: p256dh, auth: authKey }
    });
    var timestamp = new Date();

    // Check if endpoint already exists in sheet (Deduplication)
    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    var endpointColIndex = 3; // Column D (0-indexed: 0=Time, 1=User, 2=Device, 3=Endpoint, ...)
    var existingRow = -1;

    for (var i = 1; i < values.length; i++) {
      if (values[i][endpointColIndex] === endpoint) {
        existingRow = i + 1; // 1-based row number
        break;
      }
    }

    if (existingRow > 0) {
      // Update existing record: Refresh timestamp, user, rawSub, and mark Active
      sheet.getRange(existingRow, 1).setValue(timestamp);
      sheet.getRange(existingRow, 2).setValue(user);
      sheet.getRange(existingRow, 3).setValue(userAgent);
      sheet.getRange(existingRow, 5).setValue(p256dh);
      sheet.getRange(existingRow, 6).setValue(authKey);
      sheet.getRange(existingRow, 7).setValue(rawSub);
      sheet.getRange(existingRow, 8).setValue('active');
      return jsonResponse({ status: 'success', message: 'Existing device subscription updated and active' });
    } else {
      // Append new subscription row
      sheet.appendRow([
        timestamp,
        user,
        userAgent,
        endpoint,
        p256dh,
        authKey,
        rawSub,
        'active'
      ]);
      return jsonResponse({ status: 'success', message: 'New device subscription registered successfully' });
    }

  } catch (error) {
    Logger.log('[doPost Error] ' + error.toString());
    return jsonResponse({ status: 'error', message: error.toString() });
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

// Fallback for simple GET tests
function doGet(e) {
  return jsonResponse({
    status: 'online',
    service: 'Tabreed Push Notification Google Apps Script Web App',
    time: new Date().toISOString()
  });
}

// ==============================================================================
// 3. SEND PUSH NOTIFICATION TO ALL SUBSCRIBED DEVICES
// Can be called via trigger, script, or custom Sheet menu
// ==============================================================================
function sendPushFromGoogleSheet(title, message, targetUrl) {
  if (!title) title = 'Tabreed Alert';
  if (!message) message = 'You have a new update in the system.';
  if (!targetUrl) targetUrl = '/index.html';

  if (!TABREED_APP_URL) {
    var errorMsg = 'Please set your TABREED_APP_URL in Code.gs!';
    Logger.log(errorMsg);
    SpreadsheetApp.getUi().alert('Configuration Error', errorMsg, SpreadsheetApp.getUi().ButtonSet.OK);
    return 'Error: TABREED_APP_URL not configured';
  }

  var endpointUrl = TABREED_APP_URL.replace(/\/+$/, '') + '/api/push/broadcast';
  var requestPayload = {
    title: title,
    message: message,
    url: targetUrl
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestPayload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(endpointUrl, options);
    var statusCode = response.getResponseCode();
    var responseText = response.getContentText();
    Logger.log('Broadcast response [' + statusCode + ']: ' + responseText);

    if (statusCode >= 200 && statusCode < 300) {
      var resJson = JSON.parse(responseText);
      var summaryMsg = resJson.summary || 'Push notification broadcast delivered.';
      SpreadsheetApp.getActiveSpreadsheet().toast(summaryMsg, 'Push Dispatched', 5);
      return summaryMsg;
    } else {
      var errMsg = 'Failed with status ' + statusCode + ': ' + responseText;
      SpreadsheetApp.getActiveSpreadsheet().toast(errMsg, 'Push Error', 8);
      return errMsg;
    }
  } catch (err) {
    Logger.log('Error calling broadcast API: ' + err.message);
    SpreadsheetApp.getActiveSpreadsheet().toast(err.message, 'Network Error', 8);
    return 'Error: ' + err.message;
  }
}

// ==============================================================================
// 4. HELPER FUNCTIONS & SHEET INITIALIZATION
// ==============================================================================
function getOrCreateSubscriptionSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Setup Column Headers
    sheet.appendRow([
      'Timestamp',
      'User',
      'Device / Browser',
      'Endpoint',
      'P256dh Key',
      'Auth Key',
      'Raw Subscription',
      'Status'
    ]);
    
    // Style header row
    var headerRange = sheet.getRange(1, 1, 1, 8);
    headerRange.setBackground('#1e293b');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, 8);
  }
  return sheet;
}

function markSubscriptionStatus(sheet, endpoint, newStatus) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][3] === endpoint) {
      sheet.getRange(i + 1, 8).setValue(newStatus);
      break;
    }
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==============================================================================
// 5. CUSTOM MENU & TEST RUNNERS
// ==============================================================================
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🔔 Push Notifications')
    .addItem('Send Push to All Users', 'promptAndSendPush')
    .addSeparator()
    .addItem('Test Push Notification', 'testSendPush')
    .addToUi();
}

function promptAndSendPush() {
  var ui = SpreadsheetApp.getUi();
  var titlePrompt = ui.prompt('Send Push Notification', 'Enter Notification Title:', ui.ButtonSet.OK_CANCEL);
  if (titlePrompt.getSelectedButton() !== ui.Button.OK) return;
  var title = titlePrompt.getResponseText();

  var bodyPrompt = ui.prompt('Send Push Notification', 'Enter Notification Body/Message:', ui.ButtonSet.OK_CANCEL);
  if (bodyPrompt.getSelectedButton() !== ui.Button.OK) return;
  var message = bodyPrompt.getResponseText();

  var urlPrompt = ui.prompt('Send Push Notification', 'Enter Target Click URL (Optional, default: /index.html):', ui.ButtonSet.OK_CANCEL);
  var targetUrl = (urlPrompt.getSelectedButton() === ui.Button.OK && urlPrompt.getResponseText()) ? urlPrompt.getResponseText() : '/index.html';

  var result = sendPushFromGoogleSheet(title, message, targetUrl);
  ui.alert('Result', result, ui.ButtonSet.OK);
}

function testSendPush() {
  var result = sendPushFromGoogleSheet('Test Notification 🚀', 'Testing Web Push from Google Sheet at ' + new Date().toLocaleTimeString(), '/index.html');
  Logger.log(result);
}
