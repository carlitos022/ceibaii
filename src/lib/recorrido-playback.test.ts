import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlaybackTimeline, toPlaybackClock, fromPlaybackClock, PLAYBACK_BASE_RATE, playbackRateText, playbackRemainingText, advancePlayback, eventPosition, playbackPosition } from './recorrido-playback';
test('multipliers preserve real elapsed time on short and multi-day routes', () => {
 for (const end of [600000,7*86400000]) for (const speed of [1,3,6,10,20]) {
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
test('smooth movement follows long gaps but rejects implausible short jumps',()=>{
 const p=playbackPosition(points,31000)!;
 assert.ok(Math.abs(p.lat+4.0005)<1e-9&&Math.abs(p.lng+79.0005)<1e-9);
 const gap=playbackPosition([points[0],{...points[1],stamp:300000}],150500)!;
 assert.ok(Math.abs(gap.lat+4.0005)<1e-9);
 assert.deepEqual(playbackPosition([points[0],{...points[1],lat:-10}],10000),points[0]);
});
test('five hour GPS gaps retain their entire duration and original timestamps',()=>{
 const original=[{stamp:1000},{stamp:61000},{stamp:18061000},{stamp:18121000}];
 const copy=JSON.stringify(original), timeline=buildPlaybackTimeline(original);
 assert.equal(timeline.at(-1)!.clock,18120000);
 assert.equal(fromPlaybackClock(timeline,60000),61000);
 assert.equal(fromPlaybackClock(timeline,18060000),18061000);
 assert.equal(toPlaybackClock(timeline,18061000),18060000);
 assert.ok(Math.abs(fromPlaybackClock(timeline,toPlaybackClock(timeline,9000000))-9000000)<1);
 assert.equal(JSON.stringify(original),copy);
});
test('rate labels and remaining duration agree with the actual clock',()=>{
 for(const speed of [1,3,6,10,20]) {
  assert.equal(playbackRateText(speed),speed*5+' min de historial / s');
  assert.equal(advancePlayback(0,1000,speed*PLAYBACK_BASE_RATE,1e10),speed*300000);
 }
 assert.equal(playbackRemainingText(18000000,1),'1 min 0 s');
 assert.equal(playbackRemainingText(18000000,20),'3 s');
 assert.equal(playbackRemainingText(-1,1),'0 s');
});
