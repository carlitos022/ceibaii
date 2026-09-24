import { Vehicle, AlertItem, Geofence, LibraryRecord, DownloadJob } from '../src/types';
import { executeQuery, ensureTrackerEventsTable, isDbConnected } from './db';
import fs from 'fs';
import path from 'path';

const LAST_GPS_PATH = 'C:/Program Files (x86)/CMS Server/TransmitServer/AlarmServer/LastGps.txt';
const ONLINE_THRESHOLD_SEC = Number(process.env.GPS_FRESHNESS_SECONDS || 600);
const ARMS_API_URL = 'http://127.0.0.1:12040'; // Ceiba II ARMS API para estado de dispositivos

// Telemetría real desde la base de datos y el último reporte GPS
let vehiclesState: Vehicle[] = [];
let alertsState: AlertItem[] = [];
let downloadsState: DownloadJob[] = [];

type Snapshot = Pick<Vehicle, 'status' | 'ignition' | 'geofence' | 'speed' | 'lat' | 'lng' | 'route' | 'lastUpdate'>;

const snapshotState = new Map<string, Snapshot>();
const recentEventKeys = new Map<string, number>();
const ignitionOffSince = new Map<string, string>();
const signalLostSince = new Map<string, string>();

let simulationTimer: NodeJS.Timeout | null = null;

// Helpers - Hora Quito Ecuador (America/Guayaquil UTC-5)
function formatQuito(date: Date): string {
  // sv-SE locale gives YYYY-MM-DD HH:mm:ss in target TZ
  return date.toLocaleString('sv-SE', { timeZone: 'America/Guayaquil' });
}
function formatQuitoFromTs(tsSec: number): string {
  if (!tsSec) return formatQuito(new Date());
  return formatQuito(new Date(tsSec * 1000));
}
function rawToKmh(v: any): number {
  const n = Number(v);
  if (isNaN(n) || n < 0) return 0;
  const kmh = Math.round(n / 100);
  return kmh > 200 ? 200 : kmh;
}
function readLastGps(): any[] {
  try {
    if (!fs.existsSync(LAST_GPS_PATH)) return [];
    const raw = fs.readFileSync(LAST_GPS_PATH, 'utf8').trim();
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function mapVehicleStatus(speed: number, online: boolean, hasFreshGps: boolean): Vehicle['status'] {
  if (!online) return 'offline';
  if (!hasFreshGps) return 'online';
  return speed > 5 ? 'moving' : 'stopped';
}

function parseQuitoDate(value: string): Date {
  const d = new Date(String(value).replace(' ', 'T'));
  return isNaN(d.getTime()) ? new Date() : d;
}

function eventTimestamp(value?: string): string {
  return formatQuito(value ? parseQuitoDate(value) : new Date());
}

function cleanLocation(v: Vehicle): string {
  return v.geofence || v.route || 'su ruta';
}

function minutesBetween(from: string, to: string): number {
  const a = parseQuitoDate(from).getTime();
  const b = parseQuitoDate(to).getTime();
  if (!a || !b || isNaN(a) || isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 60000));
}

function makeEvent(v: Vehicle, eventType: string, title: string, description: string, source: 'gps' | 'ignition' | 'geofence' | 'signal' | 'route', meta: Record<string, any> = {}) {
  const now = eventTimestamp(v.lastUpdate);
  const key = `${v.id}:${eventType}:${title}`;
  const last = recentEventKeys.get(key) || 0;
  if (Date.now() - last < 120000) return null;
  recentEventKeys.set(key, Date.now());
  return {
    vehicle_id: v.id,
    unit_number: v.unitNumber,
    plate: v.plate,
    event_type: eventType,
    title,
    description,
    event_time: now,
    lat: v.lat,
    lng: v.lng,
    speed: v.speed,
    source,
    meta: JSON.stringify(meta)
  };
}

async function saveHistoricEvent(event: any) {
  if (!event || !isDbConnected()) return;
  try {
    await ensureTrackerEventsTable();
    await executeQuery(
      `INSERT INTO tracker_events (vehicle_id, unit_number, plate, event_type, title, description, event_time, lat, lng, speed, source, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [event.vehicle_id, event.unit_number, event.plate, event.event_type, event.title, event.description, event.event_time, event.lat, event.lng, event.speed, event.source, event.meta]
    );
  } catch (e) {
    console.warn('[tracker_events] insert failed', (e as any)?.message);
  }
}

async function recordHistoricEvents(vehicles: Vehicle[]) {
  for (const v of vehicles) {
    const prev = snapshotState.get(v.id);
    const location = cleanLocation(v);
    const currentSnapshot: Snapshot = {
      status: v.status,
      ignition: v.ignition,
      geofence: v.geofence,
      speed: v.speed,
      lat: v.lat,
      lng: v.lng,
      route: v.route,
      lastUpdate: v.lastUpdate
    };

    const candidates: any[] = [];

    if (!prev) {
      if (v.status === 'moving') {
        candidates.push(makeEvent(v, 'route_active', `${v.unitNumber} está en ruta`, `La unidad ${v.unitNumber} está en ruta a ${v.speed} km/h por ${location}.`, 'route', { route: v.route }));
      } else if (v.status === 'stopped') {
        candidates.push(makeEvent(v, 'stopped', `${v.unitNumber} se detuvo`, `La unidad ${v.unitNumber} se detuvo en ${location}.`, 'gps', { location }));
      } else if (v.status === 'offline') {
        candidates.push(makeEvent(v, 'signal_lost', `${v.unitNumber} perdió la señal`, `La unidad ${v.unitNumber} perdió la señal.`, 'signal', { location }));
      } else {
        candidates.push(makeEvent(v, 'ignition_off', `${v.unitNumber} apagó el carro`, `La unidad ${v.unitNumber} apagó el carro en ${location}.`, 'ignition', { location }));
      }
    } else {
      if (!prev.ignition && v.ignition) {
        const offSince = ignitionOffSince.get(v.id);
        const offMinutes = offSince ? minutesBetween(offSince, v.lastUpdate) : 0;
        const extra = offMinutes > 0 ? ` después de estar apagada ${offMinutes} min` : '';
        candidates.push(makeEvent(v, 'ignition_on', `${v.unitNumber} prendió el carro`, `La unidad ${v.unitNumber} prendió el carro${extra} y salió hacia ${location}.`, 'ignition', { previous: prev.ignition, location, offMinutes }));
        ignitionOffSince.delete(v.id);
      }
      if (prev.ignition && !v.ignition) {
        ignitionOffSince.set(v.id, v.lastUpdate);
        candidates.push(makeEvent(v, 'ignition_off', `${v.unitNumber} apagó el carro`, `La unidad ${v.unitNumber} apagó el carro en ${location}.`, 'ignition', { previous: prev.ignition, location }));
      }
      if (prev.status !== v.status) {
        if (v.status === 'offline') {
          signalLostSince.set(v.id, v.lastUpdate);
          candidates.push(makeEvent(v, 'signal_lost', `${v.unitNumber} perdió la señal`, `La unidad ${v.unitNumber} perdió la señal mientras se movía hacia ${location}.`, 'signal', { previousStatus: prev.status, location }));
        } else if (prev.status === 'offline') {
          const lostSince = signalLostSince.get(v.id);
          const lostMinutes = lostSince ? minutesBetween(lostSince, v.lastUpdate) : 0;
          const extra = lostMinutes > 0 ? ` después de ${lostMinutes} min sin señal` : '';
          candidates.push(makeEvent(v, 'signal_recovered', `${v.unitNumber} recuperó la señal`, `La unidad ${v.unitNumber} recuperó la señal en ${location}${extra}.`, 'signal', { previousStatus: prev.status, location, lostMinutes }));
          signalLostSince.delete(v.id);
        } else if (v.status === 'moving') {
          candidates.push(makeEvent(v, 'route_active', `${v.unitNumber} continuó en ruta`, `La unidad ${v.unitNumber} continuó en ruta a ${v.speed} km/h por ${location}.`, 'route', { previousStatus: prev.status, route: v.route }));
        } else if (v.status === 'stopped') {
          candidates.push(makeEvent(v, 'stopped', `${v.unitNumber} se detuvo`, `La unidad ${v.unitNumber} se detuvo en ${location}.`, 'gps', { previousStatus: prev.status, location }));
        }
      }
      if (prev.geofence !== v.geofence) {
        if (prev.geofence && !v.geofence) {
          candidates.push(makeEvent(v, 'geofence_exit', `${v.unitNumber} salió de ${prev.geofence}`, `La unidad ${v.unitNumber} salió de ${prev.geofence} y siguió hacia ${location}.`, 'geofence', { from: prev.geofence, to: v.geofence || null }));
        }
        if (!prev.geofence && v.geofence) {
          candidates.push(makeEvent(v, 'geofence_entry', `${v.unitNumber} entró a ${v.geofence}`, `La unidad ${v.unitNumber} entró a ${v.geofence} en las coordenadas ${v.lat?.toFixed(6) ?? 'sin GPS'}, ${v.lng?.toFixed(6) ?? 'sin GPS'}.`, 'geofence', { to: v.geofence }));
        }
        if (prev.geofence && v.geofence && prev.geofence !== v.geofence) {
          candidates.push(makeEvent(v, 'geofence_entry', `${v.unitNumber} entró a ${v.geofence}`, `La unidad ${v.unitNumber} salió de ${prev.geofence} y entró a ${v.geofence}.`, 'geofence', { from: prev.geofence, to: v.geofence }));
        }
      }
      if (v.status === 'moving' && v.speed > 0 && prev.status !== 'moving') {
        candidates.push(makeEvent(v, 'route_active', `${v.unitNumber} está en ruta a ${v.speed} km/h`, `La unidad ${v.unitNumber} está en ruta a ${v.speed} km/h por ${location}.`, 'route', { route: v.route, speed: v.speed }));
      }
      if (v.status === 'stopped' && prev.status === 'moving' && v.speed === 0) {
        candidates.push(makeEvent(v, 'stopped', `${v.unitNumber} se detuvo`, `La unidad ${v.unitNumber} se detuvo en ${location}.`, 'gps', { location }));
      }
    }

    snapshotState.set(v.id, currentSnapshot);
    for (const ev of candidates) {
      await saveHistoricEvent(ev as any);
    }
  }
}

// Obtener lista de dispositivos online desde la API ARMS de Ceiba II
let lastOnline = new Set<string>();
let lastOnlineAt = 0;
async function getOnlineDevicesFromARMS(): Promise<Set<string>> {
  try {
    // Primero obtener todos los deviceIds de la DB
    const rows = await executeQuery<any>('SELECT deviceid FROM vehicledevice');
    if (!rows || rows.length === 0) return new Set();
    
    const deviceIds = rows.map(r => r.deviceid).filter(Boolean);
    if (deviceIds.length === 0) return new Set();
    
    // Consultar la API ARMS para saber cuáles están online
    const response = await fetch(`${ARMS_API_URL}/dev/online/last`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ terminals: deviceIds.join(',') })
    });
    
    if (!response.ok) {
      console.warn('[ARMS] HTTP error:', response.status);
      return Date.now() - lastOnlineAt < 15000 ? lastOnline : new Set();
    }
    
    const result = await response.json();
    // WCMS5's own basicStateNow2 also accepts 4 (partial device response).
    if (![0, 4].includes(result.errorcode) || !Array.isArray(result.data)) {
      console.warn('[ARMS] API error:', result.errorcode);
      return Date.now() - lastOnlineAt < 15000 ? lastOnline : new Set();
    }
    
    // result.data contiene los deviceIds que están online
    lastOnline = new Set<string>(result.data.map(String));
    lastOnlineAt = Date.now();
    return lastOnline;
  } catch (e: any) {
    console.warn('[ARMS] Failed to get online status:', e.message);
    return Date.now() - lastOnlineAt < 15000 ? lastOnline : new Set();
  }
}

// Start telemetry polling real GPS every 2.5s (replaces mock simulation)
export function startTelemetrySimulation() {
  if (simulationTimer) return;
  // Immediately try to load real data once
  refreshVehiclesFromRealSource().catch(()=>{});
  simulationTimer = setInterval(async () => {
    try {
      await refreshVehiclesFromRealSource();
    } catch {}
  }, 2500);
}

let refreshInFlight: Promise<void> | null = null;
let lastRefreshAt = 0;
async function refreshVehiclesFromRealSource() {
  if (refreshInFlight) return refreshInFlight;
  if (Date.now() - lastRefreshAt < 2000) return;
  refreshInFlight = loadVehiclesFromRealSource().finally(() => {
    lastRefreshAt = Date.now();
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function loadVehiclesFromRealSource() {
  if (!isDbConnected()) {
    // No representar datos simulados como si fueran telemetría real.
    vehiclesState = [];
    return;
  }
  try {
    const rows = await executeQuery<any>(
      `SELECT v.id, v.carlicence AS carlicense, v.deviceid AS deviceno, v.groupid,
              g.groupname, d.channelcount, d.enable AS channelenable, d.channelname
       FROM vehicledevice v
       LEFT JOIN devicefile d ON d.vehicledeviceid = v.id
       LEFT JOIN groupinfo g ON g.id = v.groupid
       ORDER BY v.carlicence ASC`
    );
    if (!rows || rows.length === 0) return;
    
    // Obtener lista de dispositivos online desde la API ARMS de Ceiba II
    const onlineDevices = await getOnlineDevicesFromARMS();
    
    const gpsRaw = readLastGps();
    const gpsMap = new Map<string, any>();
    const nowSec = Date.now() / 1000;
    for (const entry of gpsRaw) {
      const devId = entry.d || '';
      if (!devId) continue;
      const p = entry.p || {};
      gpsMap.set(devId, {
        lat: parseFloat(p.w),
        lng: parseFloat(p.j),
        speed: rawToKmh(p.s),
        heading: p.c ? Math.round(p.c / 100) : 0,
        timestamp: p.t || 0,
        altitude: p.h || 0,
        ignition: !!p.v,
        humanTime: p.t ? new Date(p.t * 1000).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil' }) : '',
      });
    }
    const mapped: Vehicle[] = rows.map((r: any, idx: number) => {
       const chCount = Math.max(0, parseInt(r.channelcount, 10) || 0);
       const enabledMask = r.channelenable === -1 ? (2 ** chCount - 1) : Number(r.channelenable ?? 0);
       const chNames = r.channelname ? String(r.channelname).split(',') : [];
       const isOnlineFromARMS = onlineDevices.has(String(r.deviceno).trim());
       const channels = [];
      for (let j = 0; j < chCount; j++) {
        if (!(enabledMask & (1 << j))) continue;
        channels.push({ id: j + 1, channelNumber: j + 1, name: chNames[j] ? `${chNames[j]} [${j + 1}]` : `Cámara ${j + 1} [${j + 1}]`, status: isOnlineFromARMS ? 'buffering' as const : 'offline' as const, resolution: '', fps: 0, bitrate: '' });
      }
      const prevVehicle = vehiclesState.find(v => v.id === String(r.id));
      const g = gpsMap.get(r.deviceno);
      let lat = prevVehicle?.lat ?? null;
      let lng = prevVehicle?.lng ?? null;
      let speed = 0, heading = prevVehicle ? prevVehicle.heading : 0, lastUpdate = prevVehicle?.lastUpdate || '', ignition = prevVehicle ? prevVehicle.ignition : false, status: Vehicle['status'] = 'offline';
      let trail: [number, number][] | undefined = prevVehicle?.trail ? [...prevVehicle.trail] : undefined;
      const validGps = g && Number.isFinite(g.lat) && Number.isFinite(g.lng) && Math.abs(g.lat) <= 90 && Math.abs(g.lng) <= 180 && (g.lat !== 0 || g.lng !== 0);
      const freshGps = validGps && Number.isFinite(Number(g.timestamp)) && nowSec - Number(g.timestamp) >= -30 && nowSec - Number(g.timestamp) <= ONLINE_THRESHOLD_SEC;
      if (validGps) {
        lat = g.lat; lng = g.lng; speed = g.speed; heading = g.heading; ignition = g.ignition;
        lastUpdate = g.timestamp ? formatQuitoFromTs(g.timestamp) : (prevVehicle?.lastUpdate || '');
        // Usar el estado de ARMS en lugar de la lógica de tiempo
        status = mapVehicleStatus(speed, isOnlineFromARMS, freshGps);
        if (freshGps && prevVehicle?.lastUpdate !== lastUpdate) {
          trail = [...(prevVehicle?.trail || []).slice(-20), [lat, lng] as [number, number]];
        }
        // Si está offline, conservar última velocidad 0 pero mantener trail
        if (status === 'offline' || !freshGps) speed = 0;
      } else {
        // Sin GPS en este ciclo: usar el estado de ARMS
         status = mapVehicleStatus(0, isOnlineFromARMS, false);
        speed = 0;
        // Mantener trail previo
      }
       const statusText = status === 'moving'
         ? `Moviendo - ${speed} km/h`
         : status === 'stopped'
           ? 'Detenido'
           : status === 'online'
             ? 'Conectado'
             : 'Sin conexión';
      const relativeTime = (()=>{ 
        const ts = validGps ? Number(g.timestamp) : 0;
        if (!ts) return 'sin reporte';
        const diff = Math.round(nowSec - ts);
        if(diff<0) return 'reloj GPS adelantado';
        if(diff<60) return `hace ${diff}s`;
        if(diff<3600) return `hace ${Math.round(diff/60)} min`;
        if(diff<86400) return `hace ${Math.round(diff/3600)}h`;
        return `hace ${Math.round(diff/86400)}d`;
      })();
      return {
        id: String(r.id),
        unitNumber: r.carlicense,
        plate: r.carlicense,
        status,
        statusText,
        speed,
        lat: lat === null ? null : Number(lat.toFixed(6)),
        lng: lng === null ? null : Number(lng.toFixed(6)),
        heading,
        route: r.groupname || '',
        geofence: '',
        lastUpdate,
        relativeTime,
         camerasOnline: isOnlineFromARMS ? `MDVR conectado • ${channels.length} canales configurados` : 'MDVR sin conexión',
         camerasCount: 0,
        camerasTotal: chCount,
        driverName: undefined,
        ignition,
         mileageKm: null,
         fuelLevelPct: null,
         engineTempC: null,
         batteryVolts: null,
         altitudeMeters: validGps ? g.altitude : null,
         satellites: null,
        channels,
        trail
      };
    });
    if (mapped.length > 0) {
      await recordHistoricEvents(mapped);
      vehiclesState = mapped;
    }
  } catch (e: any) {
    console.warn('[getVehicles real] fallback to mock', e.message);
  }
}

export async function getVehicles(): Promise<Vehicle[]> {
  if (isDbConnected()) {
    // SSE and direct API callers must receive the newest Ceiba II GPS state.
    await refreshVehiclesFromRealSource();
    return vehiclesState;
  }
  return [];
}

export function getVehicleById(idOrUnitNumber: string): Vehicle | undefined {
  return vehiclesState.find(v => v.id === idOrUnitNumber || v.unitNumber === idOrUnitNumber);
}

export async function getGeofences(): Promise<Geofence[]> {
  const rows = await getGeofencesReal();
  return rows.flatMap((row: any) => {
    const points = String(row.KeyPoints || '').split(',').map(Number);
    const lat = points[0], lng = points[1];
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (!lat && !lng)) return [];
    const radius = Number(row.Radius);
    if (!Number.isFinite(radius) || radius <= 0) return [];
    return [{ id: String(row.FenceID), name: String(row.FenceCode || row.FenceID), type: 'terminal' as const,
      typeLabel: 'Geocerca', coordinates: [] as [number, number][], center: [lat, lng] as [number, number],
      radiusMeters: radius, activeUnitsCount: 0, alertOnEntry: false, alertOnExit: false, color: '#f59e0b' }];
  });
}
// Real fences fetch is done via client proxy to miritrans; server keeps mock as fallback but we expose real via separate function for future
export async function getGeofencesReal(): Promise<any[]> {
  if (!isDbConnected()) return [];
  try {
    const rows = await executeQuery<any>('SELECT FenceID, FenceCode, FenceType, KeyPoints, Radius FROM fenceinfo ORDER BY FenceID DESC');
    return rows || [];
  } catch { return []; }
}

export function getAlerts(): AlertItem[] {
  return alertsState;
}
export async function getAlertsReal(): Promise<AlertItem[]> {
  if (!isDbConnected()) return [];
  try {
    const rows = await executeQuery<any>('SELECT ID, DeviceID, AlarmType, GPSTime, Latitude, Longitude, Speed FROM apc_ioalarm ORDER BY ID DESC LIMIT 50');
    if (!rows) return [];
    return rows.map((r: any) => ({
      id: String(r.ID),
      vehicleId: String(r.DeviceID),
      unitNumber: String(r.DeviceID),
      type: r.AlarmType === 18 ? 'geofence' : 'speeding',
      typeLabel: r.AlarmType === 18 ? 'Geocerca' : `Tipo ${r.AlarmType}`,
      title: `Alarma ${r.AlarmType} en ${r.DeviceID}`,
      description: `Evento registrado ${r.GPSTime}`,
      timestamp: r.GPSTime ? String(r.GPSTime) : new Date().toISOString(),
      severity: 'warning' as const,
      lat: r.Latitude || 0,
      lng: r.Longitude || 0,
      speed: r.Speed || 0,
      resolved: false,
    }));
  } catch { return []; }
}

export function getLibrary(): LibraryRecord[] {
  // Real library via 12058 proxy (/api/video/calendar + filelist); return empty to avoid hardcode perception
  // Keep fallback empty array for production; frontend will show "sin datos" instead of mock 2026-08-18
  return [];
}

export function getDownloads(): DownloadJob[] {
  return [];
}

export function addDownloadJob(unitNumber: string, title: string, type: DownloadJob['type']): DownloadJob {
  const newJob: DownloadJob = {
    id: `dl-${Date.now()}`,
    title,
    unitNumber,
    type,
    status: 'downloading',
    progress: 15,
    size: '12.4 MB',
    createdAt: formatQuito(new Date())
  };
  downloadsState.unshift(newJob);
  const interval = setInterval(() => {
    const job = downloadsState.find(j => j.id === newJob.id);
    if (job) {
      job.progress = Math.min(100, job.progress + 25);
      if (job.progress >= 100) {
        job.status = 'completed';
        job.downloadUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
        clearInterval(interval);
      }
    } else {
      clearInterval(interval);
    }
  }, 1000);
  return newJob;
}

export function resolveAlert(alertId: string): boolean {
  const alert = alertsState.find(a => a.id === alertId);
  if (alert) {
    alert.resolved = true;
    return true;
  }
  return false;
}

export { getGpsTrackHistory } from './mock-data';
