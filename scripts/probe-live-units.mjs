const base = process.env.LIVE_BASE || 'http://127.0.0.1:3000';
const vehicles = await fetch(`${base}/api/vehicles`).then(r=>r.json());
const candidates = vehicles.filter(v=>v.status!=='offline');
async function probe(v) {
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),30000);
  let bytes=0;
  const started=Date.now();
  try {
    const res=await fetch(`${base}/api/vehicles/${v.id}/live/1?audio=1`,{signal:controller.signal});
    if(!res.ok) return console.log(JSON.stringify({unit:v.unitNumber,id:v.id,status:res.status,detail:await res.text()}));
    for await(const data of res.body) { bytes+=data.length; if(bytes>40000)break; }
    console.log(JSON.stringify({unit:v.unitNumber,id:v.id,bytes,ms:Date.now()-started}));
  }catch(e){console.log(JSON.stringify({unit:v.unitNumber,id:v.id,bytes,error:e.message}));}
  finally{clearTimeout(timer);controller.abort();}
}
for(let i=0;i<candidates.length;i+=3)await Promise.all(candidates.slice(i,i+3).map(probe));
