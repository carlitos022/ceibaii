/* ============================================================
   Ceiba Video Downloader v3.5 — Persistent Queue & Mobile UI
   ============================================================ */

const API_BASE = '/downloader-api';
let TOKEN = localStorage.getItem('token') || '';
let VEHICLES = [];
let SELECTED_VEHICLE = null;
let SELECTED_DATE = null;
let SELECTED_CHANNELS = [1, 2, 3, 4];
let CURRENT_MONTH = new Date();
let CALENDAR_DATA = [];
let VIDEO_FILES = [];
let DOWNLOAD_INTERVAL = null;
let STATUS_INTERVAL = null;
let DOWNLOAD_LOAD_IN_FLIGHT = false;
let PREV_TASK_STATES = {};
let COMPLETED_ORDER_MAP = {};
let TASK_FILE_CACHE = {};
let CURRENT_MODAL_DIR = null;
let CURRENT_MODAL_NAME = null;
let PLAYER_ZOOM = 1;
let PLAYER_PINCH_DISTANCE = 0;
let PLAYER_PINCH_ZOOM = 1;
let PLAYER_PAN_X = 0;
let PLAYER_PAN_Y = 0;
let PLAYER_PAN_START_X = 0;
let PLAYER_PAN_START_Y = 0;
let PLAYER_PAN_ORIGIN_X = 0;
let PLAYER_PAN_ORIGIN_Y = 0;

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const CHANNEL_COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#ec4899'];

function normalizeCalendarData(rows) {
  return (Array.isArray(rows) ? rows : []).map(x => {
    if (typeof x === 'number') return { day: x, count: 1, level: 'low' };
    const day = parseInt(x.day || x.Day || x.date || x.Date, 10);
    const count = parseInt(x.count || x.total || x.files || 1, 10) || 1;
    return { day, count, level: x.level || (count >= 8 ? 'high' : (count >= 3 ? 'medium' : 'low')) };
  }).filter(x => !isNaN(x.day));
}

function calendarInfoMap() {
  const map = {};
  for (const x of normalizeCalendarData(CALENDAR_DATA)) map[x.day] = x;
  return map;
}

// ─── API Helpers ─────────────────────────────────────

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (TOKEN) opts.headers['Authorization'] = 'Bearer ' + TOKEN;
  if (body) opts.body = JSON.stringify(body);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  opts.signal = controller.signal;
  try {
    const res = await fetch(API_BASE + path, opts);
    clearTimeout(timer);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    return { code: 202, error: err.message };
  }
}
const apiGet  = p => api('GET', p);
const apiPost = (p, b) => api('POST', p, b);
const apiDel  = (p, b) => api('DELETE', p, b);

// ─── Toast ───────────────────────────────────────────

function toast(msg, duration) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), duration || 2800);
}

// ─── Auth ─────────────────────────────────────────────

async function doLogin() {
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  if (!user || !pass) {
    errEl.textContent = 'Complete todos los campos';
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';
  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px"></div> Ingresando...';
  const res = await apiPost('/api/auth/login', { username: user, password: pass });
  btn.disabled = false;
  btn.textContent = 'Iniciar Sesión';
  if (res.code === 200 && res.result) {
    TOKEN = res.token;
    localStorage.setItem('token', TOKEN);
    showMain();
  } else {
    errEl.textContent = res.error || 'Credenciales inválidas';
    errEl.style.display = 'block';
  }
}

function doLogout() {
  TOKEN = '';
  localStorage.removeItem('token');
  if (DOWNLOAD_INTERVAL) { clearInterval(DOWNLOAD_INTERVAL); DOWNLOAD_INTERVAL = null; }
  if (STATUS_INTERVAL) { clearInterval(STATUS_INTERVAL); STATUS_INTERVAL = null; }
  document.getElementById('splash').style.display = 'none';
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  document.getElementById('view-login').style.display = 'flex';
}

// ─── Router & Views ──────────────────────────────────

function showView(name) {
  document.getElementById('splash').style.display = 'none';
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  const el = document.getElementById('view-' + name);
  if (el) el.style.display = 'flex';
}

function showMain() {
  showView('main');
  loadVehicles();
  showPage('dashboard');
  loadDownloads();
  if (!DOWNLOAD_INTERVAL) DOWNLOAD_INTERVAL = setInterval(loadDownloads, 3500);
  if (!STATUS_INTERVAL) STATUS_INTERVAL = setInterval(checkDeviceStatus, 15000);
}

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  const el = document.getElementById('page-' + name);
  if (el) el.style.display = 'block';
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === name));
  if (name === 'downloads') loadDownloads();
}

function showDashboard() {
  showPage('dashboard');
}

// ─── Dashboard (Vehicles) ────────────────────────────

async function loadVehicles() {
  const list = document.getElementById('vehicle-list');
  const empty = document.getElementById('vehicle-empty');
  list.innerHTML = '<div class="loading-overlay"><div class="spinner"></div><span>Cargando unidades MDVR...</span></div>';
  empty.style.display = 'none';
  const res = await apiGet('/api/vehicles');
  VEHICLES = res.result || [];
  renderVehicles();
  checkDeviceStatus();
}

function refreshStatus() {
  const btn = document.getElementById('btn-refresh-status');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div>';
  }
  checkDeviceStatus().then(() => {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>';
    }
    toast('Estado de señal actualizado', 1800);
  });
}

function filterVehicles(query) {
  renderVehicles(query);
}

async function checkDeviceStatus() {
  if (VEHICLES.length === 0) return;
  const deviceNos = VEHICLES.map(v => v.deviceno);
  const res = await apiPost('/api/devices/status', { deviceNos });
  if (res.code === 200 && res.result) {
    const map = {};
    for (const s of res.result) map[s.deviceNo] = !!s.online;
    for (const v of VEHICLES) v._online = map[v.deviceno] || false;
    const q = (document.getElementById('input-search') || {}).value;
    renderVehicles(q);
    updateStatusSummary();
  }
}

function updateStatusSummary() {
  const el = document.getElementById('status-summary');
  if (!el || VEHICLES.length === 0) return;
  const total = VEHICLES.length;
  const online = VEHICLES.filter(v => v._online === true).length;
  const offline = total - online;
  el.innerHTML = `
    <span class="status-chip total"><span class="status-dot" style="background:var(--primary)"></span> Total: ${total}</span>
    <span class="status-chip online"><span class="status-dot" style="background:var(--success)"></span> En línea: ${online}</span>
    <span class="status-chip offline"><span class="status-dot" style="background:var(--danger)"></span> Offline: ${offline}</span>
  `;
}

function renderVehicles(query) {
  const list = document.getElementById('vehicle-list');
  const empty = document.getElementById('vehicle-empty');
  const q = (query || '').toLowerCase().trim();
  const filtered = q ? VEHICLES.filter(v =>
    (v.carlicense || '').toLowerCase().includes(q) ||
    (v.deviceno || '').toLowerCase().includes(q) ||
    (v.groupname || '').toLowerCase().includes(q)
  ) : VEHICLES;

  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  const sorted = [...filtered].sort((a, b) => {
    const oa = a._online === true ? 0 : 1;
    const ob = b._online === true ? 0 : 1;
    if (oa !== ob) return oa - ob;
    return (a.carlicense || '').localeCompare(b.carlicense || '');
  });

  list.innerHTML = sorted.map(v => {
    const online = v._online;
    const statusCls = online === undefined ? 'status-unknown' : (online ? 'status-online' : 'status-offline');
    const statusLabel = online === undefined ? 'Verificando' : (online ? 'En línea' : 'Offline');
    const chCount = v.channel || 4;

    return `<div class="vehicle-card ${online ? 'online' : 'offline'}" onclick="selectVehicle(${v.id})">
      <div class="vcard-left">
        <div class="status-indicator ${statusCls}">
          <span class="status-dot"></span>
          <span class="status-text">${statusLabel}</span>
        </div>
        <div style="min-width:0">
          <div class="plate">${esc(v.carlicense || '—')}</div>
          <div class="info">${esc(v.groupname || 'Flota')} · ID: ${esc(v.deviceno || '')}</div>
        </div>
      </div>
      <div class="vcard-right">
        <div class="badge">${chCount} Cám</div>
        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();selectVehicle(${v.id})" title="Descargar video">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          ${online ? 'Descargar' : 'Poner en cola'}
        </button>
      </div>
    </div>`;
  }).join('');
}

// ─── Vehicle Detail & Video Download ─────────────────

async function selectVehicle(id) {
  SELECTED_VEHICLE = VEHICLES.find(v => v.id == id);
  if (!SELECTED_VEHICLE) return;

  const today = new Date();
  SELECTED_DATE = today;
  SELECTED_CHANNELS = [1, 2, 3, 4];
  CALENDAR_DATA = [];
  VIDEO_FILES = [];

  document.getElementById('vehicle-title').textContent = SELECTED_VEHICLE.carlicense || 'Vehículo';
  const badge = document.getElementById('vehicle-status-badge');
  badge.className = 'status-badge pending';
  badge.textContent = 'Verificando...';

  const pad = n => String(n).padStart(2, '0');
  const nowH = today.getHours();
  const nowM = today.getMinutes();
  const startM = (nowM >= 30) ? nowM - 30 : 0;
  document.getElementById('time-start').value = `${pad(Math.max(0, nowH - 1))}:${pad(startM)}:00`;
  document.getElementById('time-end').value = `${pad(nowH)}:${pad(nowM)}:00`;

  showPage('vehicle');
  CURRENT_MONTH = new Date();

  await loadChannels();
  renderCalendar();
  await loadCalendar();

  try {
    const st = await apiGet('/api/vehicles/' + SELECTED_VEHICLE.id + '/status');
    if (st.code === 200) {
      SELECTED_VEHICLE._online = !!st.online;
      if (st.online) {
        badge.className = 'status-badge done';
        badge.textContent = 'En línea';
      } else {
        badge.className = 'status-badge error';
        badge.textContent = 'Offline (Poner en cola)';
      }
    }
  } catch {}
}

async function loadChannels() {
  const el = document.getElementById('channel-list');
  el.innerHTML = '<div class="spinner" style="width:18px;height:18px"></div>';
  const res = await apiGet('/api/vehicles/' + SELECTED_VEHICLE.id + '/channels');
  const chs = res.result || [
    { id: 1, name: 'Cámara 1 [1]' },
    { id: 2, name: 'Cámara 2 [2]' },
    { id: 3, name: 'Cámara 3 [3]' },
    { id: 4, name: 'Cámara 4 [4]' }
  ];

  SELECTED_CHANNELS = chs.map(c => c.id);

  el.innerHTML = chs.map(c => {
    const checked = SELECTED_CHANNELS.includes(c.id) ? 'active' : '';
    return `<button type="button" class="channel-chip ${checked}" data-ch="${c.id}" onclick="toggleChannelChip(${c.id})">
      <span class="chip-dot" style="background:${CHANNEL_COLORS[(c.id - 1) % CHANNEL_COLORS.length]}"></span>
      <span>${esc(c.name)}</span>
    </button>`;
  }).join('');
}

function toggleChannelChip(chId) {
  const chip = document.querySelector(`.channel-chip[data-ch="${chId}"]`);
  if (SELECTED_CHANNELS.includes(chId)) {
    if (SELECTED_CHANNELS.length === 1) {
      toast('Debe haber al menos 1 cámara seleccionada');
      return;
    }
    SELECTED_CHANNELS = SELECTED_CHANNELS.filter(c => c !== chId);
    if (chip) chip.classList.remove('active');
  } else {
    SELECTED_CHANNELS.push(chId);
    SELECTED_CHANNELS.sort((a, b) => a - b);
    if (chip) chip.classList.add('active');
  }
  if (SELECTED_DATE) loadVideoFiles();
}

function toggleAllChannels() {
  const chips = document.querySelectorAll('.channel-chip');
  const allIds = Array.from(chips).map(c => parseInt(c.dataset.ch, 10));
  if (SELECTED_CHANNELS.length === allIds.length) {
    SELECTED_CHANNELS = [allIds[0]];
  } else {
    SELECTED_CHANNELS = [...allIds];
  }
  chips.forEach(c => {
    const id = parseInt(c.dataset.ch, 10);
    c.classList.toggle('active', SELECTED_CHANNELS.includes(id));
  });
  if (SELECTED_DATE) loadVideoFiles();
}

// ─── Calendar ─────────────────────────────────────────

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const year = CURRENT_MONTH.getFullYear();
  const month = CURRENT_MONTH.getMonth();
  document.getElementById('current-month').textContent = MONTHS[month] + ' ' + year;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayInfo = calendarInfoMap();

  let cells = [
    '<div class="cal-day-header">D</div>',
    '<div class="cal-day-header">L</div>',
    '<div class="cal-day-header">M</div>',
    '<div class="cal-day-header">M</div>',
    '<div class="cal-day-header">J</div>',
    '<div class="cal-day-header">V</div>',
    '<div class="cal-day-header">S</div>'
  ];

  const offset = firstDay;
  for (let i = 0; i < offset; i++) cells.push('<div class="cal-day empty"></div>');

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    date.setHours(0, 0, 0, 0);
    const isFuture = date > today;
    const info = dayInfo[d];
    const hasVideo = !!info;
    const isSel = SELECTED_DATE && (
      SELECTED_DATE.getFullYear() === year &&
      SELECTED_DATE.getMonth() === month &&
      SELECTED_DATE.getDate() === d
    );
    const cls = ['cal-day'];
    if (isFuture) cls.push('future');
    if (hasVideo) cls.push('has-video', 'video-' + (info.level || 'low'));
    if (isSel) cls.push('selected');

    const title = hasVideo ? ` title="${info.count || 1} bloque(s) de video disponible(s)"` : '';
    const badge = hasVideo ? `<span class="cal-availability-dot"></span>` : '';
    cells.push(`<div class="${cls.join(' ')}"${title} onclick="${isFuture ? '' : `selectDay(${year},${month},${d})`}"><span class="cal-num">${d}</span>${badge}</div>`);
  }
  grid.innerHTML = cells.join('');
}

function selectDay(year, month, day) {
  SELECTED_DATE = new Date(year, month, day);
  SELECTED_DATE.setHours(0, 0, 0, 0);
  renderCalendar();
  loadVideoFiles();
}

function changeMonth(delta) {
  CURRENT_MONTH.setMonth(CURRENT_MONTH.getMonth() + delta);
  renderCalendar();
  loadCalendar();
}

async function loadCalendar() {
  if (!SELECTED_VEHICLE) return;
  const ym = CURRENT_MONTH.getFullYear() + '-' + String(CURRENT_MONTH.getMonth() + 1).padStart(2, '0');
  const st = document.getElementById('stream-type').value || '1';
  const devNo = SELECTED_VEHICLE.deviceno;

  const warnEl = document.getElementById('cal-offline-warn');
  if (warnEl) warnEl.style.display = 'none';

  const res = await apiGet(`/api/video/calendar/${devNo}?yearmonth=${ym}&streamtype=${st}`);
  const data = normalizeCalendarData(res.result);
  CALENDAR_DATA = data;

  if (CALENDAR_DATA.length > 0) {
    const latestDay = Math.max(...CALENDAR_DATA.map(d => d.day));
    if (!SELECTED_DATE || SELECTED_DATE.getMonth() !== CURRENT_MONTH.getMonth()) {
      SELECTED_DATE = new Date(CURRENT_MONTH.getFullYear(), CURRENT_MONTH.getMonth(), latestDay);
      SELECTED_DATE.setHours(0, 0, 0, 0);
    }
  }

  renderCalendar();
  if (SELECTED_DATE) loadVideoFiles();
}

function onStreamTypeChange() {
  loadCalendar();
}

// ─── Timeline & File Listing ──────────────────────────

async function loadVideoFiles() {
  if (!SELECTED_DATE || !SELECTED_VEHICLE || SELECTED_CHANNELS.length === 0) return;
  const devNo = SELECTED_VEHICLE.deviceno;
  const dateStr = formatDateStr(SELECTED_DATE);
  const st = document.getElementById('stream-type').value || '1';

  const tl = document.getElementById('timeline');
  tl.innerHTML = '<div class="loading-overlay"><div class="spinner"></div><span>Cargando grabaciones...</span></div>';
  const retryEl = document.getElementById('tl-retry');
  if (retryEl) retryEl.style.display = 'none';

  const allFiles = [];
  for (const ch of SELECTED_CHANNELS) {
    const res = await apiGet(`/api/video/filelist/${devNo}?date=${dateStr}&channel=${ch}&streamtype=${st}`);
    if (res.result && Array.isArray(res.result) && res.result.length > 0) {
      for (const f of res.result) {
        f._channel = ch;
        allFiles.push(f);
      }
    }
  }

  allFiles.sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')) || ((a._channel || 0) - (b._channel || 0)));
  VIDEO_FILES = allFiles;
  renderTimeline();
  updateChannelLegend();

  if (allFiles.length > 0) {
    const firstTime = extractTime(allFiles[0].startTime);
    const lastTime = extractTime(allFiles[allFiles.length - 1].endTime);
    if (firstTime) document.getElementById('time-start').value = firstTime;
    if (lastTime) document.getElementById('time-end').value = lastTime;
  }
}

function retryLoadVideoFiles() {
  loadVideoFiles();
}

function updateChannelLegend() {
  const el = document.getElementById('channel-legend');
  if (!el) return;
  const activeChannels = SELECTED_CHANNELS.sort((a, b) => a - b);
  el.innerHTML = activeChannels.map(ch => {
    const color = CHANNEL_COLORS[(ch - 1) % CHANNEL_COLORS.length];
    return `<span class="legend-item"><span class="legend-dot" style="background:${color}"></span>Cámara ${ch}</span>`;
  }).join('');
}

function renderTimeline() {
  const el = document.getElementById('timeline');
  if (!el) return;
  if (VIDEO_FILES.length === 0) {
    el.innerHTML = `
      <div class="tl-empty">
        <svg viewBox="0 0 24 24" width="32" height="32"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        <p>No se encontraron grabaciones en el DVR para esta fecha/canales.</p>
        <p style="font-size:12px;color:var(--text-muted)">Puedes poner la descarga en cola persistente igualmente; se descargará al conectar.</p>
      </div>
    `;
    const retryEl = document.getElementById('tl-retry');
    if (retryEl) retryEl.style.display = 'block';
    return;
  }

  const totalSec = 86400;
  const segments = [];
  const rulers = [];

  for (let h = 0; h <= 24; h++) {
    const left = (h / 24) * 100;
    const major = h % 6 === 0;
    rulers.push(`<span class="tl-ruler ${major ? 'major' : 'minor'}" style="left:${left}%"></span>`);
  }

  for (const f of VIDEO_FILES) {
    const stSec = toSec(extractTime(f.startTime));
    const etSec = toSec(extractTime(f.endTime));
    if (etSec > stSec) {
      const left = Math.round((stSec / totalSec) * 10000) / 100;
      const width = Math.max(Math.round(((etSec - stSec) / totalSec) * 10000) / 100, 0.4);
      const color = CHANNEL_COLORS[(f._channel - 1) % CHANNEL_COLORS.length];
      segments.push({
        left,
        width,
        color,
        start: extractTime(f.startTime),
        end: extractTime(f.endTime),
        ch: f._channel
      });
    }
  }

  const bars = segments.map(s =>
    `<div class="tl-seg" style="left:${s.left}%;width:${s.width}%;background:${s.color}" title="Cám ${s.ch}: ${s.start} - ${s.end}" onclick="clipRange('${s.start}','${s.end}')"><span class="tl-seg-glow"></span></div>`
  ).join('');

  el.innerHTML = `
    <div class="tl-track">${rulers.join('')}${bars}</div>
    <div class="tl-labels">
      <span>00:00</span>
      <span>06:00</span>
      <span>12:00</span>
      <span>18:00</span>
      <span>23:59</span>
    </div>
  `;
}

function clipRange(startTime, endTime) {
  document.getElementById('time-start').value = startTime;
  document.getElementById('time-end').value = endTime;
  toast(`Rango seleccionado: ${startTime} - ${endTime}`, 2000);
}

function setQuickRange(minutes) {
  const endInput = document.getElementById('time-end').value || '12:00:00';
  const endSec = toSec(endInput);
  const startSec = Math.max(0, endSec - minutes * 60);
  document.getElementById('time-start').value = formatSecToTime(startSec);
  toast(`Recorte de ${minutes} min configurado`, 1800);
}

function setAllDayRange() {
  document.getElementById('time-start').value = '00:00:00';
  document.getElementById('time-end').value = '23:59:59';
  toast('Recorte de todo el día configurado', 1800);
}

function nudgeRange(edge, minutes) {
  const el = document.getElementById(edge === 'start' ? 'time-start' : 'time-end');
  if (!el) return;
  const next = Math.max(0, Math.min(86399, toSec(el.value || '00:00:00') + (minutes * 60)));
  el.value = formatSecToTime(next);
  toast(`Rango ajustado ${edge === 'start' ? 'inicio' : 'fin'} ${minutes > 0 ? '+' : ''}${minutes}m`, 1600);
}

function expandRange(minutes) {
  const startEl = document.getElementById('time-start');
  const endEl = document.getElementById('time-end');
  const start = toSec(startEl.value || '00:00:00');
  const end = toSec(endEl.value || '00:00:00');
  const mid = Math.round((start + end) / 2);
  const half = Math.max(30, Math.round((minutes * 60) / 2));
  startEl.value = formatSecToTime(Math.max(0, mid - half));
  endEl.value = formatSecToTime(Math.min(86399, mid + half));
  toast(`Rango expandido a ${minutes} min`, 1600);
}

function resetRange() {
  if (VIDEO_FILES.length > 0) {
    const firstTime = extractTime(VIDEO_FILES[0].startTime);
    const lastTime = extractTime(VIDEO_FILES[VIDEO_FILES.length - 1].endTime);
    if (firstTime) document.getElementById('time-start').value = firstTime;
    if (lastTime) document.getElementById('time-end').value = lastTime;
  }
  toast('Rango restaurado al video disponible', 1800);
}

// ─── Download Task Execution ─────────────────────────

async function startDownload() {
  if (!SELECTED_VEHICLE) { toast('Seleccione un vehículo'); return; }
  if (!SELECTED_DATE) { toast('Seleccione una fecha'); return; }
  if (SELECTED_CHANNELS.length === 0) { toast('Seleccione al menos una cámara'); return; }

  const dateStr = formatDateStr(SELECTED_DATE);
  const startTime = document.getElementById('time-start').value;
  const endTime = document.getElementById('time-end').value;
  const st = document.getElementById('stream-type').value || '1';

  if (!startTime || !endTime) { toast('Complete las horas de inicio y fin'); return; }
  if (startTime >= endTime) { toast('La hora de fin debe ser posterior a inicio'); return; }

  const btn = document.getElementById('btn-download');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px"></div> Agregando a cola persistente...';

  const taskName = `${SELECTED_VEHICLE.carlicense}_${dateStr}_CH${SELECTED_CHANNELS.join('_')}`;

  const res = await apiPost('/api/download/create', {
    deviceNo: SELECTED_VEHICLE.deviceno,
    date: dateStr,
    startTime: startTime,
    endTime: endTime,
    channels: SELECTED_CHANNELS,
    taskName: taskName,
    streamType: st
  });

  btn.disabled = false;
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg> Descargar / Poner en Cola Persistente';

  if (res.code === 200 && res.result) {
    toast(res.message || '✅ Tarea agregada a la cola persistente', 4000);
    showPage('downloads');
    loadDownloads();
  } else {
    toast('❌ ' + (res.error || 'Error al agregar a la cola'), 4500);
  }
}

// ─── Downloads Center & Real-Time Status ─────────────

async function loadDownloads() {
  if (!TOKEN || DOWNLOAD_LOAD_IN_FLIGHT) return;
  DOWNLOAD_LOAD_IN_FLIGHT = true;
  const el = document.getElementById('downloads-list');
  const empty = document.getElementById('downloads-empty');
  const badgeEl = document.getElementById('nav-dwn-badge');

  try {
    const res = await apiGet('/api/download/tasks');
    const tasks = res.result || [];

    const activeTasks = tasks.filter(t => t.status === 'downloading' || t.status === 'retrying' || t.status === 'queued');
    if (badgeEl) {
      if (activeTasks.length > 0) {
        badgeEl.textContent = activeTasks.length;
        badgeEl.style.display = 'inline-flex';
      } else {
        badgeEl.style.display = 'none';
      }
    }

    detectCompletedTasks(tasks);

    TASK_FILE_CACHE = {};
    for (const t of tasks) TASK_FILE_CACHE[t.queueId || t.taskId] = t;

    if (tasks.length === 0) {
      el.innerHTML = '';
      const recentEl = document.getElementById('recent-downloads-list');
      if (recentEl) recentEl.innerHTML = '';
      empty.style.display = 'flex';
      return;
    }
    empty.style.display = 'none';

    const order = { downloading: 0, queued: 1, retrying: 2, completed: 3, cancelled: 4 };
    const sorted = [...tasks].sort((a, b) => {
      const oa = order[a.status] !== undefined ? order[a.status] : 9;
      const ob = order[b.status] !== undefined ? order[b.status] : 9;
      if (oa !== ob) return oa - ob;
      if (a.status === 'completed' && b.status === 'completed') {
        return String(b.completedAt || b.updatedAt || b.createdAt || '').localeCompare(String(a.completedAt || a.updatedAt || a.createdAt || ''));
      }
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });

    const completedSorted = [...tasks]
      .filter(t => t.status === 'completed')
      .sort((a, b) => String(b.completedAt || b.updatedAt || b.createdAt || '').localeCompare(String(a.completedAt || a.updatedAt || a.createdAt || '')));
    COMPLETED_ORDER_MAP = {};
    completedSorted.forEach((t, idx) => {
      COMPLETED_ORDER_MAP[t.queueId || t.taskId] = idx + 1;
    });

    const byStatus = {};
    for (const t of sorted) {
      const key = ['downloading', 'queued', 'retrying', 'completed'].includes(t.status) ? t.status : 'other';
      (byStatus[key] = byStatus[key] || []).push(t);
    }
    const groups = [
      { key: 'downloading', label: '⬇️ En proceso' },
      { key: 'queued', label: '⏳ En cola' },
      { key: 'retrying', label: '🔄 Reintentando' },
      { key: 'completed', label: '✅ Completadas' },
      { key: 'other', label: 'Otros' }
    ];
    const html = groups.map(g => {
      const members = byStatus[g.key] || [];
      if (members.length === 0) return '';
      return `<div class="dwn-group"><div class="dwn-group-title">${g.label} <span class="dwn-group-count">${members.length}</span></div>${members.map(t => renderTaskCard(t)).join('')}</div>`;
    }).join('');

    el.innerHTML = html || '<div class="download-card"><div class="dwn-detail-text" style="color:var(--text-muted)">Sin descargas recientes.</div></div>';
    renderRecentDownloads(tasks);
  } catch (e) {
    el.innerHTML = '';
    const recentEl = document.getElementById('recent-downloads-list');
    if (recentEl) recentEl.innerHTML = '';
    empty.style.display = 'flex';
  } finally {
    DOWNLOAD_LOAD_IN_FLIGHT = false;
  }
}

function detectCompletedTasks(tasks) {
  const next = {};
  for (const t of tasks) {
    next[t.queueId || t.taskId] = t.status;
    const prev = PREV_TASK_STATES[t.queueId || t.taskId];
    if (t.status === 'completed' && prev !== 'completed' && prev !== undefined) {
      notifyComplete(t.taskName || ('Tarea ' + (t.carlicense || '')));
    }
  }
  PREV_TASK_STATES = next;
}

function notifyComplete(name) {
  toast('🎉 Descarga terminada: ' + name, 5000);
}

function renderTaskCard(t) {
  const pct = Math.max(0, Math.min(100, parseInt(t.percent, 10) || 0));
  const status = t.status || (t.files && t.files.length > 0 ? 'completed' : 'downloading');
  const failureText = 'No se recibió grabación para el rango solicitado. Verifique el calendario remoto, la tarjeta SD y la señal de la unidad.';
  const ts = t.completedAt || t.updatedAt || t.createdAt || null;
  const tsLabel = ts ? formatDateTime(ts) : '';
  const completedOrder = COMPLETED_ORDER_MAP[t.queueId || t.taskId] || null;
  const channelTags = renderChannelTags(t.channel);
  const unitClass = t.isOnline ? 'online' : 'offline';
  const unitLabel = t.isOnline ? 'Unidad encendida' : 'Unidad apagada';

  let pillHtml = '';
  if (status === 'completed') {
    pillHtml = `<span class="status-pill done"><span class="pill-dot"></span> Completado${completedOrder ? ' #' + completedOrder : ''}</span>`;
  } else if (status === 'downloading') {
    pillHtml = `<span class="status-pill downloading"><span class="pill-dot"></span> Descargando ${pct}%</span>`;
  } else if (status === 'retrying') {
    pillHtml = `<span class="status-pill retrying"><span class="pill-dot"></span> Reintentando ${pct > 0 ? pct + '%' : ''}</span>`;
  } else if (status === 'queued') {
    pillHtml = `<span class="status-pill queued"><span class="pill-dot"></span> En cola (esperando señal)</span>`;
  } else {
    pillHtml = `<span class="status-pill error"><span class="pill-dot"></span> ${esc(t.statusText || 'Error')}</span>`;
  }

  let filesHtml = '';
  if (t.files && t.files.length > 0) {
    filesHtml = '<div class="dwn-files">' + t.files.map(f => {
      const size = formatSize(f.size);
      const isMp4 = f.name.toLowerCase().endsWith('.mp4');
      return `<div class="dwn-file">
        <div class="dwn-file-info">
          <div class="dwn-file-name">📹 ${esc(f.name)}</div>
          <div class="dwn-file-size">${size} ${isMp4 ? '· MP4 Móvil' : ''}</div>
        </div>
        <div class="dwn-file-actions">
          <button class="btn btn-sm btn-ghost" onclick="playVideo('${f.dirBase64}', '${esc(f.name)}')">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
            Ver
          </button>
          <button class="btn btn-sm btn-primary" onclick="downloadFile('${f.dirBase64}', '${esc(f.name)}')">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            Descargar
          </button>
        </div>
      </div>`;
    }).join('') + '</div>';
  }

  // "Descargar progreso": partial files already copied to the server while the
  // ADS download continues in background (e.g. 60%). Lets the user grab what's done.
  let partialHtml = '';
  if (t.partialFiles && t.partialFiles.length > 0 && status !== 'completed') {
    partialHtml = '<div class="dwn-files dwn-partial">' +
      '<div class="dwn-partial-title">📥 Progreso ya descargado en el servidor (' + t.partialFiles.length + ' archivo' + (t.partialFiles.length > 1 ? 's' : '') + ')</div>' +
      t.partialFiles.map(f => {
        const size = formatSize(f.size);
        const isMp4 = f.name.toLowerCase().endsWith('.mp4');
        return `<div class="dwn-file">
          <div class="dwn-file-info">
            <div class="dwn-file-name">📹 ${esc(f.name)}</div>
            <div class="dwn-file-size">${size} ${isMp4 ? '· MP4 Móvil' : ''}</div>
          </div>
          <div class="dwn-file-actions">
             <button class="btn btn-sm btn-primary" onclick="downloadFile('${f.dirBase64}', '${esc(f.name)}')">Descargar progreso</button>
          </div>
        </div>`;
      }).join('') + '</div>';
  }

  let actionsHtml = '';
  if (status === 'downloading' || status === 'queued' || status === 'retrying') {
    const canGrabProgress = pct >= 90 || (t.partialFiles && t.partialFiles.length > 0);
    actionsHtml = `<div class="dwn-actions">
      <span class="dwn-detail-text">${esc(t.statusText || 'En proceso en segundo plano')}</span>
      <div class="dwn-action-stack">
        ${canGrabProgress ? `<button class="btn btn-sm btn-primary" onclick="downloadPartialProgress('${t.queueId || t.taskId}')">Descargar progreso parcial</button>` : ''}
        <button class="btn btn-sm btn-danger" onclick="deleteTask('${t.taskId || ''}', '${t.queueId || ''}')">Cancelar</button>
      </div>
    </div>`;
  } else {
    actionsHtml = `<div class="dwn-actions">
      <span class="dwn-detail-text" style="color:${status === 'failed' ? 'var(--danger)' : 'var(--success)'}">${status === 'failed' ? failureText : 'Listo para guardar en tu celular'}</span>
      ${status === 'failed' ? `<button class="btn btn-sm btn-primary" onclick="retryTask('${t.queueId || ''}')">Reintentar</button>` : ''}
      <button class="btn btn-sm btn-ghost" style="color:var(--text-muted)" onclick="deleteTask('${t.taskId || ''}', '${t.queueId || ''}')">Eliminar</button>
    </div>`;
  }

  const progressHtml = (status === 'downloading' || status === 'retrying' || status === 'queued')
    ? `<div class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill ${status}" style="width:${Math.max(5, pct)}%"></div>
        </div>
        <div class="progress-meta">
          <span>${esc(t.statusText || 'Descargando...')}</span>
          <span class="progress-pct-num">${pct}%</span>
        </div>
      </div>`
    : '';

  return `<div class="download-card ${status}">
    <div class="dwn-header">
      <div class="dwn-title">${esc(t.taskName || 'Tarea ' + (t.carlicense || ''))}</div>
      ${pillHtml}
    </div>
    <div class="dwn-meta">
      <span class="unit-state ${unitClass}"><i></i>${unitLabel}</span>
      <span>🚐 ${esc(t.carlicense || '')}</span>
      ${channelTags}
      <span>· 📅 ${t.date || ''}</span>
      ${t.startTime && t.endTime ? `<span>(${t.startTime} - ${t.endTime})</span>` : ''}
      ${completedOrder ? `<span class="download-order">Orden #${completedOrder}</span>` : ''}
      ${tsLabel ? `<span class="download-time">${status === 'completed' ? 'Finalizado ' : 'Actualizado '} ${tsLabel}</span>` : ''}
       ${t.retryCount > 0 ? `<span class="badge-retry">Reintentos: ${t.retryCount}</span>` : ''}
     </div>
     <div class="download-dates">
       <span><b>Inicio de cola</b> ${formatDateTime(t.createdAt || null) || '—'}</span>
       <span><b>Finalización</b> ${status === 'completed' && t.completedAt ? formatDateTime(t.completedAt) : 'Pendiente'}</span>
     </div>
     ${status === 'failed' ? `<div class="download-failure"><strong>Descarga no completada</strong><span>${failureText}</span><small>Confirme que el día aparezca marcado en el calendario y que la unidad tenga señal.</small></div>` : ''}
     ${progressHtml}
    ${partialHtml}
    ${filesHtml}
    ${actionsHtml}
  </div>`;
}

function renderRecentDownloads(tasks) {
  const el = document.getElementById('recent-downloads-list');
  if (!el) return;
  const recent = [...tasks]
    .filter(t => t.status === 'completed')
    .sort((a, b) => String(b.completedAt || b.updatedAt || b.createdAt || '').localeCompare(String(a.completedAt || a.updatedAt || a.createdAt || '')))
    .slice(0, 6);
  if (recent.length === 0) {
    el.innerHTML = '<div class="recent-empty">Aún no hay descargas terminadas.</div>';
    return;
  }
  el.innerHTML = recent.map(t => renderRecentCard(t)).join('');
}

function renderRecentCard(t) {
  const ts = t.completedAt || t.updatedAt || t.createdAt || null;
  const tsLabel = ts ? formatDateTime(ts) : '';
  const channelTags = renderChannelTags(t.channel);
  const unitClass = t.isOnline ? 'online' : 'offline';
  const unitLabel = t.isOnline ? 'Encendida' : 'Apagada';
  const fileCount = Array.isArray(t.files) ? t.files.length : 0;
  return `<div class="recent-card ${unitClass}">
    <div class="recent-card-head">
      <div class="recent-dot ${unitClass}"></div>
      <div class="recent-head-main">
        <div class="recent-title">${esc(t.carlicense || t.taskName || 'Sin nombre')}</div>
        <div class="recent-sub">${unitLabel} · ${esc(tsLabel)}</div>
      </div>
      <span class="recent-pill">${fileCount} archivo${fileCount === 1 ? '' : 's'}</span>
    </div>
    <div class="recent-tags">${channelTags || '<span class="recent-tag">Sin canal</span>'}</div>
    <div class="recent-meta">${esc(t.date || '')} ${t.startTime && t.endTime ? '· ' + t.startTime + ' - ' + t.endTime : ''}</div>
  </div>`;
}

function renderChannelTags(channel) {
  if (channel === undefined || channel === null || channel === '') return '';
  const chs = String(channel).split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n));
  if (chs.length === 0) return '';
  return chs.map(ch => `<span class="recent-tag"><span class="recent-tag-dot" style="background:${CHANNEL_COLORS[(ch - 1) % CHANNEL_COLORS.length]}"></span>C${ch}</span>`).join('');
}

function downloadPartialProgress(queueId) {
  const task = TASK_FILE_CACHE[queueId];
  const files = task && Array.isArray(task.partialFiles) && task.partialFiles.length > 0
    ? [...task.partialFiles]
    : (task && Array.isArray(task.files) ? [...task.files] : []);
  if (files.length === 0) {
    toast('No hay progreso parcial disponible', 2500);
    return;
  }
  files.sort((a, b) => String(b.mtime || '').localeCompare(String(a.mtime || '')) || ((b.size || 0) - (a.size || 0)));
  const latest = files[0];
  if (latest && latest.dirBase64) {
    toast('Descargando el progreso disponible...', 2500);
    downloadFile(latest.dirBase64, latest.name);
  }
}

// ─── File Download & In-App Video Player ─────────────

function downloadFile(dirB64, name) {
  const cleanName = name.toLowerCase().endsWith('.mp4') ? name : name + '.mp4';
  const url = `${API_BASE}/api/download/file?dir=${encodeURIComponent(dirB64)}&token=${encodeURIComponent(TOKEN)}`;

  toast('⬇️ Guardando en la carpeta Descargas de tu celular...', 4000);

  const a = document.createElement('a');
  a.href = url;
  a.download = cleanName;
  a.target = '_blank';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 2000);
}

function playVideo(dirB64, name) {
  CURRENT_MODAL_DIR = dirB64;
  CURRENT_MODAL_NAME = name;
  const modal = document.getElementById('modal-player');
  const video = document.getElementById('video-player');
  const title = document.getElementById('modal-video-title');

  resetPlayerZoom();
  title.textContent = name;
  const streamUrl = `${API_BASE}/api/download/stream?dir=${encodeURIComponent(dirB64)}&token=${encodeURIComponent(TOKEN)}`;
  video.src = streamUrl;
  modal.style.display = 'flex';
  video.play().catch(() => {});
}

function closeVideoPlayer() {
  const modal = document.getElementById('modal-player');
  const video = document.getElementById('video-player');
  if (video) {
    video.pause();
    video.src = '';
  }
  modal.style.display = 'none';
}

function downloadCurrentModalVideo() {
  if (CURRENT_MODAL_DIR && CURRENT_MODAL_NAME) {
    downloadFile(CURRENT_MODAL_DIR, CURRENT_MODAL_NAME);
  }
}

async function deleteTask(taskId, queueId) {
  if (!confirm('¿Eliminar esta tarea de descarga?')) return;
  await apiDel('/api/download/task', { taskId, queueId });
  toast('Tarea eliminada');
  loadDownloads();
}

// ─── Quick Download Form ─────────────────────────────

let QUICK_VEHICLE = null;
let QUICK_CHANNELS = [1];

async function openQuickDownload(vehicleId) {
  const v = VEHICLES.find(x => x.id == vehicleId);
  if (!v) return;
  QUICK_VEHICLE = v;
  document.getElementById('qd-subtitle').textContent = v.carlicense + ' · ID: ' + v.deviceno;

  const sel = document.getElementById('qd-vehicle');
  sel.innerHTML = VEHICLES.map(x =>
    `<option value="${x.id}" ${x.id == vehicleId ? 'selected' : ''}>${esc(x.carlicense || '—')} · ${esc(x.deviceno || '')}</option>`
  ).join('');

  sel.onchange = () => {
    const sv = VEHICLES.find(x => x.id == sel.value);
    if (sv) {
      QUICK_VEHICLE = sv;
      document.getElementById('qd-subtitle').textContent = sv.carlicense + ' · ID: ' + sv.deviceno;
    }
  };

  document.getElementById('qd-date').value = formatDateStr(new Date());
  document.getElementById('qd-start').value = '08:00:00';
  document.getElementById('qd-end').value = '08:30:00';

  const chEl = document.getElementById('qd-channels');
  const chCount = v.channel || 4;
  let chHtml = '';
  for (let j = 1; j <= chCount; j++) {
    chHtml += `<button type="button" class="channel-chip ${j === 1 ? 'active' : ''}" data-qch="${j}" onclick="toggleQuickChip(${j})">
      <span class="chip-dot" style="background:${CHANNEL_COLORS[(j - 1) % CHANNEL_COLORS.length]}"></span>
      <span>Cámara ${j} [${j}]</span>
    </button>`;
  }
  chEl.innerHTML = chHtml;
  QUICK_CHANNELS = [1];
  showPage('quick-download');
}

function toggleQuickChip(chId) {
  const chip = document.querySelector(`.channel-chip[data-qch="${chId}"]`);
  if (QUICK_CHANNELS.includes(chId)) {
    if (QUICK_CHANNELS.length === 1) {
      toast('Seleccione al menos 1 cámara');
      return;
    }
    QUICK_CHANNELS = QUICK_CHANNELS.filter(c => c !== chId);
    if (chip) chip.classList.remove('active');
  } else {
    QUICK_CHANNELS.push(chId);
    QUICK_CHANNELS.sort((a, b) => a - b);
    if (chip) chip.classList.add('active');
  }
}

async function submitQuickDownload() {
  if (!QUICK_VEHICLE) return;
  const date = document.getElementById('qd-date').value;
  const startTime = document.getElementById('qd-start').value;
  const endTime = document.getElementById('qd-end').value;
  const streamType = document.getElementById('qd-stream').value;

  if (!date || !startTime || !endTime) { toast('Complete fecha y horas'); return; }
  if (startTime >= endTime) { toast('La hora fin debe ser posterior a inicio'); return; }

  const btn = document.querySelector('#form-quick-download button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px"></div> Agregando a cola...';

  const res = await apiPost('/api/download/create', {
    deviceNo: QUICK_VEHICLE.deviceno,
    date: date,
    startTime: startTime,
    endTime: endTime,
    channels: QUICK_CHANNELS,
    taskName: `${QUICK_VEHICLE.carlicense}_${date}_CH${QUICK_CHANNELS.join('_')}`,
    streamType: streamType
  });

  btn.disabled = false;
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg> Descargar / Poner en Cola';

  if (res.code === 200 && res.result) {
    toast(res.message || '✅ Descarga agregada a la cola persistente', 3500);
    showPage('downloads');
    loadDownloads();
  } else {
    toast('❌ ' + (res.error || 'Error al agregar a la cola'), 4000);
  }
}

// ─── Utility Helpers ─────────────────────────────────

function esc(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

function formatDateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function extractTime(dt) {
  if (!dt) return '00:00:00';
  const m = dt.match(/(\d{2}):(\d{2}):(\d{2})/);
  if (m) return `${m[1]}:${m[2]}:${m[3]}`;
  const parts = dt.split(' ');
  if (parts.length > 1) return extractTime(parts[1]);
  return '00:00:00';
}

function toSec(t) {
  if (!t) return 0;
  const p = t.split(':');
  return parseInt(p[0], 10) * 3600 + (parseInt(p[1], 10) || 0) * 60 + (parseInt(p[2], 10) || 0);
}

function formatSecToTime(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = n => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  bytes = parseInt(bytes, 10);
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < 3) { bytes /= 1024; i++; }
  return bytes.toFixed(i > 0 ? 1 : 0) + ' ' + u[i];
}

function applyPlayerZoom() {
  const video = document.getElementById('video-player');
  const label = document.getElementById('player-zoom-label');
  if (video) video.style.transform = `translate(${PLAYER_PAN_X}px, ${PLAYER_PAN_Y}px) scale(${PLAYER_ZOOM})`;
  if (label) label.textContent = Math.round(PLAYER_ZOOM * 100) + '%';
}

function changePlayerZoom(delta) {
  PLAYER_ZOOM = Math.max(1, Math.min(3, PLAYER_ZOOM + delta));
  applyPlayerZoom();
}

function resetPlayerZoom() {
  PLAYER_ZOOM = 1;
  PLAYER_PAN_X = 0;
  PLAYER_PAN_Y = 0;
  applyPlayerZoom();
}

function playerTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt((dx * dx) + (dy * dy));
}

function onPlayerTouchStart(event) {
  if (event.touches.length === 2) {
    PLAYER_PINCH_DISTANCE = playerTouchDistance(event.touches);
    PLAYER_PINCH_ZOOM = PLAYER_ZOOM;
    return;
  }
  if (event.touches.length === 1 && PLAYER_ZOOM > 1) {
    PLAYER_PAN_START_X = event.touches[0].clientX;
    PLAYER_PAN_START_Y = event.touches[0].clientY;
    PLAYER_PAN_ORIGIN_X = PLAYER_PAN_X;
    PLAYER_PAN_ORIGIN_Y = PLAYER_PAN_Y;
  }
}

function onPlayerTouchMove(event) {
  if (event.touches.length === 2 && PLAYER_PINCH_DISTANCE) {
    event.preventDefault();
    const ratio = playerTouchDistance(event.touches) / PLAYER_PINCH_DISTANCE;
    PLAYER_ZOOM = Math.max(1, Math.min(3, PLAYER_PINCH_ZOOM * ratio));
    applyPlayerZoom();
    return;
  }
  if (event.touches.length === 1 && PLAYER_ZOOM > 1 && PLAYER_PAN_START_X !== 0) {
    event.preventDefault();
    PLAYER_PAN_X = PLAYER_PAN_ORIGIN_X + event.touches[0].clientX - PLAYER_PAN_START_X;
    PLAYER_PAN_Y = PLAYER_PAN_ORIGIN_Y + event.touches[0].clientY - PLAYER_PAN_START_Y;
    applyPlayerZoom();
  }
}

function onPlayerTouchEnd(event) {
  if (event.touches.length < 2) PLAYER_PINCH_DISTANCE = 0;
  if (event.touches.length === 0) {
    PLAYER_PAN_START_X = 0;
    PLAYER_PAN_START_Y = 0;
  }
}

function togglePlayerFullscreen() {
  const container = document.querySelector('.video-container');
  if (!container) return;
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else if (container.requestFullscreen) {
    container.requestFullscreen().catch(() => {});
  }
}

async function retryTask(queueId) {
  if (!queueId) return;
  const res = await apiPost('/api/download/retry', { queueId });
  if (res.code === 200) {
    toast('Reintento puesto en cola');
    loadDownloads();
  } else {
    toast('No se pudo reintentar: ' + (res.error || 'error'), 4500);
  }
}

async function clearQueue() {
  if (!confirm('¿Limpiar toda la cola y cancelar sus tareas remotas?')) return;
  const res = await apiPost('/api/download/queue/clear', {});
  if (res.code === 200) {
    toast('Cola limpiada: ' + (res.removed || 0) + ' tareas eliminadas');
    loadDownloads();
  } else {
    toast('No se pudo limpiar la cola: ' + (res.error || 'error'), 4500);
  }
}

function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(d);
}

// ─── Initialization ──────────────────────────────────

document.getElementById('form-login').addEventListener('submit', e => { e.preventDefault(); doLogin(); });
document.getElementById('btn-logout').addEventListener('click', doLogout);
document.getElementById('form-quick-download').addEventListener('submit', e => { e.preventDefault(); submitQuickDownload(); });

(async function init() {
  if (TOKEN) {
    const res = await apiGet('/api/auth/verify');
    if (res.code === 200) {
      showMain();
      return;
    }
    TOKEN = '';
    localStorage.removeItem('token');
  }
  setTimeout(() => showView('login'), 500);
})();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

const playerVideo = document.getElementById('video-player');
if (playerVideo) {
  playerVideo.addEventListener('touchstart', onPlayerTouchStart, { passive: true });
  playerVideo.addEventListener('touchmove', onPlayerTouchMove, { passive: false });
  playerVideo.addEventListener('touchend', onPlayerTouchEnd, { passive: true });
  playerVideo.addEventListener('touchcancel', onPlayerTouchEnd, { passive: true });
}
