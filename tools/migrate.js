// Stop the service before applying a migration. --dry-run validates without changing storage.
'use strict';
require('../api/_env.js')();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');
const store = require('../api/_store.js');
const { cleanBody, safeUrl } = require('../api/_html.js');
const OLD = process.argv.find((x, i) => i > 1 && !x.startsWith('--'));
const FORCE = process.argv.includes('--force');
const DRY = process.argv.includes('--dry-run');
const timeout = () => AbortSignal.timeout(120000);
const hosts = (process.env.MIGRATE_FILE_HOST || 'blob.vercel-storage.com').split(',').map(x => x.trim().replace(/^\./, '').toLowerCase());
const hostMatches = (host, suffix) => host === suffix || host.endsWith('.' + suffix);
const run = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(4).toString('hex');
const lock = path.join(store.ROOT, '.migration.lock');
let stage, backup, locked = false, movedOld = false, committed = false;
const mappings = new Map();
const files = [];
function assert(ok, message) { if (!ok) throw new Error(message); }
async function getJSON(url) {
  const r = await fetch(url, { signal: timeout(), headers: { 'cache-control': 'no-cache' } });
  assert(r.ok, 'Source API HTTP ' + r.status);
  return r.json();
}
function sourceUrl(value) {
  if (!value) return null;
  try {
    const u = new URL(value, OLD);
    const legacy = hosts.some(h => hostMatches(u.hostname, h));
    const local = new URL(OLD).origin === u.origin && /^\/(files|__blob)\//.test(u.pathname);
    return (legacy || local) && ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password ? u.href : null;
  } catch { return null; }
}
function mapUrl(value) {
  const source = sourceUrl(value);
  if (!source) return value;
  if (!mappings.has(source)) {
    const name = store.cleanSegment(decodeURIComponent(new URL(source).pathname.split('/').pop() || 'file'));
    const rel = 'migrated/' + run + '/' + crypto.createHash('sha256').update(source).digest('hex').slice(0, 20) + '-' + name;
    mappings.set(source, { source, rel, url: store.urlFor(rel) });
  }
  return mappings.get(source).url;
}
function validate(docs, news) {
  assert(docs && Array.isArray(docs.governance) && Array.isArray(docs.presentations), 'Invalid source documents: expected governance and presentations arrays');
  for (const x of [...docs.governance, ...docs.presentations]) assert(x && typeof x.id === 'string' && x.title && typeof x.title.en === 'string' && typeof x.url === 'string', 'Invalid document item');
  assert(news && Array.isArray(news.items) && news.overrides && typeof news.overrides === 'object' && !Array.isArray(news.overrides), 'Invalid source news: expected items array and overrides object; refusing an empty fallback');
  assert(docs.governance.length <= 80 && docs.presentations.length <= 80 && news.items.length <= 500 && Object.keys(news.overrides).length <= 500, 'Source exceeds CMS supported limits');
  assert(JSON.stringify(news).length <= 4000000, 'Source news exceeds supported CMS size');
  const ids = new Set();
  for (const x of news.items) {
    assert(x && /^n-[a-z0-9]{4,30}$/.test(x.id || '') && !ids.has(x.id) && /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') && x.title && typeof x.title.en === 'string' && x.title.en.trim(), 'Invalid/duplicate source news item');
    assert(typeof x.body === 'string' && x.body.length <= 400000 && typeof x.url === 'string' && (x.body.trim() || x.url), 'Invalid news content');
    ids.add(x.id);
  }
}
function rewrite(value, key = '') {
  if (Array.isArray(value)) return value.map(x => rewrite(x));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, rewrite(v,k)]));
  if (typeof value !== 'string') return value;
  if (key === 'body') return cleanBody(value, mapUrl);
  if (key === 'url' && value) { assert(safeUrl(value) || sourceUrl(value), 'Invalid source file/news URL'); return mapUrl(value); }
  return value;
}
function checkNoLegacy(value) {
  const urls = JSON.stringify(value).match(/https?:[^\s<>"\\]+/g) || [];
  for (const url of urls) {
    const host = new URL(url).hostname;
    assert(!hosts.some(h => hostMatches(host, h)) && !hostMatches(host, 'vercel.app') && !sourceUrl(url), 'Unmigrated legacy URL remains; inspect source content before retrying');
  }
}
async function download(entry) {
  const r = await fetch(entry.source, { signal: timeout() });
  assert(r.ok && r.body, 'File download HTTP ' + r.status);
  assert(!/text\/html|application\/json/i.test(r.headers.get('content-type') || ''), 'File URL returned HTML/JSON instead of a document');
  const dest = path.join(stage, 'files', entry.rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let size = 0;
  const hash = crypto.createHash('sha256');
  const max = (+process.env.UPLOAD_MAX_MB || 200) * 1048576;
  const meter = new Transform({ transform(chunk, enc, cb) { size += chunk.length; if (size > max) return cb(new Error('Migration file exceeds UPLOAD_MAX_MB')); hash.update(chunk); cb(null, chunk); } });
  await pipeline(Readable.fromWeb(r.body), meter, fs.createWriteStream(dest, { flags: 'wx' }));
  assert(size > 0, 'Downloaded empty file');
  const expected = r.headers.get('content-length');
  if (expected && !r.headers.get('content-encoding')) assert(size === +expected, 'Downloaded file size mismatch');
  const sha256 = hash.digest('hex');
  assert(crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex') === sha256, 'Saved file checksum mismatch');
  files.push({ ...entry, size, sha256 });
}
(async () => {
  assert(OLD && /^https?:\/\//.test(OLD), 'Usage: node tools/migrate.js https://old-site [--dry-run] [--force]');
  const origin = new URL(OLD); assert(!origin.username && !origin.password && origin.pathname === '/' && !origin.search && !origin.hash, 'Source must be an origin without credentials or query');
  assert(!fs.existsSync(lock), 'Migration lock exists; inspect/recover the previous migration');
  if (!FORCE) assert(!fs.existsSync(path.join(store.CMS, 'docs.json')) && !fs.existsSync(path.join(store.CMS, 'news.json')), 'Existing CMS content; back up and use --force only for a deliberate replacement');
  const docsSource = (await getJSON(origin.origin + '/api/docs?fresh=1')).data;
  const newsSource = (await getJSON(origin.origin + '/api/newscms?fresh=1')).data;
  validate(docsSource, newsSource);
  const docs = rewrite({ ...docsSource, trash: [] }), news = rewrite(newsSource);
  for (const item of news.items) assert(item.body.replace(/<[^>]+>/g, '').trim() || item.url, 'News body became empty after safety filtering; inspect source: ' + item.id);
  docs.trash = []; docs.updated = news.updated = new Date().toISOString();
  checkNoLegacy({ docs, news });
  const counts = { governance: docs.governance.length, presentations: docs.presentations.length, news: news.items.length, overrides: Object.keys(news.overrides).length, files: mappings.size };
  console.log(JSON.stringify({ dryRun: DRY, source: origin.origin, counts }));
  if (DRY) { console.log('Preflight only: files have NOT been downloaded or verified.'); return; }
  store.ensureDirs();
  const fd = fs.openSync(lock, 'wx', 0o600); locked = true; fs.writeFileSync(fd, JSON.stringify({ run, pid: process.pid })); fs.closeSync(fd);
  stage = fs.mkdtempSync(path.join(store.ROOT, '.migration-'));
  for (const entry of mappings.values()) await download(entry);
  const stagedCms = path.join(stage, 'cms'); fs.mkdirSync(stagedCms);
  // Preserve unrelated CMS files on replacement; snapshots are retained under backups/.
  fs.cpSync(store.CMS, stagedCms, { recursive: true });
  fs.writeFileSync(path.join(stagedCms, 'docs.json'), JSON.stringify(docs));
  fs.writeFileSync(path.join(stagedCms, 'news.json'), JSON.stringify(news));
  const manifest = { run, source: origin.origin, counts, files, sanitizedNewsBodies: news.items.filter((x,i) => x.body !== newsSource.items[i].body).map(x => x.id) };
  fs.writeFileSync(path.join(stagedCms, 'migration-manifest.json'), JSON.stringify(manifest, null, 2));
  if (files.length) {
    fs.mkdirSync(path.join(store.FILES, 'migrated'), { recursive: true });
    fs.renameSync(path.join(stage, 'files/migrated', run), path.join(store.FILES, 'migrated', run));
  }
  backup = path.join(store.ROOT, 'backups', run); fs.mkdirSync(backup, { recursive: true });
  fs.writeFileSync(path.join(backup, 'source-docs.json'), JSON.stringify(docsSource));
  fs.writeFileSync(path.join(backup, 'source-news.json'), JSON.stringify(newsSource));
  fs.renameSync(store.CMS, path.join(backup, 'cms')); movedOld = true;
  fs.renameSync(stagedCms, store.CMS); committed = true;
  console.log('COMMITTED: ' + path.join(store.CMS, 'migration-manifest.json'));
  console.log('Previous CMS and source snapshot: ' + backup);
})().catch(e => {
  if (movedOld && !committed) {
    try { fs.renameSync(path.join(backup, 'cms'), store.CMS); } catch { console.error('ROLLBACK FAILED: retain migration lock, restore CMS from ' + backup); locked = false; }
  }
  console.error('Migration failed: ' + e.message); process.exitCode = 1;
}).finally(() => {
  if (stage) fs.rmSync(stage, { recursive: true, force: true });
  if (locked) fs.unlinkSync(lock);
});
