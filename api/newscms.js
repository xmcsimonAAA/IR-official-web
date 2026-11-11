// News managed from the admin page (stored on the server at STORAGE_DIR/cms/news.json).
// GET  /api/newscms?base=1  -> built-in + auto-discovered news (before admin changes) and the stored admin data
// GET  /api/newscms         -> the stored admin data
// POST /api/newscms         -> save { items, overrides } (header x-admin-password)
const { getList } = require('./_list.js');
const store = require('./_store.js');
const { cleanBody, safeUrl } = require('./_html.js');
const CATS = ['AI', 'Results', 'M&A', 'Corporate'];
const okPw = (p) => !!process.env.ADMIN_PASSWORD && typeof p === 'string' && p === process.env.ADMIN_PASSWORD;

function readStored() { return store.readJSON('news.json'); }

function sanitize(m) {
  if (!m || !Array.isArray(m.items) || !m.overrides || typeof m.overrides !== 'object' || Array.isArray(m.overrides) || m.items.length > 500 || Object.keys(m.overrides).length > 500) throw new Error('新闻数据格式或数量不正确');
  const S = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const U = (u) => safeUrl(S(u, 1000));
  const items = [];
  const seen = new Set();
  for (const x of (Array.isArray(m.items) ? m.items : []).slice(0, 500)) {
    let id = S(x.id, 40).toLowerCase();
    if (!/^n-[a-z0-9]{4,30}$/.test(id) || seen.has(id)) id = 'n-' + Math.random().toString(36).slice(2, 12);
    seen.add(id);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') ? x.date : '';
    const title = { en: S(x.title && x.title.en, 300), zhs: S(x.title && x.title.zhs, 300), zht: S(x.title && x.title.zht, 300) };
    if (typeof x.body === 'string' && x.body.length > 400000) throw new Error('新闻正文超过限制');
    const body = cleanBody(x.body);
    const url = U(x.url);
    if (x.url && !url) throw new Error('新闻链接无效');
    if (!date || !title.en || (!body.replace(/<[^>]+>/g, '').trim() && !url)) throw new Error('新闻日期、英文标题或正文/链接缺失');
    items.push({ id, date, cat: CATS.includes(x.cat) ? x.cat : 'Corporate', title, url, body });
  }
  const overrides = {};
  const src = m.overrides && typeof m.overrides === 'object' ? m.overrides : {};
  for (const k of Object.keys(src).slice(0, 500)) {
    if (!/^[a-z0-9-]{1,60}$/.test(k)) continue;
    const o = src[k] || {};
    const v = { zhs: S(o.zhs, 300), zht: S(o.zht, 300), cat: CATS.includes(o.cat) ? o.cat : '', hidden: o.hidden === true };
    if (v.zhs || v.zht || v.cat || v.hidden) overrides[k] = v;
  }
  return { updated: new Date().toISOString(), items, overrides };
}

module.exports = async (req, res) => {
  try {
    const q = req.query || {};
    if (req.method === 'POST') {
      res.setHeader('Cache-Control', 'no-store');
      if (!okPw(req.headers['x-admin-password'])) return res.status(401).json({ error: 'unauthorized' });
      if (!store.writable()) return res.status(503).json({ error: 'storage_not_configured' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      let data;
      try { data = sanitize(body || {}); } catch (e) { return res.status(400).json({ error: e.message }); }
      const json = JSON.stringify(data);
      if (json.length > 4000000) return res.status(413).json({ error: 'too_large' });
      store.writeJSON('news.json', data);
      return res.status(200).json({ ok: true, data });
    }
    const stored = readStored() || { items: [], overrides: {} };
    stored.items = (stored.items || []).map(x => ({ ...x, body: cleanBody(x.body) }));
    if (q.base) {
      res.setHeader('Cache-Control', 'no-store');
      const base = (await getList({ raw: true })).map(({ id, date, cat, url, title, zh, zht, source }) => ({ id, date, cat, url, title, zh: zh || '', zht: zht || '', source: source || 'builtin' }));
      return res.status(200).json({ base, cms: stored });
    }
    res.setHeader('Cache-Control', q.fresh ? 'no-store' : 's-maxage=30, stale-while-revalidate=300');
    return res.status(200).json({ ts: Date.now(), data: stored });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
