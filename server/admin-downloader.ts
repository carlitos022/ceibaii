import type express from 'express';
import jwt from 'jsonwebtoken';
import { Readable } from 'node:stream';
import { downloaderBase, downloaderToken, publicPath } from './nacional-access';

export function registerAdminDownloader(app: express.Express, secret: string, requireAppAuth: express.RequestHandler) {
  const cookiePath = publicPath + '/admin-downloader';
  app.post('/api/admin-downloader/session', requireAppAuth, (req, res) => {
    const { uid, rid } = res.locals.auth;
    const ticket = jwt.sign({ uid, rid, scope: 'national-library' }, secret, { expiresIn: '20m' });
    res.cookie('csrs_dl', ticket, { httpOnly: true, secure: req.secure, sameSite: 'lax', path: cookiePath, maxAge: 1200000 });
    res.json({ ok: true });
  });
  app.post('/api/admin-downloader/logout', (req, res) => {
    res.clearCookie('csrs_dl', { path: cookiePath, httpOnly: true, sameSite: 'lax', secure: req.secure });
    res.json({ ok: true });
  });
  app.use('/admin-downloader', async (req, res) => {
    let claim: { uid: number; rid: number };
    try {
      const ticket = /(?:^|;\s*)csrs_dl=([^;]+)/.exec(req.headers.cookie || '')?.[1];
      const payload: any = jwt.verify(decodeURIComponent(ticket || ''), secret, { algorithms: ['HS256'] });
      if (payload.scope !== 'national-library' || !Number.isInteger(payload.uid) || !Number.isInteger(payload.rid)) throw Error('scope');
      claim = payload;
    } catch { return res.status(401).send('Inicie sesion para abrir Biblioteca'); }
    const suffix = req.originalUrl.replace(/^\/admin-downloader(?=\/|\?|$)/, '') || '/';
    if (suffix.split('?')[0] === '/api/auth/login') return res.status(403).json({ error: 'Cambie de cuenta desde la aplicacion' });
    if (suffix.split('?')[0] === '/api/auth/logout') {
      res.clearCookie('csrs_dl', { path: cookiePath }); return res.json({ code: 200 });
    }
    try {
      const headers: Record<string, string> = { authorization: 'Bearer ' + downloaderToken(claim.uid, claim.rid, secret) };
      for (const name of ['content-type', 'range', 'accept', 'idempotency-key']) if (req.headers[name]) headers[name] = String(req.headers[name]);
      const options: RequestInit = { method: req.method, headers, redirect: 'manual' };
      if (!['GET', 'HEAD'].includes(req.method) && req.body) options.body = JSON.stringify(req.body);
      const controller = new AbortController(); res.on('close', () => controller.abort()); options.signal = controller.signal;
      const upstream = await fetch(downloaderBase + (suffix.startsWith('?') ? '/' + suffix : suffix), options);
      res.status(upstream.status);
      for (const name of ['content-type', 'content-disposition', 'accept-ranges', 'content-range']) {
        const value = upstream.headers.get(name); if (value) res.setHeader(name, value);
      }
      if (suffix.split('?')[0] === '/sd.js' && upstream.ok) {
        let script = await upstream.text();
        if (!script.includes("fetch('/api'+url")) throw Error('Formato de Biblioteca inesperado');
        script = script.replace("fetch('/api'+url", `fetch('${cookiePath}/api'+url`);
        script = `function csrsProxyUrl(u){if(typeof u!=='string')return u;if(u.startsWith('${cookiePath}/'))return u;if(u.startsWith('/'))return '${cookiePath}'+u;return u;}\n` + script
          .replaceAll('esc(job.output.url)', 'esc(csrsProxyUrl(job.output.url))')
          .replaceAll('src=job.output.streamUrl', 'src=csrsProxyUrl(job.output.streamUrl)');
        script = script.replace("$('logout').onclick=async()=>{", "$('logout').onclick=async()=>{window.parent.postMessage({type:'csrs:logout'},location.origin);return;");
        res.type('application/javascript').send(script); return;
      }
      const length = upstream.headers.get('content-length');
      if (length && !upstream.headers.get('content-encoding')) res.setHeader('Content-Length', length);
      if (upstream.body) Readable.fromWeb(upstream.body as any).pipe(res); else res.end();
    } catch { if (!res.headersSent) res.status(502).send('El descargador no esta disponible'); }
  });
}
