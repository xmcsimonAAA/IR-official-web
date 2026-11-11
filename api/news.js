// GET /api/news  -> list of press releases (used by the IR site's news list)
const { getList } = require('./_list.js');
module.exports = async (req, res) => {
  const data = await getList();
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600');
  res.status(200).json({ ts: Date.now(), data: data.map(({ id, date, cat, url, title, zh, zht, source }) => ({ id, date, cat, url, title, zh, zht, source: source || 'gnw' })) });
};
