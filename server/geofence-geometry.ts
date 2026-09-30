import type { Geofence } from '../src/types';
export function insideFence(lat: number, lng: number, fence: Geofence): boolean {
  if (fence.center && fence.radiusMeters) {
    const [north, east] = fence.center, radians = Math.PI / 180;
    const a = Math.sin((lat - north) * radians / 2) ** 2 + Math.cos(lat * radians) * Math.cos(north * radians) * Math.sin((lng - east) * radians / 2) ** 2;
    return 12742000 * Math.asin(Math.min(1, Math.sqrt(a))) <= fence.radiusMeters;
  }
  let inside = false; const polygon = fence.coordinates;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i], [yj, xj] = polygon[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
