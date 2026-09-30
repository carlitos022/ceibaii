import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advancePlayback, eventPosition, playbackPosition } from './recorrido-playback';
test('multipliers preserve real elapsed time on short and multi-day routes', () => {
 for (const end of [600000,7*86400000]) for (const speed of [1,2,4,6,10]) {
  assert.equal(advancePlayback(1000,2000,speed,end),1000+2000*speed);
  assert.equal(advancePlayback(1000,2100,speed,end),1000+2100*speed);
 }
 assert.equal(advancePlayback(5000,1000,10,6000),6000);
});
const points=[{stamp:1000,lat:-4,lng:-79},{stamp:61000,lat:-4.001,lng:-79.001}];
test('event GPS has priority; nearest GPS is identified; missing GPS stays missing',()=>{
 assert.deepEqual(eventPosition({lat:-4.05,lng:-79.05},30000,points),{lat:-4.05,lng:-79.05,exact:true});
 assert.deepEqual(eventPosition({lat:null,lng:null},30000,points),{lat:-4,lng:-79,exact:false});
 assert.equal(eventPosition({lat:null,lng:null},90000,points),null);
 assert.equal(eventPosition({lat:300,lng:0},90000,points),null);
});
test('smooth movement cannot interpolate through outages or large jumps',()=>{
 const p=playbackPosition(points,31000)!;
 assert.ok(Math.abs(p.lat+4.0005)<1e-9&&Math.abs(p.lng+79.0005)<1e-9);
 assert.deepEqual(playbackPosition([points[0],{...points[1],stamp:300000}],10000),points[0]);
 assert.deepEqual(playbackPosition([points[0],{...points[1],lat:-10}],10000),points[0]);
});
