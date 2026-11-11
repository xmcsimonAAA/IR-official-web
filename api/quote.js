const fetchUpstream = require('./_fetch.js');
// GET /api/quote
// Returns a delayed stock quote for XMAX from a market-data provider (Finnhub by default).
// Set the environment variable QUOTE_API_KEY (in .env). Displaying quotes on a public
// company website usually needs a commercial/display licence from the provider: confirm
// the terms before the official launch.

const SYMBOL = 'XMAX';

module.exports = async (req, res) => {
  const fail = (reason, status = 503) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).json({ error: 'unavailable', reason });
  };
  const key = (process.env.QUOTE_API_KEY || '').trim();
  if (!key) return fail('missing_key: QUOTE_API_KEY is not set, or the server was not restarted after adding it');
  try {
    const r = await fetchUpstream(`https://finnhub.io/api/v1/quote?symbol=${SYMBOL}&token=${encodeURIComponent(key)}`);
    if (r.status === 401 || r.status === 403) return fail('invalid_key: the provider rejected the API key (' + r.status + ')');
    if (r.status === 429) return fail('rate_limited: too many requests to the provider');
    if (!r.ok) return fail('provider_error: HTTP ' + r.status);
    const q = await r.json(); // { c: price, d: change, dp: change %, pc: previous close, t: unix seconds }
    if (!q || typeof q.c !== 'number' || q.c === 0) return fail('no_data: the provider returned no price for ' + SYMBOL);
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=30');
    res.status(200).json({
      ts: Date.now(),
      data: {
        price: q.c,
        change: q.d ?? 0,
        changePct: q.dp ?? 0,
        prevClose: q.pc,
        time: (q.t || Math.floor(Date.now() / 1000)) * 1000,
        source: 'Delayed',
      },
    });
  } catch (e) {
    fail('network_error: ' + (e && e.message ? e.message : 'request failed'));
  }
};
