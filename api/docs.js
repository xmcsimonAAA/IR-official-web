// GET  /api/docs            -> governance documents and presentations shown on the IR site
// POST /api/docs            -> save the list from the admin page (header x-admin-password)
// GET  /api/docs?check=1    -> admin login check
// Content is stored on the server (STORAGE_DIR/cms/docs.json); uploaded files live under /files/. Requires ADMIN_PASSWORD.
const store = require('./_store.js');
const DEFAULTS = {"updated": "", "governance": [{"id": "g1", "title": {"en": "Audit Committee charter", "zhs": "审计委员会章程", "zht": "審計委員會章程"}, "url": "https://www.xmax.com/upload/default/20260506/d0aa82db6df5a8de2dacb16e1c7afc13.pdf", "label": "PDF"}, {"id": "g2", "title": {"en": "Compensation Committee charter", "zhs": "薪酬委员会章程", "zht": "薪酬委員會章程"}, "url": "https://www.xmax.com/upload/default/20260506/7828065e962d15aaccc54aa6b88865e8.pdf", "label": "PDF"}, {"id": "g3", "title": {"en": "Nominating and Corporate Governance Committee charter", "zhs": "提名与公司治理委员会章程", "zht": "提名與公司治理委員會章程"}, "url": "https://www.xmax.com/upload/default/20260506/a1959e63db73ef681326beabeebd1fe7.pdf", "label": "PDF"}, {"id": "g4", "title": {"en": "Clawback policy", "zhs": "薪酬追回政策", "zht": "薪酬追回政策"}, "url": "https://www.xmax.com/upload/default/20260506/c5521bd97f2e908e74d3d3d40c3090c3.pdf", "label": "PDF"}, {"id": "g5", "title": {"en": "Insider trading policy", "zhs": "内幕交易政策", "zht": "內幕交易政策"}, "url": "https://www.xmax.com/upload/default/20260507/3e06bba6c06a0d03ab41300dcb9c04dc.pdf", "label": "PDF"}, {"id": "g6", "title": {"en": "Code of business conduct and ethics", "zhs": "商业行为与道德准则", "zht": "商業行為與道德準則"}, "url": "https://www.xmax.com/upload/default/20260507/9eec02e4a080fe1e498789ed6f013e65.pdf", "label": "PDF"}], "presentations": [{"id": "p1", "icon": "deck", "ti": 80, "title": {"en": "Corporate presentation", "zhs": "公司介绍", "zht": "公司介紹"}, "desc": {"en": "Group overview, businesses and strategy.", "zhs": "集团概况、业务与战略。", "zht": "集團概況、業務與戰略。"}, "url": "", "label": ""}, {"id": "p2", "icon": "ai", "ti": 81, "title": {"en": "AI business overview", "zhs": "AI 业务介绍", "zht": "AI 業務介紹"}, "desc": {"en": "XMax AI’s platform, services and progress.", "zhs": "XMax AI 的平台、服务与进展。", "zht": "XMax AI 的平臺、服務與進展。"}, "url": "", "label": ""}, {"id": "p3", "icon": "doc", "ti": 82, "title": {"en": "Fact sheet", "zhs": "公司简报", "zht": "公司簡報"}, "desc": {"en": "Key data on one page.", "zhs": "一页纸了解关键数据。", "zht": "一頁紙瞭解關鍵數據。"}, "url": "", "label": ""}, {"id": "p4", "icon": "download", "ti": 83, "title": {"en": "Annual report", "zhs": "年度报告", "zht": "年度報告"}, "desc": {"en": "Form 10-K for the year ended December 31, 2025.", "zhs": "截至2025年12月31日财年的10-K表格。", "zht": "截至2025年12月31日財年的10-K表格。"}, "url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001473334&type=10-K&dateb=&owner=include&count=40", "label": "EDGAR"}]};
const okPw = (p) => !!process.env.ADMIN_PASSWORD && typeof p === 'string' && p === process.env.ADMIN_PASSWORD;

function readStored() { return store.readJSON('docs.json'); }

function sanitize(m) {
  if (!m || !Array.isArray(m.governance) || !Array.isArray(m.presentations) || m.governance.length > 80 || m.presentations.length > 80) throw new Error('文档数据格式或数量不正确');
  const S = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const T = (o, n) => ({ en: S(o && o.en, n), zhs: S(o && o.zhs, n), zht: S(o && o.zht, n) });
  const U = (u) => (/^https?:\/\//i.test(u || '') || /^\/files\/[^\s]+$/.test(u || '') ? S(u, 1000) : '');
  const ICONS = ['deck', 'ai', 'doc', 'download'];
  return {
    updated: new Date().toISOString(),
    governance: (Array.isArray(m.governance) ? m.governance : []).slice(0, 80)
      .map((x) => ({ id: S(x.id, 40), title: T(x.title, 200), url: U(x.url), label: S(x.label, 20) || 'PDF' }))
      .filter((x) => x.title.en || x.title.zhs),
    presentations: (Array.isArray(m.presentations) ? m.presentations : []).slice(0, 80)
      .map((x) => {
        const o = { id: S(x.id, 40), icon: ICONS.includes(x.icon) ? x.icon : 'doc', title: T(x.title, 200), desc: T(x.desc, 400), url: U(x.url), label: S(x.label, 20) };
        if (Number.isInteger(x.ti)) o.ti = x.ti;
        return o;
      })
      .filter((x) => x.title.en || x.title.zhs),
  };
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
      const before = readStored();
      // Files no longer listed are kept for 15 minutes (pages and caches may still link to them),
      // then deleted during a later publish.
      const GRACE = 15 * 60 * 1000, now = Date.now();
      const urls = (m) => [...(m && m.governance || []), ...(m && m.presentations || [])].map((x) => x.url).filter(Boolean);
      const isOurs = (u) => store.isLocalFile(u);
      const keep = new Set(urls(data));
      const trash = new Map(((before && before.trash) || []).filter((t) => t && t.url && !keep.has(t.url)).map((t) => [t.url, t.at]));
      for (const u of urls(before)) if (!keep.has(u) && isOurs(u) && !trash.has(u)) trash.set(u, now);
      const due = [...trash].filter(([, at]) => now - at >= GRACE).map(([u]) => u);
      let removed = 0;
      if (due.length) { removed = store.deleteFiles(due); due.forEach((u) => trash.delete(u)); }
      data.trash = [...trash].map(([url, at]) => ({ url, at }));
      store.writeJSON('docs.json', data);
      return res.status(200).json({ ok: true, data, removed });
    }
    if (q.check) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: okPw(req.headers['x-admin-password']), storage: store.writable(), password: !!process.env.ADMIN_PASSWORD });
    }
    const data = readStored() || DEFAULTS;
    res.setHeader('Cache-Control', q.fresh ? 'no-store' : 's-maxage=30, stale-while-revalidate=300');
    return res.status(200).json({ ts: Date.now(), data });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
