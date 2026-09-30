import type express from 'express';
import jwt from 'jsonwebtoken';
import mysql, { type Pool } from 'mysql2/promise';
import { getDbConfig, executeQuery } from './db';

let pool: Pool | undefined;
let preparing: Promise<Pool> | undefined;
const fields = ['firstName', 'lastName', 'nationalId', 'ownerName'] as const;
type Profile = Record<typeof fields[number], string>;
export function validateProfile(body: unknown): Profile {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error('Formulario invalido');
  const data = body as Record<string, unknown>;
  if (Object.keys(data).some(key => !fields.includes(key as any))) throw Error('Solo puede editar sus datos personales');
  const result = {} as Profile;
  for (const key of fields) {
    if (typeof data[key] !== 'string') throw Error('Revise los campos del formulario');
    const value = (data[key] as string).trim();
    if (value.length > (key === 'nationalId' ? 10 : 120) || /[\u0000-\u001f\u007f<>]/.test(value)) throw Error('Revise los campos del formulario');
    result[key] = value;
  }
  if (result.nationalId && !/^\d{10}$/.test(result.nationalId)) throw Error('La cedula debe tener 10 digitos');
  return result;
}
async function profilePool() {
  if (pool) return pool;
  if (preparing) return preparing;
  preparing = (async () => {
    const database = process.env.APP_DATABASE || 'csrs_profiles';
    if (!/^[a-zA-Z0-9_]+$/.test(database)) throw Error('Base de perfiles invalida');
    const config = getDbConfig();
    const connection = await mysql.createConnection(config);
    try { await connection.query('CREATE DATABASE IF NOT EXISTS `' + database + '` CHARACTER SET utf8mb4'); }
    finally { await connection.end(); }
    const candidate = mysql.createPool({ ...config, database, connectionLimit: 2 });
    try {
      await candidate.execute(`CREATE TABLE IF NOT EXISTS account_profiles (
        account_uid BIGINT UNSIGNED NOT NULL PRIMARY KEY,
        first_name VARCHAR(120) NOT NULL DEFAULT '',
        last_name VARCHAR(120) NOT NULL DEFAULT '',
        national_id VARCHAR(10) NOT NULL DEFAULT '',
        owner_name VARCHAR(120) NOT NULL DEFAULT '',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      pool = candidate; return candidate;
    } catch (e) { await candidate.end(); throw e; }
  })();
  try { return await preparing; } finally { preparing = undefined; }
}
export function registerAccountProfile(app: express.Express, secret: string) {
  const accountAuth: express.RequestHandler = async (req, res, next) => {
    let uid: number;
    try {
      const auth = String(req.headers.authorization || '');
      if (!auth.startsWith('Bearer ')) throw Error('token');
      const claim: any = jwt.verify(auth.slice(7), secret, { algorithms: ['HS256'] });
      uid = Number(claim.uid);
      if (!Number.isSafeInteger(uid) || uid <= 0) throw Error('uid');
    } catch { res.status(401).json({ error: 'Inicie sesion nuevamente' }); return; }
    const accounts = await executeQuery<any>('SELECT username, validend FROM registerlogin WHERE id = ? LIMIT 1', [uid]);
    if (!accounts) { res.status(503).json({ error: 'No se pudo verificar su cuenta' }); return; }
    const account = accounts[0];
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Guayaquil' });
    const expires = account?.validend instanceof Date ? account.validend.toLocaleDateString('sv-SE') : String(account?.validend || '').slice(0, 10);
    if (!account || (expires && expires < today)) { res.status(401).json({ error: 'Cuenta no disponible o expirada' }); return; }
    res.locals.profileAccount = { uid, account: String(account.username) };
    res.setHeader('Cache-Control', 'no-store');
    next();
  };
  app.get('/api/account/profile', accountAuth, async (_req, res) => {
    try {
      const { uid, account } = res.locals.profileAccount;
      const [rows]: any = await (await profilePool()).execute('SELECT first_name AS firstName, last_name AS lastName, national_id AS nationalId, owner_name AS ownerName FROM account_profiles WHERE account_uid = ?', [uid]);
      res.json({ account, profile: rows[0] || { firstName: '', lastName: '', nationalId: '', ownerName: '' } });
    } catch { res.status(503).json({ error: 'Su perfil no esta disponible. Intente nuevamente.' }); }
  });
  app.put('/api/account/profile', accountAuth, async (req, res) => {
    let profile: Profile;
    try { profile = validateProfile(req.body); } catch (e: any) { res.status(400).json({ error: e.message }); return; }
    try {
      const { uid, account } = res.locals.profileAccount;
      await (await profilePool()).execute(`INSERT INTO account_profiles (account_uid, first_name, last_name, national_id, owner_name)
        VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE first_name=VALUES(first_name), last_name=VALUES(last_name), national_id=VALUES(national_id), owner_name=VALUES(owner_name)`,
        [uid, profile.firstName, profile.lastName, profile.nationalId, profile.ownerName]);
      res.json({ account, profile });
    } catch { res.status(503).json({ error: 'No se pudo guardar su perfil. Intente nuevamente.' }); }
  });
}
