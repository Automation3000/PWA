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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby_XKC1cV1VaeqKB2MbQgmRSOYmcxQI0v-5qcAAKhFczNOwU3GsindACIkuawzQZN4/exec";

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
      return JSON.parse(content);
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

function loadHistoryData() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveHistoryData(data) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

// Proxy endpoint: fetches live cloud data on refresh or if no cache
app.get('/api/operation-requests', async (req, res) => {
  const forceRefresh = req.query.refresh === 'true';
  let cached = loadLocalData();

  // If force refresh requested or cache is empty, fetch live from cloud backend
  if (!cached || !Array.isArray(cached) || cached.length === 0 || forceRefresh) {
    try {
      const response = await fetch(APPS_SCRIPT_URL + '?t=' + Date.now(), {
        redirect: 'follow'
      });
      const data = await response.json();
      if (data && data.status === 'success' && Array.isArray(data.data)) {
        // Filter out ghost empty rows
        const cleaned = data.data.filter(r => (r['Work Order'] || r.wo) && String(r['Work Order'] || r.wo).trim() !== '');
        cached = cleaned;
        saveLocalData(cached);
        // Clear deleted and overrides on fresh pull so user cloud changes take immediate effect
        if (forceRefresh) {
          saveDeletedIds([]);
          saveStatusOverrides({});
        }
      }
    } catch (error) {
      console.error('Proxy GET error from Apps Script:', error);
    }
  }

  if (Array.isArray(cached)) {
    return res.json({ status: 'success', data: cached });
  }

  res.status(500).json({ status: 'error', message: 'Unable to load operation requests' });
});

// Operation History Endpoints
app.get('/api/operation-history', (req, res) => {
  const history = loadHistoryData();
  res.json({ status: 'success', data: history });
});

app.post('/api/operation-history', (req, res) => {
  const item = req.body || {};
  if (!item.action && !item.description) {
    return res.status(400).json({ status: 'error', message: 'Invalid history item' });
  }
  const history = loadHistoryData();
  const entry = {
    id: item.id || ('hist_' + Date.now() + '_' + Math.floor(Math.random() * 1000)),
    timestamp: item.timestamp || new Date().toISOString(),
    displayTime: item.displayTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    action: item.action || 'info',
    actionLabel: item.actionLabel || 'Activity',
    workOrder: item.workOrder || '',
    plant: item.plant || '',
    description: item.description || '',
    user: item.user || 'Technician',
    badgeColor: item.badgeColor || 'var(--primary)'
  };
  history.unshift(entry);
  if (history.length > 100) history.length = 100; // Keep last 100 logs
  saveHistoryData(history);
  res.json({ status: 'success', data: entry });
});

app.delete('/api/operation-history', (req, res) => {
  saveHistoryData([]);
  res.json({ status: 'success', message: 'History cleared' });
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

    // Record history
    const history = loadHistoryData();
    history.unshift({
      id: 'hist_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      displayTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: 'delete',
      actionLabel: 'Deleted',
      workOrder: wo,
      plant: body.plant || '',
      description: `Deleted Work Order #${wo || idToDelete}`,
      user: body.user || 'Supervisor',
      badgeColor: '#dc2626'
    });
    if (history.length > 100) history.length = 100;
    saveHistoryData(history);

    // Forward to Apps Script asynchronously
    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
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

    // Record history
    const history = loadHistoryData();
    history.unshift({
      id: 'hist_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      displayTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: 'status',
      actionLabel: 'Status Changed',
      workOrder: wo,
      plant: body.plant || '',
      description: `Status changed to "${newStatus}" for WO #${wo || idToUpdate}`,
      user: body.user || 'Supervisor',
      badgeColor: '#16a34a'
    });
    if (history.length > 100) history.length = 100;
    saveHistoryData(history);

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
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

    cached = cached.map(item => {
      const itemId = String(item.ID || item.id || '');
      if (itemId === idToUpdate) {
        item['Work Order'] = body.workOrder;
        item['Description'] = body.description;
        item['Plant'] = body.plant;
        item['Date'] = body.date;
        item['Time'] = body.time;
        item['Team'] = body.team;
        item['Status'] = body.status;
        item['Remarks'] = body.remarks;
        item.wo = body.workOrder;
        item.desc = body.description;
        item.plant = body.plant;
        item.date = body.date;
        item.time = body.time;
        item.team = body.team;
        item.status = body.status;
        item.remarks = body.remarks;
      }
      return item;
    });
    saveLocalData(cached);

    // Record history
    const history = loadHistoryData();
    history.unshift({
      id: 'hist_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      displayTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: 'update',
      actionLabel: 'Updated',
      workOrder: body.workOrder || '',
      plant: body.plant || '',
      description: `Updated details for Work Order #${body.workOrder || idToUpdate} (${body.plant || ''})`,
      user: body.user || 'Technician',
      badgeColor: '#7c3aed'
    });
    if (history.length > 100) history.length = 100;
    saveHistoryData(history);

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    }).catch(err => console.error("Apps Script update error:", err));

    return res.json({ status: 'success', message: 'Updated successfully' });
  }

  if (action === 'create') {
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

    // Record history
    const history = loadHistoryData();
    history.unshift({
      id: 'hist_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      displayTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: 'create',
      actionLabel: 'New Request',
      workOrder: body.workOrder || '',
      plant: body.plant || '',
      description: `Created request for ${body.plant || 'Plant'} (WO #${body.workOrder || ''})`,
      user: body.user || 'Technician',
      badgeColor: '#1a73e8'
    });
    if (history.length > 100) history.length = 100;
    saveHistoryData(history);

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, id: newId }),
      redirect: 'follow'
    }).catch(err => console.error("Apps Script create error:", err));

    return res.json({ status: 'success', message: 'Created successfully', data: newItem });
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

