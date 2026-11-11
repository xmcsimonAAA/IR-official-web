const fetchUpstream = require('./_fetch.js');
// GET /api/financials -> key financial figures from the SEC's official XBRL data (company facts).
// Updates automatically after each new Form 10-Q / 10-K. Amounts are returned in US$ millions.
// Uses the SEC_UA environment variable (company name + contact email), like filings.js.

const CIK = '0001473334';
const SH = () => ({ 'User-Agent': process.env.SEC_UA || 'XMax Inc. Investor Relations IR@XMax.com', 'Accept': 'application/json' });
const REV = ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'SalesRevenueGoodsNet'];
const NI = ['NetIncomeLoss', 'ProfitLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic'];
const CASH = ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents', 'Cash'];
const ASSETS = ['Assets'];
let mem = null;

const M = (v) => (v == null ? null : Math.round((v / 1e6) * 100) / 100);
const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;

function series(gaap, names) {
  let best = null;
  for (const n of names) {
    const u = gaap[n] && gaap[n].units && gaap[n].units.USD;
    if (!u || !u.length) continue;
    const last = u.reduce((m, x) => (x.end > m ? x.end : m), '');
    if (!best || last > best.last) best = { u, last };
  }
  return best ? best.u : [];
}
function frames(u, re) {
  const m = {};
  for (const x of u) if (x.frame && re.test(x.frame)) m[x.frame] = x.val;
  return m;
}
function instantAt(u, date) {
  const hit = u.filter((x) => x.end === date && !x.start).sort((a, b) => (a.filed < b.filed ? 1 : -1))[0];
  return hit ? hit.val : null;
}
function ytd(u, end) {
  const y = end.slice(0, 4);
  const hit = u.filter((x) => x.end === end && x.start === y + '-01-01').sort((a, b) => (a.filed < b.filed ? 1 : -1))[0];
  return hit ? hit.val : null;
}

async function build() {
  const r = await fetchUpstream(`https://data.sec.gov/api/xbrl/companyfacts/CIK${CIK}.json`, { headers: SH() });
  if (!r.ok) throw new Error('SEC ' + r.status);
  const g = ((await r.json()).facts || {})['us-gaap'] || {};
  const rev = series(g, REV), ni = series(g, NI), cash = series(g, CASH), assets = series(g, ASSETS);
  if (!rev.length) throw new Error('No revenue data');

  // quarters (3-month frames), deriving Q4 from the annual figure when needed
  const rq = frames(rev, /^CY\d{4}Q[1-4]$/), nq = frames(ni, /^CY\d{4}Q[1-4]$/);
  const ra = frames(rev, /^CY\d{4}$/), na = frames(ni, /^CY\d{4}$/);
  const years = new Set(Object.keys(rq).concat(Object.keys(ra)).map((k) => +k.slice(2, 6)));
  const quarters = [];
  for (const y of [...years].sort()) {
    for (let q = 1; q <= 4; q++) {
      const k = 'CY' + y + 'Q' + q;
      let rv = rq[k], nv = nq[k], derived = false;
      if (q === 4 && rv == null && ra['CY' + y] != null && [1, 2, 3].every((i) => rq['CY' + y + 'Q' + i] != null)) {
        rv = ra['CY' + y] - [1, 2, 3].reduce((s, i) => s + rq['CY' + y + 'Q' + i], 0);
        if (na['CY' + y] != null && [1, 2, 3].every((i) => nq['CY' + y + 'Q' + i] != null))
          nv = na['CY' + y] - [1, 2, 3].reduce((s, i) => s + nq['CY' + y + 'Q' + i], 0);
        derived = true;
      }
      if (rv != null) quarters.push({ y, q, rev: M(rv), ni: M(nv), derived });
    }
  }

  // annual figures with year-end balances
  const annual = Object.keys(ra).map((k) => +k.slice(2)).sort().slice(-2).map((y) => ({
    y, rev: M(ra['CY' + y]), ni: M(na['CY' + y]),
    cash: M(instantAt(cash, y + '-12-31')), assets: M(instantAt(assets, y + '-12-31')),
  }));

  // latest reported period (10-Q or 10-K)
  const latestEnd = rev.filter((x) => /^10-[QK]/.test(x.form || '')).reduce((m, x) => (x.end > m ? x.end : m), '');
  const yr = +latestEnd.slice(0, 4);
  const months = Math.round(days(yr + '-01-01', latestEnd) / 30.44);
  const priorEnd = (yr - 1) + latestEnd.slice(4);
  const filing = rev.filter((x) => x.end === latestEnd).sort((a, b) => (a.filed < b.filed ? 1 : -1))[0] || {};
  const latest = {
    end: latestEnd, y: yr, months,
    rev: M(ytd(rev, latestEnd)), revPrior: M(ytd(rev, priorEnd)), ni: M(ytd(ni, latestEnd)),
    cash: M(instantAt(cash, latestEnd)), cashPrevYE: M(instantAt(cash, (yr - 1) + '-12-31')),
    assets: M(instantAt(assets, latestEnd)), assetsPrevYE: M(instantAt(assets, (yr - 1) + '-12-31')),
    form: filing.form || '', filed: filing.filed || '',
  };
  return { quarters: quarters.slice(-6), annual, latest };
}

module.exports = async (req, res) => {
  try {
    if (!mem || Date.now() - mem.ts > 3 * 3600e3) mem = { ts: Date.now(), data: await build() };
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.status(200).json(mem);
  } catch (e) {
    if (mem) return res.status(200).json(mem);
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({ error: 'unavailable', reason: String(e && e.message || e) });
  }
};
