import test from 'node:test';
import assert from 'node:assert/strict';
import { insideFence } from './geofence-geometry';
import { crossingsFromPositions } from './nacional-dispatch';
import type { Geofence } from '../src/types';

const fence = { name: 'Prueba', coordinates: [], center: [-4, -79], radiusMeters: 100 } as Geofence;
test('geocercas circulares y poligonales usan coordenadas reales', () => {
  assert.equal(insideFence(-4, -79, fence), true);
  assert.equal(insideFence(-4.01, -79, fence), false);
  const polygon = { ...fence, center: undefined, radiusMeters: undefined, coordinates: [[-4.1,-79.1],[-4.1,-78.9],[-3.9,-78.9],[-3.9,-79.1]] } as Geofence;
  assert.equal(insideFence(-4, -79, polygon), true);
  assert.equal(insideFence(-4.2, -79, polygon), false);
});
test('el primer registro y una perdida de GPS no inventan entradas', () => {
  const p = (stamp: number, lat: number) => ({ stamp, lat, lng: -79, time: '' });
  assert.deepEqual(crossingsFromPositions([p(0,-4),p(700000,-4.01)], [fence], 0), []);
  assert.deepEqual(crossingsFromPositions([p(0,-4.01),p(60000,-4),p(120000,-4.01)], [fence], 0).map(x=>x.event), ['ENTRO','SALIO']);
});
test('si el descargador no responde, permisos fallan cerrados', async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Sin permisos' }), { status: 503 });
  try {
    const { getDownloaderVehicles } = await import('./nacional-access');
    await assert.rejects(() => getDownloaderVehicles(999001, 999001, 'test-secret-for-isolated-check'), /Permisos/);
  } finally { globalThis.fetch = saved; }
});
