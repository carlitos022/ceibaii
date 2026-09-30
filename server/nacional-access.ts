import 'dotenv/config';
import jwt from 'jsonwebtoken';

export const downloaderBase = process.env.DOWNLOADER_BASE_URL || 'http://127.0.0.1:12058';
export const publicPath = (process.env.APP_PUBLIC_PATH || '/app').replace(/\/$/, '');
export type DownloaderVehicle = { id: number; deviceno: string; channels: { id: number; name: string }[] };
const permissions = new Map<string, { until: number; rows: DownloaderVehicle[] }>();
const pending = new Map<string, Promise<DownloaderVehicle[]>>();

export function downloaderToken(uid: number, rid: number, secret: string) {
  return jwt.sign({ uid, rid }, secret, { algorithm: 'HS256', expiresIn: '2m' });
}

// The existing downloader remains the authority for grouppower and channelpower.
export async function getDownloaderVehicles(uid: number, rid: number, secret: string): Promise<DownloaderVehicle[]> {
  const key = `${uid}:${rid}`;
  const cached = permissions.get(key);
  if (cached && cached.until > Date.now()) return cached.rows;
  if (pending.has(key)) return pending.get(key)!;
  const request = (async () => {
    const response = await fetch(downloaderBase + '/api/vehicles', {
      headers: { Authorization: 'Bearer ' + downloaderToken(uid, rid, secret) },
      signal: AbortSignal.timeout(8000)
    });
    const body = await response.json();
    if (!response.ok || body.code !== 200 || !Array.isArray(body.result)) throw new Error('Permisos no disponibles');
    const rows = body.result as DownloaderVehicle[];
    if (rows.some(v => !Number.isInteger(v.id) || typeof v.deviceno !== 'string' || !Array.isArray(v.channels))) {
      throw new Error('Respuesta de permisos invalida');
    }
    if (permissions.size > 1000) permissions.clear();
    permissions.set(key, { until: Date.now() + 1500, rows });
    return rows;
  })().finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
