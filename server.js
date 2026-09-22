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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby_XKC1cV1VaeqKB2MbQgmRSOYmcxQI0v-5qcAAKhFczNOwU3GsindACIkuawzQZN4/exec";

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
      if (json && json.status === 'success' && Array.isArray(json.data)) {
        if (json.data.length === 0) {
          history = [];
          saveHistoryData([]);
        } else {
          // Merge cloud history with local with intelligent deduplication and 24-hour formatting
          const combined = [...json.data, ...history];
          history = deduplicateHistoryList(combined);
          if (history.length > 200) history.length = 200;
          saveHistoryData(history);
        }
      }
    }
  } catch(e) {
    // Quiet fail to local cache
  }
  res.json({ status: 'success', data: history });
});

app.post('/api/operation-history', (req, res) => {
  const item = req.body || {};
  if (!item.action && !item.description) {
    return res.status(400).json({ status: 'error', message: 'Invalid history item' });
  }

  const epoch = parseHistoryEpoch(item.timestamp, item.displayTime) || Date.now();
  const normAction = normalizeHistoryAction(item.action || item.actionLabel);
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
  const body = req.body || {};
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

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, id: newId, skipAutoHistory: true, skipHistoryLog: true }),
      redirect: 'follow'
    }).catch(err => console.error("Apps Script create error:", err));

    return res.json({ status: 'success', message: 'Created successfully', data: newItem });
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

// POST Clean Ghost / Invalid Empty Rows from Sheet & Cache
app.post('/api/clean-kachra', async (req, res) => {
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

