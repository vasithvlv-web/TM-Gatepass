// ════════════════════════════════════════════════════════════════
// GLOBALS
// ════════════════════════════════════════════════════════════════
var SESSION = null;
var REGISTRY = [];
var VISITOR_REGISTRY = [];
var DIRECTION_FILTER = 'IN';
var camStream = null;
var capturedImage = null;
var vcamStream = null;
var vcapturedImage = null;
var passModalInstance = null;
var visitorEntryModalInstance = null;
var visitorExitModalInstance = null;
var visitorDetailModalInstance = null;
var chartIn = null;
var chartOut = null;
var currentChartType = 'bar';
var globalChartCachedData = null;
var exitCurrentPassNo = null;
var visitorEntryTimeInterval = null;
var exitClockInterval = null;

// ════════════════════════════════════════════════════════════════
// DOM READY
// ════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function () {
  passModalInstance = new bootstrap.Modal(document.getElementById('passModal'));
  visitorEntryModalInstance = new bootstrap.Modal(document.getElementById('visitorEntryModal'));
  visitorExitModalInstance = new bootstrap.Modal(document.getElementById('visitorExitModal'));
  visitorDetailModalInstance = new bootstrap.Modal(document.getElementById('visitorDetailModal'));

  document.getElementById('visitorEntryModal').addEventListener('hidden.bs.modal', function () {
    stopVisitorCamera();
    if (visitorEntryTimeInterval) { clearInterval(visitorEntryTimeInterval); visitorEntryTimeInterval = null; }
  });
  document.getElementById('visitorExitModal').addEventListener('hidden.bs.modal', function () {
    if (exitClockInterval) { clearInterval(exitClockInterval); exitClockInterval = null; }
  });

  setInterval(function () {
    var el = document.getElementById('liveClock');
    if (el) el.textContent = new Date().toLocaleTimeString('en-GB');
  }, 1000);

  document.getElementById('loginPassword').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doLogin();
  });
});

// ════════════════════════════════════════════════════════════════
// SIDEBAR
// ════════════════════════════════════════════════════════════════
function openSidebar() {
  document.getElementById('sidebar').classList.add('visible');
  document.getElementById('sidebarOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('visible');
  document.getElementById('sidebarOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ════════════════════════════════════════════════════════════════
// CAMERA — MAIN FORM
// ════════════════════════════════════════════════════════════════
function startCamera() {
  hideCamWarning();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showCamWarning('Camera API not supported. Use Chrome/Safari on HTTPS.');
    return;
  }
  stopCamera(false);
  var constraints = { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false };
  navigator.mediaDevices.getUserMedia(constraints)
    .then(function (stream) {
      camStream = stream;
      var video = document.getElementById('formVideoPreview');
      video.srcObject = stream;
      video.onloadedmetadata = function () {
        video.play().then(function () {
          document.getElementById('camPlaceholder').style.display = 'none';
          document.getElementById('imgPreviewContainer').style.display = 'none';
          video.style.display = 'block';
          document.getElementById('btnCapture').disabled = false;
          document.getElementById('btnStopCam').style.display = 'inline-flex';
          document.getElementById('btnStartCam').style.display = 'none';
          showToast('Camera started', 'success');
        }).catch(function (err) { showCamWarning('Could not start video: ' + err.message); });
      };
    })
    .catch(function (err) { handleCameraError(err, 'camWarning', 'camWarningMsg'); });
}

function stopCamera(resetUI) {
  if (resetUI === undefined) resetUI = true;
  if (camStream) { camStream.getTracks().forEach(function (t) { t.stop(); }); camStream = null; }
  var video = document.getElementById('formVideoPreview');
  if (video) { video.pause(); video.srcObject = null; video.style.display = 'none'; }
  if (resetUI) {
    var hasImage = capturedImage !== null;
    document.getElementById('camPlaceholder').style.display = hasImage ? 'none' : 'block';
    document.getElementById('imgPreviewContainer').style.display = hasImage ? 'block' : 'none';
    document.getElementById('btnCapture').disabled = true;
    document.getElementById('btnStopCam').style.display = 'none';
    document.getElementById('btnStartCam').style.display = 'inline-flex';
  }
}

function capturePhoto() {
  if (!camStream) { showToast('Camera not active', 'warn'); return; }
  var video = document.getElementById('formVideoPreview');
  if (!video.videoWidth) { showToast('Camera not ready yet', 'warn'); return; }
  var canvas = document.getElementById('captureCanvas');
  var dims = scaleDown(video.videoWidth, video.videoHeight, 800);
  canvas.width = dims.w; canvas.height = dims.h;
  canvas.getContext('2d').drawImage(video, 0, 0, dims.w, dims.h);
  capturedImage = canvas.toDataURL('image/jpeg', 0.7);
  showMainFormImagePreview(capturedImage);
  stopCamera(true);
  showToast('Photo captured!', 'success');
}

function showMainFormImagePreview(base64) {
  document.getElementById('camPlaceholder').style.display = 'none';
  document.getElementById('formVideoPreview').style.display = 'none';
  document.getElementById('formImagePreview').src = base64;
  document.getElementById('imgPreviewContainer').style.display = 'block';
}

function removeCapturedPhoto() {
  capturedImage = null;
  document.getElementById('p-file').value = '';
  document.getElementById('formImagePreview').src = '';
  document.getElementById('imgPreviewContainer').style.display = 'none';
  document.getElementById('camPlaceholder').style.display = 'block';
}

function handleMainFormFileUpload(input) {
  if (!input.files || !input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement('canvas');
      var dims = scaleDown(img.width, img.height, 800);
      canvas.width = dims.w; canvas.height = dims.h;
      canvas.getContext('2d').drawImage(img, 0, 0, dims.w, dims.h);
      capturedImage = canvas.toDataURL('image/jpeg', 0.75);
      showMainFormImagePreview(capturedImage);
      showToast('Image uploaded!', 'success');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(input.files[0]);
}

function showCamWarning(msg) {
  var el = document.getElementById('camWarning');
  document.getElementById('camWarningMsg').textContent = msg;
  el.style.display = 'block';
}
function hideCamWarning() { document.getElementById('camWarning').style.display = 'none'; }

// ════════════════════════════════════════════════════════════════
// VISITOR CAMERA
// ════════════════════════════════════════════════════════════════
function startVisitorCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('Camera not supported', 'error'); return;
  }
  stopVisitorCamera(false);
  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' } }, audio: false })
    .then(function (stream) {
      vcamStream = stream;
      var video = document.getElementById('vcamVideo');
      video.srcObject = stream;
      video.onloadedmetadata = function () {
        video.play().then(function () {
          document.getElementById('vcamPlaceholder').style.display = 'none';
          document.getElementById('vcamPreviewWrap').style.display = 'none';
          video.style.display = 'block';
          document.getElementById('vBtnSnap').disabled = false;
          document.getElementById('vBtnStop').style.display = 'inline-flex';
          document.getElementById('vBtnStart').style.display = 'none';
          showToast('Visitor camera started', 'success');
        });
      };
    })
    .catch(function (err) { showToast('Camera error: ' + (err.message || err.name), 'error'); });
}

function stopVisitorCamera(resetUI) {
  if (resetUI === undefined) resetUI = true;
  if (vcamStream) { vcamStream.getTracks().forEach(function (t) { t.stop(); }); vcamStream = null; }
  var video = document.getElementById('vcamVideo');
  if (video) { video.pause(); video.srcObject = null; video.style.display = 'none'; }
  if (resetUI) {
    var hasImg = vcapturedImage !== null;
    document.getElementById('vcamPlaceholder').style.display = hasImg ? 'none' : 'block';
    document.getElementById('vcamPreviewWrap').style.display = hasImg ? 'block' : 'none';
    document.getElementById('vBtnSnap').disabled = true;
    document.getElementById('vBtnStop').style.display = 'none';
    document.getElementById('vBtnStart').style.display = 'inline-flex';
  }
}

function snapVisitorPhoto() {
  if (!vcamStream) { showToast('Camera not active', 'warn'); return; }
  var video = document.getElementById('vcamVideo');
  if (!video.videoWidth) { showToast('Camera not ready', 'warn'); return; }
  var canvas = document.getElementById('vcaptureCanvas');
  var dims = scaleDown(video.videoWidth, video.videoHeight, 600);
  canvas.width = dims.w; canvas.height = dims.h;
  canvas.getContext('2d').drawImage(video, 0, 0, dims.w, dims.h);
  vcapturedImage = canvas.toDataURL('image/jpeg', 0.8);
  document.getElementById('vcamPreviewImg').src = vcapturedImage;
  document.getElementById('vcamPreviewWrap').style.display = 'block';
  document.getElementById('vcamPlaceholder').style.display = 'none';
  stopVisitorCamera(false);
  document.getElementById('vBtnSnap').disabled = true;
  document.getElementById('vBtnStop').style.display = 'none';
  document.getElementById('vBtnStart').style.display = 'inline-flex';
  showToast('Visitor photo captured!', 'success');
}

function handleVisitorPhotoUpload(input) {
  if (!input.files || !input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement('canvas');
      var dims = scaleDown(img.width, img.height, 600);
      canvas.width = dims.w; canvas.height = dims.h;
      canvas.getContext('2d').drawImage(img, 0, 0, dims.w, dims.h);
      vcapturedImage = canvas.toDataURL('image/jpeg', 0.8);
      document.getElementById('vcamPreviewImg').src = vcapturedImage;
      document.getElementById('vcamPreviewWrap').style.display = 'block';
      document.getElementById('vcamPlaceholder').style.display = 'none';
      showToast('Photo uploaded!', 'success');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(input.files[0]);
}

function clearVisitorPhoto() {
  vcapturedImage = null;
  document.getElementById('vcamPreviewImg').src = '';
  document.getElementById('vcamPreviewWrap').style.display = 'none';
  document.getElementById('vcamPlaceholder').style.display = 'block';
  document.getElementById('v-photo-file').value = '';
}

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════
function scaleDown(width, height, maxDim) {
  if (width > height) {
    if (width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
  } else {
    if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
  }
  return { w: width, h: height };
}

function handleCameraError(err, warningId, msgId) {
  var msg = 'Unable to access camera.';
  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') msg = 'Camera permission denied. Allow camera access in browser settings.';
  else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') msg = 'No camera found on this device.';
  else if (err.name === 'NotReadableError') msg = 'Camera is in use by another app.';
  else msg = err.message || 'Unknown error: ' + err.name;
  var el = document.getElementById(warningId);
  if (el) { el.style.display = 'block'; document.getElementById(msgId).textContent = msg; }
  showToast(msg, 'error');
}

function formatDateTime(dt) {
  if (!dt) return '—';
  try {
    var d = new Date(dt);
    if (isNaN(d.getTime())) return dt;
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) { return dt || '—'; }
}

function calcDuration(inTime, outTime) {
  if (!inTime || !outTime) return '—';
  var diff = Math.floor((new Date(outTime) - new Date(inTime)) / 1000);
  if (isNaN(diff) || diff < 0) return '—';
  var h = Math.floor(diff / 3600);
  var m = Math.floor((diff % 3600) / 60);
  return h + 'h ' + m + 'm';
}

function nowString() {
  return new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getStatusClass(status) {
  var s = (status || '').toUpperCase();
  if (s === 'CONFIRMED' || s === 'APPROVED') return 'pill-confirmed';
  if (s === 'REJECTED') return 'pill-rejected';
  return 'pill-pending';
}

// ════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════
function doLogin() {
  var username = document.getElementById('loginUsername').value.trim();
  var password = document.getElementById('loginPassword').value;
  if (!username || !password) { showAuthError('Please enter username and password.'); return; }
  var btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Authenticating...';
  API.handleLogin(username, password)
    .then(function (res) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>ACCESS SYSTEM';
      if (res.success) { SESSION = res.user; hideAuthError(); bootApp(); }
      else showAuthError(res.message || 'Authentication failed.');
    })
    .catch(function (err) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>ACCESS SYSTEM';
      showAuthError('Connection error: ' + err.message);
    });
}

function doLogout() {
  SESSION = null; REGISTRY = []; VISITOR_REGISTRY = [];
  stopCamera(true); stopVisitorCamera();
  if (visitorEntryTimeInterval) { clearInterval(visitorEntryTimeInterval); visitorEntryTimeInterval = null; }
  if (exitClockInterval) { clearInterval(exitClockInterval); exitClockInterval = null; }
  document.getElementById('appContainer').style.display = 'none';
  document.getElementById('authContainer').style.display = 'flex';
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  closeSidebar();
}

function showAuthError(msg) {
  var el = document.getElementById('authError');
  document.getElementById('authErrorMsg').textContent = msg;
  el.style.display = 'flex';
}
function hideAuthError() { document.getElementById('authError').style.display = 'none'; }

// ════════════════════════════════════════════════════════════════
// BOOT APP
// ════════════════════════════════════════════════════════════════
function bootApp() {
  document.getElementById('authContainer').style.display = 'none';
  document.getElementById('appContainer').style.display = 'block';
  document.getElementById('sidebarAvatar').textContent = (SESSION.name || 'U')[0].toUpperCase();
  document.getElementById('sidebarName').textContent = SESSION.name;
  document.getElementById('sidebarRole').textContent = SESSION.role;

  var nav = document.getElementById('navSection');

  if (SESSION.role === 'Security') {
    nav.innerHTML =
      '<div class="nav-group-label">Gate Operations</div>' +
      '<a class="nav-link" data-pane="pane-create" onclick="navToPane(\'pane-create\')">' +
      '<i class="fas fa-pen-fancy"></i> <span>Issue Gate Pass</span></a>' +
      '<a class="nav-link" data-pane="pane-visitor" onclick="navToPane(\'pane-visitor\'); syncVisitorData()">' +
      '<i class="fas fa-id-card" style="color:#059669"></i> <span>Visitor Gate Pass</span></a>';
    navToPane('pane-create');
    return;
  }

  nav.innerHTML =
    '<a class="nav-link" data-pane="pane-dashboard" onclick="navToPane(\'pane-dashboard\')">' +
    '<i class="fas fa-chart-pie"></i> <span>Dashboard</span></a>' +
    '<div class="nav-group-label">Gate Ledger</div>' +
    '<a class="nav-link" data-pane="pane-registry-in" data-dir="IN" onclick="loadRegistry(\'IN\'); navToPane(\'pane-registry\')">' +
    '<i class="fas fa-sign-in-alt" style="color:var(--success)"></i> <span>Inbound (IN)</span></a>' +
    '<a class="nav-link" data-pane="pane-registry-out" data-dir="OUT" onclick="loadRegistry(\'OUT\'); navToPane(\'pane-registry\')">' +
    '<i class="fas fa-sign-out-alt" style="color:var(--danger)"></i> <span>Outbound (OUT)</span></a>' +
    '<div class="nav-group-label">Operations</div>' +
    '<a class="nav-link" data-pane="pane-create" onclick="navToPane(\'pane-create\')">' +
    '<i class="fas fa-pen-fancy" style="color:var(--brand)"></i> <span>Issue Gate Pass</span></a>' +
    '<a class="nav-link" data-pane="pane-visitor" onclick="navToPane(\'pane-visitor\'); syncVisitorData()">' +
    '<i class="fas fa-id-card" style="color:#059669"></i> <span>Visitor Gate Pass</span></a>' +
    '<a class="nav-link" data-pane="pane-scanner" onclick="navToPane(\'pane-scanner\')">' +
    '<i class="fas fa-qrcode" style="color:var(--info)"></i> <span>Pass Scanner</span></a>' +
    '<div class="nav-group-label">Reports</div>' +
    '<a class="nav-link" data-pane="pane-reports" onclick="openReport(\'Gatepass\'); navToPane(\'pane-reports\')">' +
    '<i class="fas fa-file-alt" style="color:var(--warning)"></i> <span>Gatepass Report</span></a>';

  navToPane('pane-dashboard');
  syncData();
}

function navToPane(paneId) {
  document.querySelectorAll('.app-pane').forEach(function (p) {
    if (p.id === paneId) { p.style.display = 'block'; p.classList.add('visible'); }
    else { p.style.display = 'none'; p.classList.remove('visible'); }
  });
  document.querySelectorAll('#navSection .nav-link').forEach(function (link) {
    link.classList.toggle('active', link.getAttribute('data-pane') === paneId);
  });
  if (window.innerWidth <= 991) closeSidebar();
}

// ════════════════════════════════════════════════════════════════
// CHARTS
// ════════════════════════════════════════════════════════════════
function toggleChartRenderingMode() {
  currentChartType = document.getElementById('chartTypeSelector').value;
  if (globalChartCachedData) buildCharts(globalChartCachedData);
}

function buildCharts(chartData) {
  globalChartCachedData = chartData;
  if (!chartData || !chartData.length) return;
  var labels = chartData.map(function (d) { return d.date ? d.date.slice(5) : ''; });
  var inData = chartData.map(function (d) { return d.inbound; });
  var outData = chartData.map(function (d) { return d.outbound; });
  var baseOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { boxPadding: 4 } },
    scales: {
      y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { family: 'Outfit', size: 10 }, maxTicksLimit: 5 } },
      x: { grid: { display: false }, ticks: { font: { family: 'Outfit', size: 10 }, maxRotation: 45 } }
    }
  };
  if (chartIn) { chartIn.destroy(); chartIn = null; }
  if (chartOut) { chartOut.destroy(); chartOut = null; }
  var isBar = currentChartType === 'bar';
  var ctxIn = document.getElementById('chartInbound');
  var ctxOut = document.getElementById('chartOutbound');
  if (!ctxIn || !ctxOut) return;
  chartIn = new Chart(ctxIn.getContext('2d'), {
    type: currentChartType,
    data: { labels, datasets: [{ label: 'IN', data: inData, backgroundColor: isBar ? '#10b981' : 'rgba(16,185,129,0.15)', borderColor: '#10b981', borderWidth: 2, fill: true, tension: 0.3, borderRadius: isBar ? 5 : 0 }] },
    options: baseOpts
  });
  chartOut = new Chart(ctxOut.getContext('2d'), {
    type: currentChartType,
    data: { labels, datasets: [{ label: 'OUT', data: outData, backgroundColor: isBar ? '#3b82f6' : 'rgba(59,130,246,0.15)', borderColor: '#3b82f6', borderWidth: 2, fill: true, tension: 0.3, borderRadius: isBar ? 5 : 0 }] },
    options: baseOpts
  });
}

// ════════════════════════════════════════════════════════════════
// REGISTRY
// ════════════════════════════════════════════════════════════════
function loadRegistry(direction) {
  DIRECTION_FILTER = direction;
  var label = direction === 'IN' ? 'Inbound Gate Pass Records' : 'Outbound Gate Pass Records';
  document.getElementById('registryTitle').innerHTML = '<i class="fas fa-table"></i>' + label;
  if (document.getElementById('registrySearch')) document.getElementById('registrySearch').value = '';
  if (document.getElementById('registryStatusFilter')) document.getElementById('registryStatusFilter').value = '';
  renderRegistry();
}

function renderRegistry() {
  var searchTerm = (document.getElementById('registrySearch') ? document.getElementById('registrySearch').value : '').toLowerCase();
  var statusFilter = (document.getElementById('registryStatusFilter') ? document.getElementById('registryStatusFilter').value : '').toUpperCase();
  var rows = REGISTRY.filter(function (p) { return p.Direction === DIRECTION_FILTER; });
  if (searchTerm) {
    rows = rows.filter(function (p) {
      return (p.PassNo || '').toLowerCase().includes(searchTerm) ||
        (p.VisitorName || '').toLowerCase().includes(searchTerm) ||
        (p.VehicleNo || '').toLowerCase().includes(searchTerm) ||
        (p.PassType || '').toLowerCase().includes(searchTerm) ||
        (p.Company || '').toLowerCase().includes(searchTerm);
    });
  }
  if (statusFilter) rows = rows.filter(function (p) { return (p.Status || '').toUpperCase() === statusFilter; });

  var tbody = document.getElementById('registryBody');
  tbody.innerHTML = '';
  document.getElementById('registryCountLabel').textContent = rows.length + ' records';

  var isAdmin = SESSION && SESSION.role === 'Admin';
  var thBulk = document.getElementById('thBulkCheck');
  if (thBulk) thBulk.style.display = isAdmin ? 'table-cell' : 'none';
  var masterChk = document.getElementById('masterChk');
  if (masterChk) masterChk.checked = false;
  document.getElementById('bulkDeleteBtn').style.display = 'none';

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No records found.</td></tr>';
    return;
  }

  rows.forEach(function (p) {
    var tr = document.createElement('tr');
    var chkHtml = isAdmin ? '<td><input type="checkbox" class="row-chk" value="' + esc(p.PassNo) + '" onchange="evaluateBulkBtn()"></td>' : '<td></td>';
    tr.innerHTML = chkHtml +
      '<td><strong style="font-family:var(--mono);font-size:12px">' + esc(p.PassNo || '') + '</strong></td>' +
      '<td><span style="font-size:11px">' + formatDateTime(p.CreatedTime || '') + '</span></td>' +
      '<td><span class="badge bg-light text-dark border" style="font-size:10px;white-space:normal">' + esc(p.PassType || '') + '</span></td>' +
      '<td>' + esc(p.VisitorName || '') + '</td>' +
      '<td><code style="font-size:11px">' + esc(p.VehicleNo || '—') + '</code></td>' +
      '<td><span class="pill ' + getStatusClass(p.Status) + '">' + esc(p.Status || '') + '</span></td>' +
      '<td class="text-end"><button class="btn-xs btn-xs-brand view-btn" title="View"><i class="fas fa-eye"></i></button></td>';
    tr.querySelector('.view-btn').addEventListener('click', function () { openPassDetail(p.PassNo); });
    tbody.appendChild(tr);
  });
}

function toggleAllCheckboxes(masterChk) {
  document.querySelectorAll('.row-chk').forEach(function (cb) { cb.checked = masterChk.checked; });
  evaluateBulkBtn();
}

function evaluateBulkBtn() {
  var selected = document.querySelectorAll('.row-chk:checked').length;
  document.getElementById('bulkDeleteBtn').style.display = selected ? 'inline-flex' : 'none';
}

// ════════════════════════════════════════════════════════════════
// VISITOR MODULE
// ════════════════════════════════════════════════════════════════
function openVisitorEntryModal() {
  ['v-name', 'v-idno', 'v-company', 'v-mobile', 'v-address', 'v-meeting'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('v-purpose').value = '';
  document.getElementById('v-gate').value = 'Gate 1';
  vcapturedImage = null;
  clearVisitorPhoto();
  document.getElementById('v-photo-file').value = '';
  document.getElementById('v-intime').value = nowString();
  visitorEntryModalInstance.show();
  if (visitorEntryTimeInterval) { clearInterval(visitorEntryTimeInterval); visitorEntryTimeInterval = null; }
  visitorEntryTimeInterval = setInterval(function () {
    var el = document.getElementById('v-intime');
    if (el && document.getElementById('visitorEntryModal').classList.contains('show')) {
      el.value = nowString();
    } else {
      clearInterval(visitorEntryTimeInterval); visitorEntryTimeInterval = null;
    }
  }, 1000);
}

function submitVisitorEntry() {
  var name = document.getElementById('v-name').value.trim();
  var idno = document.getElementById('v-idno').value.trim();
  var company = document.getElementById('v-company').value.trim();
  var mobile = document.getElementById('v-mobile').value.trim();
  var address = document.getElementById('v-address').value.trim();
  var purpose = document.getElementById('v-purpose').value;
  var meeting = document.getElementById('v-meeting').value.trim();
  var gate = document.getElementById('v-gate').value;
  var intime = document.getElementById('v-intime').value;

  if (!name) { showToast('Visitor name is required', 'error'); return; }
  if (!idno) { showToast('ID / Passport number is required', 'error'); return; }
  if (!company) { showToast('Company name is required', 'error'); return; }
  if (!mobile) { showToast('Mobile number is required', 'error'); return; }
  if (!purpose) { showToast('Purpose of visit is required', 'error'); return; }
  if (!meeting) { showToast('Person to meet is required', 'error'); return; }

  showLoader();
  var passNo = 'VP-' + Math.floor(10000 + Math.random() * 90000);
  var visitorData = {
    PassNo: passNo,
    VisitorName: name,
    IdentityNo: idno,
    Company: company,
    ContactNo: mobile,
    Address: address || '—',
    Purpose: purpose,
    Meeting: meeting,
    GateNo: gate || 'Gate 1',
    InTime: new Date().toISOString(),
    OutTime: '',
    PhotoUrl: vcapturedImage || '',
    Status: 'IN',
    CreatedBy: SESSION ? SESSION.username : 'Security'
  };

  API.addVisitorRowToDatabase(visitorData)
    .then(function (res) {
      hideLoader();
      if (res.success) {
        showToast('Visitor pass issued: ' + passNo, 'success');
        // Update photo URL from server response if changed
        visitorData.InTime = new Date().toISOString();
        VISITOR_REGISTRY.unshift(visitorData);
        renderVisitorRegistry();
        visitorEntryModalInstance.hide();
        var el = document.getElementById('m-visitorsActive');
        if (el) el.textContent = VISITOR_REGISTRY.filter(function (v) { return v.Status === 'IN'; }).length;
      } else {
        showToast('Error: ' + (res.message || 'Unknown error'), 'error');
      }
    })
    .catch(function (err) { hideLoader(); showToast('Connection error: ' + err.message, 'error'); });
}

// ════════════════════════════════════════════════════════════════
// VISITOR EXIT
// ════════════════════════════════════════════════════════════════
function openVisitorExitModal() {
  document.getElementById('exit-passno-input').value = '';
  document.getElementById('exitLookupResult').innerHTML = '';
  document.getElementById('exitStep1').style.display = 'block';
  document.getElementById('exitStep2').style.display = 'none';
  exitCurrentPassNo = null;
  document.getElementById('exitModalFooter').innerHTML =
    '<button type="button" class="btn-outline" data-bs-dismiss="modal">Cancel</button>';
  visitorExitModalInstance.show();
}

function lookupVisitorForExit() {
  var raw = document.getElementById('exit-passno-input').value.trim();
  if (!raw) { showToast('Enter a Gate Pass number', 'warn'); return; }
  var passNo = raw.toUpperCase();
  var vp = null;
  for (var i = 0; i < VISITOR_REGISTRY.length; i++) {
    if ((VISITOR_REGISTRY[i].PassNo || '').toUpperCase() === passNo) { vp = VISITOR_REGISTRY[i]; break; }
  }
  var resultDiv = document.getElementById('exitLookupResult');
  if (!vp) {
    resultDiv.innerHTML = '<div class="p-3 border border-danger rounded" style="background:var(--danger-bg)">' +
      '<i class="fas fa-times-circle text-danger me-2"></i><strong style="color:var(--danger)">Not Found</strong><br>' +
      '<span style="font-size:12px">No record for: <code>' + esc(raw) + '</code></span></div>';
    return;
  }
  if ((vp.Status || '').toUpperCase() === 'OUT') {
    resultDiv.innerHTML = '<div class="p-3 border border-warning rounded" style="background:var(--warning-bg)">' +
      '<i class="fas fa-exclamation-triangle" style="color:var(--warning)"></i> <strong style="color:var(--warning)">Already Exited</strong><br>' +
      '<span style="font-size:12px">' + esc(vp.VisitorName) + ' exited at ' + formatDateTime(vp.OutTime) + '</span></div>';
    return;
  }
  exitCurrentPassNo = vp.PassNo;
  var imgHtml = vp.PhotoUrl
    ? '<img src="' + vp.PhotoUrl + '" style="width:65px;height:65px;border-radius:50%;object-fit:cover;border:3px solid var(--brand)" onerror="this.style.display=\'none\'">'
    : '<div style="width:65px;height:65px;border-radius:50%;background:var(--brand-light);display:flex;align-items:center;justify-content:center;font-size:1.6rem;color:var(--brand)"><i class="fas fa-user"></i></div>';

  document.getElementById('exitStep2').style.display = 'block';
  document.getElementById('exitStep2').innerHTML =
    '<div class="border rounded p-3" style="background:var(--bg)">' +
    '<div class="d-flex align-items-center gap-3 mb-3">' + imgHtml +
    '<div><div style="font-size:1rem;font-weight:700">' + esc(vp.VisitorName) + '</div>' +
    '<div style="font-size:12px;color:var(--text-3)">ID: ' + esc(vp.IdentityNo || '—') + '</div>' +
    '<span class="pill pill-visitor-in mt-1" style="display:inline-flex"><i class="fas fa-circle" style="font-size:7px;margin-top:4px"></i> Currently IN</span>' +
    '</div></div>' +
    '<table class="detail-table">' +
    '<tr><td>Pass No</td><td><code style="color:var(--brand);font-weight:700">' + esc(vp.PassNo) + '</code></td></tr>' +
    '<tr><td>Company</td><td>' + esc(vp.Company || '—') + '</td></tr>' +
    '<tr><td>Purpose</td><td>' + esc(vp.Purpose || '—') + '</td></tr>' +
    '<tr><td>In Time</td><td><strong style="color:var(--success)">' + formatDateTime(vp.InTime) + '</strong></td></tr>' +
    '</table>' +
    '<div class="mt-3 p-2 rounded" style="background:var(--brand-light);border:1px solid #c3d9f0">' +
    '<label class="form-label" style="font-size:11px">Exit Time (Auto)</label>' +
    '<input type="text" id="exit-outtime-display" class="form-control" readonly style="font-family:var(--mono);font-weight:700;color:var(--brand);background:#fff">' +
    '</div></div>';

  var outEl = document.getElementById('exit-outtime-display');
  if (outEl) outEl.value = nowString();
  if (exitClockInterval) { clearInterval(exitClockInterval); exitClockInterval = null; }
  exitClockInterval = setInterval(function () {
    var el = document.getElementById('exit-outtime-display');
    if (el) el.value = nowString();
    else { clearInterval(exitClockInterval); exitClockInterval = null; }
  }, 1000);

  var pno = vp.PassNo;
  document.getElementById('exitModalFooter').innerHTML =
    '<button type="button" class="btn-outline" data-bs-dismiss="modal">Cancel</button>' +
    '<button type="button" class="btn-solid btn-solid-warn" onclick="confirmVisitorExit(\'' + esc(pno) + '\')">' +
    '<i class="fas fa-sign-out-alt"></i> Confirm Exit & Close Pass</button>';
}

function confirmVisitorExit(passNo) {
  if (!passNo) { showToast('Missing Pass Number', 'warn'); return; }
  if (exitClockInterval) { clearInterval(exitClockInterval); exitClockInterval = null; }
  var outTimeISO = new Date().toISOString();
  showLoader();
  API.recordVisitorExit({ passNo: passNo, outTime: outTimeISO, username: SESSION ? SESSION.username : 'Security' })
    .then(function (res) {
      hideLoader();
      if (res.success) {
        visitorExitModalInstance.hide();
        showToast('Exit recorded for ' + passNo + '. Duration: ' + (res.duration || '—'), 'success');
        for (var i = 0; i < VISITOR_REGISTRY.length; i++) {
          if (VISITOR_REGISTRY[i].PassNo === passNo) {
            VISITOR_REGISTRY[i].Status = 'OUT';
            VISITOR_REGISTRY[i].OutTime = outTimeISO;
            break;
          }
        }
        renderVisitorRegistry();
        var el = document.getElementById('m-visitorsActive');
        if (el) el.textContent = VISITOR_REGISTRY.filter(function (v) { return v.Status === 'IN'; }).length;
      } else {
        showToast('Error: ' + (res.message || 'Unknown error'), 'error');
      }
    })
    .catch(function (err) { hideLoader(); showToast('Connection error: ' + err.message, 'error'); });
}

// ════════════════════════════════════════════════════════════════
// VISITOR REGISTRY TABLE
// ════════════════════════════════════════════════════════════════
function syncVisitorData() {
  showLoader();
  API.fetchVisitorRegistry()
    .then(function (res) {
      hideLoader();
      if (res.success) {
        VISITOR_REGISTRY = res.visitors || [];
        renderVisitorRegistry();
        var activeCount = VISITOR_REGISTRY.filter(function (v) { return v.Status === 'IN'; }).length;
        var el = document.getElementById('m-visitorsActive');
        if (el) el.textContent = activeCount;
      } else {
        showToast('Visitor sync failed: ' + (res.message || ''), 'error');
      }
    })
    .catch(function (err) { hideLoader(); showToast('Connection error: ' + err.message, 'error'); });
}

function renderVisitorRegistry() {
  var searchTerm = (document.getElementById('visitorSearch') ? document.getElementById('visitorSearch').value : '').toLowerCase();
  var statusFilter = document.getElementById('visitorStatusFilter') ? document.getElementById('visitorStatusFilter').value : '';
  var rows = VISITOR_REGISTRY.slice();
  if (searchTerm) {
    rows = rows.filter(function (v) {
      return (v.PassNo || '').toLowerCase().includes(searchTerm) ||
        (v.VisitorName || '').toLowerCase().includes(searchTerm) ||
        (v.IdentityNo || '').toLowerCase().includes(searchTerm) ||
        (v.Company || '').toLowerCase().includes(searchTerm) ||
        (v.ContactNo || '').toLowerCase().includes(searchTerm);
    });
  }
  if (statusFilter) rows = rows.filter(function (v) { return (v.Status || 'IN').toUpperCase() === statusFilter; });

  var tbody = document.getElementById('visitorRegistryBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  var countEl = document.getElementById('visitorCountLabel');
  if (countEl) countEl.textContent = rows.length + ' records';

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4 text-muted">No visitor records found.</td></tr>';
    return;
  }

  rows.forEach(function (v) {
    var isIn = (v.Status || 'IN').toUpperCase() === 'IN';
    var statusPill = isIn
      ? '<span class="pill pill-visitor-in"><i class="fas fa-circle" style="font-size:7px;margin-top:3px"></i> IN</span>'
      : '<span class="pill pill-visitor-out"><i class="fas fa-sign-out-alt" style="font-size:9px"></i> OUT</span>';
    var duration = calcDuration(v.InTime, v.OutTime);
    var tr = document.createElement('tr');
    var photoHtml = v.PhotoUrl
      ? '<img src="' + v.PhotoUrl + '" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:2px solid var(--border);flex-shrink:0" onerror="this.style.display=\'none\'">'
      : '<div style="width:28px;height:28px;border-radius:50%;background:var(--brand-light);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--brand);flex-shrink:0"><i class="fas fa-user"></i></div>';
    tr.innerHTML =
      '<td><strong style="font-family:var(--mono);font-size:11px;color:var(--brand)">' + esc(v.PassNo || '') + '</strong></td>' +
      '<td><div style="display:flex;align-items:center;gap:7px">' + photoHtml + '<span>' + esc(v.VisitorName || '') + '</span></div></td>' +
      '<td><code style="font-size:11px">' + esc(v.IdentityNo || '—') + '</code></td>' +
      '<td style="font-size:12px">' + esc(v.Company || '—') + '</td>' +
      '<td style="font-size:12px">' + esc(v.ContactNo || '—') + '</td>' +
      '<td style="font-size:11px">' + formatDateTime(v.InTime) + '</td>' +
      '<td style="font-size:11px">' + (v.OutTime ? formatDateTime(v.OutTime) : '<span class="text-muted">—</span>') + '</td>' +
      '<td>' + (v.OutTime ? '<span style="font-family:var(--mono);font-size:11px;background:var(--brand-light);color:var(--brand);padding:2px 8px;border-radius:5px;font-weight:700">' + duration + '</span>' : '<span class="text-muted" style="font-size:11px">Active</span>') + '</td>' +
      '<td>' + statusPill + '</td>' +
      '<td class="text-end"><div class="d-flex gap-1 justify-content-end">' +
      '<button class="btn-xs btn-xs-brand view-vp-btn" title="View"><i class="fas fa-eye"></i></button>' +
      (isIn ? '<button class="btn-xs btn-xs-warn exit-vp-btn" title="Exit"><i class="fas fa-sign-out-alt"></i></button>' : '') +
      '</div></td>';
    tr.querySelector('.view-vp-btn').addEventListener('click', function () { openVisitorDetail(v.PassNo); });
    if (isIn) {
      tr.querySelector('.exit-vp-btn').addEventListener('click', function () {
        openVisitorExitModal();
        var modalEl = document.getElementById('visitorExitModal');
        function onShown() {
          document.getElementById('exit-passno-input').value = v.PassNo;
          lookupVisitorForExit();
          modalEl.removeEventListener('shown.bs.modal', onShown);
        }
        modalEl.addEventListener('shown.bs.modal', onShown);
      });
    }
    tbody.appendChild(tr);
  });
}

// ════════════════════════════════════════════════════════════════
// VISITOR DETAIL
// ════════════════════════════════════════════════════════════════
function openVisitorDetail(passNo) {
  var v = null;
  for (var i = 0; i < VISITOR_REGISTRY.length; i++) {
    if (VISITOR_REGISTRY[i].PassNo === passNo) { v = VISITOR_REGISTRY[i]; break; }
  }
  if (!v) { showToast('Visitor record not found', 'error'); return; }

  var isIn = (v.Status || 'IN').toUpperCase() === 'IN';
  var duration = calcDuration(v.InTime, v.OutTime);
  var imgHtml = v.PhotoUrl
    ? '<img src="' + v.PhotoUrl + '" class="visitor-photo-circle" onerror="this.style.display=\'none\'">'
    : '<div class="visitor-photo-placeholder"><i class="fas fa-user"></i></div>';

  document.getElementById('visitorDetailBody').innerHTML =
    '<div class="vpass-header">' +
    '<div class="d-flex justify-content-between align-items-start flex-wrap gap-3">' +
    '<div class="d-flex align-items-center gap-3">' + imgHtml +
    '<div><h4>' + esc(v.VisitorName) + '</h4><small>Transmech LLC — Visitor Management</small>' +
    '<div class="vpass-barcode">' + esc(v.PassNo) + '</div></div></div>' +
    '<div class="text-end">' +
    (isIn ? '<span class="pill" style="font-size:11px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);color:#fff"><i class="fas fa-circle" style="font-size:7px"></i> INSIDE</span>'
      : '<span class="pill" style="font-size:11px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);color:#fff"><i class="fas fa-check-circle" style="font-size:9px"></i> EXITED</span>') +
    (v.OutTime ? '<div class="duration-badge mt-2">&#9201; ' + duration + '</div>' : '') +
    '</div></div></div>' +
    '<div class="p-3 p-md-4"><div class="row g-3">' +
    '<div class="col-lg-6"><div style="font-size:11px;color:#059669;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;border-bottom:2px solid #d1fae5;padding-bottom:6px;margin-bottom:12px">Visitor Information</div>' +
    '<table class="detail-table">' +
    '<tr><td>Pass No</td><td><code style="color:var(--brand);font-weight:700">' + esc(v.PassNo) + '</code></td></tr>' +
    '<tr><td>Full Name</td><td>' + esc(v.VisitorName || '—') + '</td></tr>' +
    '<tr><td>ID / Passport</td><td><code style="font-size:12px">' + esc(v.IdentityNo || '—') + '</code></td></tr>' +
    '<tr><td>Company</td><td>' + esc(v.Company || '—') + '</td></tr>' +
    '<tr><td>Phone</td><td>' + esc(v.ContactNo || '—') + '</td></tr>' +
    '<tr><td>Address</td><td>' + esc(v.Address || '—') + '</td></tr>' +
    '<tr><td>Purpose</td><td>' + esc(v.Purpose || '—') + '</td></tr>' +
    '<tr><td>Meeting</td><td>' + esc(v.Meeting || '—') + '</td></tr>' +
    '<tr><td>Gate</td><td>' + esc(v.GateNo || '—') + '</td></tr>' +
    '</table></div>' +
    '<div class="col-lg-6"><div style="font-size:11px;color:#059669;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;border-bottom:2px solid #d1fae5;padding-bottom:6px;margin-bottom:12px">Time & Duration</div>' +
    '<table class="detail-table">' +
    '<tr><td>In Time</td><td><strong style="color:var(--success)">' + formatDateTime(v.InTime) + '</strong></td></tr>' +
    '<tr><td>Out Time</td><td>' + (v.OutTime ? '<strong style="color:var(--danger)">' + formatDateTime(v.OutTime) + '</strong>' : '<span class="text-muted">Still inside</span>') + '</td></tr>' +
    '<tr><td>Duration</td><td>' + (v.OutTime ? '<span style="font-family:var(--mono);font-size:1rem;font-weight:700;color:var(--brand)">' + duration + '</span>' : '<span class="text-muted">Active</span>') + '</td></tr>' +
    '<tr><td>Status</td><td>' + (isIn ? '<span class="pill pill-visitor-in">IN</span>' : '<span class="pill pill-visitor-out">OUT</span>') + '</td></tr>' +
    '<tr><td>Created By</td><td>' + esc(v.CreatedBy || '—') + '</td></tr>' +
    '</table>' +
    '<div class="mt-3"><div class="form-label text-muted" style="font-size:11px">Visitor Photo</div>' +
    (v.PhotoUrl ? '<img src="' + v.PhotoUrl + '" style="width:100%;max-height:160px;object-fit:contain;border-radius:10px;border:1px solid var(--border)" onerror="this.style.display=\'none\'">'
      : '<div class="p-3 text-center text-muted bg-light border rounded" style="font-size:12px"><i class="far fa-image fa-2x d-block mb-1"></i>No photo</div>') +
    '</div></div></div></div>';

  var actionsDiv = document.getElementById('visitorDetailActions');
  actionsDiv.innerHTML = '';
  if (isIn) {
    var exitBtn = document.createElement('button');
    exitBtn.className = 'btn-solid btn-solid-warn';
    exitBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Record Exit';
    var vPassNo = v.PassNo;
    exitBtn.onclick = function () {
      visitorDetailModalInstance.hide();
      openVisitorExitModal();
      var modalEl = document.getElementById('visitorExitModal');
      function onShown() {
        document.getElementById('exit-passno-input').value = vPassNo;
        lookupVisitorForExit();
        modalEl.removeEventListener('shown.bs.modal', onShown);
      }
      modalEl.addEventListener('shown.bs.modal', onShown);
    };
    actionsDiv.appendChild(exitBtn);
  }
  var printBtn = document.createElement('button');
  printBtn.className = 'btn-xs btn-xs-brand';
  printBtn.innerHTML = '<i class="fas fa-print"></i> Print Pass';
  printBtn.onclick = function () { printVisitorPass(v); };
  actionsDiv.appendChild(printBtn);
  visitorDetailModalInstance.show();
}

function printVisitorPass(v) {
  var duration = calcDuration(v.InTime, v.OutTime);
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Visitor Gate Pass - ' + esc(v.PassNo) + '</title>' +
    '<style>body{font-family:Arial,sans-serif;padding:20px;max-width:560px;margin:auto;color:#1e293b}' +
    '.header{background:linear-gradient(135deg,#065f46,#059669);color:#fff;padding:18px;border-radius:10px;margin-bottom:18px;display:flex;align-items:center;gap:14px}' +
    '.header img{width:70px;height:70px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.5)}' +
    '.ph{width:70px;height:70px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:1.8rem}' +
    'h2{margin:0 0 3px;font-size:1.1rem}.pno{background:rgba(255,255,255,0.2);border-radius:4px;padding:3px 8px;font-family:monospace;font-size:10px;letter-spacing:0.15em;display:inline-block;margin-top:5px}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:14px}td{padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px}td:first-child{font-weight:bold;color:#64748b;width:140px}' +
    '.sec{font-size:9px;font-weight:800;color:#059669;text-transform:uppercase;letter-spacing:0.08em;border-bottom:2px solid #d1fae5;padding-bottom:4px;margin:12px 0 7px}' +
    '.footer{margin-top:18px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px}' +
    '@media print{button{display:none}}</style></head><body>' +
    '<div class="header">' +
    (v.PhotoUrl ? '<img src="' + v.PhotoUrl + '" onerror="this.outerHTML=\'<div class=\\\'ph\\\'>&#128100;</div>\'">' : '<div class="ph">&#128100;</div>') +
    '<div><h2>Transmech LLC — Visitor Gate Pass</h2><div style="font-size:10px;opacity:0.75">Industrial Area 3, Jebel Ali, Dubai, UAE</div><div class="pno">' + esc(v.PassNo) + '</div></div></div>' +
    '<div class="sec">Visitor Information</div>' +
    '<table><tr><td>Full Name</td><td>' + esc(v.VisitorName || '—') + '</td></tr>' +
    '<tr><td>ID / Passport</td><td>' + esc(v.IdentityNo || '—') + '</td></tr>' +
    '<tr><td>Company</td><td>' + esc(v.Company || '—') + '</td></tr>' +
    '<tr><td>Phone</td><td>' + esc(v.ContactNo || '—') + '</td></tr>' +
    '<tr><td>Purpose</td><td>' + esc(v.Purpose || '—') + '</td></tr>' +
    '<tr><td>Person to Meet</td><td>' + esc(v.Meeting || '—') + '</td></tr>' +
    '<tr><td>Gate</td><td>' + esc(v.GateNo || '—') + '</td></tr></table>' +
    '<div class="sec">Visit Timing</div>' +
    '<table><tr><td>In Time</td><td>' + formatDateTime(v.InTime) + '</td></tr>' +
    '<tr><td>Out Time</td><td>' + (v.OutTime ? formatDateTime(v.OutTime) : '—') + '</td></tr>' +
    '<tr><td>Duration</td><td>' + (v.OutTime ? duration : '—') + '</td></tr></table>' +
    '<div class="footer">Issued by: ' + esc(v.CreatedBy || '—') + ' | Printed: ' + new Date().toLocaleString() + '<br>Transmech LLC — Gate Control & Security System</div>' +
    '<scr' + 'ipt>window.onload=function(){window.print();}<\/scr' + 'ipt></body></html>';
  try {
    var win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); } else throw new Error('blocked');
  } catch (e) {
    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
  }
}

// ════════════════════════════════════════════════════════════════
// PASS DETAIL MODAL
// ════════════════════════════════════════════════════════════════
function openPassDetail(passNo) {
  var p = null;
  for (var i = 0; i < REGISTRY.length; i++) { if (REGISTRY[i].PassNo === passNo) { p = REGISTRY[i]; break; } }
  if (!p) { showToast('Pass not found', 'error'); return; }

  var imgHtml = p.ImageUrl
    ? '<img src="' + p.ImageUrl + '" class="img-fluid rounded border" style="max-height:180px;width:100%;object-fit:contain" onerror="this.style.display=\'none\'">'
    : '<div class="p-3 text-center text-muted bg-light border rounded" style="font-size:12px"><i class="far fa-image fa-2x d-block mb-1"></i>No image</div>';

  document.getElementById('passModalBody').innerHTML =
    '<div class="pass-header">' +
    '<div class="d-flex justify-content-between align-items-start flex-wrap gap-2">' +
    '<div><h4>Transmech LLC — Gate Pass</h4><small>Industrial Area 3, Jebel Ali, Dubai, UAE</small>' +
    '<div class="pass-barcode">' + esc(p.PassNo) + '</div></div>' +
    '<div class="text-end"><span class="pill ' + getStatusClass(p.Status) + '" style="font-size:12px">' + esc(p.Status) + '</span><br>' +
    '<small style="opacity:0.7;font-size:10px">' + esc(p.GateNo || '') + ' | ' + esc(p.Direction) + '</small></div>' +
    '</div></div>' +
    '<div class="p-3 p-md-4"><div class="row g-3">' +
    '<div class="col-lg-7">' +
    '<div style="font-size:11px;color:var(--brand);font-weight:800;text-transform:uppercase;letter-spacing:0.08em;border-bottom:2px solid var(--brand-light);padding-bottom:6px;margin-bottom:12px">' + esc((p.PassType || '').toUpperCase()) + ' — ' + esc(p.Direction) + '</div>' +
    '<table class="detail-table">' +
    '<tr><td>Date / Time</td><td>' + formatDateTime(p.CreatedTime || '') + '</td></tr>' +
    '<tr><td>Pass No</td><td><code style="color:var(--brand);font-weight:700">' + esc(p.PassNo) + '</code></td></tr>' +
    '<tr><td>Name</td><td>' + esc(p.VisitorName || '—') + '</td></tr>' +
    '<tr><td>Contact</td><td>' + esc(p.ContactNo || '—') + '</td></tr>' +
    '<tr><td>Identity</td><td>' + esc(p.IdentityNo || '—') + '</td></tr>' +
    '<tr><td>Company</td><td>' + esc(p.Company || '—') + '</td></tr>' +
    '<tr><td>Vehicle</td><td><code>' + esc(p.VehicleNo || '—') + '</code></td></tr>' +
    '<tr><td>Store Incharge</td><td>' + esc(p.StoreIncharge || '—') + '</td></tr>' +
    '<tr><td>Invoice/PO</td><td>' + esc(p.InvoiceDocNo || '—') + '</td></tr>' +
    '<tr><td>Weight</td><td>Net: <strong>' + esc(p.NetWeight || '0') + ' KG</strong> (G: ' + esc(p.GrossWeight || '0') + ' / T: ' + esc(p.TareWeight || '0') + ')</td></tr>' +
    '<tr><td>Transporter</td><td>' + esc(p.TransporterName || '—') + '</td></tr>' +
    '<tr><td>Destination</td><td>' + esc(p.ConsigneeAddress || '—') + '</td></tr>' +
    '<tr><td>Created By</td><td>' + esc(p.CreatedBy || '—') + '</td></tr>' +
    '<tr><td>Approved By</td><td>' + esc(p.ApprovedBy || '—') + '</td></tr>' +
    '</table></div>' +
    '<div class="col-lg-5">' +
    '<div class="mb-3"><div class="form-label text-muted">Item Particulars</div>' +
    '<div class="p-2 border rounded bg-light" style="white-space:pre-wrap;font-size:12px;font-family:var(--mono);min-height:70px;word-break:break-word">' + esc(p.Items || '—') + '</div></div>' +
    '<div><div class="form-label text-muted">Captured Image</div>' + imgHtml + '</div>' +
    '</div></div></div>';

  var actionsDiv = document.getElementById('modalActionButtons');
  actionsDiv.innerHTML = '';
  var role = SESSION ? SESSION.role : '';
  var status = (p.Status || '').toUpperCase();

  if (status === 'PENDING' && (role === 'Admin' || role === 'Supervisor')) {
    var approveBtn = document.createElement('button');
    approveBtn.className = 'btn-solid btn-solid-success';
    approveBtn.innerHTML = '<i class="fas fa-check"></i> Approve';
    var pno1 = p.PassNo;
    approveBtn.onclick = function () { processWorkflow(pno1, 'approve'); };
    actionsDiv.appendChild(approveBtn);
    var rejectBtn = document.createElement('button');
    rejectBtn.className = 'btn-solid btn-solid-danger';
    rejectBtn.innerHTML = '<i class="fas fa-ban"></i> Reject';
    var pno2 = p.PassNo;
    rejectBtn.onclick = function () { processWorkflow(pno2, 'reject'); };
    actionsDiv.appendChild(rejectBtn);
  } else if ((status === 'CONFIRMED' || status === 'APPROVED') && role === 'Admin') {
    var revokeBtn = document.createElement('button');
    revokeBtn.className = 'btn-xs btn-xs-danger';
    revokeBtn.innerHTML = '<i class="fas fa-undo"></i> Revoke';
    var pno3 = p.PassNo;
    revokeBtn.onclick = function () { processWorkflow(pno3, 'reject'); };
    actionsDiv.appendChild(revokeBtn);
  }
  if (role !== 'Security') {
    var printBtn = document.createElement('button');
    printBtn.className = 'btn-xs btn-xs-brand';
    printBtn.innerHTML = '<i class="fas fa-print"></i> Print';
    printBtn.onclick = function () { printPass(p); };
    actionsDiv.appendChild(printBtn);
  }
  passModalInstance.show();
}

function printPass(p) {
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Gate Pass - ' + esc(p.PassNo) + '</title>' +
    '<style>body{font-family:Arial,sans-serif;padding:20px;max-width:560px;margin:auto}h2{color:#0f4c81}table{width:100%;border-collapse:collapse}' +
    'td{padding:6px 8px;border-bottom:1px solid #eee;font-size:12px}td:first-child{font-weight:bold;color:#666;width:150px}' +
    '.confirmed{background:#d1fae5;color:#059669;padding:2px 8px;border-radius:4px;font-weight:bold;font-size:11px}' +
    '.pending{background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:4px;font-weight:bold;font-size:11px}' +
    '.rejected{background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:4px;font-weight:bold;font-size:11px}' +
    '@media print{button{display:none}}</style></head><body>' +
    '<h2>Transmech LLC — Gate Pass</h2><p style="color:#666;font-size:12px">Industrial Area 3, Jebel Ali, Dubai, UAE</p><hr>' +
    '<table>' +
    '<tr><td>Pass No</td><td><strong>' + esc(p.PassNo) + '</strong></td></tr>' +
    '<tr><td>Status</td><td><span class="' + (p.Status || '').toLowerCase() + '">' + esc(p.Status) + '</span></td></tr>' +
    '<tr><td>Date / Time</td><td>' + formatDateTime(p.CreatedTime || '') + '</td></tr>' +
    '<tr><td>Direction</td><td>' + esc(p.Direction) + '</td></tr>' +
    '<tr><td>Gate</td><td>' + esc(p.GateNo || '—') + '</td></tr>' +
    '<tr><td>Pass Type</td><td>' + esc(p.PassType || '—') + '</td></tr>' +
    '<tr><td>Name</td><td>' + esc(p.VisitorName || '—') + '</td></tr>' +
    '<tr><td>Company</td><td>' + esc(p.Company || '—') + '</td></tr>' +
    '<tr><td>Vehicle</td><td>' + esc(p.VehicleNo || '—') + '</td></tr>' +
    '<tr><td>Items</td><td>' + esc(p.Items || '—') + '</td></tr>' +
    '<tr><td>Net Weight</td><td>' + esc(p.NetWeight || '0') + ' KG</td></tr>' +
    '<tr><td>Created By</td><td>' + esc(p.CreatedBy || '—') + '</td></tr>' +
    '</table><p style="margin-top:24px;font-size:10px;color:#999">Printed: ' + new Date().toLocaleString() + '</p>' +
    '<scr' + 'ipt>window.onload=function(){window.print();}<\/scr' + 'ipt></body></html>';
  try {
    var win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); } else throw new Error('blocked');
  } catch (e) {
    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
  }
}

// ════════════════════════════════════════════════════════════════
// WORKFLOW
// ════════════════════════════════════════════════════════════════
function processWorkflow(passNo, type) {
  if (!confirm('Are you sure you want to ' + type + ' pass ' + passNo + '?')) return;
  showLoader();
  API.updateWorkflow({ passNo, type, username: SESSION.username })
    .then(function (res) {
      hideLoader();
      passModalInstance.hide();
      if (res.success) {
        showToast('Pass ' + passNo + ' ' + (type === 'approve' ? 'Approved ✓' : 'Rejected ✗'), type === 'approve' ? 'success' : 'warn');
        syncData();
      } else {
        showToast('Error: ' + (res.message || 'Unknown error'), 'error');
      }
    })
    .catch(function (err) { hideLoader(); showToast('Server error: ' + err.message, 'error'); });
}

// ════════════════════════════════════════════════════════════════
// SUBMIT GATE PASS
// ════════════════════════════════════════════════════════════════
function submitPass(e) {
  e.preventDefault();
  var visitorName = document.getElementById('p-visitorName').value.trim();
  var items = document.getElementById('p-items').value.trim();
  if (!visitorName) { showToast('Please enter the person name', 'error'); return; }
  if (!items) { showToast('Please enter item description', 'error'); return; }

  var btn = document.getElementById('submitPassBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

  var payload = {
    direction: document.getElementById('p-direction').value,
    gateNo: document.getElementById('p-gateNo').value,
    passType: document.getElementById('p-passType').value,
    visitorName,
    contactNo: document.getElementById('p-contactNo').value.trim(),
    vehicleNo: document.getElementById('p-vehicleNo').value.trim(),
    identityNo: document.getElementById('p-identityNo').value.trim(),
    company: document.getElementById('p-company').value.trim(),
    items,
    companyTransfer: document.getElementById('p-companyTransfer').value,
    storeIncharge: document.getElementById('p-storeIncharge').value.trim(),
    invoiceDocNo: document.getElementById('p-invoiceDocNo').value.trim(),
    grossWeight: document.getElementById('p-grossWeight').value,
    tareWeight: document.getElementById('p-tareWeight').value,
    netWeight: document.getElementById('p-netWeight').value,
    transporterName: document.getElementById('p-transporterName').value.trim(),
    consigneeAddress: document.getElementById('p-consigneeAddress').value.trim(),
    username: SESSION.username,
    role: SESSION.role,
    fileBase64: capturedImage || ''
  };

  API.createNewPass(payload)
    .then(function (res) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> SUBMIT GATE PASS';
      if (res.success) {
        showToast('Pass created: ' + res.passNo + ' (' + res.status + ')', 'success');
        document.getElementById('passForm').reset();
        removeCapturedPhoto();
        calcNetWeight();
        if (SESSION.role !== 'Security') { navToPane('pane-dashboard'); syncData(); }
      } else {
        showToast('Submission failed: ' + (res.message || 'Unknown error'), 'error');
      }
    })
    .catch(function (err) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> SUBMIT GATE PASS';
      showToast('Server Error: ' + err.message, 'error');
    });
}

function calcNetWeight() {
  var g = parseFloat(document.getElementById('p-grossWeight').value) || 0;
  var t = parseFloat(document.getElementById('p-tareWeight').value) || 0;
  document.getElementById('p-netWeight').value = Math.max(0, g - t).toFixed(2);
}

function handlePassTypeFields() {
  var type = document.getElementById('p-passType').value;
  var isVisitor = type === 'Visitor';
  ['p-grossWeight', 'p-tareWeight'].forEach(function (id) {
    document.getElementById(id).disabled = isVisitor;
    if (isVisitor) document.getElementById(id).value = '0.00';
  });
  if (isVisitor) document.getElementById('p-netWeight').value = '0.00';
}

// ════════════════════════════════════════════════════════════════
// DATA SYNC
// ════════════════════════════════════════════════════════════════
function syncData() {
  showLoader();
  API.fetchMatrixPackage()
    .then(function (res) {
      hideLoader();
      if (res.success) {
        REGISTRY = res.registry || [];
        updateDashboardMetrics(res.metrics);
        buildCharts(res.chartData);
        if (DIRECTION_FILTER) renderRegistry();
      } else {
        showToast('Sync failed: ' + (res.message || ''), 'error');
      }
    })
    .catch(function (err) { hideLoader(); showToast('Connection error: ' + err.message, 'error'); });
}

function updateDashboardMetrics(m) {
  if (!m) return;
  var map = {
    'm-inTotal': m.inTotal, 'm-inConfirmed': m.inConfirmed, 'm-inPending': m.inPending,
    'm-outTotal': m.outTotal, 'm-outConfirmed': m.outConfirmed,
    'm-rtbMatIn': m.rtbMatIn, 'm-nrtbMatIn': m.nrtbMatIn,
    'm-rtbMatOut': m.rtbMatOut, 'm-nrtbMatOut': m.nrtbMatOut,
    'm-rtbEquipOut': m.rtbEquipOut, 'm-nrtbEquipOut': m.nrtbEquipOut,
    'm-visitorsIn': m.visitorsIn, 'm-vehiclesIn': m.vehiclesIn
  };
  Object.keys(map).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.textContent = map[id] || 0;
  });
}

// ════════════════════════════════════════════════════════════════
// BULK DELETE
// ════════════════════════════════════════════════════════════════
function doBulkDelete() {
  var selected = Array.from(document.querySelectorAll('.row-chk:checked')).map(function (cb) { return cb.value; });
  if (!selected.length) { showToast('Select at least one record', 'warn'); return; }
  if (!confirm('Permanently delete ' + selected.length + ' record(s)? This cannot be undone.')) return;
  showLoader();
  API.deletePasses(selected, SESSION.role)
    .then(function (res) {
      hideLoader();
      if (res.success) { showToast(res.message || 'Records deleted', 'success'); syncData(); }
      else showToast('Error: ' + (res.message || ''), 'error');
    })
    .catch(function (err) { hideLoader(); showToast('Server error: ' + err.message, 'error'); });
}

// ════════════════════════════════════════════════════════════════
// SCANNER
// ════════════════════════════════════════════════════════════════
function doScan() {
  var token = (document.getElementById('scannerInput').value || '').trim();
  if (!token) { showToast('Please enter a pass code', 'warn'); return; }
  var resultDiv = document.getElementById('scanResult');
  var tokenUpper = token.toUpperCase();

  var vp = null;
  for (var i = 0; i < VISITOR_REGISTRY.length; i++) {
    if ((VISITOR_REGISTRY[i].PassNo || '').toUpperCase() === tokenUpper) { vp = VISITOR_REGISTRY[i]; break; }
  }
  if (vp) {
    var isIn = (vp.Status || 'IN').toUpperCase() === 'IN';
    var vpno = vp.PassNo;
    resultDiv.innerHTML =
      '<div class="p-3 border rounded text-start" style="background:var(--bg)">' +
      '<div class="d-flex align-items-center gap-2 mb-2">' +
      (isIn ? '<span class="pill pill-visitor-in">IN</span>' : '<span class="pill pill-visitor-out">OUT</span>') +
      '<code class="fw-bold" style="color:#059669">' + esc(vp.PassNo) + '</code>' +
      '<span class="badge bg-light text-success border" style="font-size:10px">VISITOR PASS</span></div>' +
      '<div style="font-size:13px"><strong>' + esc(vp.VisitorName) + '</strong> | ' + esc(vp.Company || '—') + '<br>' +
      '<span class="text-muted">In: ' + formatDateTime(vp.InTime) + '</span>' +
      (vp.OutTime ? '<br><span class="text-muted">Out: ' + formatDateTime(vp.OutTime) + ' | ' + calcDuration(vp.InTime, vp.OutTime) + '</span>' : '') +
      '</div><button class="btn-xs btn-xs-brand mt-2 view-scan-vp-btn"><i class="fas fa-eye"></i> View Details</button></div>';
    resultDiv.querySelector('.view-scan-vp-btn').addEventListener('click', function () { openVisitorDetail(vpno); });
    return;
  }

  var p = null;
  for (var j = 0; j < REGISTRY.length; j++) {
    if ((REGISTRY[j].PassNo || '').toUpperCase() === tokenUpper) { p = REGISTRY[j]; break; }
  }
  if (p) {
    var ppno = p.PassNo;
    resultDiv.innerHTML =
      '<div class="p-3 border rounded text-start" style="background:var(--bg)">' +
      '<div class="d-flex align-items-center gap-2 mb-2"><span class="pill ' + getStatusClass(p.Status) + '">' + esc(p.Status) + '</span>' +
      '<code class="fw-bold" style="color:var(--brand)">' + esc(p.PassNo) + '</code></div>' +
      '<div style="font-size:13px"><strong>' + esc(p.VisitorName) + '</strong> | ' + esc(p.PassType) + '<br>' +
      '<span class="text-muted">' + formatDateTime(p.CreatedTime || '') + '</span></div>' +
      '<button class="btn-xs btn-xs-brand mt-2 view-scan-p-btn"><i class="fas fa-eye"></i> View Details</button></div>';
    resultDiv.querySelector('.view-scan-p-btn').addEventListener('click', function () { openPassDetail(ppno); });
  } else {
    resultDiv.innerHTML =
      '<div class="p-3 border border-danger rounded" style="background:var(--danger-bg)">' +
      '<i class="fas fa-times-circle text-danger me-2"></i><strong style="color:var(--danger)">Pass Not Found</strong><br>' +
      '<span style="font-size:12px">No record for: <code>' + esc(token) + '</code></span></div>';
  }
}

// ════════════════════════════════════════════════════════════════
// REPORTS
// ════════════════════════════════════════════════════════════════
function openReport(type) {
  document.getElementById('reportPaneTitle').innerHTML = '<i class="fas fa-file-invoice"></i> ' + type + ' Report';
  document.getElementById('reportBody').innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">Set filters and click Generate.</td></tr>';
  document.getElementById('reportCount').textContent = '';
}

function runReport() {
  var from = document.getElementById('rep-from').value;
  var to = document.getElementById('rep-to').value;
  var status = document.getElementById('rep-status').value;
  var direction = document.getElementById('rep-direction').value;
  if (!from || !to) { showToast('Please select both date bounds', 'warn'); return; }
  if (from > to) { showToast('From date cannot be after To date', 'warn'); return; }
  showLoader();
  setTimeout(function () {
    hideLoader();
    var tbody = document.getElementById('reportBody');
    tbody.innerHTML = '';
    var records = REGISTRY.filter(function (x) {
      var d = (x.CreatedTime || '').split('T')[0];
      return d >= from && d <= to &&
        (status === 'ALL' || (x.Status || '').toUpperCase() === status) &&
        (direction === 'ALL' || x.Direction === direction);
    });
    document.getElementById('reportCount').textContent = records.length + ' records';
    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">No records in this range.</td></tr>';
      return;
    }
    records.forEach(function (x, i) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + (i + 1) + '</td>' +
        '<td style="font-size:11px">' + formatDateTime(x.CreatedTime || '') + '</td>' +
        '<td><strong style="font-family:var(--mono);font-size:11px">' + esc(x.PassNo || '') + '</strong></td>' +
        '<td><span class="pill ' + (x.Direction === 'IN' ? 'pill-in' : 'pill-out') + '">' + esc(x.Direction || '') + '</span></td>' +
        '<td style="font-size:11px">' + esc(x.PassType || '') + '</td>' +
        '<td>' + esc(x.VisitorName || '') + '</td>' +
        '<td style="font-size:11px">' + esc(x.Company || '—') + '</td>' +
        '<td><code style="font-size:11px">' + esc(x.VehicleNo || '—') + '</code></td>' +
        '<td><span class="pill ' + getStatusClass(x.Status) + '">' + esc(x.Status || '') + '</span></td>';
      tbody.appendChild(tr);
    });
    showToast('Report generated: ' + records.length + ' records', 'success');
  }, 300);
}

function exportReportExcel() {
  var from = document.getElementById('rep-from').value;
  var to = document.getElementById('rep-to').value;
  var status = document.getElementById('rep-status').value;
  var direction = document.getElementById('rep-direction').value;
  if (!from || !to) { showToast('Please select date range before exporting', 'warn'); return; }
  var records = REGISTRY.filter(function (x) {
    var d = (x.CreatedTime || '').split('T')[0];
    return d >= from && d <= to &&
      (status === 'ALL' || (x.Status || '').toUpperCase() === status) &&
      (direction === 'ALL' || x.Direction === direction);
  });
  if (!records.length) { showToast('No data in selected range', 'warn'); return; }
  try {
    showLoader();
    var rows = records.map(function (x, idx) {
      return {
        'S.No': idx + 1, 'Pass No': x.PassNo || '', 'Date / Time': formatDateTime(x.CreatedTime || ''),
        'Direction': x.Direction || '', 'Gate No': x.GateNo || '', 'Pass Type': x.PassType || '',
        'Visitor Name': x.VisitorName || '', 'Contact No': x.ContactNo || '', 'Vehicle No': x.VehicleNo || '',
        'Identity No': x.IdentityNo || '', 'Company': x.Company || '', 'Items': x.Items || '',
        'Net Weight KG': x.NetWeight || '0', 'Status': x.Status || '', 'Created By': x.CreatedBy || '', 'Approved By': x.ApprovedBy || ''
      };
    });
    var ws = XLSX.utils.json_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'GatePass Data');
    XLSX.writeFile(wb, 'GatePass_Report_' + from + '_to_' + to + '.xlsx');
    hideLoader();
    showToast('Exported ' + records.length + ' records', 'success');
  } catch (err) {
    hideLoader();
    showToast('Export failed: ' + err.toString(), 'error');
  }
}

// ════════════════════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════════════════════
function showToast(msg, type) {
  type = type || 'info';
  var icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle', warn: 'fa-exclamation-triangle' };
  var colors = { success: 'var(--success)', error: 'var(--danger)', info: 'var(--brand)', warn: 'var(--warning)' };
  var toast = document.createElement('div');
  toast.className = 'toast-item ' + type;
  toast.innerHTML =
    '<i class="fas ' + (icons[type] || 'fa-info-circle') + '" style="color:' + (colors[type] || 'var(--brand)') + ';flex-shrink:0"></i>' +
    '<span style="flex:1">' + String(msg) + '</span>' +
    '<button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text-3);cursor:pointer;padding:2px;font-size:16px;min-width:24px">&times;</button>';
  document.getElementById('toastStack').appendChild(toast);
  setTimeout(function () {
    toast.style.opacity = '0';
    toast.style.transition = '0.4s';
    setTimeout(function () { if (toast.parentElement) toast.remove(); }, 400);
  }, 5000);
}

function showLoader() { document.getElementById('globalLoader').classList.add('visible'); }
function hideLoader() { document.getElementById('globalLoader').classList.remove('visible'); }
