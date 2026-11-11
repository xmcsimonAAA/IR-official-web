const fetchUpstream = require('./_fetch.js');
// GET /api/filings
// Returns the latest SEC EDGAR filings for XMax Inc. (CIK 0001473334).
// Set the environment variable SEC_UA (in .env), e.g. "XMax Inc. Investor Relations ir@xmax.com"
// (the SEC requires a User-Agent naming the company and a contact email).

const CIK = '0001473334';
const CIK_NUM = '1473334';
const LABELS = {
  '10-K': 'Annual report', '10-K/A': 'Amended annual report',
  '10-Q': 'Quarterly report', '10-Q/A': 'Amended quarterly report',
  '8-K': 'Current report', '8-K/A': 'Amended current report',
  'DEF 14A': 'Definitive proxy statement', 'PRE 14A': 'Preliminary proxy statement',
  'DEFA14A': 'Additional proxy materials', 'S-3': 'Registration statement',
  'S-3/A': 'Amended registration statement', '424B5': 'Prospectus supplement',
  'SC 13G': 'Beneficial ownership report', 'SC 13G/A': 'Amended beneficial ownership report',
  'SC 13D': 'Beneficial ownership report', '3': 'Initial statement of ownership',
  '4': 'Statement of changes in ownership', 'NT 10-K': 'Notice of late filing',
};

module.exports = async (req, res) => {
  try {
    const r = await fetchUpstream(`https://data.sec.gov/submissions/CIK${CIK}.json`, {
      headers: { 'User-Agent': process.env.SEC_UA || 'XMax Inc. Investor Relations', 'Accept': 'application/json' },
    });
    if (!r.ok) throw new Error('SEC ' + r.status);
    const f = (await r.json()).filings.recent;
    const data = [];
    for (let i = 0; i < f.form.length && data.length < 80; i++) {
      const form = f.form[i];
      const acc = f.accessionNumber[i].replace(/-/g, '');
      const doc = f.primaryDocument[i];
      const d = f.primaryDocDescription[i];
      data.push({
        date: f.filingDate[i],
        form,
        desc: d && !d.toUpperCase().includes(form.replace(/^SC /, '').toUpperCase()) ? d : (LABELS[form] || form),
        period: f.reportDate[i] || '',
        url: `https://www.sec.gov/Archives/edgar/data/${CIK_NUM}/${acc}/${doc || ''}`,
      });
    }
    // The server's response cache keeps this for 10 minutes, then refreshes in the background.
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400');
    res.status(200).json({ ts: Date.now(), data });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({ error: 'unavailable' });
  }
};
