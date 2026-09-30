import type express from 'express';
import jwt from 'jsonwebtoken';
import { Readable } from 'stream';

export function registerAdminDownloader(
  app: express.Express,
  secret: string,
  requireAppAuth: express.RequestHandler
) {
  app.post('/api/admin-downloader/session', requireAppAuth, (req, res) => {
    const { uid, rid } = res.locals.auth || {};
    if (rid !== 1) return res.status(403).json({ error: 'Solo el administrador puede usar Biblioteca' });
    const ticket = jwt.sign({ uid, rid, scope: 'admin-downloader' }, secret, { expiresIn: '20m' });
    res.cookie('csrs_dl', ticket, {
      httpOnly: true, secure: true, sameSite: 'lax',
      path: '/admin-downloader', maxAge: 20 * 60 * 1000
    });
    res.json({ ok: true });
  });

  app.use('/admin-downloader', async (req, res) => {
    const ticket = /(?:^|;\s*)csrs_dl=([^;]+)/.exec(req.headers.cookie || '')?.[1];
    try {
      const claim = jwt.verify(decodeURIComponent(ticket || ''), secret, { algorithms: ['HS256'] }) as any;
      if (claim.scope !== 'admin-downloader' || Number(claim.rid) !== 1) throw new Error('forbidden');
    } catch {
      return res.status(403).send('Solo el administrador puede usar Biblioteca');
    }

    const suffix = req.originalUrl.replace(/^\/admin-downloader(?=\/|\?|$)/, '') || '/';
    const upstreamUrl = 'http://127.0.0.1:12058' + (suffix.startsWith('?') ? '/' + suffix : suffix);
    try {
      const headers: Record<string, string> = {};
      for (const key of ['cookie', 'content-type', 'range', 'accept']) {
        if (req.headers[key]) headers[key] = String(req.headers[key]);
      }
      const method = req.method;
      const options: RequestInit = { method, headers, redirect: 'manual' };
      if (method !== 'GET' && method !== 'HEAD' && req.body && Object.keys(req.body).length) {
        options.body = JSON.stringify(req.body);
      }
      const upstream = await fetch(upstreamUrl, options);
      res.status(upstream.status);
      for (const key of ['content-type', 'content-disposition', 'accept-ranges', 'content-range', 'location']) {
        const value = upstream.headers.get(key);
        if (value) res.setHeader(key, key === 'location' && value.startsWith('/')
          ? '/admin-downloader' + value : value);
      }
      const setCookies = upstream.headers.getSetCookie();
      if (setCookies.length) res.setHeader('Set-Cookie', setCookies.map(value =>
        /;\s*Path=/i.test(value)
          ? value.replace(/;\s*Path=[^;]*/i, '; Path=/admin-downloader')
          : value + '; Path=/admin-downloader'
      ));
      if (suffix.split('?')[0] === '/sd.js' && upstream.ok) {
        let script = await upstream.text();
        if (!script.includes("fetch('/api'+url")) throw new Error('Downloader script format changed');
        script = script.replace("fetch('/api'+url", "fetch('/admin-downloader/api'+url");
        script = `function csrsProxyUrl(u){if(typeof u!=='string')return u;if(u.startsWith('/admin-downloader/'))return u;if(u.startsWith('/'))return '/admin-downloader'+u;try{const x=new URL(u);if(x.port==='12058')return '/admin-downloader'+x.pathname+x.search;}catch{}return u;}\n` +
          script.replaceAll('esc(job.output.url)', 'esc(csrsProxyUrl(job.output.url))')
                .replaceAll('src=job.output.streamUrl', 'src=csrsProxyUrl(job.output.streamUrl)');
        res.type('application/javascript').send(script);
        return;
      }
      if (upstream.body) Readable.fromWeb(upstream.body as any).pipe(res);
      else res.end();
    } catch (error) {
      console.error('[Admin downloader proxy]', error);
      if (!res.headersSent) res.status(502).send('El descargador no esta disponible');
    }
  });
}
