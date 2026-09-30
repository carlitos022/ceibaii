import type { Vehicle, Geofence } from '../src/types';
import { executeQuery } from './db';
import { getGeofences } from './ceiba-service';
import { insideFence } from './geofence-geometry';
type Position = { stamp: number; time: string; lat: number; lng: number };
type Crossing = Position & { name: string; event: string };
const quito = (stamp: number) => new Date(stamp).toLocaleString('sv-SE', { timeZone: 'America/Guayaquil' });
export function crossingsFromPositions(points: Position[], fences: Geofence[], start: number): Crossing[] {
  const result: Crossing[] = []; let previous: Set<string> | null = null; let lastStamp = 0;
  for (const point of points) {
    const current = new Set(fences.filter(f => insideFence(point.lat, point.lng, f)).map(f => f.name));
    // First points and archive gaps are baselines, not evidence of crossings.
    if (previous && point.stamp - lastStamp <= 10 * 60000 && point.stamp >= start) {
      for (const name of previous) if (!current.has(name)) result.push({ ...point, name, event: 'SALIO' });
      for (const name of current) if (!previous.has(name)) result.push({ ...point, name, event: 'ENTRO' });
    }
    previous = current; lastStamp = point.stamp;
  }
  return result;
}
export async function getNationalDispatchReport(vehicle: Vehicle, date: string) {
  const rows = await executeQuery<any>('SELECT deviceid FROM vehicledevice WHERE id = ?', [vehicle.id]);
  const deviceId = rows?.[0]?.deviceid; if (!deviceId) throw Error('Unidad no disponible');
  const start = Date.parse(date + 'T00:00:00-05:00'), end = start + 86400000 - 1000;
  const points: Position[] = [];
  for (let cursor = start - 30 * 60000; cursor <= end; cursor += 4 * 3600000 + 1000) {
    const until = Math.min(cursor + 4 * 3600000, end);
    const response = await fetch(`http://127.0.0.1:${process.env.CEIBA_GPS_HISTORY_PORT || '12040'}/gps/${encodeURIComponent(deviceId)}/${encodeURIComponent(quito(cursor))}/${encodeURIComponent(quito(until))}`, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error('Archivo GPS no disponible'); const raw = await response.json();
    if (!Array.isArray(raw)) throw Error('Archivo GPS invalido');
    for (const row of raw) {
      const stamp = Date.parse(String(row.GpsTime).replace(' ', 'T') + '-05:00'), lat = Number(row.GpsLat), lng = Number(row.GpsLng);
      if (String(row.TerminalID) !== String(deviceId) || !Number.isFinite(stamp) || stamp < cursor || stamp > until || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (!lat && !lng)) continue;
      points.push({ stamp, time: String(row.GpsTime), lat, lng });
    }
    if (points.length > 150000) throw Error('Demasiados registros GPS');
  }
  points.sort((a, b) => a.stamp - b.stamp);
  const crossings = crossingsFromPositions(points, await getGeofences(), start);
  const stored = await executeQuery<any>(`SELECT event_type, DATE_FORMAT(event_time, '%Y-%m-%d %H:%i:%s') AS time, lat, lng, meta
    FROM tracker_events WHERE vehicle_id = ? AND event_time >= ? AND event_time < DATE_ADD(?, INTERVAL 1 DAY)
    AND event_type IN ('geofence_entry','geofence_exit') ORDER BY event_time`, [vehicle.id, date, date]);
  if (!stored) throw Error('Eventos no disponibles');
  for (const row of stored) {
    let meta: any; try { meta = JSON.parse(row.meta || '{}'); } catch { continue; }
    const name = meta.to || meta.from;
    if (name) crossings.push({ name, event: row.event_type === 'geofence_entry' ? 'ENTRO' : 'SALIO', time: row.time, stamp: Date.parse(row.time.replace(' ', 'T') + '-05:00'), lat: Number(row.lat), lng: Number(row.lng) });
  }
  crossings.sort((a, b) => a.stamp - b.stamp);
  const unique = crossings.filter((p, i) => !crossings.slice(Math.max(0, i - 10), i).some(q => q.name === p.name && q.event === p.event && Math.abs(q.stamp - p.stamp) < 2000));
  if (!unique.length) return [];
  const schedules = await executeQuery<any>(`SELECT fence_name, DATE_FORMAT(due_at, '%Y-%m-%d %H:%i:%s') AS due_at, rate
    FROM dispatch_schedules WHERE vehicle_id = ? AND due_at >= ? AND due_at < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY due_at`, [vehicle.id, date, date]);
  if (!schedules) throw Error('Programacion no disponible'); const usedSchedules = new Set<number>();
  const details = unique.map(p => {
    const index = p.event === 'ENTRO' ? schedules.findIndex((s, i) => !usedSchedules.has(i) && s.fence_name === p.name && p.stamp >= Date.parse(s.due_at.replace(' ', 'T') + '-05:00') - 30 * 60000) : -1;
    const scheduled = index >= 0 ? schedules[index] : null; if (scheduled) usedSchedules.add(index);
    const difference = scheduled ? Math.max(0, Math.ceil((p.stamp - Date.parse(scheduled.due_at.replace(' ', 'T') + '-05:00')) / 60000)) : null;
    return { name: p.name, event: p.event, time: p.time.slice(11), expected: scheduled?.due_at.slice(11) || null, arrival: p.time.slice(11), difference, fine: difference == null ? 0 : Math.round(difference * Number(scheduled.rate) * 100) / 100, lat: p.lat, lng: p.lng };
  });
  return [{ id: 'gps-' + date, route: vehicle.route || 'Pasos por geocercas', start: details[0].time, end: details[details.length - 1].time, status: 'REGISTROS_GPS', fine: details.reduce((sum, p) => sum + p.fine, 0), points: details }];
}
