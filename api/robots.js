// GET /robots.txt
module.exports = (req, res) => {
  // SITE_URL (e.g. https://ir.xmax.com) keeps canonical links on the company domain when requests are proxied
  const base = (process.env.SITE_URL || '').replace(/\/+$/, '') || 'https://' + (req.headers['x-forwarded-host'] || req.headers.host);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(200).send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin.html\nSitemap: ${base}/sitemap.xml\n`);
};
