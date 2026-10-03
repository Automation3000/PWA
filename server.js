import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Centralized Data Directory: /data (supports /Data via symlink)
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error("Error creating data directory:", e);
  }
}

// JSON Data Storage locations in /data/
const DATA_FILE = path.join(DATA_DIR, 'operation_requests.json');
const DELETED_FILE = path.join(DATA_DIR, 'deleted_requests.json');
const OVERRIDES_FILE = path.join(DATA_DIR, 'status_overrides.json');
const HISTORY_FILE = path.join(DATA_DIR, 'operation_history.json');
const TEAM_CONTACTS_FILE = path.join(DATA_DIR, 'team_contacts.json');
const EMPLOYEES_FILE = path.join(DATA_DIR, 'employees.json');
const PWA_PREFERENCES_FILE = path.join(DATA_DIR, 'pwa_preferences.json');
const DRIVE_PWA_FILE_ID = '1AlvVbRj3DOQIMOQ2DaWikRoOlilJMmlX';
const INVENTORY_CACHE_FILE = path.join(DATA_DIR, 'inventory_cache.json');
const INVENTORY_HISTORY_FILE = path.join(DATA_DIR, 'inventory_history_cache.json');
const INVENTORY_GAS_URL = "https://script.google.com/macros/s/AKfycbwnUqgWqfPwnPLtmsSXvXfqNj66wcOjVoft3ou_t4RDBQ-Iscyp3wuiv45Z1o9UND6OZQ/exec";
const ETS_CACHE_FILE = path.join(DATA_DIR, 'ets_cache.json');
const ETS_GAS_URL = "https://script.google.com/macros/s/AKfycbwtbDjkB35lpSHZAN40I6voWUbQHHGVZo9LHtfah_y3IZO149gJgeY33K-98MqxBeGc1g/exec";

function loadEtsCache() {
  try {
    if (fs.existsSync(ETS_CACHE_FILE)) {
      const content = fs.readFileSync(ETS_CACHE_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && (Array.isArray(parsed.data) || parsed.status === 'success')) return parsed;
    }
  } catch (e) {
    console.warn("Error reading ets_cache.json:", e.message);
  }
  return { status: 'success', data: [] };
}

function saveEtsCache(data) {
  try {
    fs.writeFileSync(ETS_CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn("Error writing ets_cache.json:", e.message);
  }
}

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
const PORT = 3000;
const ALT_PORT = (process.env.PORT && String(process.env.PORT) !== '3000') ? Number(process.env.PORT) : null;

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
  
  const actionLabels = {
    'create': 'Created',
    'update': 'Edited',
    'status': 'Status',
    'delete': 'Deleted',
    'clean': 'Cleaned'
  };

  // 1. Prepare items with parsed epoch, normalized action and 24h displayTime
  const prepared = list.map((item, idx) => {
    if (!item) return null;
    let wo = String(item.workOrder || '').replace(/^#+/, '').trim();
    if (wo === 'undefined' || wo === 'null' || wo === 'N/A') wo = '';

    let desc = String(item.description || '').trim();
    let plant = String(item.plant || '').trim();
    if (plant === 'undefined' || plant === 'null') plant = '';

    let details = String(item.details || '').trim();
    if (details === 'undefined' || details === 'null') details = '';
    
    // Filter out completely blank ghost rows
    if (!wo && !desc && !plant && !details) return null;

    // Filter out non-operation request items (contacts, instruments, sync logs)
    const lowerDesc = desc.toLowerCase();
    const lowerDetails = details.toLowerCase();
    if (
      lowerDesc.includes('team contact') || 
      lowerDesc.includes('instrument update') || 
      lowerDesc.includes('pwa preference') || 
      lowerDetails.includes('phone:') || 
      lowerDetails.includes('wa:')
    ) {
      return null;
    }

    // Filter out improper status changes where oldStatus === newStatus
    const statusSelfMatch = desc.match(/Status changed from ["']?([^"']+)["']? to ["']?([^"']+)["']?/i);
    if (statusSelfMatch && statusSelfMatch[1].trim().toLowerCase() === statusSelfMatch[2].trim().toLowerCase()) {
      return null;
    }

    const rawAction = normalizeHistoryAction(item.action || item.actionLabel);
    
    // Normalize action correctly from description if miscategorized
    let normAction = rawAction;
    if (lowerDesc.includes('status changed from') || lowerDesc.startsWith('status changed')) {
      normAction = 'status';
    } else if (lowerDesc.includes('created operation request') || lowerDesc.includes('new request')) {
      normAction = 'create';
    } else if (lowerDesc.includes('edited wo') || lowerDesc.includes('edited request')) {
      normAction = 'update';
    } else if (lowerDesc.includes('deleted work order') || lowerDesc.includes('deleted wo')) {
      normAction = 'delete';
    }

    // Exclude sync actions as user requested
    if (normAction === 'sync' || rawAction === 'sync') return null;

    // Extract real user name if generic
    let userName = String(item.user || '').trim();
    if (isGenericHistoryUser(userName)) {
      const byMatch = (details + ' ' + desc).match(/\bby\s+([A-Za-z]+)\b/i);
      if (byMatch && byMatch[1] && !['the', 'and', 'or', 'a'].includes(byMatch[1].toLowerCase())) {
        userName = byMatch[1].charAt(0).toUpperCase() + byMatch[1].slice(1).toLowerCase();
      } else {
        userName = 'Technician';
      }
    }

    const epoch = parseHistoryEpoch(item.timestamp, item.displayTime) || (Date.now() - idx * 1000);
    const normWo = wo.toLowerCase();
    const display24 = format24HourDateTime(epoch);

    return {
      ...item,
      epoch,
      action: normAction,
      actionLabel: actionLabels[normAction] || item.actionLabel || 'Activity',
      workOrder: wo,
      normWo,
      plant: plant,
      description: desc,
      details: details,
      user: userName,
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

      const dateA = String(r.displayTime || '').split(' ')[0];
      const dateB = String(item.displayTime || '').split(' ')[0];
      const sameDay = Boolean(dateA && dateB && dateA === dateB);
      const timeDiffMs = Math.abs(r.epoch - item.epoch);
      const within24Hours = timeDiffMs <= 86400000;

      // A. Both have matching Work Orders
      if (r.normWo && item.normWo && r.normWo === item.normWo) {
        // Create action: a Work Order is created only once in history
        if (r.action === 'create' && item.action === 'create') {
          return true;
        }
        // Delete action: a Work Order is deleted only once
        if (r.action === 'delete' && item.action === 'delete') {
          return true;
        }
        // Status action: collapse duplicate status changes within 24 hours
        if (r.action === 'status' && item.action === 'status' && within24Hours) {
          return true;
        }
        // Update action: collapse duplicate edits within 12 hours
        if (r.action === 'update' && item.action === 'update' && timeDiffMs < 43200000) {
          return true;
        }
        // Same action within same day or 24 hours
        if (r.action === item.action && (within24Hours || sameDay)) {
          return true;
        }
        // Identical description on same WO
        if (r.description && item.description && r.description.toLowerCase().trim() === item.description.toLowerCase().trim()) {
          return true;
        }
      }

      // B. Work Order is empty
      if (!r.normWo && !item.normWo) {
        if (r.action === item.action) {
          if (r.action === 'clean' && (sameDay || timeDiffMs < 7200000)) return true;
          if (r.plant && item.plant && r.plant.toLowerCase() === item.plant.toLowerCase() && within24Hours) {
            return true;
          }
          if (r.description && item.description && r.description.toLowerCase().trim() === item.description.toLowerCase().trim() && within24Hours) {
            return true;
          }
        }
      }

      return false;
    });

    if (existingIdx === -1) {
      result.push(item);
    } else {
      // Merge: prefer real logged user over generic ('Technician'/'Supervisor'/'User')
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
      if (item.workOrder && !existing.workOrder) {
        existing.workOrder = item.workOrder;
        existing.normWo = item.normWo;
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

// Proxy endpoint: fetches live cloud data from Google Sheet with resilient local cache fallback
app.get('/api/operation-requests', async (req, res) => {
  const forceRefresh = req.query.refresh === 'true';
  let cached = loadLocalData();

  // Always attempt live fetch from Google Apps Script with 12s timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
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
      const deletedList = loadDeletedIds();
      const statusOverrides = loadStatusOverrides();
      let overridesModified = false;

      const cleaned = data.data.filter(r => {
        const wo = String(r['Work Order'] || r.wo || '').trim();
        const desc = String(r['Description'] || r.desc || '').trim();
        const plant = String(r['Plant'] || r.plant || '').trim();
        const idStr = String(r['ID'] || r.id || '');
        if (!wo && !desc && !plant) return false;
        if (idStr && deletedList.includes(idStr)) return false;
        if (wo && deletedList.includes('wo_' + wo.toLowerCase())) return false;
        return true;
      }).map((r, idx) => {
        const idStr = String(r['ID'] || r.id || ('row_' + (idx + 2)));
        const cloudStatus = String(r['Status'] || r.status || 'Requested').trim();
        
        // Cloud response is authoritative: clear any stale local override for this ID or WO
        if (statusOverrides[idStr]) {
          delete statusOverrides[idStr];
          overridesModified = true;
        }
        const woKey = String(r['Work Order'] || r.wo || '').trim().toLowerCase();
        if (woKey && statusOverrides['wo_' + woKey]) {
          delete statusOverrides['wo_' + woKey];
          overridesModified = true;
        }

        r['Status'] = cloudStatus || 'Requested';
        r.status = cloudStatus || 'Requested';
        return r;
      });

      if (overridesModified) {
        saveStatusOverrides(statusOverrides);
      }

      // Retain items from local cached that have not yet reached cloud (and are not deleted)
      const cloudWos = new Set(cleaned.map(c => String(c['Work Order'] || c.wo || '').trim().toLowerCase()).filter(Boolean));
      const cloudIds = new Set(cleaned.map(c => String(c['ID'] || c.id || '')).filter(Boolean));

      const pendingLocal = (Array.isArray(cached) ? cached : []).filter(item => {
        const itemWo = String(item['Work Order'] || item.wo || '').trim().toLowerCase();
        const itemId = String(item['ID'] || item.id || '');
        if (itemId && deletedList.includes(itemId)) return false;
        if (itemWo && deletedList.includes('wo_' + itemWo)) return false;
        if (itemWo && cloudWos.has(itemWo)) return false;
        if (itemId && cloudIds.has(itemId)) return false;
        return true;
      });

      cached = [...pendingLocal, ...cleaned];
      saveLocalData(cached);
      return res.json({ status: 'success', data: cached, source: 'cloud' });
    }
  } catch (error) {
    console.warn('Proxy GET error or timeout from Apps Script:', error.message || error);
  }

  // Resilient fallback: return existing cache
  if (Array.isArray(cached)) {
    return res.json({ status: 'success', data: cached, source: 'fallback_cache' });
  }

  saveLocalData([]);
  return res.json({ status: 'success', data: [], source: 'fallback_init' });
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
    const wo = String(body.workOrder || '').trim();
    const rowIdx = Number(body.rowIdx || 0);
    const desc = String(body.description || body.desc || '').trim();
    const plant = String(body.plant || '').trim();

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
      const itemWo = String(item['Work Order'] || item.wo || '').trim();
      const itemDesc = String(item['Description'] || item.desc || '').trim();
      const itemPlant = String(item['Plant'] || item.plant || '').trim();
      const itemRowIdx = Number(item.rowIdx || 0);

      if (idToDelete && itemId === idToDelete) return false;
      if (wo && itemWo && itemWo.toLowerCase() === wo.toLowerCase()) return false;
      if (!wo && rowIdx && itemRowIdx && itemRowIdx === rowIdx) return false;
      if (!wo && desc && plant && itemDesc.toLowerCase() === desc.toLowerCase() && itemPlant.toLowerCase() === plant.toLowerCase()) return false;
      return true;
    });
    saveLocalData(cached);

    // Forward to Apps Script asynchronously
    const appsScriptPayload = { ...body, skipAutoHistory: true, skipHistoryLog: true };
    // If no work order, pass compatible row ID for Apps Script findRow ("row_" + (rowIdx - 1))
    if (!wo && rowIdx >= 2) {
      appsScriptPayload.id = "row_" + (rowIdx - 1);
    }

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(appsScriptPayload),
      redirect: 'follow'
    }).catch(err => console.error("Apps Script delete error:", err));

    return res.json({ status: 'success', message: 'Deleted successfully' });
  }

  if (action === 'updateStatus') {
    const idToUpdate = String(body.id || '');
    const newStatus = String(body.status || '');
    const wo = String(body.workOrder || '').trim();
    const rowIdx = Number(body.rowIdx || 0);

    if (idToUpdate && newStatus) {
      statusOverrides[idToUpdate] = newStatus;
      saveStatusOverrides(statusOverrides);
    }

    cached = cached.map((item, idx) => {
      const itemId = String(item.ID || item.id || '');
      const itemWo = String(item['Work Order'] || item.wo || '').trim();
      const itemRowIdx = Number(item.rowIdx || (idx + 2));
      const match = (
        (idToUpdate && itemId === idToUpdate) ||
        (wo && itemWo && itemWo.toLowerCase() === wo.toLowerCase()) ||
        (rowIdx && itemRowIdx && itemRowIdx === rowIdx)
      );
      if (match) {
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
    const wo = String(body.workOrder || '').trim();
    const oldWo = String(body.oldWorkOrder || '').trim();
    const rowIdx = Number(body.rowIdx || 0);

    if (idToUpdate && body.status) {
      statusOverrides[idToUpdate] = String(body.status);
      saveStatusOverrides(statusOverrides);
    }

    let updatedTarget = null;
    cached = cached.map((item, idx) => {
      const itemId = String(item.ID || item.id || '');
      const itemWo = String(item['Work Order'] || item.wo || '').trim();
      const itemRowIdx = Number(item.rowIdx || (idx + 2));
      const match = (
        (idToUpdate && itemId === idToUpdate) ||
        (oldWo && itemWo && itemWo.toLowerCase() === oldWo.toLowerCase()) ||
        (wo && itemWo && itemWo.toLowerCase() === wo.toLowerCase()) ||
        (rowIdx && itemRowIdx && itemRowIdx === rowIdx)
      );
      if (match) {
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

    // Forward to Apps Script with full payload
    const appsScriptPayload = Object.assign({}, updatedTarget ? {
      workOrder: updatedTarget['Work Order'] || updatedTarget.wo || '',
      oldWorkOrder: oldWo || '',
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

    return res.json({ status: 'success', message: 'Team Contact saved to Cloud & cache', code: targetCode });
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
    const timeoutId = setTimeout(() => controller.abort(), 12000);
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
    if (err.name !== 'AbortError') {
      console.log("[Team Contacts] Upstream GAS note:", err.message);
    }
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

  return res.json({ status: 'success', message: 'Team contact saved to Cloud', data: list[idx !== -1 ? idx : list.length - 1] });
});

// GET ETS Locator Data (Fast local cache with async background refresh)
app.get('/api/ets', async (req, res) => {
  const action = req.query.action || 'read';
  const cached = loadEtsCache();

  if (action === 'read') {
    // Background refresh from Google Apps Script without blocking response
    fetch(`${ETS_GAS_URL}?action=read`, { redirect: 'follow' })
      .then(r => r.json())
      .then(result => {
        if (result && result.status === 'success' && Array.isArray(result.data)) {
          // Preserve developer hidden entries and flags across cloud sync
          const localHiddenMap = new Map();
          if (Array.isArray(cached.data)) {
            cached.data.forEach(item => {
              if (item && (item.hidden || item.isHidden || (item.comment && item.comment.includes('[DEV_ONLY]')))) {
                localHiddenMap.set(item.name, item);
              }
            });
          }
          result.data.forEach(item => {
            if (item) {
              const hasDevTag = Boolean(item.comment && (item.comment.includes('[DEV_ONLY]') || item.comment.includes('[HIDDEN]')));
              const matched = localHiddenMap.get(item.name);
              if (hasDevTag || (matched && (matched.hidden || matched.isHidden))) {
                item.hidden = true;
                item.isHidden = true;
              }
            }
          });
          localHiddenMap.forEach((hiddenItem, name) => {
            if (!result.data.some(it => it.name === name)) {
              result.data.unshift(hiddenItem);
            }
          });
          saveEtsCache(result);
        }
      })
      .catch(err => console.warn('Background ETS refresh note:', err.message));

    return res.json(cached);
  }

  // Handle other actions
  try {
    const qs = new URLSearchParams(req.query).toString();
    const response = await fetch(`${ETS_GAS_URL}?${qs}`, { redirect: 'follow' });
    const json = await response.json();
    return res.json(json);
  } catch (err) {
    return res.json(cached);
  }
});

// POST ETS Locator Data
app.post('/api/ets', async (req, res) => {
  const body = req.body || {};
  const itemData = body.data || body;
  const isHidden = Boolean(itemData.hidden || itemData.isHidden || (itemData.comment && (itemData.comment.includes('[DEV_ONLY]') || itemData.comment.includes('[HIDDEN]'))));
  const cached = loadEtsCache();

  // Apply update to local cache
  if (body.action === 'create' || body.action === 'add') {
    if (Array.isArray(cached.data)) {
      const newEntry = {
        rowIdx: cached.data.length + 2,
        name: itemData.name || '',
        plant: itemData.plant || '',
        coords: itemData.coords || '',
        lat: parseFloat(itemData.lat) || 0,
        lng: parseFloat(itemData.lng) || 0,
        comment: itemData.comment || '',
        hidden: isHidden,
        isHidden: isHidden,
        timestamp: new Date().toISOString()
      };
      if (isHidden) {
        cached.data.unshift(newEntry);
      } else {
        cached.data.push(newEntry);
      }
      saveEtsCache(cached);
    }
  } else if (body.action === 'update') {
    if (Array.isArray(cached.data)) {
      const idx = cached.data.findIndex(it => String(it.rowIdx) === String(itemData.rowIdx) || it.name === itemData.name);
      if (idx !== -1) {
        cached.data[idx] = { ...cached.data[idx], ...itemData, hidden: isHidden, isHidden: isHidden };
        saveEtsCache(cached);
      }
    }
  } else if (body.action === 'delete') {
    if (Array.isArray(cached.data)) {
      cached.data = cached.data.filter(it => String(it.rowIdx) !== String(itemData.rowIdx) && it.name !== itemData.name);
      saveEtsCache(cached);
    }
  }

  // Forward to Google Apps Script asynchronously
  fetch(ETS_GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow'
  }).catch(err => console.warn('Background ETS sync note:', err.message));

  return res.json({ status: 'success', message: 'ETS data saved', data: cached.data });
});

let lastInventorySyncTime = 0;
let isInventorySyncing = false;
let lastInventoryHistorySyncTime = 0;
let isInventoryHistorySyncing = false;

async function syncInventoryFromGAS(targetUrl) {
  if (isInventorySyncing) return null;
  isInventorySyncing = true;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    const response = await fetch(targetUrl, {
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      if (result && (result.success || result.status === 'success') && Array.isArray(result.data)) {
        result.success = true;
        saveInventoryCache(result);
        lastInventorySyncTime = Date.now();
        return result;
      }
    }
  } catch (err) {
    // Quiet fail in background - cache continues to serve seamlessly
  } finally {
    isInventorySyncing = false;
  }
  return null;
}

async function syncInventoryHistoryFromGAS(force = false) {
  if (isInventoryHistorySyncing && !force) return null;
  isInventoryHistorySyncing = true;
  try {
    const targetUrl = `${INVENTORY_GAS_URL}?key=AI1&action=getHistory&t=${Date.now()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    const response = await fetch(targetUrl, {
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      if (result && (result.success || result.status === 'success') && Array.isArray(result.data)) {
        result.success = true;
        saveInventoryHistoryCache(result);
        lastInventoryHistorySyncTime = Date.now();
        return result;
      }
    }
  } catch (err) {
    // Background fail quiet
  } finally {
    isInventoryHistorySyncing = false;
  }
  return null;
}

// Helper to synchronize local inventory cache on item update, add, or delete
function applyLocalInventoryChange(action, data) {
  const cachedInv = loadInventoryCache();
  if (!cachedInv || !Array.isArray(cachedInv.data)) return;

  const targetName = data.name || data.itemName;
  if (!targetName) return;

  if (action === 'update') {
    let item = cachedInv.data.find(it => it.name === targetName || (data.itemName && it.name === data.itemName));
    if (item) {
      if (data.newLocation || data.location) item.location = data.newLocation || data.location;
      if (data.newExpiry !== undefined || data.expiry !== undefined) item.expiry = data.newExpiry !== undefined ? data.newExpiry : data.expiry;
      if (data.user || data.updatedBy) item.updatedBy = data.user || data.updatedBy;
      if (data.remark !== undefined || data.comment !== undefined) item.remark = data.remark !== undefined ? data.remark : data.comment;
      saveInventoryCache(cachedInv);
    }
  } else if (action === 'add') {
    const existing = cachedInv.data.find(it => it.name === targetName);
    if (existing) {
      if (data.newLocation || data.location) existing.location = data.newLocation || data.location;
      if (data.newExpiry !== undefined || data.expiry !== undefined) existing.expiry = data.newExpiry !== undefined ? data.newExpiry : data.expiry;
      if (data.user || data.updatedBy) existing.updatedBy = data.user || data.updatedBy;
      if (data.remark !== undefined || data.comment !== undefined) existing.remark = data.remark !== undefined ? data.remark : data.comment;
    } else {
      cachedInv.data.push({
        name: targetName,
        location: data.newLocation || data.location || '',
        expiry: data.newExpiry || data.expiry || '',
        updatedBy: data.user || data.updatedBy || '',
        remark: data.remark || data.comment || ''
      });
    }
    saveInventoryCache(cachedInv);
  } else if (action === 'delete') {
    cachedInv.data = cachedInv.data.filter(it => it.name !== targetName);
    saveInventoryCache(cachedInv);
  }
}

// GET Inventory Proxy (Forward to Google Apps Script with cache management)
app.get('/api/inventory', async (req, res) => {
  const query = { ...req.query };
  if (!query.key) query.key = 'AI1';
  const action = query.action || 'getItems';

  const qs = new URLSearchParams(query).toString();
  const targetUrl = `${INVENTORY_GAS_URL}?${qs}`;

  if (action === 'getItems') {
    const forceRefresh = query.refresh === 'true';
    const cached = loadInventoryCache();
    const hasValidCache = cached && Array.isArray(cached.data) && cached.data.length > 0;

    // Fast path: if cache is populated and client is not requesting a forced refresh,
    // serve cache immediately to avoid GAS cold-start lag. Revalidate in background.
    if (hasValidCache && !forceRefresh) {
      if (Date.now() - lastInventorySyncTime > 45000) {
        syncInventoryFromGAS(targetUrl).catch(() => {});
      }
      return res.json({ ...cached, success: true, fromCache: true });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      const response = await fetch(targetUrl, {
        redirect: 'follow',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        if (result && (result.success || result.status === 'success') && Array.isArray(result.data)) {
          result.success = true;
          saveInventoryCache(result);
          lastInventorySyncTime = Date.now();
          return res.json(result);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.log("[Inventory] Upstream GAS note:", err.message);
      }
    }

    // Return cached inventory data safely with 200 OK
    return res.json({ ...cached, success: true, fromCache: true });
  }

  if (action === 'getHistory') {
    const forceRefresh = query.refresh === 'true';
    const cachedHist = loadInventoryHistoryCache();
    const hasValidHist = cachedHist && Array.isArray(cachedHist.data) && cachedHist.data.length > 0;

    // If cache is fresh and forceRefresh is false, serve immediately and revalidate in background
    if (hasValidHist && !forceRefresh && (Date.now() - lastInventoryHistorySyncTime < 30000)) {
      return res.json({ ...cachedHist, success: true, fromCache: true });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      const response = await fetch(targetUrl, {
        redirect: 'follow',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        if (result && (result.success || result.status === 'success') && Array.isArray(result.data)) {
          result.success = true;
          saveInventoryHistoryCache(result);
          lastInventoryHistorySyncTime = Date.now();
          return res.json(result);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.log("[Inventory History] Upstream GAS note:", err.message);
      }
    }

    return res.json({ ...cachedHist, success: true, fromCache: true });
  }

  // Handle write actions (update, add, updateLocations, clearCache, etc.)
  // 1. Immediately apply change to local cache for instant zero-latency UI consistency
  applyLocalInventoryChange(action, query);

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
  }

  // 2. Forward to Google Apps Script via GET (GAS Web App only handles doGet)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    const response = await fetch(targetUrl, {
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      if (result && (result.success || result.status === 'success')) {
        result.success = true;
        // Invalidate sync timers so next read fetches fresh state from Sheet
        lastInventorySyncTime = 0;
        // Re-sync history in background to capture newly logged record
        setTimeout(() => syncInventoryHistoryFromGAS(true).catch(() => {}), 1000);
        return res.json(result);
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.log(`[Inventory Action ${action}] note:`, err.message);
    }
  }

  // Also trigger background history revalidation
  setTimeout(() => syncInventoryHistoryFromGAS(true).catch(() => {}), 2000);
  return res.json({ success: true, message: 'Update saved to cache and queued for Cloud sync' });
});

// POST Inventory Proxy (Always forwards as GET to GAS since GAS Web App only implements doGet)
app.post('/api/inventory', async (req, res) => {
  const query = { ...req.query, ...req.body };
  if (!query.key) query.key = 'AI1';
  const action = query.action || (req.body && req.body.action) || 'update';

  // Apply immediately to local cache
  applyLocalInventoryChange(action, query);

  const qs = new URLSearchParams(query).toString();
  const targetUrl = `${INVENTORY_GAS_URL}?${qs}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    const response = await fetch(targetUrl, {
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      if (result && (result.success || result.status === 'success')) {
        result.success = true;
        lastInventorySyncTime = 0;
        setTimeout(() => syncInventoryHistoryFromGAS(true).catch(() => {}), 1000);
        return res.json(result);
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.log("[Inventory POST->GET] Upstream GAS note:", err.message);
    }
  }

  setTimeout(() => syncInventoryHistoryFromGAS(true).catch(() => {}), 2000);
  return res.json({ success: true, message: 'Update processed in cache and Cloud' });
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
    message: 'Sync to Cloud completed',
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

// Backward Compatibility & Static Data Routing:
// Maps requests for root JSON files (e.g. /employees.json) seamlessly to /data/
const DATA_JSON_FILES = new Set([
  'employees.json',
  'documents.json',
  'operation_requests.json',
  'operation_history.json',
  'deleted_requests.json',
  'status_overrides.json',
  'team_contacts.json',
  'pwa_preferences.json',
  'inventory_cache.json',
  'inventory_history_cache.json'
]);

app.use((req, res, next) => {
  const reqFile = req.path.replace(/^\//, '');
  if (DATA_JSON_FILES.has(reqFile)) {
    const targetPath = path.join(DATA_DIR, reqFile);
    if (fs.existsSync(targetPath)) {
      return res.sendFile(targetPath);
    }
  }
  next();
});

// Explicitly serve /data and /Data directory
app.use('/data', express.static(DATA_DIR));
app.use('/Data', express.static(DATA_DIR));

// Serve static files from root directory
app.use(express.static(__dirname, {
  index: 'index.html'
}));

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  if (!res.headersSent) {
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// Process-level resilience to prevent unexpected server termination
process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.warn('[Process] Unhandled Rejection:', reason);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

if (ALT_PORT && ALT_PORT !== PORT) {
  try {
    app.listen(ALT_PORT, '0.0.0.0', () => {
      console.log(`Server also running on http://0.0.0.0:${ALT_PORT}`);
    });
  } catch (e) {
    console.warn("Could not bind to alt port:", e.message);
  }
}

