export const PLAYBACK_BASE_RATE = 300;
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
export function pointIndex(points: { stamp: number }[], stamp: number) {
  let lo = 0, hi = points.length - 1;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (points[mid].stamp <= stamp) lo = mid; else hi = mid - 1; }
  return lo;
}
export function playbackPosition(points: TimedPosition[], stamp: number) {
  if (!points.length) return null;
  const index = pointIndex(points, stamp), a = points[index], b = points[index + 1];
  if (!validPosition(a.lat, a.lng)) return null;
  if (!b || !validPosition(b.lat, b.lng) || b.stamp <= a.stamp) return a;
  // Preserve elapsed time, including long intervals. Only reject implausible short GPS jumps.
  const distance = Math.hypot((b.lat - a.lat) * 111, (b.lng - a.lng) * 111 * Math.cos(a.lat * Math.PI / 180));
  if (distance > 3 && b.stamp - a.stamp <= 120000) return a;
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
export type PlaybackEntry = { stamp: number; clock: number };
export function buildPlaybackTimeline(points: { stamp: number }[]): PlaybackEntry[] {
  let clock = 0;
  return points.map((point, index) => {
    if (index) clock += Math.max(0, point.stamp - points[index - 1].stamp);
    return { stamp: point.stamp, clock };
  });
}
export function toPlaybackClock(timeline: PlaybackEntry[], stamp: number) {
  if (!timeline.length) return 0;
  const index = pointIndex(timeline, stamp), a = timeline[index], b = timeline[index + 1];
  if (!b || b.stamp <= a.stamp) return a.clock;
  const ratio = Math.max(0, Math.min(1, (stamp - a.stamp) / (b.stamp - a.stamp)));
  return a.clock + ratio * (b.clock - a.clock);
}
export function fromPlaybackClock(timeline: PlaybackEntry[], clock: number) {
  if (!timeline.length) return 0;
  let lo = 0, hi = timeline.length - 1;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (timeline[mid].clock <= clock) lo = mid; else hi = mid - 1; }
  const a = timeline[lo], b = timeline[lo + 1];
  if (!b || b.clock <= a.clock) return a.stamp;
  const ratio = Math.max(0, Math.min(1, (clock - a.clock) / (b.clock - a.clock)));
  return a.stamp + ratio * (b.stamp - a.stamp);
}
export function playbackRateText(multiplier: number) {
  return (PLAYBACK_BASE_RATE * multiplier / 60) + ' min de historial / s';
}
export function playbackRemainingText(remainingMs: number, multiplier: number) {
  const seconds = Math.ceil(Math.max(0, remainingMs) / (PLAYBACK_BASE_RATE * multiplier * 1000));
  return seconds >= 60 ? Math.floor(seconds / 60) + ' min ' + seconds % 60 + ' s' : seconds + ' s';
}
