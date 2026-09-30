import { registerAccountProfile } from './server/account-profile';
import express from 'express';
import { registerAdminDownloader } from './server/admin-downloader';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import CryptoJS from 'crypto-js';
import http from 'http';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { CeibaLiveFlv } from './server/live-flv';
import { downloaderBase, publicPath, getDownloaderVehicles, downloaderToken } from './server/nacional-access';
import { getNationalDispatchReport } from './server/nacional-dispatch';
import { initDbPool, testConnectionAndSchema, getDbConfig, isDbConnected, getDbLastError, executeQuery, ensureTrackerEventsTable } from './server/db';
import {
  startTelemetrySimulation,
  getVehicles,
  getVehicleById,
  getGeofences,
  getAlerts,
  getLibrary,
  getDownloads,
  addDownloadJob,
  resolveAlert
} from './server/ceiba-service';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error('Missing required environment variable: ' + name);
  return value;
}

const PORT = parseInt(process.env.PORT || '3000', 10);
const PORT_ALIAS = parseInt(process.env.PORT_ALIAS || '0', 10);
const APK_VERSIONS_DIR = process.env.APK_VERSIONS_DIR || 'C:/customserviciosrs/versiones';
const JWT_SECRET = requireEnv('JWT_SECRET');
const DES_KEY = requireEnv('DES_KEY');
const DES_IV = requireEnv('DES_IV');

function desEncrypt(str: string) {
  const keyUtf8 = CryptoJS.enc.Utf8.parse(DES_KEY);
  const ivUtf8 = CryptoJS.enc.Utf8.parse(DES_IV);
  const encrypted = CryptoJS.DES.encrypt(str, keyUtf8, { iv: ivUtf8, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
  return encrypted.ciphertext.toString(CryptoJS.enc.Base64);
}

function formatQuitoDate(date: Date): string {
  return date.toLocaleString('sv-SE', { timeZone: 'America/Guayaquil' });
}

const CHANNEL_FALLBACK_CACHE: Record<number, string> = {};
let dispatchSchedulesReady = false;

function searchChannelInDir(baseDir: string, channelNum: number): string | null {
  if (!fs.existsSync(baseDir)) return null;
  const stack = [baseDir];
  const candidateFiles: { file: string; size: number; mtime: number }[] = [];
  const chPattern = new RegExp(`12k40${channelNum}`, 'i');

  while (stack.length > 0) {
    const dir = stack.pop()!;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          stack.push(p);
        } else if (e.isFile() && e.name.endsWith('.mp4')) {
          if (chPattern.test(e.name)) {
            try {
              const st = fs.statSync(p);
              if (st.size > 50000) {
                candidateFiles.push({ file: p, size: st.size, mtime: st.mtimeMs });
              }
            } catch {}
          }
        }
      }
    } catch {}
  }

  if (candidateFiles.length > 0) {
    candidateFiles.sort((a, b) => b.mtime - a.mtime || b.size - a.size);
    return candidateFiles[0].file;
  }
  return null;
}

function findVideoFileForVehicleChannel(unitNumber: string, channelNum: number, allowGlobal = false): string | null {
  // 1. Carpeta específica de la unidad en C:/Video
  const specificDir = path.join('C:/Video', unitNumber);
  const foundSpecific = searchChannelInDir(specificDir, channelNum);
  if (foundSpecific) return foundSpecific;

  // 2. Variante de placa sin prefijo (ej. LAA4015 de 03_LAA4015)
  const plateOnly = unitNumber.includes('_') ? unitNumber.split('_')[1] : unitNumber;
  const plateDir = path.join('C:/Video', plateOnly);
  const foundPlate = searchChannelInDir(plateDir, channelNum);
  if (foundPlate) return foundPlate;

  // The global fallback may point to another vehicle's footage; only admins may use it.
  if (!allowGlobal) return null;
  // 3. Cache en memoria del canal
  if (CHANNEL_FALLBACK_CACHE[channelNum] && fs.existsSync(CHANNEL_FALLBACK_CACHE[channelNum])) {
    return CHANNEL_FALLBACK_CACHE[channelNum];
  }

  // 4. Búsqueda global en C:/Video para el canal MDVR correspondiente
  const globalFound = searchChannelInDir('C:/Video', channelNum);
  if (globalFound) {
    CHANNEL_FALLBACK_CACHE[channelNum] = globalFound;
    return globalFound;
  }

  return null;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 'loopback');
  app.use(express.json());

  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('ETag', `"${Date.now()}-${Math.random()}"`);
    next();
  });

  // Public update channel kept separate from the fleet and GPS APIs.
  app.use('/updates', express.static(APK_VERSIONS_DIR, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.apk')) {
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', 'attachment');
      }
    }
  }));

  app.get('/api/updates/ceiba2.json', (req, res) => {
    res.sendFile(path.join(APK_VERSIONS_DIR, 'ceiba2.json'));
  });

  app.get('/api/updates/:file', (req, res) => {
    const file = req.params.file;
    if (!/^Ceiba2-CustomServiciosRS-[0-9]+\.[0-9]+\.apk$/.test(file)) {
      return res.status(404).end();
    }
    res.sendFile(path.join(APK_VERSIONS_DIR, file));
  });

  if (!await initDbPool()) throw new Error('No se pudo conectar al CMS local');
  if (!await ensureTrackerEventsTable()) throw new Error('No se pudo preparar la base de eventos');
  if (await ensureDispatchSchedules() === null) throw new Error('No se pudo preparar la base de despachos');
  startTelemetrySimulation();

  app.get('/api/health', (req, res) => {
    const config = getDbConfig();
    const quitoNow = new Date().toLocaleString('sv-SE', { timeZone: 'America/Guayaquil' });
    res.json({
      status: 'ok',
      service: 'CustomServiciosRS Fleet Server',
      database: {
        connected: isDbConnected(),
        host: config.host,
        port: config.port,
        db: config.database,
        error: getDbLastError()
      },
      ceibaGateway: {
        serverIp: process.env.CEIBA_SERVER_IP || '127.0.0.1',
        httpPort: process.env.CEIBA_WEB_PORT || '12056',
        streamPort: process.env.CEIBA_FLV_PORT || '12060',
        mediaPort: process.env.CEIBA_TRANSMIT_PORT || '17891',
        protocol: 'WCMS5 / HTTP-FLV (H.264 + AAC)',
        liveProxyVersion: 2
      },
      timestamp: quitoNow,
      timestampQuito: quitoNow,
      timestampUTC: new Date().toISOString(),
      timezone: 'America/Guayaquil'
    });
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const upstream = await fetch(downloaderBase + '/api/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': req.ip || '127.0.0.1' },
        body: JSON.stringify(req.body), signal: AbortSignal.timeout(10000)
      });
      const body = await upstream.json();
      if (!upstream.ok || body.code !== 200) return res.status(upstream.status).json({ ...body, result: false });
      return res.json({ code: 200, result: true, token: body.token,
        user: { uid: body.user.uid, roleid: body.user.rid, account: body.user.account } });
    } catch { return res.status(503).json({ code: 503, result: false, error: 'El CMS no esta disponible' }); }
  });

  app.get('/api/auth/verify', (req, res) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
    if (!token) return res.status(401).json({ code: 401, error: 'No token' });
    try {
      const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      res.json({ code: 200, user: payload });
    } catch {
      return res.status(401).json({ code: 401, error: 'Invalid token' });
    }
  });

  function readAuthToken(req: express.Request) {
    const auth = String(req.headers.authorization || '');
    return auth.startsWith('Bearer ') ? auth.slice(7) : String(req.query.access_token || '');
  }

  async function getAuthorizedDeviceIds(uid: number, rid: number): Promise<Set<string> | null> {
    try { return new Set((await getDownloaderVehicles(uid, rid, JWT_SECRET)).map(v => v.deviceno)); }
    catch { return null; }
  }

  async function getAuthorizedVehicles(req: express.Request) {
    try {
      const payload: any = jwt.verify(readAuthToken(req), JWT_SECRET, { algorithms: ['HS256'] });
      const permitted = await getDownloaderVehicles(Number(payload.uid), Number(payload.rid), JWT_SECRET);
      const byId = new Map(permitted.map(v => [String(v.id), v]));
      return (await getVehicles()).flatMap(vehicle => {
        const permission = byId.get(String(vehicle.id));
        if (!permission) return [];
        const channels = permission.channels.map(c => vehicle.channels.find(v => v.channelNumber === Number(c.id)) || {
          id: Number(c.id), channelNumber: Number(c.id), name: c.name || `Camara ${c.id}`,
          status: vehicle.status === 'offline' ? 'offline' as const : 'buffering' as const,
          resolution: '', fps: 0, bitrate: '',
        });
        return [{ ...vehicle, channels, camerasTotal: channels.length,
          camerasOnline: `${vehicle.status === 'offline' ? 'MDVR desconectado' : 'MDVR conectado'} · ${channels.length} canales autorizados` }];
      });
    } catch { return null; }
  }

  async function requireAppAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const token = readAuthToken(req);
    if (!token) return res.status(401).json({ code: 401, error: 'Inicie sesión' });
    try {
      const payload: any = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      if (!Number.isInteger(Number(payload.uid)) || !Number.isInteger(Number(payload.rid))) throw new Error('invalid user');
      res.locals.auth = { uid: Number(payload.uid), rid: Number(payload.rid) };
      next();
    } catch {
      return res.status(401).json({ code: 401, error: 'Sesión inválida o expirada' });
    }
  }

  registerAccountProfile(app, JWT_SECRET);
  registerAdminDownloader(app, JWT_SECRET, requireAppAuth);

  // Apply Ceiba II account permissions to every fleet endpoint below.
  app.use('/api', requireAppAuth);
  const adminOnly: express.RequestHandler = (_req, res, next) =>
    Number(res.locals.auth?.rid) === 1 ? next() : res.status(403).json({ error: 'Solo el administrador puede acceder a este recurso' });
  async function authorizedUnits(req: express.Request, res: express.Response) {
    const vehicles = await getAuthorizedVehicles(req);
    if (!vehicles) {
      res.status(503).json({ error: 'No se pudieron consultar los permisos de Ceiba II' });
      return null;
    }
    res.locals.authorizedVehicleIds = vehicles.map(vehicle => String(vehicle.id));
    return new Set(vehicles.map(vehicle => vehicle.unitNumber));
  }

  async function ensureDispatchSchedules() {
    if (dispatchSchedulesReady) return [];
    const result = await executeQuery(`CREATE TABLE IF NOT EXISTS dispatch_schedules (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      vehicle_id VARCHAR(64) NOT NULL,
      unit_number VARCHAR(64) NOT NULL,
      fence_id VARCHAR(64) NOT NULL,
      fence_name VARCHAR(255) NOT NULL,
      due_at DATETIME NOT NULL,
      rate DECIMAL(8,2) NOT NULL DEFAULT 0.50,
      created_by BIGINT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_dispatch_schedule_unit_due (unit_number, due_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    dispatchSchedulesReady = result !== null;
    return result;
  }
  app.get('/api/dispatch/fences', async (_req, res) => {
    try { res.json((await getGeofences()).map(fence => ({ id: fence.id, name: fence.name }))); }
    catch { res.status(503).json({ error: 'Geocercas no disponibles' }); }
  });
  app.post('/api/dispatch/schedules', async (req, res) => {
    const vehicles = await getAuthorizedVehicles(req);
    if (!vehicles) return res.status(503).json({ error: 'Permisos no disponibles' });
    const vehicle = vehicles.find(item => String(item.id) === String(req.body?.vehicleId || ''));
    if (!vehicle) return res.status(403).json({ error: 'Sin permiso para esta unidad' });
    const fence = (await getGeofences()).find(item => item.id === String(req.body?.fenceId || ''));
    if (!fence) return res.status(400).json({ error: 'Selecciona una geocerca valida' });
    const dueAt = String(req.body?.date || '') + ' ' + String(req.body?.time || '') + ':00';
    const rate = Number(req.body?.rate);
    if (!/^\d{4}-\d{2}-\d{2} ([01]\d|2[0-3]):[0-5]\d:00$/.test(dueAt) ||
        !Number.isFinite(Date.parse(dueAt.replace(' ', 'T') + '-05:00')) ||
        !Number.isFinite(rate) || rate < 0 || rate > 100)
      return res.status(400).json({ error: 'Fecha, hora o tarifa invalida' });
    if (await ensureDispatchSchedules() === null) return res.status(503).json({ error: 'No se pudo preparar la programacion' });
    const saved = await executeQuery('INSERT INTO dispatch_schedules (vehicle_id, unit_number, fence_id, fence_name, due_at, rate, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [vehicle.id, vehicle.unitNumber, fence.id, fence.name, dueAt, rate, Number(res.locals.auth.uid)]);
    if (saved === null) return res.status(503).json({ error: 'No se pudo guardar el despacho' });
    return res.status(201).json({ saved: true });
  });
  app.get('/api/dispatch/schedules', async (req, res) => {
    const vehicles = await getAuthorizedVehicles(req);
    if (!vehicles) return res.status(503).json({ error: 'Permisos no disponibles' });
    const vehicle = vehicles.find(item => String(item.id) === String(req.query.vehicleId || ''));
    if (!vehicle) return res.status(403).json({ error: 'Sin permiso para esta unidad' });
    const date = String(req.query.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Fecha invalida' });
    if (await ensureDispatchSchedules() === null) return res.status(503).json({ error: 'Programacion no disponible' });
    const rows = await executeQuery<any>(`SELECT id, fence_name, DATE_FORMAT(due_at, '%Y-%m-%d %H:%i:%s') AS due_at, rate FROM dispatch_schedules WHERE vehicle_id = ? AND due_at >= ? AND due_at < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY due_at`,
      [vehicle.id, date + ' 00:00:00', date + ' 00:00:00']);
    if (rows === null) return res.status(503).json({ error: 'No se pudo leer la programacion' });
    const schedules = await Promise.all(rows.map(async row => {
      const due = String(row.due_at);
      const crossings = await executeQuery<any>(`SELECT DATE_FORMAT(event_time, '%Y-%m-%d %H:%i:%s') AS event_time, meta FROM tracker_events WHERE vehicle_id = ? AND event_type = 'geofence_entry'
        AND event_time BETWEEN DATE_SUB(?, INTERVAL 30 MINUTE) AND DATE_ADD(?, INTERVAL 24 HOUR) ORDER BY event_time ASC`, [vehicle.id, due, due]);
      if (crossings === null) throw new Error('No se pudieron consultar los eventos');
      const crossing = crossings.find(event => { try { return JSON.parse(event.meta || '{}').to === row.fence_name; } catch { return false; } });
      const arrived = crossing?.event_time || null;
      const arrival = arrived ? String(arrived) : null;
      const delayMinutes = arrival ? Math.max(0, Math.ceil((Date.parse(arrival.replace(' ', 'T') + '-05:00') - Date.parse(due.replace(' ', 'T') + '-05:00')) / 60000)) : null;
      return { id: row.id, fenceName: row.fence_name, dueAt: due, arrival, delayMinutes, rate: Number(row.rate), fine: delayMinutes == null ? 0 : Math.round(delayMinutes * Number(row.rate) * 100) / 100 };
    })).catch(() => null);
    if (!schedules) return res.status(503).json({ error: 'No se pudo consultar la programacion' });
    return res.json({ schedules });
  });

  app.get('/api/dispatch/report', async (req, res) => {
    const date = String(req.query.date || '');
    const vehicleId = String(req.query.vehicleId || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date + 'T12:00:00Z')))
      return res.status(400).json({ error: 'Fecha inválida' });
    const vehicles = await getAuthorizedVehicles(req);
    if (!vehicles) return res.status(503).json({ error: 'No se pudieron consultar los permisos de Ceiba II' });
    const vehicle = vehicles.find(item => String(item.id) === vehicleId);
    if (!vehicle) return res.status(403).json({ error: 'Sin permiso para esta unidad' });
    try { res.json({ unitNumber: vehicle.unitNumber, date, report: await getNationalDispatchReport(vehicle, date) }); }
    catch { res.status(502).json({ error: 'No se pudo consultar el historial de geocercas del CMS' }); }
  });

  // Historical positions come from the CMS GPS archive, never from mock-data.
  app.get('/api/recorrido/history', async (req, res) => {
    const vehicleId = String(req.query.vehicleId || '');
    const fromDate = String(req.query.fromDate || '');
    const toDate = String(req.query.toDate || '');
    const fromTime = String(req.query.fromTime || '00:00');
    const toTime = String(req.query.toTime || '23:59');
    const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value + 'T12:00:00Z')) &&
      new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
    if (!validDate(fromDate) || !validDate(toDate) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(fromTime) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(toTime))
      return res.status(400).json({ error: 'Fecha u hora inválida' });
    const start = Date.parse(fromDate + 'T' + fromTime + ':00-05:00');
    const end = Date.parse(toDate + 'T' + toTime + ':59-05:00');
    if (end < start || end - start > 7 * 24 * 3600_000)
      return res.status(400).json({ error: 'Selecciona un rango de hasta 7 días' });
    const vehicles = await getAuthorizedVehicles(req);
    if (!vehicles) return res.status(503).json({ error: 'No se pudieron comprobar los permisos de Ceiba II' });
    const vehicle = vehicles.find(item => String(item.id) === vehicleId);
    if (!vehicle) return res.status(403).json({ error: 'Sin permiso para esta unidad' });
    const dbRows = await executeQuery<any>('SELECT deviceid FROM vehicledevice WHERE id = ? LIMIT 1', [vehicleId]);
    const deviceId = dbRows?.[0]?.deviceid && String(dbRows[0].deviceid);
    if (!deviceId) return res.status(503).json({ error: 'No se pudo identificar la unidad en el CMS' });
    const dateTime = (ms: number) => formatQuitoDate(new Date(ms));
    const positions: any[] = [];
    try {
      // Short requests avoid overloading the archive on multi-day queries.
      for (let cursor = start; cursor <= end; cursor += 4 * 3600_000 + 1000) {
        const until = Math.min(cursor + 4 * 3600_000, end);
        const url = 'http://127.0.0.1:' + (process.env.CEIBA_GPS_HISTORY_PORT || '12040') +
          '/gps/' + encodeURIComponent(deviceId) + '/' +
          encodeURIComponent(dateTime(cursor)) + '/' + encodeURIComponent(dateTime(until));
        const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error('El archivo GPS de Ceiba II no está disponible');
        const raw: any = await response.json();
        if (!Array.isArray(raw)) throw new Error('El CMS devolvió un historial GPS inválido');
        for (const item of raw) {
          const time = String(item.GpsTime || '');
          const stamp = Date.parse(time.replace(' ', 'T') + '-05:00');
          const lat = Number(item.GpsLat), lng = Number(item.GpsLng);
          if (String(item.TerminalID) !== deviceId || !Number.isFinite(stamp) || stamp < start || stamp > end ||
              !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 ||
              (lat === 0 && lng === 0)) continue;
          positions.push({ time, stamp, lat, lng,
            speed: Number.isFinite(Number(item.Speed)) ? Number(item.Speed) : null,
            heading: Number.isFinite(Number(item.Direction)) ? Number(item.Direction) : null });
        }
        if (positions.length > 150000) return res.status(413).json({ error: 'Demasiadas posiciones; reduce el horario' });
      }
      positions.sort((a, b) => a.stamp - b.stamp);
      const deduped = positions.filter((point, i) => i === 0 ||
        point.stamp !== positions[i - 1].stamp ||
        point.lat !== positions[i - 1].lat || point.lng !== positions[i - 1].lng);
      // Every displayed point is a genuine CMS record; longer tracks use a subset.
      const stride = Math.max(1, Math.ceil(deduped.length / 8000));
      const points = deduped.filter((_, i) => i % stride === 0 || i === deduped.length - 1);
      res.json({ unitNumber: vehicle.unitNumber, from: dateTime(start), to: dateTime(end),
        totalRecords: deduped.length, sampled: stride > 1, points });
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'No se pudo obtener el historial GPS' });
    }
  });

  app.get('/api/recorrido/availability', async (req, res) => {
    const date = String(req.query.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(date + 'T12:00:00Z')) ||
        new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date)
      return res.status(400).json({ error: 'Fecha inválida' });
    const vehicles = await getAuthorizedVehicles(req);
    if (!vehicles) return res.status(503).json({ error: 'No se pudieron comprobar los permisos de Ceiba II' });
    if (!vehicles.length) return res.json({ date, days: [] });
    const ids = vehicles.map(v => String(v.id));
    const rows = await executeQuery<any>('SELECT id, deviceid FROM vehicledevice WHERE id IN (' + ids.map(() => '?').join(',') + ')', ids);
    if (!rows) return res.status(503).json({ error: 'No se pudieron consultar las unidades del CMS' });
    const byDevice = new Map(rows.map(row => [String(row.deviceid), String(row.id)]));
    const start = new Date(date + 'T12:00:00Z');
    start.setUTCDate(start.getUTCDate() - 6);
    try {
      const response = await fetch('http://127.0.0.1:' + (process.env.CEIBA_GPS_HISTORY_PORT || '12040') + '/gps/outlines', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ terminals: Array.from(byDevice.keys()).join(','), startdate: start.toISOString().slice(0, 10), enddate: date }),
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw new Error('El índice GPS no está disponible');
      const body: any = await response.json();
      if (body.errorcode !== 0 || !Array.isArray(body.data)) throw new Error('El CMS no entregó el índice GPS');
      const days = body.data.flatMap((row: any) => {
        const vehicleId = byDevice.get(String(row.terid));
        return vehicleId && /^\d{4}-\d{2}-\d{2}$/.test(String(row.day)) ?
          [{ vehicleId, date: String(row.day), count: Math.max(0, Number(row.count) || 0) }] : [];
      });
      res.json({ date, days });
    } catch (error: any) { res.status(502).json({ error: error.message || 'No se pudo consultar el índice GPS' }); }
  });

  app.get('/api/vehicles', requireAppAuth, async (req, res) => {
    try {
      const vehicles = await getAuthorizedVehicles(req);
      if (!vehicles) return res.status(503).json({ error: 'No se pudieron obtener los permisos de Ceiba II' });
      res.json(vehicles);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/vehicles/:id', requireAppAuth, async (req, res) => {
    if (isDbConnected()) await getVehicles();
    const vehicles = await getAuthorizedVehicles(req);
    const vehicle = vehicles?.find(item => String(item.id) === String(req.params.id));
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado o sin permisos' });
    }
    res.json(vehicle);
  });

  async function proxyToMedia(req: express.Request, res: express.Response, targetBase: string) {
    const targetUrl = targetBase + req.originalUrl.replace(/^\/(live|hls)/, '/live');
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    try {
      const upstream = await fetch(targetUrl, { headers: { 'Accept': req.headers.accept || '*/*' }, signal: controller.signal } as any);
      clearTimeout(t);
      res.status(upstream.status);
      upstream.headers.forEach((v, k) => {
        if (['content-type','content-length','cache-control','access-control-allow-origin','accept-ranges','content-range'].includes(k.toLowerCase())) res.setHeader(k, v);
      });
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (upstream.body) {
        const { Readable } = await import('stream');
        Readable.fromWeb(upstream.body as any).pipe(res);
      } else {
        res.end();
      }
    } catch (e: any) {
      clearTimeout(t);
      const isAbort = e.name === 'AbortError';
      res.status(isAbort ? 504 : 502).json({ error: isAbort ? 'Media gateway timeout' : 'Media proxy failed: ' + e.message, target: targetUrl });
    }
  }

  function wcmsLiveToken(uid = 1, rid = 1) {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const value = `wcms4.0|${rid}|${uid}|${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    return encodeURIComponent(desEncrypt(value));
  }

  async function requireLiveAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const token = readAuthToken(req);
    if (!token) return res.status(401).json({ error: 'Inicie sesión para ver video en vivo' });
    try {
      const payload: any = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      if (typeof payload === 'string' || !Number.isInteger(Number(payload.uid)) || Number(payload.uid) <= 0 ||
          !Number.isInteger(Number(payload.rid)) || Number(payload.rid) <= 0) {
        return res.status(403).json({ error: 'Se requiere una cuenta del CMS para ver video en vivo' });
      }
      if (payload.live && (String(payload.vehicleId) !== String(req.params.id) || Number(payload.channel) !== Number(req.params.channel))) {
        return res.status(403).json({ error: 'Autorización de video inválida para este canal' });
      }
      res.locals.liveUser = { uid: Number(payload.uid), rid: Number(payload.rid) };
      const ids = await getAuthorizedDeviceIds(res.locals.liveUser.uid, res.locals.liveUser.rid);
      const row = await executeQuery<any>('SELECT deviceid FROM vehicledevice WHERE id = ? LIMIT 1', [req.params.id]);
      if (!ids || !row?.[0]?.deviceid || !ids.has(String(row[0].deviceid))) {
        return res.status(403).json({ error: 'No tiene permiso para esta unidad' });
      }
      next();
    } catch {
      return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }
  }

  async function proxyLiveFlv(req: express.Request, res: express.Response, vehicle: any, channelNum: number) {
    const { uid, rid } = res.locals.liveUser;
    const requestAudio = String(req.query.audio ?? '1') !== '0';
    const streamType = String(req.query.stream ?? '1') === '0' ? '0' : '1';
    const query = new URLSearchParams({
      key: wcmsLiveToken(uid, rid),
      terid: String(vehicle.deviceId),
      chl: String(channelNum),
      audio: requestAudio ? '1' : '0',
      st: streamType,
      port: String(process.env.CEIBA_FLV_PORT || '12060'),
      dt: 'mdvr'
    });
    const infoUrl = `http://127.0.0.1:${process.env.CEIBA_WEB_PORT || '12056'}/api/v1/basic/live/video?${query}`;
    const controller = new AbortController();
    let timeout = setTimeout(() => controller.abort(new Error('Tiempo de espera del CMS agotado')), 20000);
    const touch = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => controller.abort(new Error('El CMS dejó de enviar datos')), 25000);
    };
    const onClose = () => controller.abort();
    res.on('close', onClose);
    try {
      const info = await fetch(infoUrl, { signal: controller.signal });
      const body: any = await info.json();
      if (!info.ok || body.errorcode !== 200 || !body.data?.url) {
        return res.status(502).json({ error: 'Ceiba II no pudo iniciar el video en vivo', ceibaError: body.errorcode });
      }
      const liveUrl = new URL(body.data.url);
      liveUrl.hostname = '127.0.0.1';
      liveUrl.searchParams.set('svrid', '127.0.0.1');
      liveUrl.searchParams.set('svrport', String(process.env.CEIBA_TRANSMIT_PORT || '17891'));
      liveUrl.searchParams.set('guid', crypto.randomUUID());
      const upstream = await fetch(liveUrl, {
        headers: { Accept: 'video/x-flv, application/octet-stream' },
        signal: controller.signal
      } as any);
      if (!upstream.ok) {
        const detail = await upstream.text().catch(() => '');
        return res.status(502).json({
          error: 'Ceiba II no entregó video en vivo',
          upstreamStatus: upstream.status,
          detail: detail.slice(0, 300)
        });
      }
      if (!upstream.body) return res.status(502).json({ error: 'El CMS no entregó datos de video' });
      touch();
      res.status(upstream.status);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/x-flv');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Connection', 'keep-alive');
      // Propagate backpressure and dispose the upstream on disconnect or idle timeout.
      const activity = new Transform({ transform(chunk, _encoding, done) { touch(); done(null, chunk); } });
      await pipeline(Readable.fromWeb(upstream.body as any), activity, new CeibaLiveFlv(), res, { signal: controller.signal });
    } catch (e: any) {
      if (!res.headersSent && !res.destroyed) res.status(controller.signal.aborted ? 504 : 502).json({
        error: 'Error conectando al stream Ceiba II', detail: controller.signal.reason?.message || e.message
      });
      else if (!res.destroyed) res.destroy();
    } finally {
      clearTimeout(timeout);
      controller.abort();
      res.off('close', onClose);
    }
  }

  app.get(/^\/live\/.*/, requireAppAuth, adminOnly, async (req, res) => { await proxyToMedia(req, res, 'http://127.0.0.1:8090'); });
  app.get(/^\/hls\/.*/, requireAppAuth, adminOnly, async (req, res) => { await proxyToMedia(req, res, 'http://127.0.0.1:8090'); });
  app.get('/api/vehicles/:id/live/:channel', requireLiveAuth, async (req, res) => {
    const vehicles = await getAuthorizedVehicles(req);
    const vehicle: any = vehicles?.find(item => String(item.id) === String(req.params.id));
    if (!vehicle) return res.status(404).json({ error: 'Vehículo no encontrado' });
    const channelNum = Number(req.params.channel);
    if (!Number.isInteger(channelNum) || !vehicle.channels.some((c: any) => c.channelNumber === channelNum)) {
      return res.status(400).json({ error: 'Canal inválido o deshabilitado' });
    }
    try {
      const rows = await executeQuery<any>('SELECT deviceid FROM vehicledevice WHERE id = ? LIMIT 1', [vehicle.id]);
      if (!rows?.[0]?.deviceid) return res.status(503).json({ error: 'No se encontró el identificador MDVR en el CMS' });
      await proxyLiveFlv(req, res, { ...vehicle, deviceId: rows[0].deviceid }, channelNum);
    } catch (e: any) {
      if (!res.headersSent) res.status(502).json({ error: 'Error conectando al video en vivo', detail: e.message });
    }
  });

  app.get('/api/vehicles/:id/latest-video/:channel', requireAppAuth, async (req, res) => {
    const vehicles = await getAuthorizedVehicles(req);
    const vehicle = vehicles?.find(item => String(item.id) === String(req.params.id));
    if (!vehicle) return res.status(404).json({ error: 'Vehículo no encontrado' });
    const ch = Number(req.params.channel);
    if (!Number.isInteger(ch) || !vehicle.channels.some(c => c.channelNumber === ch)) return res.status(403).json({ error: 'Canal sin permiso' });
    try {
      const videoPath = findVideoFileForVehicleChannel(vehicle.unitNumber, ch, Number(res.locals.auth?.rid) === 1);
      if (!videoPath || !fs.existsSync(videoPath)) {
        return res.status(404).json({ error: `Sin video disponible para canal ${ch}` });
      }

      const stat = fs.statSync(videoPath);
      const range = req.headers.range;
      const ext = path.extname(videoPath).toLowerCase();
      const ct = ext === '.mp4' ? 'video/mp4' : 'video/h264';
      
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunksize = end - start + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': ct
        });
        fs.createReadStream(videoPath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': stat.size,
          'Content-Type': ct,
          'Accept-Ranges': 'bytes'
        });
        fs.createReadStream(videoPath).pipe(res);
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/vehicles/:id/video-stream/:channel', requireLiveAuth, async (req, res) => {
    const vehicles = await getAuthorizedVehicles(req);
    const vehicle = vehicles?.find(item => String(item.id) === String(req.params.id));
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    const channelNum = Number(req.params.channel);
    const channel = vehicle.channels.find(c => c.channelNumber === channelNum);
    if (!Number.isInteger(channelNum) || !channel) return res.status(400).json({ error: 'Canal inválido o deshabilitado' });

    let deviceId: string | null = null;
    try {
      if (isDbConnected()) {
        const rows = await executeQuery<any>('SELECT deviceid FROM vehicledevice WHERE id = ? LIMIT 1', [vehicle.id]);
        if (rows && rows[0] && rows[0].deviceid) deviceId = String(rows[0].deviceid);
      }
    } catch {}
    if (!deviceId) return res.status(503).json({ error: 'No se encontró el identificador MDVR en el CMS' });
    const requestAudio = String(req.query.audio ?? '1') === '1';
    const streamType = String(req.query.stream ?? '1') === '0' ? '0' : '1';
    const liveUrl = `/api/vehicles/${vehicle.id}/live/${channelNum}`;
    const streamToken = jwt.sign(
      { uid: res.locals.liveUser.uid, rid: res.locals.liveUser.rid, live: true, vehicleId: String(vehicle.id), channel: channelNum },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '2m' }
    );
    const flvUrl = `${publicPath}${liveUrl}?audio=${requestAudio ? '1' : '0'}&stream=${streamType}&access_token=${encodeURIComponent(streamToken)}`;

    res.json({
      vehicleId: vehicle.id,
      unitNumber: vehicle.unitNumber,
      deviceId: deviceId,
      channelNumber: channelNum,
      channelName: channel?.name || `CH${channelNum}`,
      protocol: 'Ceiba II WCMS5 live FLV',
      flvUrl,
      audioUrl: requestAudio ? flvUrl : undefined,
      live: true,
      gateway: { wcmsPort: Number(process.env.CEIBA_WEB_PORT || 12056), flvPort: Number(process.env.CEIBA_FLV_PORT || 12060), gtPort: Number(process.env.CEIBA_TRANSMIT_PORT || 17891) },
      status: channel?.status || 'live'
    });
  });

  app.get('/api/geofences', async (_req, res) => {
    try { res.json(await getGeofences()); }
    catch { res.status(503).json({ error: 'No se pudieron cargar las geocercas' }); }
  });
  app.get('/api/alerts', async (req, res) => {
    const vehicles = await getAuthorizedVehicles(req);
    if (!vehicles) return res.status(503).json({ error: 'No se pudieron consultar los permisos de Ceiba II' });
    const ids = new Set(vehicles.map(vehicle => String(vehicle.id)));
    res.json(getAlerts().filter(alert => ids.has(String(alert.vehicleId))));
  });
  app.get('/api/gps-track/:unitId', (_req, res) => {
    res.status(410).json({ error: 'El historial de prueba fue retirado. Use /api/recorrido/history para consultar posiciones reales del CMS.' });
  });

  app.get('/api/tracker/events', async (req, res) => {
    try {
      const units = await authorizedUnits(req, res);
      if (!units) return;
      if (!units.size) return res.json([]);
      const query = String(req.query.query || '').trim();
      const unit = String(req.query.unit || '').trim();
      const plate = String(req.query.plate || '').trim();
      const from = String(req.query.from || '').trim();
      const to = String(req.query.to || '').trim();
      const limit = Math.min(parseInt(String(req.query.limit || '120'), 10) || 120, 500);
      const geofencesOnly = String(req.query.kind || '') === 'geofence';
      const beforeId = Number(req.query.beforeId || 0);
      const params: any[] = [];
      let sql = 'SELECT id, vehicle_id, unit_number, plate, event_type, title, description, event_time, lat, lng, speed, source, meta FROM tracker_events WHERE unit_number IN (' + Array.from(units).map(() => '?').join(',') + ')';
      params.push(...units);
      sql += ' AND vehicle_id IN (' + res.locals.authorizedVehicleIds.map(() => '?').join(',') + ')';
      params.push(...res.locals.authorizedVehicleIds);
      if (geofencesOnly) sql += " AND event_type IN ('geofence_entry', 'geofence_exit')";
      if (Number.isSafeInteger(beforeId) && beforeId > 0) { sql += ' AND id < ?'; params.push(beforeId); }
      if (query) {
        sql += ' AND (unit_number LIKE ? OR plate LIKE ? OR title LIKE ? OR description LIKE ?)';
        params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
      }
      if (unit) {
        sql += ' AND unit_number = ?';
        params.push(unit);
      }
      if (plate) {
        sql += ' AND plate = ?';
        params.push(plate);
      }
      if (from) {
        sql += ' AND event_time >= ?';
        params.push(from);
      }
      if (to) {
        sql += ' AND event_time <= ?';
        params.push(to);
      }
      if (String(req.query.count || '') === '1') {
        const countSql = sql.replace(/^SELECT .*? FROM tracker_events /, 'SELECT COUNT(*) AS total FROM tracker_events ');
        const counts = (await executeQuery<any>(countSql, params)) || [];
        return res.json({ total: Number(counts[0]?.total || 0) });
      }
      sql += ' ORDER BY event_time DESC, id DESC LIMIT ?';
      params.push(limit);
      const rows = (await executeQuery(sql, params)) || [];
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/tracker/chat', async (req, res) => {
    try {
      const units = await authorizedUnits(req, res);
      if (!units) return;
      const question = String(req.body?.question || '').trim();
      if (!question) return res.status(400).json({ error: 'Pregunta requerida' });

      const unitMatch = question.match(/\b\d{2}_[A-Z0-9]+\b/i);
      const unit = String(req.body?.unitNumber || '').trim().toUpperCase() || (unitMatch ? unitMatch[0].toUpperCase() : '');
      if (unit && !units.has(unit)) return res.status(403).json({ error: 'Sin permiso para esta unidad' });
      if (!units.size) return res.json({ reply: 'No tiene unidades autorizadas.', unitNumber: null, events: [] });
      const dateInput = String(req.body?.date || '').trim();
      const hourMatch = question.match(/(\d{1,2})[:.](\d{2})/);
      const meridiem = /\b(pm|p\.m\.|tarde|noche)\b/i.test(question) ? 'pm' : /\b(am|a\.m\.|mañana)\b/i.test(question) ? 'am' : '';
      const parsedHour = hourMatch ? Math.min(23, Math.max(0, parseInt(hourMatch[1], 10))) : new Date().getHours();
      const parsedMinute = hourMatch ? Math.min(59, Math.max(0, parseInt(hourMatch[2], 10))) : new Date().getMinutes();
      const targetHour = meridiem === 'pm' && parsedHour < 12 ? parsedHour + 12 : meridiem === 'am' && parsedHour === 12 ? 0 : parsedHour;
      const base = dateInput ? new Date(`${dateInput}T12:00:00`) : new Date();
      base.setHours(targetHour, parsedMinute, 0, 0);
      const from = formatQuitoDate(new Date(base.getTime() - 90 * 60 * 1000));
      const to = formatQuitoDate(new Date(base.getTime() + 120 * 60 * 1000));

      const params: any[] = [from, to];
      let sql = 'SELECT unit_number, plate, event_type, title, description, event_time, lat, lng, speed, source FROM tracker_events WHERE event_time BETWEEN ? AND ? AND unit_number IN (' + Array.from(units).map(() => '?').join(',') + ')';
      params.push(...units);
      sql += ' AND vehicle_id IN (' + res.locals.authorizedVehicleIds.map(() => '?').join(',') + ')';
      params.push(...res.locals.authorizedVehicleIds);
      if (unit) {
        sql += ' AND unit_number = ?';
        params.push(unit);
      }
      sql += ' ORDER BY event_time ASC LIMIT 20';
      const rows = (await executeQuery<any>(sql, params)) || [];
      const greeting = base.getHours() < 12 ? 'Buenos días' : base.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches';
      const targetUnit = unit || rows[0]?.unit_number || 'la unidad';
      const narration = rows.length > 0
        ? rows.map((r: any) => `${r.event_time} - ${r.title}: ${r.description}`).join(' ')
        : `No encontré eventos para ${targetUnit} en ese horario.`;

      res.json({
        reply: `${greeting}. ${narration}`,
        unitNumber: unit || rows[0]?.unit_number || null,
        events: rows
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/alerts/:id/resolve', adminOnly, (req, res) => {
    const success = resolveAlert(req.params.id);
    res.json({ success });
  });
  app.get('/api/library', async (req, res) => {
    const units = await authorizedUnits(req, res);
    if (units) res.json(getLibrary().filter(record => units.has(record.unitNumber)));
  });
  app.get('/api/downloads', async (req, res) => {
    const units = await authorizedUnits(req, res);
    if (units) res.json(getDownloads().filter(job => units.has(job.unitNumber)));
  });
  app.post('/api/downloads', async (req, res) => {
    const units = await authorizedUnits(req, res);
    if (!units) return;
    const { unitNumber, title, type } = req.body;
    if (!units.has(String(unitNumber))) return res.status(403).json({ error: 'Sin permiso para esta unidad' });
    const job = addDownloadJob(unitNumber, title || 'Descarga MDVR', type || 'video_mp4');
    res.json(job);
  });

  async function proxyTo12058(req: express.Request, res: express.Response) {

    const targetUrl = `${downloaderBase}${req.originalUrl}`;
    try {
      const headers: Record<string, string> = {};
      if (req.headers.authorization) headers['Authorization'] = req.headers.authorization as string;
      if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'] as string;
      if (req.headers['range']) headers['Range'] = req.headers['range'] as string;
      const fetchOpts: any = { method: req.method, headers };
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
        fetchOpts.body = JSON.stringify(req.body);
      }
      const proxied = await fetch(targetUrl, fetchOpts);
      res.status(proxied.status);
      const ct = proxied.headers.get('content-type');
      if (ct) res.setHeader('Content-Type', ct);
      const cr = proxied.headers.get('content-range');
      if (cr) res.setHeader('Content-Range', cr);
      const cl = proxied.headers.get('content-length');
      if (cl) res.setHeader('Content-Length', cl);
      const cd = proxied.headers.get('content-disposition');
      if (cd) res.setHeader('Content-Disposition', cd);
      const ar = proxied.headers.get('accept-ranges');
      if (ar) res.setHeader('Accept-Ranges', ar);
      const contentType = ct || '';
      if (proxied.body) Readable.fromWeb(proxied.body as any).pipe(res); else res.end();
    } catch (e: any) {
      console.error('[Proxy 12058] error:', e.message);
      res.status(502).json({ code: 502, error: 'Proxy to 12058 failed: ' + e.message });
    }
  }

  // Isolated API namespace used only by the copied downloader UI.
  app.use('/downloader-api', requireAppAuth, async (req, res) => {
    const targetUrl = `http://127.0.0.1:12058${req.originalUrl.replace(/^\/downloader-api/, '')}`;
    try {
      const headers: Record<string, string> = {};
      for (const name of ['authorization', 'content-type', 'range']) {
        const value = req.headers[name];
        if (value) headers[name] = String(value);
      }
      const options: any = { method: req.method, headers };
      if (!['GET', 'HEAD'].includes(req.method) && req.body && Object.keys(req.body).length) {
        headers['content-type'] ||= 'application/json';
        options.body = JSON.stringify(req.body);
      }
      const upstream = await fetch(targetUrl, options);
      res.status(upstream.status);
      upstream.headers.forEach((value, name) => {
        // Node fetch already decompresses upstream gzip responses.
        if (!['connection', 'transfer-encoding', 'content-encoding', 'content-length'].includes(name.toLowerCase())) res.setHeader(name, value);
      });
      if (upstream.body) {
        const { Readable } = await import('stream');
        Readable.fromWeb(upstream.body as any).pipe(res);
      } else res.end();
    } catch (e: any) {
      if (!res.headersSent) res.status(502).json({ code: 502, error: 'Downloader proxy failed: ' + e.message });
    }
  });

  app.get('/api/vehicles/:id/channels', async (req, res) => { await proxyTo12058(req, res); });
  app.post('/api/devices/status', async (req, res) => { await proxyTo12058(req, res); });
  app.get('/api/vehicles/:id/status', async (req, res) => { await proxyTo12058(req, res); });
  app.get('/api/video/calendar/:deviceNo', async (req, res) => { await proxyTo12058(req, res); });
  app.get('/api/video/filelist/:deviceNo', async (req, res) => { await proxyTo12058(req, res); });
  app.post('/api/download/create', async (req, res) => { await proxyTo12058(req, res); });
  app.get('/api/download/tasks', async (req, res) => { await proxyTo12058(req, res); });
  app.get('/api/download/file', async (req, res) => { await proxyTo12058(req, res); });
  app.get('/api/download/stream', async (req, res) => { await proxyTo12058(req, res); });
  app.delete('/api/download/task', async (req, res) => { await proxyTo12058(req, res); });
  app.post('/api/download/task', async (req, res) => { await proxyTo12058(req, res); });

  app.get('/api/stream/telemetry', requireAppAuth, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let closed = false;
    let timer: NodeJS.Timeout;
    const sendTelemetry = async () => {
      try {
        // An await may take longer than one interval; keep one request per connection.
        if (closed || res.destroyed) return;
        const vehicles = await getAuthorizedVehicles(req);
        if (closed || res.destroyed) return;
        if (vehicles && res.writableLength < 256 * 1024) {
          const timestamp = new Date().toLocaleString('sv-SE', { timeZone: 'America/Guayaquil' });
          res.write(`data: ${JSON.stringify({ type: 'telemetry_update', vehicles, timestamp })}\n\n`);
        }
      } catch (error) {
        if (!closed && !res.destroyed) res.write(': telemetry retry\n\n');
      } finally {
        if (!closed) timer = setTimeout(sendTelemetry, 2500);
      }
    };
    void sendTelemetry();
    req.on('close', () => {
      closed = true;
      clearTimeout(timer);
      res.end();
    });
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint API no encontrado' }));

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, process.env.BIND_HOST || '127.0.0.1', () => {
    console.log(`[CustomServiciosRS Server] Telematics & Video Gateway running on http://0.0.0.0:${PORT}`);
  });
  if (PORT_ALIAS > 0 && PORT_ALIAS !== PORT) {
    app.listen(PORT_ALIAS, '0.0.0.0', () => {
      console.log(`[CustomServiciosRS Server] Alias activo en http://0.0.0.0:${PORT_ALIAS}`);
    });
  }
}

startServer();