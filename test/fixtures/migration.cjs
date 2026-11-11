const fs = require('fs');
const fixture = JSON.parse(fs.readFileSync(process.env.MIGRATION_FIXTURE));
global.fetch = async url => {
  const u = new URL(url);
  if (u.pathname.startsWith('/api/')) {
    const data = u.pathname === '/api/docs' ? fixture.docs : fixture.news;
    return new Response(JSON.stringify(data), { headers: { 'content-type':'application/json' } });
  }
  if (fixture.failFiles) return new Response('not found', {status:404});
  const bytes = Buffer.from('%PDF-1.4\n' + u.host + ' fixture\n');
  return new Response(bytes, { headers: { 'content-type':'application/pdf', 'content-length':String(bytes.length) } });
};
