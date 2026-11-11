// XMax IR website server (Node.js 18+, no external dependencies).
// Serves the static site, uploaded files and the API, and caches API responses.
// Run behind Nginx (HTTPS). Configuration: environment variables or a .env file next to this script.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

/* ---------- configuration ---------- */
require('./api/_env.js')();
const PORT = process.env.PORT === undefined ? 3000 : Number(process.env.PORT);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC = path.join(__dirname, 'public');
const store = require('./api/_store.js');
const version = require('./package.json').version;
if (process.env.NODE_ENV === 'production') require('./tools/preflight.js').validate();
if (fs.existsSync(path.join(store.ROOT, '.migration.lock'))) throw new Error('Migration lock exists: finish or recover migration before starting');

const API = {}; // only these names are reachable from the web (helpers starting with "_" are not)
for (const n of ['quote', 'filings', 'financials', 'news', 'newscms', 'docs', 'upload', 'article', 'sitemap', 'robots']) {
  API[n] = require('./api/' + n + '.js');
}
const STREAMING = new Set(['upload']);          // these read the request body themselves
const INVALIDATES = new Set(['docs', 'newscms']); // a successful POST clears the response cache

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf', '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/* ---------- response cache (stands in for a CDN; honours s-maxage / stale-while-revalidate) ---------- */
const cache = new Map();      // key -> { status, headers, body, fresh, stale }
const inflight = new Map();   // key -> Promise (one upstream call per key at a time)
const MAX_ENTRIES = 1000;
function cacheTimes(headers) {
  const cc = String(headers['cache-control'] || '');
  if (/no-store|private/.test(cc)) return null;
  const m = /s-maxage=(\d+)/.exec(cc); if (!m) return null;
  const swr = /stale-while-revalidate=(\d+)/.exec(cc);
  return { maxAge: +m[1], swr: swr ? +swr[1] : 0 };
}

/* ---------- request/response helpers for the API functions (req.query, req.body, res.status/json/send) ---------- */
function runFunction(name, req, query, body) {
  return new Promise((resolve) => {
    const out = { status: 200, headers: {}, body: Buffer.alloc(0), done: false };
    const finish = () => { if (!out.done) { out.done = true; clearTimeout(timer); resolve(out); } };
    const res = {
      get statusCode() { return out.status; }, set statusCode(v) { out.status = v; },
      setHeader(k, v) { out.headers[String(k).toLowerCase()] = String(v); return res; },
      getHeader(k) { return out.headers[String(k).toLowerCase()]; },
      status(c) { out.status = c; return res; },
      json(o) { if (!out.headers['content-type']) out.headers['content-type'] = 'application/json; charset=utf-8'; out.body = Buffer.from(JSON.stringify(o)); finish(); return res; },
      send(b) { out.body = Buffer.isBuffer(b) ? b : Buffer.from(typeof b === 'string' ? b : JSON.stringify(b)); finish(); return res; },
      end(b) { if (b) out.body = Buffer.isBuffer(b) ? b : Buffer.from(String(b)); finish(); return res; },
      get writableEnded() { return out.done; },
    };
    req.query = query; req.body = body;
    const timer = name === 'upload' ? null : setTimeout(() => { if (!out.done) { out.status = 504; out.headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }; out.body = Buffer.from('{"error":"timeout"}'); finish(); } }, 30000);
    Promise.resolve().then(() => API[name](req, res)).catch((e) => {
      console.error('[api:' + name + ']', e && e.stack || e);
      if (!out.done) { out.status = 500; out.headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }; out.body = Buffer.from('{"error":"internal_error"}'); finish(); }
    }).finally(() => { setTimeout(() => { clearTimeout(timer); finish(); }, 0); });
  });
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    let over = false;
    req.on('data', (c) => {
      if (over) return;
      size += c.length;
      if (size > limit) { over = true; chunks.length = 0; reject(Object.assign(new Error('too_large'), { code: 413 })); }   // keep draining so a proper 413 can be sent
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/* ---------- helpers ---------- */
const SEC_HEADERS = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'x-frame-options': 'SAMEORIGIN' };
function send(res, status, headers, body, head) {
  res.writeHead(status, Object.assign({}, SEC_HEADERS, headers, { 'content-length': body ? body.length : 0 }));
  res.end(head ? undefined : body);
}
function sendJSON(res, status, obj) { send(res, status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, Buffer.from(JSON.stringify(obj))); }
function notFound(res) { send(res, 404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }, Buffer.from('Not found')); }

function serveFile(req, res, file, cacheControl, extraHeaders) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return notFound(res);
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const headers = Object.assign({}, SEC_HEADERS, { 'content-type': type, 'cache-control': cacheControl, 'accept-ranges': 'bytes', 'last-modified': st.mtime.toUTCString() }, extraHeaders || {});
    if (req.headers['if-modified-since'] && new Date(req.headers['if-modified-since']) >= new Date(st.mtime.toUTCString())) { res.writeHead(304, headers); return res.end(); }
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      let start = range[1] === '' ? Math.max(0, st.size - +range[2]) : +range[1];
      let end = range[1] !== '' && range[2] !== '' ? Math.min(+range[2], st.size - 1) : st.size - 1;
      if (start > end || start >= st.size) { res.writeHead(416, Object.assign(headers, { 'content-range': 'bytes */' + st.size })); return res.end(); }
      res.writeHead(206, Object.assign(headers, { 'content-range': `bytes ${start}-${end}/${st.size}`, 'content-length': end - start + 1 }));
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, Object.assign(headers, { 'content-length': st.size }));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------- request handling ---------- */
async function handle(req, res) {
  let u;
  try { u = new URL(req.url, 'http://localhost'); } catch (e) { return notFound(res); }
  let pathname;
  try { pathname = decodeURIComponent(u.pathname); } catch (e) { return notFound(res); }
  if (pathname.includes('\0')) return notFound(res);
  const query = {};
  for (const [k, v] of u.searchParams) if (!(k in query)) query[k] = v;
  const isGet = req.method === 'GET' || req.method === 'HEAD';

  // health check for monitoring
  if (pathname === '/healthz') { const storage = store.writable(); return sendJSON(res, storage ? 200 : 503, { ok: storage, storage, version }); }
  if (fs.existsSync(path.join(store.ROOT, '.migration.lock'))) return sendJSON(res, 503, { error: 'migration_in_progress' });

  // uploaded files
  if (pathname.startsWith('/files/')) {
    if (!isGet) return notFound(res);
    const file = store.filePathFromUrl(u.pathname);
    if (!file) return notFound(res);
    return serveFile(req, res, file, 'public, max-age=300', { 'content-disposition': 'inline', 'content-security-policy': "default-src 'none'; sandbox" });
  }

  // page routes handled by API functions
  let fn = null;
  let m;
  if ((m = /^\/news\/([^/]+)\/?$/.exec(pathname))) { fn = 'article'; query.id = m[1]; }
  else if (pathname === '/sitemap.xml') fn = 'sitemap';
  else if (pathname === '/robots.txt') fn = 'robots';
  else if ((m = /^\/api\/([a-z]+)\/?$/.exec(pathname)) && API[m[1]]) fn = m[1];
  else if (pathname.startsWith('/api/')) return notFound(res);

  if (fn) {
    if ((req.method === 'POST' && ['docs','newscms','upload'].includes(fn)) || (fn === 'docs' && query.check)) {
      const status = require('./api/_auth.js').authorize(req);
      if (status !== 200) { req.resume(); if (status === 429) res.setHeader('retry-after', '900'); return sendJSON(res, status, { error: status === 429 ? 'too_many_attempts' : 'unauthorized' }); }
    }
    let body;
    if (!isGet && !STREAMING.has(fn)) {
      try {
        const raw = await readBody(req, 5 * 1024 * 1024);
        const text = raw.toString('utf8');
        body = /json/.test(req.headers['content-type'] || '') && text ? JSON.parse(text) : (text || undefined);
      } catch (e) {
        if (e.code === 413) { res.setHeader('connection', 'close'); return sendJSON(res, 413, { error: 'too_large' }); }
        return sendJSON(res, 400, { error: 'bad_request' });
      }
    }
    const key = isGet && !req.headers['x-admin-password'] && !query.check && !query.fresh && !query.base ? fn + ' ' + u.pathname + u.search : null;
    const now = Date.now();
    const hit = key && cache.get(key);
    if (hit && now < hit.fresh) return send(res, hit.status, Object.assign({}, hit.headers, { 'x-cache': 'HIT' }), hit.body, req.method === 'HEAD');
    const compute = () => {
      if (inflight.has(key)) return inflight.get(key);
      const p = runFunction(fn, req, Object.assign({}, query), body).then((out) => {
        const t = out.status === 200 && cacheTimes(out.headers);
        if (key && t) {
          if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
          cache.set(key, { status: out.status, headers: out.headers, body: out.body, fresh: Date.now() + t.maxAge * 1000, stale: Date.now() + (t.maxAge + t.swr) * 1000 });
        }
        return out;
      }).finally(() => { if (key) inflight.delete(key); });
      if (key) inflight.set(key, p);
      return p;
    };
    if (hit && now < hit.stale) {                       // serve stale, refresh in the background
      compute().catch(() => {});
      return send(res, hit.status, Object.assign({}, hit.headers, { 'x-cache': 'STALE' }), hit.body, req.method === 'HEAD');
    }
    const out = key ? await compute() : await runFunction(fn, req, query, body);
    if (!isGet && INVALIDATES.has(fn) && out.status === 200) cache.clear();
    return send(res, out.status, Object.assign({}, out.headers, { 'x-cache': key ? 'MISS' : 'BYPASS' }), out.body, req.method === 'HEAD');
  }

  // static site
  if (!isGet) return notFound(res);
  let rel = pathname === '/' ? '/index.html' : pathname;
  if (rel.split('/').some((s) => s.startsWith('.'))) return notFound(res);   // no dotfiles
  const file = path.resolve(PUBLIC, '.' + rel);
  if (!file.startsWith(PUBLIC + path.sep)) return notFound(res);
  const ext = path.extname(file).toLowerCase();
  const cc = ext === '.html' ? 'no-cache' : ext === '.woff2' ? 'public, max-age=2592000, immutable' : 'public, max-age=86400';
  const extra = path.basename(file) === 'admin.html' ? { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } : null;
  return serveFile(req, res, file, cc, extra);
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error('[server]', e && e.stack || e);
    if (!res.headersSent) sendJSON(res, 500, { error: 'internal_error' }); else res.end();
  });
});
server.requestTimeout = ((+process.env.UPLOAD_TIMEOUT_SECONDS || 900) + 10) * 1000;   // large uploads on slow connections
server.headersTimeout = 60 * 1000;
store.ensureDirs();
server.listen(PORT, HOST, () => {
  console.log(`XMax IR server listening on http://${HOST}:${server.address().port}  (storage: ${store.ROOT}, writable: ${store.writable()})`);
  if (!process.env.ADMIN_PASSWORD) console.warn('WARNING: ADMIN_PASSWORD is not set; the admin page cannot be used.');
  if (!process.env.QUOTE_API_KEY) console.warn('WARNING: QUOTE_API_KEY is not set; the stock quote will not show.');
  if (!process.env.SITE_URL) console.warn('WARNING: SITE_URL is not set; canonical links will use the request host.');
});
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 5000).unref(); });
