import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import CryptoJS from 'crypto-js';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { executeQuery, getDbConfig, initDbPool, isDbConnected } from './server/db';
import { getVehicles } from './server/ceiba-service';
import { ceibaConfig, getLastGpsByDevice, getLastStateByDevice } from './server/ceiba-api';
const ioClient: any = require('socket.io-client');

dotenv.config();

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const JWT_SECRET = requireEnv('JWT_SECRET');
const DES_KEY = requireEnv('DES_KEY');
const DES_IV = requireEnv('DES_IV');
const PORT = Number(process.env.CEIBA_FLEET_PORT || 3010);

function desEncrypt(value: string) {
  const key = CryptoJS.enc.Utf8.parse(DES_KEY);
  const iv = CryptoJS.enc.Utf8.parse(DES_IV);
  return CryptoJS.DES.encrypt(value, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  }).ciphertext.toString(CryptoJS.enc.Base64);
}
function readToken(req: express.Request) {
  const auth = String(req.headers.authorization || '');
  return auth.startsWith('Bearer ') ? auth.slice(7) : String(req.query.access_token || '');
}

const authorizedDeviceCache = new Map<string, { expires: number; ids: Set<string> }>();
const nativeSessionCache = new Map<string, { expires: number; key: string; userId?: number }>();
const NATIVE_WEB_BASE = process.env.CEIBA_NATIVE_WEB_BASE || 'http://127.0.0.1:12056';

function wcmsLiveToken(uid: number, rid: number) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const value = `wcms4.0|${rid}|${uid}|${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return encodeURIComponent(desEncrypt(value));
}

async function getNativeCeibaSession(username: string, password: string) {
  try {
    const params = new URLSearchParams({ username, password, opencheck: '1' });
    const response = await fetch(`${NATIVE_WEB_BASE}/api/v1/basic/key?${params.toString()}`, {
      signal: AbortSignal.timeout(5000)
    });
    const data: any = await response.json();
    if (response.ok && data?.errorcode === 200 && data?.data?.key) {
      return { key: String(data.data.key), userId: Number(data.data.userId || 0) || undefined };
    }
  } catch (error) {
    console.warn('[Ceiba Fleet native login]', error);
  }
  return null;
}

async function nativeCeibaGet(pathname: string, key: string, params: Record<string, string>) {
  const query = new URLSearchParams({ key, ...params });
  const response = await fetch(`${NATIVE_WEB_BASE}${pathname}?${query.toString()}`, {
    signal: AbortSignal.timeout(7000)
  });
  const contentType = String(response.headers.get('content-type') || '');
  if (!contentType.includes('application/json')) {
    throw new Error(`Ceiba II native API returned ${contentType || 'unknown content type'}`);
  }
  const data: any = await response.json();
  if (!response.ok) throw new Error(`Ceiba II native API HTTP ${response.status}`);
  return data;
}

async function start() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  await initDbPool();

  app.get('/api/health', (_req, res) => {
    const cfg = getDbConfig();
    res.json({
      status: 'ok',
      service: 'Ceiba Fleet',
      ceibaDatabase: isDbConnected(),
      database: cfg.database,
      port: PORT,
      time: new Date().toISOString()
    });
  });

  app.post('/api/auth/login', async (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (!username || !password) {
      return res.status(400).json({ code: 400, result: false, error: 'Ingrese usuario y contrasena' });
    }
    if (!isDbConnected()) {
      return res.status(503).json({ code: 503, result: false, error: 'Servidor Ceiba II no disponible' });
    }
    try {
      const sha1pwd = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
      const despwd = desEncrypt(password);
      const rows = await executeQuery<any>(
        'SELECT a.id, b.roleid, a.username AS account, a.validend ' +
        'FROM registerlogin AS a INNER JOIN userinfo AS b ON a.id = b.registerloginid ' +
        'WHERE a.username = ? AND (a.userpassword = ? OR a.userpassword = ?) LIMIT 1',
        [username, sha1pwd, despwd]
      );

      if (!rows?.length) {
        return res.status(401).json({ code: 401, result: false, error: 'Credenciales invalidas' });
      }

      const user = rows[0];
      if (user.validend) {
        const validUntil = new Date(String(user.validend) + ' 23:59:59');
        if (validUntil.getTime() < Date.now()) {
          return res.status(403).json({ code: 206, result: false, error: 'Cuenta expirada' });
        }
      }

      const sid = crypto.randomUUID();
      const nativeSession = await getNativeCeibaSession(username, password);
      if (nativeSession) {
        nativeSessionCache.set(sid, { ...nativeSession, expires: Date.now() + 23 * 60 * 60 * 1000 });
      }
      const payload = { uid: Number(user.id), rid: Number(user.roleid), un: String(user.account), sid };
      const token = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '24h' });
      return res.json({
        code: 200,
        result: true,
        token,
        nativeApi: Boolean(nativeSession),
        serverVersion: '2.5.1.0.01',
        user: { uid: payload.uid, account: payload.un, roleid: payload.rid }
      });
    } catch (error) {
      console.error('[Ceiba Fleet login]', error);
      return res.status(503).json({ code: 503, result: false, error: 'No se pudo validar la cuenta en Ceiba II' });
    }
  });

  app.get('/api/auth/verify', (req, res) => {
    const token = readToken(req);
    if (!token) return res.status(401).json({ code: 401, error: 'Sesion requerida' });
    try {
      const user = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      return res.json({ code: 200, user });
    } catch {
      return res.status(401).json({ code: 401, error: 'Sesion invalida o expirada' });
    }
  });

  async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const token = readToken(req);
    if (!token) return res.status(401).json({ code: 401, error: 'Inicie sesion' });
    try {
      const payload: any = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      if (!Number.isInteger(Number(payload.uid)) || !Number.isInteger(Number(payload.rid))) throw new Error('invalid');
      res.locals.auth = { uid: Number(payload.uid), rid: Number(payload.rid), un: String(payload.un || ''), sid: String(payload.sid || '') };
      next();
    } catch {
      return res.status(401).json({ code: 401, error: 'Sesion invalida o expirada' });
    }
  }

  async function authorizedDeviceIds(uid: number, rid: number): Promise<Set<string> | null> {
    const cacheKey = `${uid}:${rid}`;
    const cached = authorizedDeviceCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.ids;
    const rows = await executeQuery<any>('SELECT deviceid FROM vehicledevice WHERE deviceid IS NOT NULL AND deviceid <> ""');
    if (!rows) return null;
    const all = rows.map(row => String(row.deviceid));
    if (rid === 1) {
      const ids = new Set<string>(all);
      authorizedDeviceCache.set(cacheKey, { expires: Date.now() + 10000, ids });
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
      authorizedDeviceCache.set(cacheKey, { expires: Date.now() + 10000, ids });
      return ids;
    } catch {
      return null;
    }
  }

  async function authorizedVehicles(uid: number, rid: number) {
    const ids = await authorizedDeviceIds(uid, rid);
    if (!ids) return null;
    const vehicles = await getVehicles();
    const rows = await executeQuery<any>('SELECT id, deviceid FROM vehicledevice WHERE deviceid IS NOT NULL');
    const allowedIds = new Set((rows || []).filter(row => ids.has(String(row.deviceid))).map(row => String(row.id)));
    return vehicles.filter(vehicle => allowedIds.has(String(vehicle.id)));
  }

  app.get('/api/monitor/vehicles', requireAuth, async (_req, res) => {
    const { uid, rid } = res.locals.auth;
    const vehicles = await authorizedVehicles(uid, rid);
    if (!vehicles) return res.status(503).json({ error: 'No se pudieron obtener permisos de Ceiba II' });
    res.json(vehicles);
  });

  app.get('/api/monitor/capabilities', requireAuth, (req, res) => {
    const { sid } = res.locals.auth;
    const native = sid ? nativeSessionCache.get(sid) : null;
    res.json({
      serverType: 'cb2',
      serverVersion: '2.5.1.0.01',
      nativeApi: Boolean(native && native.expires > Date.now()),
      originalMonitor: {
        vehicleStateButton: false,
        mapResetButton: false,
        detailTabs: true,
        vehicleDrawer: true
      }
    });
  });

  app.get('/api/monitor/vehicle/:id/detail', requireAuth, async (req, res) => {
    const { uid, rid, sid } = res.locals.auth;
    const vehicles = await authorizedVehicles(uid, rid);
    const vehicle = vehicles?.find(item => String(item.id) === String(req.params.id));
    if (!vehicle) return res.status(404).json({ error: 'Vehiculo no encontrado o sin permisos' });

    const rows = await executeQuery<any>(
      'SELECT deviceid, carlicence FROM vehicledevice WHERE id = ? LIMIT 1',
      [req.params.id]
    );
    const deviceId = rows?.[0]?.deviceid ? String(rows[0].deviceid) : '';
    const section = String(req.query.section || 'location');
    const routeMap: Record<string, string> = {
      location: '/api/v1/basic/vehicle/detail/gps',
      trip: '/api/v1/basic/vehicle/detail/lasttrip',
      day: '/api/v1/basic/vehicle/detail/daytrip',
      sensor: '/api/v1/basic/vehicle/detail/io'
    };
    if (section === 'location' && deviceId) {
      try {
        const [gpsResult, stateResult] = await Promise.allSettled([
          getLastGpsByDevice([deviceId]),
          getLastStateByDevice([deviceId])
        ]);
        const gps = gpsResult.status === 'fulfilled' ? gpsResult.value[0] : null;
        const state = stateResult.status === 'fulfilled' ? stateResult.value[0] : null;
        if (gps) {
          return res.json({
            source: 'ceiba-webapi',
            section,
            data: {
              vehicle: vehicle.unitNumber,
              plate: vehicle.plate,
              group: vehicle.route,
              terminalId: gps.TerminalID || deviceId,
              latitude: gps.GpsLat,
              longitude: gps.GpsLng,
              speed: gps.Speed,
              course: gps.Direction,
              gpsTime: gps.GpsTime,
              serverTime: gps.Time,
              altitude: gps.Altitude,
              accState: gps.AccState,
              engineState: gps.EngineState,
              engineTemp: gps.EngineTemp,
              deviceTemp: gps.DeviceTemp,
              ambientTemp: gps.AmbientTemp,
              humidity: gps.Humidity,
              mileage: gps.Mileage,
              oil: gps.Oil,
              driverName: gps.DriverName,
              location: gps.Location,
              gpsState: gps.State,
              lastStateTime: state?.time || null,
              lastStateType: state?.type ?? null
            }
          });
        }
      } catch (error) {
        console.warn('[Ceiba Fleet webapi detail]', error);
      }
    }

    const native = sid ? nativeSessionCache.get(sid) : null;
    if (deviceId && native && native.expires > Date.now() && routeMap[section]) {
      try {
        const data = await nativeCeibaGet(routeMap[section], native.key, { terid: deviceId });
        if (data?.errorcode === 200 || data?.success === true) {
          return res.json({ source: 'ceiba-native', section, data: data.data ?? data.result ?? data });
        }
      } catch (error) {
        console.warn('[Ceiba Fleet monitor detail]', section, error);
      }
    }

    if (section === 'location') {
      return res.json({
        source: 'fleet-fallback',
        section,
        data: {
          vehicle: vehicle.unitNumber,
          plate: vehicle.plate,
          group: vehicle.route,
          latitude: vehicle.lat,
          longitude: vehicle.lng,
          speed: vehicle.speed,
          course: vehicle.heading,
          gpsTime: vehicle.lastUpdate,
          state: vehicle.statusText
        }
      });
    }
    return res.json({ source: 'fleet-fallback', section, data: null });
  });

  app.get('/api/monitor/vehicle/:id/video-stream/:channel', requireAuth, async (req, res) => {
    const token = readToken(req);
    const channel = Number(req.params.channel);
    if (!Number.isInteger(channel) || channel < 1) {
      return res.status(400).json({ error: 'Canal invalido' });
    }
    const { uid, rid } = res.locals.auth;
    const vehicles = await authorizedVehicles(uid, rid);
    const vehicle = vehicles?.find(item => String(item.id) === String(req.params.id));
    if (!vehicle) return res.status(404).json({ error: 'Vehiculo no encontrado o sin permisos' });
    if (!vehicle.channels.some(ch => ch.channelNumber === channel)) {
      return res.status(400).json({ error: 'Canal no disponible para esta unidad' });
    }

    try {
      const qs = new URLSearchParams({
        audio: String(req.query.audio ?? '1'),
        stream: String(req.query.stream ?? '1')
      });
      const upstream = await fetch(
        `http://127.0.0.1:3000/api/vehicles/${encodeURIComponent(req.params.id)}/video-stream/${channel}?${qs}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(15000)
        }
      );
      const body: any = await upstream.json();
      if (!upstream.ok || !body?.flvUrl) {
        return res.status(upstream.status || 502).json(body || { error: 'No se pudo iniciar video' });
      }
      const flvUrl = `/api/monitor/vehicle/${encodeURIComponent(req.params.id)}/live/${channel}?audio=${qs.get('audio')}&stream=${qs.get('stream')}&access_token=${encodeURIComponent(token)}`;
      return res.json({ ...body, flvUrl });
    } catch (error: any) {
      return res.status(502).json({ error: 'No se pudo conectar con el gateway de video', detail: error?.message });
    }
  });

  app.get('/api/monitor/vehicle/:id/live/:channel', requireAuth, async (req, res) => {
    const token = readToken(req);
    const { uid, rid } = res.locals.auth;
    const vehicles = await authorizedVehicles(uid, rid);
    const vehicle = vehicles?.find(item => String(item.id) === String(req.params.id));
    if (!vehicle) return res.status(404).json({ error: 'Vehiculo no encontrado o sin permisos' });

    const qs = new URLSearchParams({
      audio: String(req.query.audio ?? '1'),
      stream: String(req.query.stream ?? '1'),
      access_token: token
    });
    const target = `http://127.0.0.1:3000/api/vehicles/${encodeURIComponent(req.params.id)}/live/${encodeURIComponent(req.params.channel)}?${qs}`;
    try {
      const upstream = await fetch(target, {
        headers: { Accept: 'video/x-flv, application/octet-stream' },
        signal: AbortSignal.timeout(35000)
      } as any);
      res.status(upstream.status);
      const contentType = upstream.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Accel-Buffering', 'no');
      if (!upstream.body) return res.end();
      const { Readable } = await import('stream');
      Readable.fromWeb(upstream.body as any).pipe(res);
    } catch (error: any) {
      if (!res.headersSent) return res.status(502).json({ error: 'Fallo el video en vivo', detail: error?.message });
      res.destroy();
    }
  });

  app.get('/api/monitor/stream', requireAuth, async (_req, res) => {
    const { uid, rid } = res.locals.auth;
    const ids = await authorizedDeviceIds(uid, rid);
    if (!ids) return res.status(503).json({ error: 'No se pudieron obtener permisos de Ceiba II' });

    const deviceIds = [...ids].map(String).filter(Boolean);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let closed = false;
    let upstream: any = null;
    const push = (payload: unknown) => {
      if (!closed) res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };
    const sendSnapshot = async () => {
      if (closed) return;
      const vehicles = await authorizedVehicles(uid, rid);
      if (vehicles) push({ type: 'telemetry_update', vehicles, at: Date.now() });
    };

    await sendSnapshot();

    if (deviceIds.length > 0) {
      const upstreamKey = wcmsLiveToken(uid, rid);
      const { wcmsBase } = ceibaConfig();
      upstream = ioClient.connect(wcmsBase, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        forceNew: true
      });

      upstream.on('connect', () => {
        const auth = { didArray: deviceIds, key: upstreamKey };
        upstream.emit('sub_gps', auth);
        upstream.emit('sub_state', auth);
        upstream.emit('sub_alarm', { ...auth, alarmType: [] });
        push({ type: 'upstream_status', connected: true, at: Date.now() });
      });
      upstream.on('disconnect', () => {
        push({ type: 'upstream_status', connected: false, at: Date.now() });
      });
      upstream.on('connect_error', () => {
        push({ type: 'upstream_status', connected: false, at: Date.now() });
      });
      upstream.on('sub_gps', (data: any) => {
        if (!data?.deviceno) return;
        push({ type: 'gps_event', data, at: Date.now() });
      });
      upstream.on('sub_state', (data: any) => {
        if (!data?.deviceno) return;
        push({ type: 'state_event', data, at: Date.now() });
      });
      upstream.on('sub_alarm', (data: any) => {
        if (!data?.deviceno) return;
        push({ type: 'alarm_event', data, at: Date.now() });
      });
    }

    const snapshotTimer = setInterval(sendSnapshot, 15000);
    const heartbeatTimer = setInterval(() => {
      if (!closed) res.write(': keepalive\n\n');
    }, 20000);

    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(snapshotTimer);
      clearInterval(heartbeatTimer);
      try { upstream?.disconnect(); } catch {}
    };
    res.on('close', cleanup);
    res.on('finish', cleanup);
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  } else {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Ceiba Fleet] http://0.0.0.0:${PORT}`);
  });
}

start().catch(error => {
  console.error('[Ceiba Fleet] Fatal:', error);
  process.exit(1);
});
