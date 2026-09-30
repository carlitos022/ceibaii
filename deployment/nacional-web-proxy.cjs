'use strict';
const http = require('node:http');
module.exports = function nacionalWebProxy(req, res) {
  const route = req.originalUrl.replace(/^\/app(?=\/|\?|$)/, '') || '/';
  if (req.originalUrl === '/app') { res.redirect(302, '/app/'); return; }
  const headers = { ...req.headers, host: '127.0.0.1:3000', 'x-forwarded-for': req.ip,
    'x-forwarded-proto': req.secure ? 'https' : 'http' };
  delete headers.connection; delete headers['content-length']; delete headers['transfer-encoding'];
  let body;
  if (!['GET', 'HEAD'].includes(req.method)) {
    body = JSON.stringify(req.body || {}); headers['content-length'] = Buffer.byteLength(body);
  }
  const upstream = http.request({ host: '127.0.0.1', port: 3000, method: req.method,
    path: route.startsWith('?') ? '/' + route : route, headers }, incoming => {
    res.status(incoming.statusCode);
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (value !== undefined && !['connection','transfer-encoding'].includes(name.toLowerCase())) res.setHeader(name, value);
    }
    incoming.on('error', () => res.destroy()); incoming.pipe(res);
  });
  upstream.on('error', () => { if (!res.headersSent) res.status(502).send('La web Nacional no esta disponible'); });
  upstream.setTimeout(180000, () => upstream.destroy());
  res.on('close', () => upstream.destroy());
  upstream.end(body);
};
