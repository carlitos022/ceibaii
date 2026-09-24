import express from 'express';
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
import { createServer as createViteServer } from 'vite';
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
  resolveAlert,
  getGpsTrackHistory
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
const AUTHORIZED_DEVICE_CACHE = new Map<string, { expires: number; ids: Set<string> }>();

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

function findVideoFileForVehicleChannel(unitNumber: string, channelNum: number): string | null {
  // 1. Carpeta específica de la unidad en C:/Video
  const specificDir = path.join('C:/Video', unitNumber);
  const foundSpecific = searchChannelInDir(specificDir, channelNum);
  if (foundSpecific) return foundSpecific;

  // 2. Variante de placa sin prefijo (ej. LAA4015 de 03_LAA4015)
  const plateOnly = unitNumber.includes('_') ? unitNumber.split('_')[1] : unitNumber;
  const plateDir = path.join('C:/Video', plateOnly);
  const foundPlate = searchChannelInDir(plateDir, channelNum);
  if (foundPlate) return foundPlate;

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

  await initDbPool();
  await ensureTrackerEventsTable().catch(() => {});
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

  app.post('/api/test-db', async (req, res) => {
    const result = await testConnectionAndSchema();
    res.json(result);
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.json({ code: 201, error: 'Missing credentials' });

      if (isDbConnected()) {
        try {
          const sha1pwd = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
          const despwd = desEncrypt(password);
          const rows = await executeQuery<any>(
            'SELECT a.id, b.roleid, a.username AS account, a.validend FROM registerlogin AS a INNER JOIN userinfo AS b ON a.id = b.registerloginid WHERE a.username = ? AND (a.userpassword = ? OR a.userpassword = ?)',
            [username, sha1pwd, despwd]
          );
          if (rows && rows.length > 0) {
            const user = rows[0];
            if (user.validend) {
              const now = new Date();
              const ve = new Date(user.validend + ' 23:59:59');
              if (ve.getTime() - now.getTime() < 0) {
                return res.json({ code: 206, result: false, error: 'Cuenta expirada' });
              }
            }
            const token = jwt.sign({ uid: user.id, rid: user.roleid, un: user.account }, JWT_SECRET, { expiresIn: '24h' });
            return res.json({ code: 200, result: true, token, user: { uid: user.id, account: user.account, roleid: user.roleid } });
          }
        } catch (e: any) {
          console.error('[Login] Consulta real de Ceiba falló:', e.message);
          return res.status(503).json({ code: 503, result: false, error: 'Servidor Ceiba II no disponible' });
        }
      }
      return res.status(401).json({ code: 401, result: false, error: 'Credenciales inválidas' });
    } catch (err: any) {
      console.error('Login error:', err);
      return res.json({ code: 202, error: err.message });
    }
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
    const cacheKey = `${uid}:${rid}`;
    const cached = AUTHORIZED_DEVICE_CACHE.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.ids;
    const rows = await executeQuery<any>('SELECT deviceid FROM vehicledevice WHERE deviceid IS NOT NULL AND deviceid <> ""');
    if (!rows) return null;
    const all = rows.map(row => String(row.deviceid));
    if (rid === 1) {
      const ids = new Set<string>(all);
      AUTHORIZED_DEVICE_CACHE.set(cacheKey, { expires: Date.now() + 10000, ids });
      return ids;
    }
    try {
      const response = await fetch(`http://127.0.0.1:${process.env.CEIBA_WEB_API_JAVA_PORT || '12046'}/api/v2/basic/power/device`, {
        method: 'POST',
        headers: { key: wcmsLiveToken(uid, rid), 'content-type': 'application/json' },
        body: JSON.stringify({ terid: all }),
        signal: AbortSignal.timeout(5000)
      });
      const data: any = await response.json();
      if (!response.ok || data.errorcode !== 200 || !Array.isArray(data.data)) return null;
      const ids = new Set<string>(data.data.map((item: unknown) => String(item)));
      AUTHORIZED_DEVICE_CACHE.set(cacheKey, { expires: Date.now() + 10000, ids });
      return ids;
    } catch {
      return null;
    }
  }

  async function getAuthorizedVehicles(req: express.Request) {
    const token = readAuthToken(req);
    if (!token) return null;
    try {
      const payload: any = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      const ids = await getAuthorizedDeviceIds(Number(payload.uid), Number(payload.rid));
      if (!ids) return null;
      const vehicles = await getVehicles();
      const rows = await executeQuery<any>('SELECT id, deviceid FROM vehicledevice WHERE deviceid IS NOT NULL');
      const allowedIds = new Set((rows || []).filter(row => ids.has(String(row.deviceid))).map(row => String(row.id)));
      return vehicles.filter(vehicle => allowedIds.has(String(vehicle.id)));
    } catch {
      return null;
    }
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
    const query = new URLSearchParams({
      key: wcmsLiveToken(uid, rid),
      terid: String(vehicle.deviceId),
      chl: String(channelNum),
      audio: requestAudio ? '1' : '0',
      st: '1',
      port: String(process.env.CEIBA_FLV_PORT || '12060'),
      dt: 'mdvr'
    });
    const infoUrl = `http://127.0.0.1:${process.env.CEIBA_WEB_PORT || '12056'}/api/v1/basic/live/video?${query}`;
    const controller = new AbortController();
    let timeout = setTimeout(() => controller.abort(new Error('Tiempo de espera del CMS agotado')), 35000);
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

  app.get(/^\/live\/.*/, async (req, res) => { await proxyToMedia(req, res, 'http://127.0.0.1:8090'); });
  app.get(/^\/hls\/.*/, async (req, res) => { await proxyToMedia(req, res, 'http://127.0.0.1:8090'); });
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
    const ch = parseInt(req.params.channel, 10) || 1;
    try {
      const videoPath = findVideoFileForVehicleChannel(vehicle.unitNumber, ch);
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
    const liveUrl = `/api/vehicles/${vehicle.id}/live/${channelNum}`;
    const streamToken = jwt.sign(
      { uid: res.locals.liveUser.uid, rid: res.locals.liveUser.rid, live: true, vehicleId: String(vehicle.id), channel: channelNum },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '2m' }
    );
    const flvUrl = `${liveUrl}?audio=${requestAudio ? '1' : '0'}&access_token=${encodeURIComponent(streamToken)}`;

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

  app.get('/api/geofences', (req, res) => { res.json(getGeofences()); });
  app.get('/api/alerts', (req, res) => { res.json(getAlerts()); });
  app.get('/api/gps-track/:unitId', (req, res) => {
    const unitId = req.params.unitId;
    const date = (req.query.date as string) || '2026-08-18';
    const vehicle = getVehicleById(unitId);
    const unitNumber = vehicle ? vehicle.unitNumber : unitId;
    const track = getGpsTrackHistory(unitNumber, date);
    res.json(track);
  });

  app.get('/api/tracker/events', async (req, res) => {
    try {
      const query = String(req.query.query || '').trim();
      const unit = String(req.query.unit || '').trim();
      const plate = String(req.query.plate || '').trim();
      const from = String(req.query.from || '').trim();
      const to = String(req.query.to || '').trim();
      const limit = Math.min(parseInt(String(req.query.limit || '120'), 10) || 120, 500);
      const params: any[] = [];
      let sql = 'SELECT id, vehicle_id, unit_number, plate, event_type, title, description, event_time, lat, lng, speed, source, meta FROM tracker_events WHERE 1=1';
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
      sql += ' ORDER BY event_time DESC LIMIT ?';
      params.push(limit);
      const rows = (await executeQuery(sql, params)) || [];
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/tracker/chat', async (req, res) => {
    try {
      const question = String(req.body?.question || '').trim();
      if (!question) return res.status(400).json({ error: 'Pregunta requerida' });

      const unitMatch = question.match(/\b\d{2}_[A-Z0-9]+\b/i);
      const unit = String(req.body?.unitNumber || '').trim().toUpperCase() || (unitMatch ? unitMatch[0].toUpperCase() : '');
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
      let sql = 'SELECT unit_number, plate, event_type, title, description, event_time, lat, lng, speed, source FROM tracker_events WHERE event_time BETWEEN ? AND ?';
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

  app.post('/api/alerts/:id/resolve', (req, res) => {
    const success = resolveAlert(req.params.id);
    res.json({ success });
  });
  app.get('/api/library', (req, res) => { res.json(getLibrary()); });
  app.get('/api/downloads', (req, res) => { res.json(getDownloads()); });
  app.post('/api/downloads', (req, res) => {
    const { unitNumber, title, type } = req.body;
    const job = addDownloadJob(unitNumber || '03_LAA4015', title || 'Descarga MDVR', type || 'video_mp4');
    res.json(job);
  });

  async function proxyTo12058(req: express.Request, res: express.Response) {
    const targetUrl = `http://127.0.0.1:12058${req.originalUrl}`;
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
      if (contentType.includes('video') || contentType.includes('octet-stream') || proxied.headers.get('content-disposition')) {
        const buf = Buffer.from(await proxied.arrayBuffer());
        res.send(buf);
      } else {
        const text = await proxied.text();
        try {
          const json = JSON.parse(text);
          res.json(json);
        } catch {
          res.send(text);
        }
      }
    } catch (e: any) {
      console.error('[Proxy 12058] error:', e.message);
      res.status(502).json({ code: 502, error: 'Proxy to 12058 failed: ' + e.message });
    }
  }

  // Isolated API namespace used only by the copied downloader UI.
  app.use('/downloader-api', async (req, res) => {
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

  async function proxyToMiritrans(req: express.Request, res: express.Response) {
    const targetUrl = `http://127.0.0.1:8080${req.originalUrl}`;
    try {
      const headers: Record<string, string> = {};
      if (req.headers.authorization) headers['Authorization'] = req.headers.authorization as string;
      if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'] as string;
      const fetchOpts: any = { method: req.method, headers };
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
        fetchOpts.body = JSON.stringify(req.body);
      }
      const proxied = await fetch(targetUrl, fetchOpts);
      res.status(proxied.status);
      const ct = proxied.headers.get('content-type');
      if (ct) res.setHeader('Content-Type', ct);
      const text = await proxied.text();
      try {
        const json = JSON.parse(text);
        res.json(json);
      } catch {
        res.send(text);
      }
    } catch (e: any) {
      console.error('[Proxy 8080] error:', e.message);
      res.status(502).json({ code: 502, error: 'Proxy to 8080 failed: ' + e.message });
    }
  }

  app.get('/api/v1/buses', async (req, res) => { await proxyToMiritrans(req, res); });
  app.get('/api/v1/rutas', async (req, res) => { await proxyToMiritrans(req, res); });
  app.get('/api/v1/puntos', async (req, res) => { await proxyToMiritrans(req, res); });
  app.get('/api/v1/puntos/detalle', async (req, res) => { await proxyToMiritrans(req, res); });
  app.get('/api/v1/puntos/ruta/:id', async (req, res) => { await proxyToMiritrans(req, res); });
  app.get('/api/v1/registrosvueltas/detalle', async (req, res) => { await proxyToMiritrans(req, res); });
  app.get('/api/v1/registrosvueltas/vueltas', async (req, res) => { await proxyToMiritrans(req, res); });
  app.get('/api/v1/registrosvueltas/total', async (req, res) => { await proxyToMiritrans(req, res); });
  app.get('/api/v1/despacho', async (req, res) => { await proxyToMiritrans(req, res); });
  app.post('/api/v1/despacho', async (req, res) => { await proxyToMiritrans(req, res); });
  app.get('/api/v1/sindespacho', async (req, res) => { await proxyToMiritrans(req, res); });
  app.get('/api/ceiba/fences', async (req, res) => { await proxyToMiritrans(req, res); });
  app.get('/api/ceiba/gps', async (req, res) => { await proxyToMiritrans(req, res); });
  app.get('/api/ceiba/gps-stream', async (req, res) => { await proxyToMiritrans(req, res); });
  app.get('/api/ceiba/ping', async (req, res) => { await proxyToMiritrans(req, res); });

  app.get('/api/stream/telemetry', requireAppAuth, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const interval = setInterval(async () => {
      try {
        const vehicles = await getAuthorizedVehicles(req);
        if (!vehicles) return;
        const quitoNow = new Date().toLocaleString('sv-SE', { timeZone: 'America/Guayaquil' });
        res.write(`data: ${JSON.stringify({ type: 'telemetry_update', vehicles, timestamp: quitoNow })}\n\n`);
      } catch (e) {}
    }, 2500);

    req.on('close', () => {
      clearInterval(interval);
      res.end();
    });
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint API no encontrado' }));

  if (process.env.NODE_ENV !== 'production') {
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CustomServiciosRS Server] Telematics & Video Gateway running on http://0.0.0.0:${PORT}`);
  });
  if (PORT_ALIAS > 0 && PORT_ALIAS !== PORT) {
    app.listen(PORT_ALIAS, '0.0.0.0', () => {
      console.log(`[CustomServiciosRS Server] Alias activo en http://0.0.0.0:${PORT_ALIAS}`);
    });
  }
}

startServer();
