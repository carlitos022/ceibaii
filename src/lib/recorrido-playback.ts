export type TimedPosition = { stamp: number; lat: number; lng: number };
export function advancePlayback(start: number, elapsedMs: number, multiplier: number, end: number) {
  return Math.min(end, start + Math.max(0, elapsedMs) * multiplier);
}
export function validPosition(lat: unknown, lng: unknown): boolean {
  return lat != null && lng != null && lat !== '' && lng !== '' &&
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) &&
    Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180 &&
    !(Number(lat) === 0 && Number(lng) === 0);
}
export function pointIndex(points: TimedPosition[], stamp: number) {
  let lo = 0, hi = points.length - 1;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (points[mid].stamp <= stamp) lo = mid; else hi = mid - 1; }
  return lo;
}
export function playbackPosition(points: TimedPosition[], stamp: number) {
  if (!points.length) return null;
  const index = pointIndex(points, stamp), a = points[index], b = points[index + 1];
  if (!validPosition(a.lat, a.lng)) return null;
  if (!b || !validPosition(b.lat, b.lng) || b.stamp <= a.stamp || b.stamp - a.stamp > 120000) return a;
  // Never animate through missing reports or large GPS jumps.
  const distance = Math.hypot((b.lat - a.lat) * 111, (b.lng - a.lng) * 111 * Math.cos(a.lat * Math.PI / 180));
  if (distance > 3) return a;
  const ratio = Math.max(0, Math.min(1, (stamp - a.stamp) / (b.stamp - a.stamp)));
  return { stamp, lat: a.lat + (b.lat - a.lat) * ratio, lng: a.lng + (b.lng - a.lng) * ratio };
}
export function eventPosition(event: { lat: number | null; lng: number | null }, stamp: number, points: TimedPosition[]) {
  if (validPosition(event.lat, event.lng)) return { lat: Number(event.lat), lng: Number(event.lng), exact: true };
  if (!stamp || !points.length || stamp < points[0].stamp || stamp > points[points.length - 1].stamp) return null;
  const index = pointIndex(points, stamp), a = points[index], b = points[index + 1];
  const nearest = b && Math.abs(b.stamp - stamp) < Math.abs(a.stamp - stamp) ? b : a;
  return validPosition(nearest.lat, nearest.lng) && Math.abs(nearest.stamp - stamp) <= 120000
    ? { lat: nearest.lat, lng: nearest.lng, exact: false } : null;
}
