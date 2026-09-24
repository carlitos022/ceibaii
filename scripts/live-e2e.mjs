import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';

// Real CMS/MDVR test. Credentials and artifact directory are supplied by the operator.
const base = process.env.LIVE_BASE || 'https://customservicios.ddns.net';
const unit = process.env.LIVE_UNIT || '13_ZAA1922';
const outputRoot = process.env.LIVE_ARTIFACTS;
assert(process.env.LIVE_USERNAME && process.env.LIVE_PASSWORD, 'Set LIVE_USERNAME and LIVE_PASSWORD');
assert(outputRoot, 'Set LIVE_ARTIFACTS to a test artifact directory');
const output = path.join(outputRoot, `${unit}-${new Date().toISOString().replace(/[:.]/g,'-')}`);
await fs.mkdir(output, { recursive: true });
const report = { base, unit, started: new Date().toISOString(), samples: [], audio: [], errors: [], requests: [] };
// Optional fault injector affects only this test browser; forwards genuine production bytes.
let proxy;
let blocked = false;
const streams = new Set();
let browserBase = base;
if (process.env.LIVE_FAULT_PROXY==='1') {
  proxy = http.createServer((req,res)=>{
    const live = /\/api\/vehicles\/[^/]+\/live\/\d/.test(req.url);
    if (live && blocked) { res.writeHead(503); res.end('Test network interruption'); return; }
    const target = new URL(req.url,base);
    const transport = target.protocol==='https:' ? https : http;
    const upstream = transport.request(target,{method:req.method,headers:{...req.headers,host:target.host}}, response=>{
      res.writeHead(response.statusCode,response.headers);
      response.pipe(res);
    });
    upstream.on('error',()=>{ if(!res.headersSent)res.writeHead(502);res.end(); });
    if(live)streams.add(res);
    res.on('close',()=>{streams.delete(res);upstream.destroy();});
    req.pipe(upstream);
  });
  await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
  browserBase=`http://127.0.0.1:${proxy.address().port}`;
  report.faultProxy=browserBase;
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on('pageerror', error => report.errors.push(error.message));
page.on('request', req => {
  if (/\/api\/vehicles\/[^/]+\/live\/\d/.test(req.url())) report.requests.push({ at:Date.now(), url:req.url() });
});
const assertUnit = async () => {
  assert((await page.locator('#camera-view-overlay').innerText()).includes(`Cámaras en Vivo: ${unit}`), 'Selected unit changed during playback');
};
const sample = async () => {
await assertUnit();
return page.locator('#camera-view-overlay video').evaluateAll(videos => videos.map(v => ({
  channel: Number(v.dataset.channel), time: v.currentTime, ready: v.readyState, paused: v.paused,
  muted: v.muted, volume:v.volume, width:v.videoWidth, height:v.videoHeight,
  frames:v.getVideoPlaybackQuality().totalVideoFrames, audioBytes:v.webkitAudioDecodedByteCount,
  error:v.error?.message
})));
};
async function waitForFour(timeout = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const before = await sample();
    await page.waitForTimeout(3000);
    const after = await sample();
    if (after.length === 4 && after.every((v,i) => v.width > 0 && v.frames > before[i]?.frames && v.time > before[i]?.time && !v.error)) return after;
  }
  throw new Error(`Four advancing cameras not found: ${JSON.stringify(await sample())}`);
}
try {
  await page.goto(browserBase);
  await page.getByPlaceholder('User', { exact:true }).fill(process.env.LIVE_USERNAME);
  await page.getByPlaceholder('Pass', { exact:true }).fill(process.env.LIVE_PASSWORD);
  await page.getByRole('button', { name:'Iniciar Sesion' }).click();
  // The marker can be outside the current map viewport. Dispatch selects the real unit.
  await page.getByText(unit, { exact:true }).first().waitFor();
  if (!(await page.locator('#info-panel').innerText().catch(()=>'' )).includes(unit)) {
    await page.getByText(unit, { exact:true }).first().dispatchEvent('click');
  }
  await page.locator('#floating-cam-btn').click();
  await page.getByRole('button', { name:'4CH', exact:true }).click();
  await page.getByText(`Cámaras en Vivo: ${unit}`, { exact:true }).waitFor();
  report.firstFour = await waitForFour();
  console.log('FOUR LIVE', JSON.stringify(report.firstFour));
  assert((await sample()).every(video => video.muted && video.volume === 0), 'Audio was audible before manual activation');
  const beforeAudioRequests = report.requests.length;
  await page.getByRole('button', { name:'AUDIO', exact:true }).click();
  const audioMeasurements = await page.evaluate(async () => {
      const videos = [...document.querySelectorAll('#camera-view-overlay video')];
      window.liveAudioTest ||= { context:new AudioContext(), nodes:new Map() };
      const test = window.liveAudioTest;
      await test.context.resume();
      const analysers = window.__csrsAudioAnalysers;
      const before = new Map(videos.map(video => [Number(video.dataset.channel), { bytes:video.webkitAudioDecodedByteCount, time:video.currentTime }]));
      const values = new Map(videos.map(video => [Number(video.dataset.channel), { peak:0, maxRms:0 }]));
      for(let i=0;i<60;i++) {
        await new Promise(resolve=>setTimeout(resolve,100));
        for (const video of videos) {
          const analyser = analysers?.get(Number(video.dataset.channel));
          const data = new Float32Array(analyser?.fftSize || 2048);
          analyser?.getFloatTimeDomainData(data);
          let peak=0, sum=0;
          for(const value of data) { peak=Math.max(peak,Math.abs(value)); sum+=value*value; }
          const current=values.get(Number(video.dataset.channel));
          if(current) { current.peak=Math.max(current.peak,peak); current.maxRms=Math.max(current.maxRms,Math.sqrt(sum/data.length)); }
        }
      }
      return videos.map(video => {
        const channel=Number(video.dataset.channel), start=before.get(channel), current=values.get(channel);
        return { channel, peak:current.peak, maxRms:current.maxRms, context:test.context.state,
          muted:video.muted, timeAdvanced:video.currentTime-start.time,
          decodedBytes:video.webkitAudioDecodedByteCount-start.bytes,
          audibleChannels:videos.filter(v=>!v.muted).map(v=>Number(v.dataset.channel)) };
      });
    });
  report.audio = audioMeasurements;
  console.log('REAL AUDIO 4CH', JSON.stringify(audioMeasurements));
  for (const measurement of audioMeasurements) {
    assert(measurement.context==='running' && !measurement.muted, `CH${measurement.channel}: audio graph was not unmuted by activation`);
    assert(measurement.decodedBytes>0 && measurement.timeAdvanced>0, `CH${measurement.channel}: audio/video did not advance`);
    assert(measurement.maxRms>0.00001, `CH${measurement.channel}: no measurable processed microphone signal`);
  }
  assert.deepEqual(audioMeasurements[0].audibleChannels,[1,2,3,4]);
  assert.equal(report.requests.length,beforeAudioRequests,'Switching audio restarted a live session');
  await page.screenshot({ path:path.join(output,`${unit}-4ch.png`) });
  await assertUnit();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('video[data-channel="1"]').locator('../..').getByTitle('Capturar fotograma a resolución original').click();
  const download = await downloadPromise;
  assert(download.suggestedFilename().startsWith(`${unit}-CH1-`));
  await download.saveAs(path.join(output,'snapshot-CH1.png'));
  for (let i=0; i<6; i++) {
    await page.waitForTimeout(10000);
    const data = await sample();
    report.samples.push({ at:new Date().toISOString(), data });
    console.log('CONTINUITY', i, JSON.stringify(data));
  }
  await waitForFour();
  if (process.env.LIVE_RECOVERY==='1') {
    assert(proxy,'Use LIVE_FAULT_PROXY=1 for a verified interruption of active stream sockets');
    const requestsBefore=report.requests.length;
    const interrupted=streams.size;
    assert.equal(interrupted,4,'Expected four active streams to interrupt');
    blocked=true;
    for(const response of streams)response.destroy();
    await page.waitForTimeout(28000);
    blocked=false;
    report.recovered = await waitForFour();
    assert(report.requests.length>=requestsBefore+4,'No automatic reconnection requests observed');
    report.interruption={interrupted,blockedMs:28000,requestsBefore,requestsAfter:report.requests.length};
    console.log('RECOVERED',JSON.stringify(report.recovered));
  }
  const counts = () => [1,2,3,4].map(ch=>report.requests.filter(r=>r.url.includes(`/live/${ch}?`)).length);
  const beforeReload = counts();
  await page.locator('video[data-channel="2"]').locator('../..').getByTitle('Recargar señal del canal').click();
  await waitForFour();
  const afterReload = counts();
  report.reload = {before:beforeReload,after:afterReload};
  for(const ch of [0,2,3]) assert.equal(afterReload[ch],beforeReload[ch],`Reload CH2 restarted CH${ch+1}`);
  assert(afterReload[1]>beforeReload[1]);
  await page.getByRole('button',{name:'Cerrar reproductor de cámaras'}).click();
  assert.equal(await page.locator('#camera-view-overlay video').count(),0);
  assert.deepEqual(report.errors,[]);
  report.passed=true;
} catch(error) {
  report.passed=false;
  report.failure=error.stack;
  console.error(error);
  await page.screenshot({path:path.join(output,`${unit}-failure.png`)}).catch(()=>{});
  process.exitCode=1;
} finally {
  report.finished=new Date().toISOString();
  await fs.writeFile(path.join(output,`${unit}-report.json`),JSON.stringify(report,null,2));
  await browser.close();
  if(proxy)await new Promise(resolve=>proxy.close(resolve));
}
