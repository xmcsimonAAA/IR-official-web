// POST /api/upload?name=<original file name>
// Body: the raw file bytes. Header x-admin-password is required.
// The file is saved under STORAGE_DIR/files/docs/<date-random>/<original name> and served at /files/...
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./_store.js');

const ALLOWED = ['.pdf', '.ppt', '.pptx', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg'];
const okPw = (p) => !!process.env.ADMIN_PASSWORD && typeof p === 'string' && p === process.env.ADMIN_PASSWORD;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const MAX = (+process.env.UPLOAD_MAX_MB || 200) * 1024 * 1024;
  const reject = (status, error) => { req.resume(); return res.status(status).json({ error }); };
  if (req.method !== 'POST') return reject(405, 'method_not_allowed');
  if (!okPw(req.headers['x-admin-password'])) return reject(401, 'unauthorized');
  if (!store.writable()) return reject(503, 'storage_not_configured');
  const name = store.cleanSegment((req.query && req.query.name) || '');
  const ext = path.extname(name).toLowerCase();
  if (!ALLOWED.includes(ext)) return reject(415, 'file_type_not_allowed');
  const declared = +req.headers['content-length'] || 0;
  if (declared > MAX) return reject(413, 'too_large');

  const d = new Date();
  const folder = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + crypto.randomBytes(4).toString('hex');
  const rel = 'docs/' + folder + '/' + name;
  const dest = path.join(store.FILES, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = dest + '.part';

  await new Promise((resolve) => {
    let size = 0, failed = false;
    const timer = setTimeout(() => fail(408, 'upload_timeout'), (+process.env.UPLOAD_TIMEOUT_SECONDS || 900) * 1000);
    const out = fs.createWriteStream(tmp);
    const fail = (status, error) => {
      if (failed) return; failed = true;
      clearTimeout(timer);
      req.unpipe(out); req.resume();
      out.once('close', () => fs.unlink(tmp, () => fs.rmdir(path.dirname(dest), () => {})));
      out.destroy();
      res.status(status).json({ error }); resolve();
    };
    req.on('data', (c) => { size += c.length; if (size > MAX) fail(413, 'too_large'); });
    req.on('aborted', () => fail(400, 'upload_aborted'));
    req.on('error', () => fail(400, 'upload_failed'));
    out.on('error', () => fail(500, 'write_failed'));
    out.on('finish', () => {
      if (failed) return;
      if (!size) return fail(400, 'empty_file');
      if (declared && size !== declared) return fail(400, 'upload_incomplete');
      fs.rename(tmp, dest, (err) => {
        if (err) return fail(500, 'write_failed');
        if (failed) { fs.unlink(dest, () => {}); return; }
        clearTimeout(timer);
        res.status(200).json({ url: store.urlFor(rel), pathname: rel, size });
        resolve();
      });
    });
    req.pipe(out);
  });
};
