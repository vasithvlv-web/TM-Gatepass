// ════════════════════════════════════════════════════════════════
// API LAYER — replaces Google Apps Script google.script.run calls
// All functions return Promises and accept the same callbacks
// ════════════════════════════════════════════════════════════════

const API_BASE = window.location.origin + '/api';

async function _post(endpoint, data) {
  const res = await fetch(API_BASE + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

async function _get(endpoint) {
  const res = await fetch(API_BASE + endpoint);
  return res.json();
}

async function _put(endpoint, data) {
  const res = await fetch(API_BASE + endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

async function _delete(endpoint, data) {
  const res = await fetch(API_BASE + endpoint, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────
window.API = {
  handleLogin: (username, password) => _post('/login', { username, password }),
  fetchMatrixPackage: () => _get('/passes'),
  createNewPass: (payload) => _post('/passes', payload),
  updateWorkflow: (data) => _put(`/passes/${encodeURIComponent(data.passNo)}/workflow`, { type: data.type, username: data.username }),
  deletePasses: (passNumbers, userRole) => _delete('/passes', { passNumbers, userRole }),
  fetchVisitorRegistry: () => _get('/visitors'),
  addVisitorRowToDatabase: (v) => _post('/visitors', v),
  recordVisitorExit: (payload) => _put(`/visitors/${encodeURIComponent(payload.passNo)}/exit`, { outTime: payload.outTime, username: payload.username })
};
