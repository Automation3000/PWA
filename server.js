import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'operation_requests.json');
const DELETED_FILE = path.join(__dirname, 'deleted_requests.json');
const OVERRIDES_FILE = path.join(__dirname, 'status_overrides.json');
const HISTORY_FILE = path.join(__dirname, 'operation_history.json');
const TEAM_CONTACTS_FILE = path.join(__dirname, 'team_contacts.json');
const EMPLOYEES_FILE = path.join(__dirname, 'employees.json');
const PWA_PREFERENCES_FILE = path.join(__dirname, 'pwa_preferences.json');
const DRIVE_PWA_FILE_ID = '1AlvVbRj3DOQIMOQ2DaWikRoOlilJMmlX';
const INVENTORY_CACHE_FILE = path.join(__dirname, 'inventory_cache.json');
const INVENTORY_HISTORY_FILE = path.join(__dirname, 'inventory_history_cache.json');
const INVENTORY_GAS_URL = "https://script.google.com/macros/s/AKfycbwnUqgWqfPwnPLtmsSXvXfqNj66wcOjVoft3ou_t4RDBQ-Iscyp3wuiv45Z1o9UND6OZQ/exec";

function loadInventoryCache() {
  try {
    if (fs.existsSync(INVENTORY_CACHE_FILE)) {
      const content = fs.readFileSync(INVENTORY_CACHE_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && (Array.isArray(parsed.data) || parsed.success)) return parsed;
    }
  } catch (e) {
    console.error("Error reading inventory_cache.json:", e);
  }
  return { success: true, data: [], locations: [], stats: { warningItems: 0 }, totalItems: 0 };
}

function saveInventoryCache(data) {
  try {
    fs.writeFileSync(INVENTORY_CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error("Error writing inventory_cache.json:", e);
  }
}

function loadInventoryHistoryCache() {
  try {
    if (fs.existsSync(INVENTORY_HISTORY_FILE)) {
      const content = fs.readFileSync(INVENTORY_HISTORY_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && (Array.isArray(parsed.data) || parsed.success)) return parsed;
    }
  } catch (e) {
    console.error("Error reading inventory_history_cache.json:", e);
  }
  return { success: true, data: [] };
}

function saveInventoryHistoryCache(data) {
  try {
    fs.writeFileSync(INVENTORY_HISTORY_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error("Error writing inventory_history_cache.json:", e);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Security: Enforce request payload size limit to prevent Memory Exhaustion / DoS
app.use(express.json({ limit: '1mb' }));

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Allow framing for AI Studio preview iframe integration
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Security: Verify privileged access for destructive administrative actions
function isPrivilegedRequest(req) {
  const role = String(req.headers['x-user-role'] || '').toLowerCase();
  const auth = String(req.headers['authorization'] || '');
  return role === 'developer' || role === 'super_admin' || role === 'supervisor' || auth.startsWith('Bearer');
}

// Security: Sanitize incoming object properties to prevent Prototype Pollution
function sanitizePayloadObject(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (typeof value === 'string') {
      clean[key] = value.slice(0, 10000); // Prevent excessively oversized strings
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizePayloadObject(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby_XKC1cV1VaeqKB2MbQgmRSOYmcxQI0v-5qcAAKhFczNOwU3GsindACIkuawzQZN4/exec";
let MIX_DATA_GAS_URL = process.env.MIX_DATA_GAS_URL || "https://script.google.com/macros/s/AKfycby3rLk9ihwFSTXmDnp0suNtsxNRfZntql7rrPzB2u-l8vYVSMpZyDwOt7kkv_LstERijQ/exec";

function loadTeamContacts() {
  try {
    if (fs.existsSync(TEAM_CONTACTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(TEAM_CONTACTS_FILE, 'utf8'));
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (e) {}
  try {
    if (fs.existsSync(EMPLOYEES_FILE)) {
      return JSON.parse(fs.readFileSync(EMPLOYEES_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveTeamContacts(data) {
  try {
    fs.writeFileSync(TEAM_CONTACTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error("Error writing team_contacts.json:", e);
  }
}

const DEVELOPER_DEFAULT_SETTINGS = {
  toastStyle: 'outlined',
  toastPosition: 'pos-bottom',
  defaultTheme: 'default',
  lightToggle: 'default',
  darkToggle: 'dark-mode',
  autoSync: true,
  moduleOrder: [
    'NATIVE_INSTRUMENT',
    'DocumentFolder.html',
    'PM_Checklist_Generator.html',
    'ETS_Locator.html',
    'Operation_Request.html',
    'Team_Contacts.html'
  ]
};

function loadPwaPreferences() {
  let data = null;
  try {
    if (fs.existsSync(PWA_PREFERENCES_FILE)) {
      data = JSON.parse(fs.readFileSync(PWA_PREFERENCES_FILE, 'utf8'));
    }
  } catch (e) {
    console.error("Error reading pwa_preferences.json:", e);
  }
  if (!data || typeof data !== 'object') {
    data = {
      fileId: DRIVE_PWA_FILE_ID,
      version: '1.0',
      syncCounter: 1,
      lastUpdated: new Date().toISOString(),
      lastUpdatedBy: 'System',
      moduleOrders: {},
      userSettings: {},
      defaultSettings: DEVELOPER_DEFAULT_SETTINGS,
      userDefaultSettings: {},
      globalSettings: {}
    };
  } else {
    data.syncCounter = typeof data.syncCounter === 'number' ? data.syncCounter : (Number(data.syncCounter) || 1);
    data.defaultSettings = data.defaultSettings || DEVELOPER_DEFAULT_SETTINGS;
    data.userDefaultSettings = data.userDefaultSettings || {};
    data.moduleOrders = data.moduleOrders || {};
    data.userSettings = data.userSettings || {};
    data.globalSettings = data.globalSettings || {};
  }
  return data;
}

function savePwaPreferences(data) {
  try {
    if (data && typeof data === 'object') {
      data.syncCounter = typeof data.syncCounter === 'number' ? data.syncCounter : (Number(data.syncCounter) || 1);
      data.defaultSettings = data.defaultSettings || DEVELOPER_DEFAULT_SETTINGS;
      data.userDefaultSettings = data.userDefaultSettings || {};
    }
    fs.writeFileSync(PWA_PREFERENCES_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error("Error writing pwa_preferences.json:", e);
  }
}

function loadDeletedIds() {
  try {
    if (fs.existsSync(DELETED_FILE)) {
      return JSON.parse(fs.readFileSync(DELETED_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveDeletedIds(ids) {
  try {
    fs.writeFileSync(DELETED_FILE, JSON.stringify(ids, null, 2), 'utf8');
  } catch (e) {}
}

function loadStatusOverrides() {
  try {
    if (fs.existsSync(OVERRIDES_FILE)) {
      return JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveStatusOverrides(overrides) {
  try {
    fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(overrides, null, 2), 'utf8');
  } catch (e) {}
}

function loadLocalData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        // Filter out any ghost/empty rows
        return parsed.filter(item => {
          const wo = String(item['Work Order'] || item.wo || '').trim();
          const desc = String(item['Description'] || item.desc || '').trim();
          const plant = String(item['Plant'] || item.plant || '').trim();
          return wo || desc || plant;
        });
      }
      return parsed;
    }
  } catch (e) {
    console.error("Error reading local data file:", e);
  }
  return null;
}

function saveLocalData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error("Error writing local data file:", e);
  }
}

function parseHistoryEpoch(ts, displayTime) {
  if (typeof ts === 'number' && !isNaN(ts) && ts > 0) return ts;
  const direct = ts ? new Date(ts).getTime() : NaN;
  if (!isNaN(direct) && direct > 0) return direct;
  
  const targetStr = String(displayTime || ts || '').trim();
  const m = targetStr.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\s*(AM|PM))?)?$/i);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    const year = parseInt(m[3], 10);
    let hour = m[4] ? parseInt(m[4], 10) : 0;
    const min = m[5] ? parseInt(m[5], 10) : 0;
    const sec = m[6] ? parseInt(m[6], 10) : 0;
    const ampm = m[7] ? m[7].toUpperCase() : '';
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    const dt = new Date(year, month, day, hour, min, sec);
    if (!isNaN(dt.getTime())) return dt.getTime();
  }
  return 0;
}

function format24HourDateTime(epoch) {
  if (!epoch) return '';
  const d = new Date(epoch);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${mins}`;
}

function normalizeHistoryAction(act) {
  const a = String(act || '').toLowerCase().trim();
  if (a.includes('create') || a.includes('new')) return 'create';
  if (a.includes('update') || a.includes('edit')) return 'update';
  if (a.includes('status')) return 'status';
  if (a.includes('delete')) return 'delete';
  if (a.includes('clean')) return 'clean';
  if (a.includes('sync') || a.includes('link')) return 'sync';
  return a || 'info';
}

function isGenericHistoryUser(u) {
  const s = String(u || '').toLowerCase().trim();
  return !s || s === 'technician' || s === 'supervisor' || s === 'system' || s === 'user';
}

function deduplicateHistoryList(list) {
  if (!Array.isArray(list)) return [];
  
  // 1. Prepare items with parsed epoch, normalized action and 24h displayTime
  const prepared = list.map((item, idx) => {
    if (!item) return null;
    const wo = String(item.workOrder || '').replace(/^#/, '').trim();
    const desc = String(item.description || '').trim();
    const plant = String(item.plant || '').trim();
    const details = String(item.details || '').trim();
    // Filter out completely blank ghost rows
    if (!wo && !desc && !plant && !details) return null;

    const epoch = parseHistoryEpoch(item.timestamp, item.displayTime) || (Date.now() - idx * 1000);
    const normAction = normalizeHistoryAction(item.action || item.actionLabel);
    const normWo = wo.toLowerCase();
    const display24 = format24HourDateTime(epoch);

    const actionLabels = {
      'create': 'Created',
      'update': 'Edited',
      'status': 'Status',
      'delete': 'Deleted',
      'clean': 'Cleaned',
      'sync': 'Synced'
    };

    return {
      ...item,
      epoch,
      action: normAction,
      actionLabel: actionLabels[normAction] || item.actionLabel || 'Activity',
      workOrder: wo,
      normWo,
      plant: plant,
      displayTime: display24,
      timestamp: new Date(epoch).toISOString()
    };
  }).filter(Boolean);

  // 2. Sort strictly chronologically descending (newest on top)
  prepared.sort((a, b) => b.epoch - a.epoch);

  // 3. Deduplicate
  const result = [];
  for (const item of prepared) {
    const existingIdx = result.findIndex(r => {
      if (r.id && item.id && r.id === item.id) return true;
      if (r.action !== item.action) return false;
      
      const sameWo = r.normWo === item.normWo;
      const timeDiff = Math.abs(r.epoch - item.epoch);
      
      // If same work order and within 5 minutes, or both empty WO and within 20s
      if (sameWo && (r.normWo ? timeDiff < 300000 : timeDiff < 20000)) {
        return true;
      }
      return false;
    });

    if (existingIdx === -1) {
      result.push(item);
    } else {
      // Merge: prefer real logged user over generic ('Technician'/'Supervisor')
      const existing = result[existingIdx];
      if (isGenericHistoryUser(existing.user) && !isGenericHistoryUser(item.user)) {
        existing.user = item.user;
      }
      // Prefer richer description
      if ((item.description || '').length > (existing.description || '').length) {
        existing.description = item.description;
      }
      if (item.details && !existing.details) {
        existing.details = item.details;
      }
      if (item.plant && !existing.plant) {
        existing.plant = item.plant;
      }
    }
  }

  return result.map(({ epoch, normWo, ...rest }) => rest);
}

function loadHistoryData() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      return deduplicateHistoryList(parsed);
    }
  } catch (e) {}
  return [];
}

function saveHistoryData(data) {
  try {
    const clean = deduplicateHistoryList(data || []);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(clean, null, 2), 'utf8');
  } catch (e) {}
}

// Fallback initial data in case cloud and local cache are cold
const INITIAL_FALLBACK_REQUESTS = [
  {
    "rowIdx": 2,
    "Work Order": "12345",
    "Description": "Testing",
    "Plant": "AD-032",
    "Date": "19.09.2026",
    "Time": "07:00 - 12:00",
    "Team": "Majeed",
    "Status": "Requested",
    "Remarks": "",
    "ID": "row_1789809912154"
  }
];

// Proxy endpoint: fetches live cloud data on refresh or if no cache
app.get('/api/operation-requests', async (req, res) => {
  const forceRefresh = req.query.refresh === 'true';
  let cached = loadLocalData();

  // If we already have local cache and not a force-refresh, return immediately for instant mobile loading
  if (cached && Array.isArray(cached) && cached.length > 0 && !forceRefresh) {
    return res.json({ status: 'success', data: cached, source: 'cache' });
  }

  // If force refresh requested or cache is empty, fetch live from cloud backend with timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);
    const response = await fetch(APPS_SCRIPT_URL + '?t=' + Date.now(), {
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const rawText = await response.text();
    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.warn('Apps Script returned non-JSON text (likely redirect/html)');
    }

    if (data && data.status === 'success' && Array.isArray(data.data)) {
      // Filter out ghost empty rows
      const cleaned = data.data.filter(r => (r['Work Order'] || r.wo) && String(r['Work Order'] || r.wo).trim() !== '');
      cached = cleaned.length > 0 ? cleaned : cached;
      if (cleaned.length > 0) {
        saveLocalData(cached);
      }
      // Clear deleted and overrides on fresh pull so user cloud changes take immediate effect
      if (forceRefresh) {
        saveDeletedIds([]);
        saveStatusOverrides({});
      }
      return res.json({ status: 'success', data: cached || cleaned, source: 'cloud' });
    }
  } catch (error) {
    console.warn('Proxy GET error or timeout from Apps Script:', error.message || error);
  }

  // Resilient fallback: return existing cache or initial fallback
  if (Array.isArray(cached) && cached.length > 0) {
    return res.json({ status: 'success', data: cached, source: 'fallback_cache' });
  }

  // Safe fallback to prevent mobile client from breaking
  saveLocalData(INITIAL_FALLBACK_REQUESTS);
  return res.json({ status: 'success', data: INITIAL_FALLBACK_REQUESTS, source: 'fallback_init' });
});

// Operation History Endpoints
app.get('/api/history', (req, res) => res.redirect(307, '/api/operation-history' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '')));
app.get('/api/operation-history', async (req, res) => {
  let history = loadHistoryData();
  // Always try to fetch live from Google Sheet "History" tab
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const cloudRes = await fetch(APPS_SCRIPT_URL + '?action=getHistory&t=' + Date.now(), {
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timeoutId);
    if (cloudRes.ok) {
      const json = await cloudRes.json();
      if (json && json.status === 'success' && Array.isArray(json.data) && json.data.length > 0) {
        // Merge cloud history with local with intelligent deduplication and 24-hour formatting
        const combined = [...json.data, ...history];
        history = deduplicateHistoryList(combined);
        if (history.length > 200) history.length = 200;
        saveHistoryData(history);
      }
    }
  } catch(e) {
    // Quiet fail to local cache
  }
  // Exclude sync actions as user requested: "Sync Log History me zarurat nahi usko Log nahi kro"
  const cleanHistory = (history || []).filter(h => h.action !== 'sync' && h.actionLabel !== 'Synced');
  res.json({ status: 'success', data: cleanHistory });
});

app.post('/api/operation-history', (req, res) => {
  const item = req.body || {};
  if (!item.action && !item.description) {
    return res.status(400).json({ status: 'error', message: 'Invalid history item' });
  }

  const normAction = normalizeHistoryAction(item.action || item.actionLabel);
  // Do not log sync actions to operation history
  if (normAction === 'sync' || item.action === 'sync') {
    return res.json({ status: 'success', message: 'Sync events are not logged to operation history' });
  }

  const epoch = parseHistoryEpoch(item.timestamp, item.displayTime) || Date.now();
  const display24 = format24HourDateTime(epoch);
  const wo = String(item.workOrder || '').replace(/^#/, '').trim();
  const plant = String(item.plant || '').trim();
  const user = String(item.user || '').trim() || 'Technician';

  const actionLabels = {
    'create': 'Created',
    'update': 'Edited',
    'status': 'Status',
    'delete': 'Deleted',
    'clean': 'Cleaned',
    'sync': 'Synced'
  };

  const entry = {
    id: item.id || ('hist_' + epoch + '_' + Math.floor(Math.random() * 1000)),
    timestamp: new Date(epoch).toISOString(),
    displayTime: display24,
    action: normAction,
    actionLabel: actionLabels[normAction] || item.actionLabel || 'Activity',
    workOrder: wo,
    plant: plant,
    description: item.description || '',
    details: item.details || '',
    user: user,
    badgeColor: item.badgeColor || (normAction === 'delete' ? '#dc2626' : (normAction === 'status' ? '#16a34a' : (normAction === 'update' ? '#7c3aed' : '#1a73e8')))
  };

  let history = loadHistoryData();
  history.unshift(entry);
  history = deduplicateHistoryList(history);
  if (history.length > 150) history.length = 150; // Keep last 150 logs
  saveHistoryData(history);

  // Push to Google Sheet "History" tab asynchronously
  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'logHistory', historyItem: entry }),
    redirect: 'follow'
  }).catch(err => console.error("Apps Script logHistory error:", err));

  res.json({ status: 'success', data: entry });
});

app.delete('/api/operation-history', async (req, res) => {
  // Authorization check: only privileged roles or authorized users can clear entire history
  if (!isPrivilegedRequest(req)) {
    return res.status(403).json({ status: 'error', message: 'Forbidden: Insufficient privileges to clear operation history log' });
  }

  saveHistoryData([]);
  // Forward clear command to Google Apps Script via both GET & POST to guarantee execution
  try {
    const p1 = fetch(APPS_SCRIPT_URL + '?action=clearHistory&t=' + Date.now(), { redirect: 'follow' });
    const p2 = fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'clearHistory' }),
      redirect: 'follow'
    });
    await Promise.race([Promise.allSettled([p1, p2]), new Promise(r => setTimeout(r, 4000))]);
  } catch(err) {
    console.error("Apps Script clearHistory error:", err);
  }
  res.json({ status: 'success', message: 'History cleared from cache and cloud' });
});

app.post('/api/operation-requests', async (req, res) => {
  const body = sanitizePayloadObject(req.body) || {};
  const action = body.action;
  let cached = loadLocalData() || [];
  const deletedList = loadDeletedIds();
  const statusOverrides = loadStatusOverrides();

  if (action === 'delete') {
    const idToDelete = String(body.id || '');
    const wo = body.workOrder || '';
    if (idToDelete) {
      if (!deletedList.includes(idToDelete)) {
        deletedList.push(idToDelete);
        saveDeletedIds(deletedList);
      }
      if (statusOverrides[idToDelete]) {
        delete statusOverrides[idToDelete];
        saveStatusOverrides(statusOverrides);
      }
    }

    cached = cached.filter(item => {
      const itemId = String(item.ID || item.id || '');
      return itemId !== idToDelete;
    });
    saveLocalData(cached);

    // Forward to Apps Script asynchronously
    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, skipAutoHistory: true, skipHistoryLog: true }),
      redirect: 'follow'
    }).catch(err => console.error("Apps Script delete error:", err));

    return res.json({ status: 'success', message: 'Deleted successfully' });
  }

  if (action === 'updateStatus') {
    const idToUpdate = String(body.id || '');
    const newStatus = String(body.status || '');
    const wo = body.workOrder || '';

    if (idToUpdate && newStatus) {
      statusOverrides[idToUpdate] = newStatus;
      saveStatusOverrides(statusOverrides);
    }

    cached = cached.map(item => {
      const itemId = String(item.ID || item.id || '');
      if (itemId === idToUpdate) {
        item.Status = newStatus;
        item.status = newStatus;
      }
      return item;
    });
    saveLocalData(cached);

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, skipAutoHistory: true, skipHistoryLog: true }),
      redirect: 'follow'
    }).catch(err => console.error("Apps Script updateStatus error:", err));

    return res.json({ status: 'success', message: 'Status updated' });
  }

  if (action === 'update') {
    const idToUpdate = String(body.id || '');
    if (idToUpdate && body.status) {
      statusOverrides[idToUpdate] = String(body.status);
      saveStatusOverrides(statusOverrides);
    }

    let updatedTarget = null;
    cached = cached.map(item => {
      const itemId = String(item.ID || item.id || '');
      if (itemId === idToUpdate) {
        if (body.workOrder !== undefined && body.workOrder !== null) { item['Work Order'] = body.workOrder; item.wo = body.workOrder; }
        if (body.description !== undefined && body.description !== null) { item['Description'] = body.description; item.desc = body.description; }
        if (body.plant !== undefined && body.plant !== null) { item['Plant'] = body.plant; item.plant = body.plant; }
        if (body.date !== undefined && body.date !== null) { item['Date'] = body.date; item.date = body.date; }
        if (body.time !== undefined && body.time !== null) { item['Time'] = body.time; item.time = body.time; }
        if (body.team !== undefined && body.team !== null) { item['Team'] = body.team; item.team = body.team; }
        if (body.status !== undefined && body.status !== null) { item['Status'] = body.status; item.status = body.status; }
        if (body.remarks !== undefined && body.remarks !== null) { item['Remarks'] = body.remarks; item.remarks = body.remarks; }
        updatedTarget = item;
      }
      return item;
    });
    saveLocalData(cached);

    // Only forward to Apps Script if workOrder or description or plant is present (prevent wiping sheet)
    const appsScriptPayload = Object.assign({}, updatedTarget ? {
      workOrder: updatedTarget['Work Order'] || updatedTarget.wo || '',
      description: updatedTarget['Description'] || updatedTarget.desc || '',
      plant: updatedTarget['Plant'] || updatedTarget.plant || '',
      date: updatedTarget['Date'] || updatedTarget.date || '',
      time: updatedTarget['Time'] || updatedTarget.time || '',
      team: updatedTarget['Team'] || updatedTarget.team || '',
      status: updatedTarget['Status'] || updatedTarget.status || 'Requested',
      remarks: updatedTarget['Remarks'] || updatedTarget.remarks || ''
    } : {}, body, { skipAutoHistory: true, skipHistoryLog: true });

    if (appsScriptPayload.workOrder || appsScriptPayload.description || appsScriptPayload.plant) {
      fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(appsScriptPayload),
        redirect: 'follow'
      }).catch(err => console.error("Apps Script update error:", err));
    }

    return res.json({ status: 'success', message: 'Updated successfully' });
  }

  if (action === 'create') {
    const woVal = String(body.workOrder || '').trim();
    const descVal = String(body.description || '').trim();
    const plantVal = String(body.plant || '').trim();

    // Safety check: Do not create ghost/empty rows
    if (!woVal && !descVal && !plantVal) {
      return res.status(400).json({ status: 'error', message: 'Cannot create empty request: Work Order, Description or Plant required' });
    }

    // Deduplication check: prevent double entry within 15 seconds
    const existing = cached.find(item => {
      const matchWo = String(item['Work Order'] || item.wo || '').trim() === woVal;
      const matchDesc = String(item['Description'] || item.desc || '').trim() === descVal;
      const matchPlant = String(item['Plant'] || item.plant || '').trim() === plantVal;
      const matchDate = String(item['Date'] || item.date || '').trim() === String(body.date || '').trim();
      const matchTime = String(item['Time'] || item.time || '').trim() === String(body.time || '').trim();
      return matchWo && matchDesc && matchPlant && matchDate && matchTime;
    });

    if (existing) {
      console.log(`[Operation Request] Duplicate create detected for WO: "${woVal}" / Plant: "${plantVal}". Returning existing entry.`);
      return res.json({ status: 'success', message: 'Request already recorded (deduplicated)', data: existing });
    }

    const newId = body.id || ("row_" + (cached.length + 1) + "_" + Date.now());
    const newItem = {
      "Work Order": body.workOrder || '',
      "Description": body.description || '',
      "Plant": body.plant || '',
      "Date": body.date || '',
      "Time": body.time || '',
      "Team": body.team || '',
      "Status": body.status || 'Requested',
      "Remarks": body.remarks || '',
      "ID": newId
    };
    cached.unshift(newItem);
    saveLocalData(cached);

    // Activity History Logging (Create entry & save to history)
    const userName = body.user || body.createdBy || 'Technician';
    const epoch = Date.now();
    const histEntry = {
      id: 'hist_' + epoch + '_' + Math.floor(Math.random() * 1000),
      timestamp: new Date(epoch).toISOString(),
      displayTime: format24HourDateTime(epoch),
      action: 'create',
      actionLabel: 'New Request',
      workOrder: woVal,
      plant: plantVal,
      description: `Created operation request for ${plantVal}${woVal ? ` (WO #${woVal})` : ''}`,
      details: body.remarks || '',
      user: userName,
      badgeColor: '#1a73e8'
    };
    let history = loadHistoryData();
    history.unshift(histEntry);
    history = deduplicateHistoryList(history);
    if (history.length > 200) history.length = 200;
    saveHistoryData(history);

    // Forward create to Apps Script and let Apps Script also log to History
    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, id: newId, user: userName, skipAutoHistory: false, skipHistoryLog: false }),
      redirect: 'follow'
    }).catch(err => console.error("Apps Script create error:", err));

    return res.json({ status: 'success', message: 'Created successfully', data: newItem, historyItem: histEntry });
  }

  if (action === 'saveTeamContact') {
    const list = loadTeamContacts();
    const targetCode = String(body.code || '').trim();
    const idx = list.findIndex(c => String(c.code).trim().toLowerCase() === targetCode.toLowerCase());
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        phone: body.phone !== undefined ? body.phone : list[idx].phone,
        whatsapp: body.whatsapp !== undefined ? body.whatsapp : list[idx].whatsapp,
        email: body.email !== undefined ? body.email : list[idx].email
      };
    } else {
      list.push({
        code: targetCode,
        short: body.short || '',
        full: body.full || '',
        role: body.role || '',
        phone: body.phone || '',
        whatsapp: body.whatsapp || '',
        email: body.email || ''
      });
    }
    saveTeamContacts(list);

    // Record in history
    const history = loadHistoryData();
    history.unshift({
      id: 'hist_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      displayTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: 'contact_update',
      actionLabel: 'Team Contact',
      workOrder: '',
      plant: '',
      description: `Updated Team Contact #${targetCode} (${body.short || body.full || ''})`,
      user: body.user || 'User',
      badgeColor: '#059669'
    });
    if (history.length > 100) history.length = 100;
    saveHistoryData(history);

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    }).catch(err => console.error("Apps Script saveTeamContact error:", err));

    return res.json({ status: 'success', message: 'Team Contact saved to Google Sheet & cache', code: targetCode });
  }

  // Fallback forward
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    });
    const text = await response.text();
    try {
      res.json(JSON.parse(text));
    } catch {
      res.send(text);
    }
  } catch (error) {
    console.error('Proxy POST error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET Team Contacts (from Google Sheet "Team Contacts" tab or local cache)
app.get('/api/team-contacts', async (req, res) => {
  const forceRefresh = req.query.refresh === 'true';
  let cached = loadTeamContacts();

  // If we already have cache and not forceRefresh, return fast
  if (cached && Array.isArray(cached) && cached.length > 0 && !forceRefresh) {
    return res.json({ status: 'success', data: cached, source: 'cache' });
  }

  // Fetch live from Apps Script
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);
    const response = await fetch(APPS_SCRIPT_URL + '?action=getTeamContacts&t=' + Date.now(), {
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      if (result.status === 'success' && Array.isArray(result.data) && result.data.length > 0) {
        // Merge cloud data with any local base fields
        const merged = result.data.map(cd => {
          const base = cached.find(c => String(c.code) === String(cd.code)) || {};
          return {
            code: cd.code,
            short: cd.short || base.short || '',
            full: cd.full || base.full || '',
            role: cd.role || base.role || '',
            phone: cd.phone || base.phone || '',
            whatsapp: cd.whatsapp || base.whatsapp || '',
            email: cd.email || base.email || ''
          };
        });
        saveTeamContacts(merged);
        return res.json({ status: 'success', data: merged, source: 'cloud' });
      }
    }
  } catch (err) {
    console.warn("Live fetch from Team Contacts sheet failed or timed out:", err.message);
  }

  // Fallback to local cache or employees.json
  return res.json({ status: 'success', data: cached, source: 'fallback' });
});

// POST Team Contacts (Update Contact & Sync to Google Sheet "Team Contacts" tab)
app.post('/api/team-contacts', async (req, res) => {
  const body = req.body || {};
  const list = loadTeamContacts();
  const targetCode = String(body.code || '').trim();

  if (!targetCode) {
    return res.status(400).json({ status: 'error', message: 'Employee code is required' });
  }

  const idx = list.findIndex(c => String(c.code).trim().toLowerCase() === targetCode.toLowerCase());
  if (idx !== -1) {
    list[idx] = {
      ...list[idx],
      phone: body.phone !== undefined ? body.phone : list[idx].phone,
      whatsapp: body.whatsapp !== undefined ? body.whatsapp : list[idx].whatsapp,
      email: body.email !== undefined ? body.email : list[idx].email
    };
  } else {
    list.push({
      code: targetCode,
      short: body.short || '',
      full: body.full || '',
      role: body.role || '',
      phone: body.phone || '',
      whatsapp: body.whatsapp || '',
      email: body.email || ''
    });
  }
  saveTeamContacts(list);

  // Write to history
  const history = loadHistoryData();
  history.unshift({
    id: 'hist_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString(),
    displayTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    action: 'contact_update',
    actionLabel: 'Team Contact',
    workOrder: '',
    plant: '',
    description: `Updated Team Contact #${targetCode} (${body.short || body.full || ''})`,
    user: body.user || 'User',
    badgeColor: '#059669'
  });
  if (history.length > 150) history.length = 150;
  saveHistoryData(history);

  // Forward contact history item to Google Sheet "History" tab asynchronously
  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'logHistory', historyItem: history[0] }),
    redirect: 'follow'
  }).catch(err => console.error("Apps Script logHistory error:", err));

  // Forward to Apps Script Team Contacts tab
  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'saveTeamContact',
      code: targetCode,
      short: body.short || (idx !== -1 ? list[idx].short : ''),
      full: body.full || (idx !== -1 ? list[idx].full : ''),
      role: body.role || (idx !== -1 ? list[idx].role : ''),
      phone: body.phone || '',
      whatsapp: body.whatsapp || '',
      email: body.email || '',
      user: body.user || 'User'
    }),
    redirect: 'follow'
  }).catch(err => console.error("Apps Script Team Contact post error:", err));

  return res.json({ status: 'success', message: 'Team contact saved to Google Sheet', data: list[idx !== -1 ? idx : list.length - 1] });
});

// GET Inventory Proxy (Forward to Google Apps Script with fallback to inventory_cache.json)
app.get('/api/inventory', async (req, res) => {
  const query = { ...req.query };
  if (!query.key) query.key = 'AI1';
  const action = query.action || 'getItems';

  const qs = new URLSearchParams(query).toString();
  const targetUrl = `${INVENTORY_GAS_URL}?${qs}`;

  if (action === 'getItems') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7500);
      const response = await fetch(targetUrl, {
        redirect: 'follow',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        if (result && result.success && Array.isArray(result.data)) {
          saveInventoryCache(result);
          return res.json(result);
        }
      }
    } catch (err) {
      console.warn("Live inventory fetch from GAS failed or timed out:", err.message);
    }

    // Return cached inventory data safely with 200 OK
    const cached = loadInventoryCache();
    return res.json({ ...cached, success: true, fromCache: true });
  }

  if (action === 'getHistory') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7500);
      const response = await fetch(targetUrl, {
        redirect: 'follow',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        if (result && result.success && Array.isArray(result.data)) {
          saveInventoryHistoryCache(result);
          return res.json(result);
        }
      }
    } catch (err) {
      console.warn("Live inventory history fetch from GAS failed:", err.message);
    }

    const cachedHist = loadInventoryHistoryCache();
    return res.json({ ...cachedHist, success: true, fromCache: true });
  }

  // Handle other actions (updateLocations, clearCache, feedback, log_sync, etc.)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(targetUrl, {
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      return res.json(result);
    }
  } catch (err) {
    console.warn(`Action ${action} proxy error:`, err.message);
  }

  // If updateLocations was requested and remote failed, update local cache
  if (action === 'updateLocations' && query.updates) {
    try {
      const updates = typeof query.updates === 'string' ? JSON.parse(query.updates) : query.updates;
      if (Array.isArray(updates)) {
        const cached = loadInventoryCache();
        updates.forEach(u => {
          const item = (cached.data || []).find(it => it.name === u.name);
          if (item) item.location = u.location;
        });
        saveInventoryCache(cached);
      }
    } catch (e) {}
    return res.json({ success: true, message: 'Locations updated in local cache' });
  }

  return res.json({ success: true, message: 'Request processed' });
});

// POST Inventory Proxy
app.post('/api/inventory', async (req, res) => {
  const query = { ...req.query };
  if (!query.key) query.key = 'AI1';
  const body = req.body || {};
  const qs = new URLSearchParams(query).toString();
  const targetUrl = `${INVENTORY_GAS_URL}?${qs}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      return res.json(result);
    }
  } catch (err) {
    console.warn("POST /api/inventory proxy error:", err.message);
  }

  return res.json({ success: true, message: 'Request accepted' });
});

// POST Clean Ghost / Invalid Empty Rows from Sheet & Cache
app.post('/api/clean-kachra', async (req, res) => {
  if (!isPrivilegedRequest(req)) {
    return res.status(403).json({ status: 'error', message: 'Forbidden: Insufficient privileges' });
  }

  let cached = loadLocalData() || [];
  const beforeLen = cached.length;
  cached = cached.filter(item => {
    const wo = String(item['Work Order'] || item.wo || '').trim();
    const desc = String(item['Description'] || item.desc || '').trim();
    const plant = String(item['Plant'] || item.plant || '').trim();
    return wo || desc || plant;
  });
  saveLocalData(cached);

  let cloudCleaned = 0;
  try {
    const cloudRes = await fetch(APPS_SCRIPT_URL + '?action=cleanEmptyRows&t=' + Date.now(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000)
    });
    if (cloudRes.ok) {
      const json = await cloudRes.json();
      if (json && json.status === 'success') {
        cloudCleaned = json.cleanedCount || 0;
      }
    }
  } catch (err) {
    console.warn("Clean ghost rows on Apps Script warning:", err.message);
  }

  return res.json({
    status: 'success',
    message: `Ghost rows cleaned successfully (Local cleaned: ${beforeLen - cached.length}, Cloud cleaned: ${cloudCleaned})`,
    localCleaned: beforeLen - cached.length,
    cloudCleaned
  });
});

// POST Bulk Sync All to Google Sheets (Populates Team Contacts & History sheets)
app.post('/api/sync-all-to-sheets', async (req, res) => {
  const contacts = loadTeamContacts();
  const history = loadHistoryData();

  let contactsResult = null;
  let setupResult = null;

  try {
    // 1. Run setupInitialSheets on Apps Script
    const setupRes = await fetch(APPS_SCRIPT_URL + '?action=setupInitialSheets&t=' + Date.now(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(9000)
    });
    if (setupRes.ok) {
      setupResult = await setupRes.json();
    }
  } catch (err) {
    console.warn("setupInitialSheets error:", err.message);
  }

  try {
    // 2. Sync all team contacts explicitly
    const syncTcRes = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'bulkSaveTeamContacts',
        contacts: contacts
      }),
      redirect: 'follow',
      signal: AbortSignal.timeout(9000)
    });
    if (syncTcRes.ok) {
      contactsResult = await syncTcRes.json();
    }
  } catch (err) {
    console.warn("bulkSaveTeamContacts error:", err.message);
  }

  return res.json({
    status: 'success',
    message: 'Sync to Google Sheets completed',
    setupResult,
    contactsResult,
    contactsCount: contacts.length,
    historyCount: history.length
  });
});

// GET PWA Preferences (Tile arrangement & User Settings from Server & Google Drive PWA.json)
app.get('/api/pwa-preferences', async (req, res) => {
  let localData = loadPwaPreferences();

  // Try to sync latest from Google Apps Script / Drive file
  try {
    const targetGasUrl = localData.gasUrl || MIX_DATA_GAS_URL || APPS_SCRIPT_URL;
    const remoteUrl = `${targetGasUrl}?action=getPwaConfig&fileId=${DRIVE_PWA_FILE_ID}&t=${Date.now()}`;
    const remoteRes = await fetch(remoteUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(2000)
    });
    if (remoteRes.ok) {
      const json = await remoteRes.json();
      if (json && json.status === 'success' && json.data && typeof json.data === 'object' && Object.keys(json.data).length > 0) {
        const remoteCounter = Number(json.data.syncCounter) || 0;
        const localCounter = Number(localData.syncCounter) || 0;

        if (remoteCounter >= localCounter) {
          localData = {
            ...localData,
            ...json.data,
            syncCounter: remoteCounter || localCounter,
            moduleOrders: { ...(localData.moduleOrders || {}), ...(json.data.moduleOrders || {}) },
            userSettings: { ...(localData.userSettings || {}), ...(json.data.userSettings || {}) },
            globalSettings: { ...(localData.globalSettings || {}), ...(json.data.globalSettings || {}) }
          };
          savePwaPreferences(localData);
          return res.json({ status: 'success', data: localData, source: 'google_drive' });
        } else if (localCounter > remoteCounter) {
          // Local has newer updates, push to remote in background!
          fetch(targetGasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'savePwaConfig', fileId: DRIVE_PWA_FILE_ID, pwaData: localData, user: 'SyncDaemon' }),
            redirect: 'follow',
            signal: AbortSignal.timeout(9000)
          }).catch(() => {});
        }
      }
    }
  } catch (err) {
    // Timeout or Apps Script not yet updated, attempt direct Drive download
    try {
      const driveDirectUrl = `https://drive.usercontent.google.com/download?id=${DRIVE_PWA_FILE_ID}&export=download`;
      const directRes = await fetch(driveDirectUrl, { signal: AbortSignal.timeout(1500) });
      if (directRes.ok) {
        const text = await directRes.text();
        if (text && text.trim().length > 0) {
          const driveData = JSON.parse(text);
          if (driveData && typeof driveData === 'object') {
            const remoteCounter = Number(driveData.syncCounter) || 0;
            const localCounter = Number(localData.syncCounter) || 0;
            if (remoteCounter >= localCounter) {
              localData = {
                ...localData,
                ...driveData,
                syncCounter: remoteCounter || localCounter,
                moduleOrders: { ...(localData.moduleOrders || {}), ...(driveData.moduleOrders || {}) },
                userSettings: { ...(localData.userSettings || {}), ...(driveData.userSettings || {}) },
                globalSettings: { ...(localData.globalSettings || {}), ...(driveData.globalSettings || {}) }
              };
              savePwaPreferences(localData);
              return res.json({ status: 'success', data: localData, source: 'google_drive_direct' });
            }
          }
        }
      }
    } catch(e) {}
  }

  return res.json({ status: 'success', data: localData, source: 'server_cache' });
});

// POST PWA Preferences (Saves to server cache and writes to Google Drive PWA.json via Apps Script)
app.post('/api/pwa-preferences', async (req, res) => {
  const body = req.body || {};
  let currentData = loadPwaPreferences();

  const user = body.user || 'User';
  const fileId = body.fileId || DRIVE_PWA_FILE_ID;
  const clientCounter = Number(body.syncCounter) || 0;
  currentData.syncCounter = Math.max(Number(currentData.syncCounter) || 0, clientCounter) + 1;

  if (body.gasUrl && typeof body.gasUrl === 'string') {
    currentData.gasUrl = body.gasUrl.trim();
    MIX_DATA_GAS_URL = body.gasUrl.trim();
  }

  if (body.action === 'restoreUserDefault') {
    const userCode = String(body.userCode || body.user || '').trim();
    const restored = (userCode && currentData.userDefaultSettings && currentData.userDefaultSettings[userCode]) 
      || currentData.defaultSettings 
      || DEVELOPER_DEFAULT_SETTINGS;

    if (userCode) {
      if (!currentData.userSettings) currentData.userSettings = {};
      currentData.userSettings[userCode] = { ...restored };
    }
    currentData.lastUpdated = new Date().toISOString();
    currentData.lastUpdatedBy = user;
    savePwaPreferences(currentData);

    const targetGasUrl = currentData.gasUrl || MIX_DATA_GAS_URL || APPS_SCRIPT_URL;
    fetch(targetGasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'savePwaConfig', fileId: fileId, pwaData: currentData, user: user }),
      redirect: 'follow',
      signal: AbortSignal.timeout(9000)
    }).catch(() => {});

    return res.json({ status: 'success', message: 'Restored default settings for user from PWA.json', restoredSettings: restored, data: currentData });
  }

  if (body.action === 'factoryResetAll') {
    currentData.moduleOrders = {};
    currentData.userSettings = {};
    currentData.userDefaultSettings = {};
    currentData.defaultSettings = { ...DEVELOPER_DEFAULT_SETTINGS };
    currentData.lastUpdated = new Date().toISOString();
    currentData.lastUpdatedBy = user;
    savePwaPreferences(currentData);

    const targetGasUrl = currentData.gasUrl || MIX_DATA_GAS_URL || APPS_SCRIPT_URL;
    fetch(targetGasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'savePwaConfig', fileId: fileId, pwaData: currentData, user: user }),
      redirect: 'follow',
      signal: AbortSignal.timeout(9000)
    }).catch(() => {});

    return res.json({ status: 'success', message: 'All employees factory reset to Developer Defaults', data: currentData });
  }

  if (body.moduleOrders && typeof body.moduleOrders === 'object') {
    currentData.moduleOrders = {
      ...(currentData.moduleOrders || {}),
      ...body.moduleOrders
    };
  }

  if (body.userSettings && typeof body.userSettings === 'object') {
    currentData.userSettings = {
      ...(currentData.userSettings || {}),
      ...body.userSettings
    };
  }

  if (body.userDefaultSettings && typeof body.userDefaultSettings === 'object') {
    currentData.userDefaultSettings = {
      ...(currentData.userDefaultSettings || {}),
      ...body.userDefaultSettings
    };
  }

  if (body.defaultSettings && typeof body.defaultSettings === 'object') {
    currentData.defaultSettings = {
      ...DEVELOPER_DEFAULT_SETTINGS,
      ...body.defaultSettings
    };
  }

  if (body.globalSettings && typeof body.globalSettings === 'object') {
    currentData.globalSettings = {
      ...(currentData.globalSettings || {}),
      ...body.globalSettings
    };
  }

  currentData.lastUpdated = new Date().toISOString();
  currentData.lastUpdatedBy = user;
  currentData.fileId = fileId;

  // 1. Save to local server file immediately so any device connecting to the server gets it
  savePwaPreferences(currentData);

  // 2. Forward to Mix Data Google Apps Script in background to write into Google Drive PWA.json
  const targetGasUrl = currentData.gasUrl || MIX_DATA_GAS_URL || APPS_SCRIPT_URL;
  fetch(targetGasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'savePwaConfig',
      fileId: fileId,
      pwaData: currentData,
      user: user
    }),
    redirect: 'follow',
    signal: AbortSignal.timeout(9000)
  }).then(async r => {
    try {
      const resJson = await r.json();
      if (resJson && resJson.status === 'success') {
        console.log("[PWA Sync] Google Drive PWA.json synced successfully with syncCounter:", currentData.syncCounter);
      }
    } catch(e) {}
  }).catch(() => {
    // Safe fallback: server copy is already safely saved in pwa_preferences.json
  });

  return res.json({
    status: 'success',
    message: 'Saved preferences to server & syncing with Google Drive PWA.json',
    data: currentData
  });
});

app.post('/api/pwa-preferences/factory-reset', async (req, res) => {
  let currentData = loadPwaPreferences();
  const user = req.body?.user || 'Developer';
  const fileId = req.body?.fileId || DRIVE_PWA_FILE_ID;
  const targetGasUrl = currentData.gasUrl || MIX_DATA_GAS_URL || APPS_SCRIPT_URL;

  currentData.syncCounter = (Number(currentData.syncCounter) || 0) + 1;
  currentData.moduleOrders = {};
  currentData.userSettings = {};
  currentData.userDefaultSettings = {};
  currentData.defaultSettings = { ...DEVELOPER_DEFAULT_SETTINGS };
  currentData.lastUpdated = new Date().toISOString();
  currentData.lastUpdatedBy = user;
  savePwaPreferences(currentData);

  fetch(targetGasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'savePwaConfig', fileId: fileId, pwaData: currentData, user: user }),
    redirect: 'follow',
    signal: AbortSignal.timeout(9000)
  }).catch(() => {});

  return res.json({ status: 'success', message: 'All employees factory reset to Developer Defaults', data: currentData });
});

// Handle case-insensitive index request for PWA start_url (/Index.html)
app.get(['/Index.html', '/index.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve static files from root directory
app.use(express.static(__dirname, {
  index: 'index.html'
}));

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

