// GET /sitemap.xml -> helps search engines find every news page
const { getList } = require('./_list.js');
module.exports = async (req, res) => {
  // SITE_URL (e.g. https://ir.xmax.com) keeps canonical links on the company domain when requests are proxied
  const base = (process.env.SITE_URL || '').replace(/\/+$/, '') || 'https://' + (req.headers['x-forwarded-host'] || req.headers.host);
  const list = await getList();
  const urls = [`<url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`]
    .concat(list.map((x) => `<url><loc>${base}/news/${x.id}</loc><lastmod>${x.date}</lastmod><priority>0.8</priority></url>`));
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`);
};
