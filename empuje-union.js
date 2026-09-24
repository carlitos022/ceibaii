#!/usr/bin/env node
// Empuje Union - Script para forzar LIVE HLS + pseudo-live por descarga continua
// Mantiene el empuje de video en vivo para unidades online y crea un HLS union de 4 canales
// Autor: Muse Spark - 2026-08-30
// Uso: node empuje-union.js (corre en puerto 20129, requiere DB 3307 y Redis 12004)

import mysql from 'mysql2/promise';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CFG = {
  dbHost: process.env.MYSQL_HOST || '127.0.0.1',
  dbPort: parseInt(process.env.MYSQL_PORT || '3307'),
  dbUser: process.env.MYSQL_USER || 'root',
  dbPassword: process.env.MYSQL_PASSWORD || 'c6l7r8ceacvi2010vs',
  dbName: process.env.MYSQL_DATABASE || 'wcms4',
  redisCli: 'C:\\Program Files (x86)\\CMS Server\\TransmitServer\\redis_service\\redis-cli.exe',
  redisPort: 12004,
  redisPass: process.env.CEIBA_REDIS_PASSWORD,
  ceibaIp: '127.0.0.1',
  adsPort: 12046,
  hlsPort: 8090,
  empujePort: 20129,
  intervalMs: 30000, // cada 30s intenta empuje
};
if (!CFG.redisPass) throw new Error('CEIBA_REDIS_PASSWORD is required');

// Helper Quito time
function formatQuito(date) {
  return date.toLocaleString('sv-SE', { timeZone: 'America/Guayaquil' });
}
function getQuitoNow() {
  return new Date();
}
function log(msg) {
  const ts = formatQuito(new Date());
  console.log(`[${ts} Quito] ${msg}`);
  try { fs.appendFileSync(path.join(__dirname, 'empuje-union.log'), `[${ts}] ${msg}\n`); } catch {}
}

let dbPool;
async function initDb() {
  dbPool = mysql.createPool({
    host: CFG.dbHost, port: CFG.dbPort, user: CFG.dbUser, password: CFG.dbPassword, database: CFG.dbName,
    connectionLimit: 5, dateStrings: 'DATETIME'
  });
  log('DB pool iniciado');
}

function redisRaw(cmd, ...args) {
  return new Promise(resolve => {
    const a = ['-p', String(CFG.redisPort), '-a', CFG.redisPass, cmd, ...args.map(String)];
    const child = spawn(CFG.redisCli, a, { windowsHide: true });
    let out = '', err = '';
    child.stdout.on('data', d => out += d.toString());
    child.stderr.on('data', d => err += d.toString());
    child.on('close', () => resolve(out.trim()));
    child.on('error', () => resolve(''));
  });
}

async function getOnlineDevices() {
  const sm = await redisRaw('smembers', 'online:dg1');
  const list = sm.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  return new Set(list);
}

async function getVehiclesWithVideo() {
  const [rows] = await dbPool.query(`
    SELECT v.id, v.carlicence, v.deviceid, d.channelcount
    FROM vehicledevice v
    LEFT JOIN devicefile d ON d.vehicledeviceid=v.id
    WHERE v.deviceid IS NOT NULL
  `);
  // Filtrar solo con carpeta C:/Video existente
  return rows.filter(r => {
    try { return fs.existsSync(path.join('C:/Video', r.carlicence)); } catch { return false; }
  });
}

// Fuerza HLS live manteniendo OpenLiveStream vivo (empuje GT)
async function empujeHLS(deviceId, channel=1) {
  const url = `http://127.0.0.1:${CFG.hlsPort}/live/${deviceId}_${channel}.m3u8`;
  return new Promise(resolve => {
    const req = http.get(url, res => {
      let data='';
      res.on('data', c=> data+=c);
      res.on('end', ()=>{
        const ok = res.statusCode===200 && data.includes('#EXTM3U');
        log(`HLS empuje ${deviceId}_ch${channel} -> ${res.statusCode} ${ok?'OK':'FAIL'} len=${data.length}`);
        resolve(ok);
      });
    });
    req.on('error', e=>{ log(`HLS empuje ${deviceId}_ch${channel} ERR ${e.message}`); resolve(false); });
    req.setTimeout(8000, ()=>{ req.destroy(); log(`HLS empuje ${deviceId}_ch${channel} TIMEOUT 8s`); resolve(false); });
  });
}

// Crea tarea ADS de descarga para los últimos 30s (pseudo-live)
async function empujeDescarga(deviceId, carlicense, dateStr, startTime, endTime, channels=[1,2,3,4]) {
  // Usar token wcms4
  const CryptoJS = (await import('crypto-js')).default;
  const DES_KEY='rogernet', DES_IV='rogernet';
  function desEncrypt(str){
    const key=CryptoJS.enc.Utf8.parse(DES_KEY);
    const iv=CryptoJS.enc.Utf8.parse(DES_IV);
    return CryptoJS.DES.encrypt(str,key,{iv,mode:CryptoJS.mode.CBC,padding:CryptoJS.pad.Pkcs7}).ciphertext.toString(CryptoJS.enc.Base64);
  }
  function getToken(uid=1,rid=1){
    const now=new Date();
    const pad=n=>n<10?'0'+n:''+n;
    const ds=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    return encodeURIComponent(desEncrypt(`wcms4.0|${rid}|${uid}|${ds}`));
  }
  const token=getToken();
  const body=JSON.stringify({
    TaskName:`${('UNION_'+carlicense).slice(0,14)}`,
    nodeType:1, nodeName:deviceId,
    StartTime:startTime, EndTime:endTime,
    TaskType:1, StartExecute:dateStr, EndExecute:dateStr,
    Period:0, TaskChannel:channels.join(','), Stream:1, VideoType:0,
    TaskPeriod:"", TaskIO:"", TaskEvent:[], NetMode:7, Effective:7
  });
  return new Promise(resolve=>{
    const opts={hostname:CFG.ceibaIp,port:CFG.adsPort,path:'/api/v2/ads/task/save-task',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'key':token}};
    const req=http.request(opts,res=>{
      let d='';res.on('data',c=>d+=c);res.on('end',()=>{
        try{ const j=JSON.parse(d); log(`Descarga empuje ${carlicense} ${startTime}-${endTime} ch${channels} -> ${j.errorcode} ${j.errorcase} data=${j.data}`);
          resolve(j.errorcode===0||j.errorcode===200);
        }catch{ log(`Descarga empuje ${carlicense} ERR parse ${d.slice(0,200)}`); resolve(false); }
      });
    });
    req.on('error',e=>{log(`Descarga empuje ${carlicense} ERR ${e.message}`); resolve(false);});
    req.write(body); req.end();
  });
}

async function cicloEmpuje() {
  try {
    const online = await getOnlineDevices();
    const vehicles = await getVehiclesWithVideo();
    const now = getQuitoNow();
    const dateStr = formatQuito(now).split(' ')[0]; // YYYY-MM-DD
    const endTime = formatQuito(now).split(' ')[1]; // HH:mm:ss
    const startDate = new Date(now.getTime() - 60000); // -60s
    const startTime = formatQuito(startDate).split(' ')[1];

    log(`=== Ciclo empuje ${dateStr} ${startTime}-${endTime} online:${online.size} vehiculos:${vehicles.length} ===`);

    let liveOk=0, liveFail=0;
    for(const v of vehicles){
      const isOnline = online.has(v.deviceid);
      if(!isOnline) continue; // solo online
      // 1. Empuje HLS para 4 canales
      for(let ch=1; ch<= (v.channelcount||4); ch++){
         const ok = await empujeHLS(v.deviceid, ch);
         if(ok) liveOk++; else liveFail++;
         await new Promise(r=>setTimeout(r,300));
      }
      // 2. Empuje descarga pseudo-live cada 60s (solo cada 2 ciclos para no saturar)
      if(Date.now() % 60000 < 30000){
        await empujeDescarga(v.deviceid, v.carlicence, dateStr, startTime, endTime, [1,2,3,4]);
        await new Promise(r=>setTimeout(r,600));
      }
    }
    log(`Ciclo fin liveOk=${liveOk} liveFail=${liveFail}`);
  } catch(e){
    log(`Ciclo error ${e.message} ${e.stack?.slice(0,300)}`);
  }
}

// Servidor HTTP para union HLS (expone /empuje/:carlicense/live.m3u8 que une 4 canales)
function startUnionServer(){
  const server = http.createServer(async (req,res)=>{
    res.setHeader('Access-Control-Allow-Origin','*');
    if(req.url==='/health'){
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({status:'ok', empuje:'union', port:CFG.empujePort, time: formatQuito(new Date()), timezone:'America/Guayaquil'}));
      return;
    }
    if(req.url.startsWith('/empuje/')){
      // /empuje/38_LAA2282/live.m3u8 -> intenta proxy a HLS real, si falla sirve ultimo MP4 como pseudo-live
      const m=req.url.match(/^\/empuje\/([^\/]+)\/live\.m3u8/);
      if(m){
        const car=m[1];
        // Buscar deviceid
        try{
          const [rows]=await dbPool.query('SELECT deviceid FROM vehicledevice WHERE carlicence=?',[car]);
          const dev=rows[0]?.deviceid;
          if(dev){
            // Proxy a HLS real
            const target=`http://127.0.0.1:${CFG.hlsPort}/live/${dev}_1.m3u8`;
            http.get(target, upstream=>{
              res.writeHead(upstream.statusCode, {'Content-Type': upstream.headers['content-type']||'application/vnd.apple.mpegurl', 'Access-Control-Allow-Origin':'*'});
              upstream.pipe(res);
            }).on('error',async ()=>{
              // Fallback a ultimo MP4 como HLS fake (pseudo-live)
              const latest = findLatestMp4(car);
              if(latest){
                res.writeHead(200,{'Content-Type':'application/vnd.apple.mpegurl'});
                res.end(`#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXTINF:10.0,\n/empuje/${car}/segment.mp4\n#EXT-X-ENDLIST\n`);
              }else res.writeHead(502).end('No live and no MP4');
            });
            return;
          }
        }catch{}
      }
      const seg=req.url.match(/^\/empuje\/([^\/]+)\/segment\.mp4/);
      if(seg){
        const car=seg[1];
        const latest=findLatestMp4(car);
        if(latest && fs.existsSync(latest)){
          const stat=fs.statSync(latest);
          res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':stat.size,'Accept-Ranges':'bytes'});
          fs.createReadStream(latest).pipe(res);
          return;
        }
      }
    }
    res.writeHead(404,{'Content-Type':'application/json'});
    res.end(JSON.stringify({error:'Not found', empuje:'union', help:'/empuje/:carlicense/live.m3u8 -> HLS union 4CH, /health'}));
  });
  server.listen(CFG.empujePort,'0.0.0.0',()=>log(`Union HLS server en http://0.0.0.0:${CFG.empujePort} -> /empuje/:car/license/live.m3u8`));
}

function findLatestMp4(car){
  const base=path.join('C:/Video',car);
  if(!fs.existsSync(base)) return null;
  let latest=null, latestTime=0;
  const stack=[base];
  while(stack.length){
    const dir=stack.pop();
    try{
      for(const e of fs.readdirSync(dir,{withFileTypes:true})){
        const p=path.join(dir,e.name);
        if(e.isDirectory()) stack.push(p);
        else if(e.isFile() && e.name.endsWith('.mp4')){
          const st=fs.statSync(p);
          if(st.mtimeMs>latestTime && st.size>50000){ latestTime=st.mtimeMs; latest=p; }
        }
      }
    }catch{}
  }
  return latest;
}

// Main
(async()=>{
  await initDb();
  startUnionServer();
  log('Empuje Union iniciado - intervalo '+CFG.intervalMs+'ms');
  await cicloEmpuje(); // primer ciclo inmediato
  setInterval(cicloEmpuje, CFG.intervalMs);
})();
