'use strict';
require('../api/_env.js')();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const target = (process.argv[2] || process.env.SITE_URL || '').replace(/\/$/, '');
const localOnly = process.argv.includes('--local');
let failed = false;
function check(ok, name) { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) failed = true; }
async function get(route, json = true) {
  const r = await fetch(target + route, { signal: AbortSignal.timeout(35000), redirect: 'error' });
  if (!r.ok) throw new Error(route + ' HTTP ' + r.status);
  return json ? r.json() : r.text();
}
(async () => {
  if (!/^https?:\/\//.test(target)) throw new Error('Usage: node tools/verify.js https://ir.xmax.com [--local]');
  const destination = new URL(target);
  const isLoopback = ['127.0.0.1','localhost','[::1]'].includes(destination.hostname);
  if (destination.username || destination.password || destination.pathname !== '/' || destination.search || destination.hash) throw new Error('Target must be an origin without credentials');
  if (!isLoopback && (destination.protocol !== 'https:' || destination.origin !== new URL(process.env.SITE_URL).origin)) throw new Error('Refusing to send admin credential outside configured HTTPS SITE_URL');
  check((await get('/', false)).includes('XMax'), 'homepage');
  const health = await get('/healthz'); check(health.ok && health.storage && health.version === require('../package.json').version, 'health + expected release version');
  const docs = await get('/api/docs?fresh=1'); check(Array.isArray(docs.data.governance) && Array.isArray(docs.data.presentations), 'documents JSON');
  const cms = await get('/api/newscms?fresh=1'); check(Array.isArray(cms.data.items) && cms.data.overrides, 'news CMS JSON');
  for (const route of ['/.env','/server.js','/api/_store']) { const r = await fetch(target + route, { signal: AbortSignal.timeout(10000) }); check(r.status === 404, 'private path blocked ' + route); }
  const login = await fetch(target + '/api/docs?check=1', { headers: { 'x-admin-password': process.env.ADMIN_PASSWORD || '' }, signal: AbortSignal.timeout(10000) });
  const auth = await login.json(); check(auth.ok === true && auth.storage, 'configured admin credential');
  const dir = process.env.STORAGE_DIR;
  const manifestFile = dir && path.join(dir, 'cms/migration-manifest.json');
  if (manifestFile && fs.existsSync(manifestFile)) {
    const m = JSON.parse(fs.readFileSync(manifestFile));
    check(docs.data.governance.length === m.counts.governance && docs.data.presentations.length === m.counts.presentations && cms.data.items.length === m.counts.news && Object.keys(cms.data.overrides).length === m.counts.overrides, 'migration content counts (before first edit)');
    for (const file of m.files) {
      const r = await fetch(target + file.url, { signal: AbortSignal.timeout(120000), redirect:'error' });
      if (!r.ok) { check(false, 'migrated file HTTP ' + r.status); continue; }
      const bytes = Buffer.from(await r.arrayBuffer());
      check(bytes.length === file.size && crypto.createHash('sha256').update(bytes).digest('hex') === file.sha256, 'migrated file ' + file.rel);
    }
  } else if (localOnly) console.log('NOTE no migration manifest; old content migration has NOT been verified.');
  else check(false, 'migration manifest required for production acceptance');
  if (!localOnly) {
    const quote = await get('/api/quote'); check(Number.isFinite(quote.data?.price) && quote.data.price > 0, 'real quote');
    const filings = await get('/api/filings'); check(Array.isArray(filings.data) && filings.data.length > 0, 'real SEC filings');
    const financials = await get('/api/financials'); check(financials.data?.quarters?.length > 0 && financials.data?.latest?.end, 'real SEC financials');
    const news = await get('/api/news'); check(news.data?.length > 0, 'news list');
    const first = news.data?.[0]; if (first) { const debug = await get('/news/' + first.id + '?debug=1'); check(debug.ok === true, 'latest news full text'); }
    const sitemap = await get('/sitemap.xml', false); check(sitemap.includes(target + '/news/') && !/vercel(?:-storage)?\./i.test(sitemap), 'sitemap domain');
  }
})().catch(e => { check(false, e.message); }).finally(() => { process.exitCode = failed ? 1 : 0; });
