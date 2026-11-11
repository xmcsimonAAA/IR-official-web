'use strict';
require('../api/_env.js')();
const fs = require('fs');
const path = require('path');
function validate() {
  const errors = [];
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || major === 22 && minor < 12) errors.push('Node.js >=22.12.0 is required');
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 24) errors.push('ADMIN_PASSWORD must have at least 24 characters');
  if (!process.env.QUOTE_API_KEY?.trim()) errors.push('QUOTE_API_KEY is required');
  if (!process.env.SEC_UA || !/@/.test(process.env.SEC_UA)) errors.push('SEC_UA must include a company contact email');
  try { const u = new URL(process.env.SITE_URL); if (u.protocol !== 'https:' || u.pathname !== '/' || u.search || u.hash || u.username || u.password) throw 0; } catch { errors.push('SITE_URL must be an HTTPS origin'); }
  const storage = process.env.STORAGE_DIR;
  if (!storage || !path.isAbsolute(storage) || (path.resolve(storage) === path.resolve(__dirname, '../public') || path.resolve(storage).startsWith(path.resolve(__dirname, '../public') + path.sep))) errors.push('STORAGE_DIR must be absolute and outside public/');
  if (storage) {
    try { fs.accessSync(storage, fs.constants.R_OK | fs.constants.W_OK); } catch { errors.push('STORAGE_DIR must exist and be readable/writable by this user'); }
    if (fs.existsSync(path.join(storage, '.migration.lock'))) errors.push('Migration lock present; inspect/recover before starting');
    for (const name of ['docs.json','news.json']) try { const file = path.join(storage, 'cms', name); if (fs.existsSync(file)) JSON.parse(fs.readFileSync(file, 'utf8')); } catch { errors.push('Corrupt CMS JSON: ' + name); }
  }
  if (process.env.HOST && !['127.0.0.1','::1'].includes(process.env.HOST)) errors.push('HOST must be a loopback address behind Nginx');
  for (const key of ['UPLOAD_MAX_MB','UPLOAD_TIMEOUT_SECONDS']) if (process.env[key] && (!Number.isFinite(+process.env[key]) || +process.env[key] <= 0)) errors.push(key + ' must be positive');
  const env = path.join(__dirname, '../.env');
  if (process.platform !== 'win32' && fs.existsSync(env) && (fs.statSync(env).mode & 0o007)) errors.push('.env must not be accessible to other users (use chmod 640)');
  try {
    require('sanitize-html');
    const bundled = fs.readFileSync(path.join(__dirname, '../public/vendor/purify.min.js'));
    const installed = fs.readFileSync(require.resolve('dompurify/dist/purify.min.js'));
    if (!bundled.equals(installed)) errors.push('DOMPurify browser bundle differs from installed locked version');
  } catch { errors.push('Dependencies/vendor assets missing; run npm ci --omit=dev --ignore-scripts'); }
  if (errors.length) throw new Error(errors.join('\n'));
  return true;
}
module.exports = { validate };
if (require.main === module) try { validate(); console.log('Preflight passed (local configuration only; run verify after starting).'); } catch (e) { console.error(e.message); process.exitCode = 1; }
