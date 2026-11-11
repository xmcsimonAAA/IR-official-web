// Local file storage on the company server.
//   STORAGE_DIR/cms/*.json  -> content managed in the admin page
//   STORAGE_DIR/files/...   -> uploaded documents, served publicly at /files/...
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(process.env.STORAGE_DIR || path.join(__dirname, '..', 'storage'));
const FILES = path.join(ROOT, 'files');
const CMS = path.join(ROOT, 'cms');

function ensureDirs() { fs.mkdirSync(FILES, { recursive: true }); fs.mkdirSync(CMS, { recursive: true }); }

function writable() {
  try { if (fs.existsSync(path.join(ROOT, '.migration.lock'))) return false; ensureDirs(); const t = path.join(CMS, '.write-test-' + process.pid); fs.writeFileSync(t, 'ok'); fs.unlinkSync(t); return true; } catch (e) { return false; }
}

// admin-managed content: 'docs.json' or 'news.json'
function readJSON(name) {
  try { return JSON.parse(fs.readFileSync(path.join(CMS, path.basename(name)), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
function writeJSON(name, data) {
  if (fs.existsSync(path.join(ROOT, '.migration.lock'))) throw new Error('migration_in_progress');
  ensureDirs();
  const file = path.join(CMS, path.basename(name));
  const tmp = file + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, file);   // atomic replace: readers never see a half-written file
}

// uploaded files
function cleanSegment(s) {
  const v = String(s).replace(/[\\/?#%*:|"<>\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').replace(/^[\s.]+|[\s.]+$/g, '').slice(-150).replace(/^[\s.]+/, '');
  return v || 'file';
}
function filePathFromUrl(u) {
  // accepts '/files/...' or 'https://host/files/...'; refuses anything outside the files folder
  const m = /^(?:https?:\/\/[^/]+)?\/files\/(.+)$/.exec(String(u || '').split('?')[0].split('#')[0]);
  if (!m) return null;
  let rel;
  try { rel = decodeURIComponent(m[1]); } catch (e) { return null; }
  if (rel.includes('\0')) return null;
  const p = path.resolve(FILES, rel);
  return p.startsWith(FILES + path.sep) ? p : null;
}
function urlFor(rel) { return '/files/' + rel.split('/').map(encodeURIComponent).join('/'); }
const isLocalFile = (u) => !!filePathFromUrl(u);
function deleteFiles(urls) {
  let n = 0;
  for (const u of [].concat(urls || [])) {
    const p = filePathFromUrl(u);
    if (!p) continue;
    try { fs.unlinkSync(p); n++; try { fs.rmdirSync(path.dirname(p)); } catch (e) { /* folder not empty */ } } catch (e) { /* already gone */ }
  }
  return n;
}

module.exports = { ROOT, FILES, CMS, ensureDirs, writable, readJSON, writeJSON, cleanSegment, filePathFromUrl, urlFor, isLocalFile, deleteFiles };
