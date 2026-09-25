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

function wcmsLiveToken(uid: number, rid: number) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const value = `wcms4.0|${rid}|${uid}|${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return encodeURIComponent(desEncrypt(value));
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

      const payload = { uid: Number(user.id), rid: Number(user.roleid), un: String(user.account) };
      const token = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '24h' });
      return res.json({
        code: 200,
        result: true,
        token,
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
      res.locals.auth = { uid: Number(payload.uid), rid: Number(payload.rid), un: String(payload.un || '') };
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

  app.get('/api/monitor/stream', requireAuth, async (_req, res) => {
    const { uid, rid } = res.locals.auth;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    let closed = false;
    res.on('close', () => { closed = true; });
    const send = async () => {
      if (closed) return;
      const vehicles = await authorizedVehicles(uid, rid);
      if (!vehicles) return;
      res.write(`data: ${JSON.stringify({ type: 'telemetry_update', vehicles, at: Date.now() })}\n\n`);
    };
    await send();
    const timer = setInterval(send, 2500);
    res.on('close', () => clearInterval(timer));
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
