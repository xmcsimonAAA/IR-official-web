'use strict';
const crypto = require('crypto');
const attempts = new Map();
const WINDOW = 15 * 60 * 1000;
function authorize(req) {
  const now = Date.now();
  // Nginx overwrites X-Forwarded-For with the actual connecting address.
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'local';
  const record = attempts.get(ip);
  if (record && record.until > now && record.count >= 10) return 429;
  const expected = process.env.ADMIN_PASSWORD || '';
  const supplied = req.headers['x-admin-password'];
  const hash = x => crypto.createHash('sha256').update(x).digest();
  const ok = expected && typeof supplied === 'string' && crypto.timingSafeEqual(hash(expected), hash(supplied));
  if (ok) { attempts.delete(ip); return 200; }
  if (attempts.size > 10000) for (const [key,value] of attempts) { if (value.until <= now) attempts.delete(key); }
  if (attempts.size > 10000 && !attempts.has(ip)) return 429;
  attempts.set(ip, { count: record && record.until > now ? record.count + 1 : 1, until: record && record.until > now ? record.until : now + WINDOW });
  return 401;
}
module.exports = { authorize };
