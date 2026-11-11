'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { Readable } = require('stream');
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xmax-regression-'));
process.env.STORAGE_DIR = tmp;
const { cleanBody, safeUrl } = require('../api/_html.js');
const store = require('../api/_store.js');
let child, base;
before(async () => {
  child = spawn(process.execPath, ['--require', path.join(__dirname,'fixtures/upstream.cjs'), path.join(root,'server.js')], { env: {...process.env, PORT:'0', HOST:'127.0.0.1', NODE_ENV:'test', ADMIN_PASSWORD:'local-fixture-password-only', SITE_URL:'https://ir.xmax.com', UPLOAD_TIMEOUT_SECONDS:'90'}, stdio:['ignore','pipe','pipe'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server startup timeout')), 10000);
    child.once('exit', code => {clearTimeout(timer);reject(new Error('server exited '+code));});
    child.stdout.on('data', chunk => { const m = /http:\/\/127.0.0.1:\d+/.exec(String(chunk)); if (m) {base=m[0];clearTimeout(timer);resolve();} });
    child.stderr.on('data', chunk => { if (!String(chunk).startsWith('WARNING:')) process.stderr.write(chunk); });
  });
});
after(async () => { if (child && child.exitCode === null) { child.kill(); await new Promise(r => child.once('exit',r)); } fs.rmSync(tmp,{recursive:true,force:true}); });
const post = async (url, data) => {
  const r = await fetch(base+url,{method:'POST',headers:{'content-type':'application/json','x-admin-password':'local-fixture-password-only'},body:JSON.stringify(data)});
  return {status:r.status, data:await r.json()};
};
const news = (extra={}) => ({ id:'n-fixture1',date:'2026-11-06',cat:'Corporate',title:{en:'Fixture',zhs:'测试'},url:'',body:'<p>Fixture body</p>',...extra });
test('sanitizer removes event handlers, executable URLs, SVG and malformed markup while retaining safe attachments', () => {
  for (const html of ['<details open ontoggle="alert(1)">Test</details>','<img src=x onerror=alert(1)>','<a href="jav&#x61;script:alert(1)">x</a>','<svg><g onload=alert(1)></g></svg>','<math><mtext><table><mglyph><style><!--</style><img title="--><img src=1 onerror=alert(1)>">']) {
    const cleaned=cleanBody(html); assert(!/\son\w+\s*=|javascript:|<svg|<math|<script/i.test(cleaned),cleaned);
  }
  assert(cleanBody('<a href="/files/test.pdf">Attachment</a>').includes('href="/files/test.pdf"'));
  for(const u of ['javascript:alert(1)','//evil.test/a','/files/../secret','/files/%2e%2e/secret','https://user:pass@example.com/a']) assert.equal(safeUrl(u),'');
});
test('file upload and local-file-only news survive save and round trip; invalid input returns 400', async () => {
  const upload=await fetch(base+'/api/upload?name=test.pdf',{method:'POST',headers:{'x-admin-password':'local-fixture-password-only'},body:'%PDF-1.4\nfixture'});
  assert.equal(upload.status,200); const {url}=await upload.json();
  const r=await post('/api/newscms',{items:[news({url,body:''})],overrides:{}}); assert.equal(r.status,200); assert.equal(r.data.data.items[0].url,url);
  assert.equal((await fetch(base+url,{headers:{Range:'bytes=0-3'}})).status,206);
  assert.equal((await post('/api/newscms',{items:[news({url:'javascript:alert(1)'})],overrides:{}})).status,400);
  assert.equal((await (await fetch(base+'/api/newscms?fresh=1')).json()).data.items[0].url,url);
});
test('legacy CMS HTML is cleaned before admin read as well as before storing new input', async () => {
  const html='<p onclick="alert(1)">Test</p><details open ontoggle="alert(1)">Danger</details>';
  fs.writeFileSync(path.join(tmp,'cms/news.json'),JSON.stringify({items:[news({body:html})],overrides:{}}));
  const read=await (await fetch(base+'/api/newscms?fresh=1')).json(); assert(!/onclick|ontoggle/.test(read.data.items[0].body));
  const r=await post('/api/newscms',{items:[news({body:html})],overrides:{}});assert.equal(r.status,200);assert(!/onclick|ontoggle/.test(fs.readFileSync(path.join(tmp,'cms/news.json'),'utf8')));
});
test('news overrides can be changed and removed without restarting or contaminating raw base list',async()=>{
  const before=await (await fetch(base+'/api/newscms?base=1')).json();const original=before.base.find(x=>x.id==='3378050');
  await post('/api/newscms',{items:[],overrides:{'3378050':{zhs:'CHANGED',cat:'AI'}}});
  assert.equal((await (await fetch(base+'/api/news')).json()).data.find(x=>x.id==='3378050').zh,'CHANGED');
  assert.equal((await (await fetch(base+'/api/newscms?base=1')).json()).base.find(x=>x.id==='3378050').zh,original.zh);
  await post('/api/newscms',{items:[],overrides:{}});
  const restored=(await (await fetch(base+'/api/news')).json()).data.find(x=>x.id==='3378050');assert.equal(restored.zh,original.zh);assert.equal(restored.cat,original.cat);
});
test('private routes, write authorization, health and CLI acceptance check',async()=>{
  for (const url of ['/.env','/server.js','/api/_store','/files/%2e%2e%2f%2e%2e%2fserver.js']) assert.equal((await fetch(base+url)).status,404);
  assert.equal((await fetch(base+'/api/newscms',{method:'POST',body:'{}'})).status,401);
  const h=await (await fetch(base+'/healthz')).json(); assert.equal(h.version,'1.1.0');assert.equal(h.storage,true);
  const r=await new Promise(resolve=>{const p=spawn(process.execPath,[path.join(root,'tools/verify.js'),base,'--local'],{env:{...process.env,ADMIN_PASSWORD:'local-fixture-password-only'}});let out='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>out+=x);p.on('exit',code=>resolve({code,out}));});assert.equal(r.code,0,r.out);
});
test('an upload lasting over 30 seconds now completes', {timeout:40000}, async()=>{
  const result=await new Promise((resolve,reject)=>{
    const req=http.request(base+'/api/upload?name=slow.pdf',{method:'POST',headers:{'x-admin-password':'local-fixture-password-only','content-length':'10'}},res=>{let text='';res.on('data',x=>text+=x);res.on('end',()=>resolve({status:res.statusCode,text}));});req.on('error',reject);req.write('12345');setTimeout(()=>req.end('67890'),31000);
  });assert.equal(result.status,200,result.text);
});
test('upload timeout removes partial data',async()=>{
  const old=process.env.UPLOAD_TIMEOUT_SECONDS;process.env.UPLOAD_TIMEOUT_SECONDS='0.05';process.env.ADMIN_PASSWORD='local-fixture-password-only';
  const req=new Readable({read(){}});req.method='POST';req.headers={'x-admin-password':process.env.ADMIN_PASSWORD};req.query={name:'timeout.pdf'};req.push('partial');
  let status;const response={setHeader(){},status(x){status=x;return this;},json(){}};
  await require('../api/upload.js')(req,response);assert.equal(status,408);req.push(null);await new Promise(r=>setTimeout(r,30));
  const parts=fs.readdirSync(path.join(tmp,'files'),{recursive:true}).filter(x=>x.endsWith('.part'));assert.deepEqual(parts,[]);if(old===undefined)delete process.env.UPLOAD_TIMEOUT_SECONDS;else process.env.UPLOAD_TIMEOUT_SECONDS=old;
});
function migration(fixture,dir,args=[]){const f=path.join(tmp,'fixture-'+Math.random()+'.json');fs.writeFileSync(f,JSON.stringify(fixture));return spawnSync(process.execPath,['--require',path.join(__dirname,'fixtures/migration.cjs'),path.join(root,'tools/migrate.js'),'https://old.example',...args],{env:{...process.env,STORAGE_DIR:dir,MIGRATION_FIXTURE:f},encoding:'utf8'});}
function source(){return {docs:{data:{governance:[{id:'g1',title:{en:'Test'},url:'https://a.blob.vercel-storage.com/docs/test.pdf'}],presentations:[]}},news:{data:{items:[news({body:'<p onclick="evil()"><a href="https://b.blob.vercel-storage.com/docs/test.pdf">Attachment</a></p>'})],overrides:{}}}};}
test('migration validates source, dry-run does not write, real commit rewrites body resources with checksums and collision-free names',()=>{
  const dir=path.join(tmp,'migration-success'),fixture=source();
  let r=migration(fixture,dir,['--dry-run']);assert.equal(r.status,0,r.stderr);assert(!fs.existsSync(dir));
  r=migration(fixture,dir);assert.equal(r.status,0,r.stderr);
  const saved=fs.readFileSync(path.join(dir,'cms/news.json'),'utf8');assert(!/vercel|onclick/.test(saved));
  const manifest=JSON.parse(fs.readFileSync(path.join(dir,'cms/migration-manifest.json')));assert.equal(manifest.files.length,2);assert.equal(new Set(manifest.files.map(x=>x.url)).size,2);assert(manifest.files.every(x=>x.sha256.length===64));
  r=migration(fixture,dir);assert.notEqual(r.status,0);
  const bad=source();bad.news={};const before=fs.readFileSync(path.join(dir,'cms/news.json'),'utf8');r=migration(bad,dir,['--force']);assert.notEqual(r.status,0);assert.equal(fs.readFileSync(path.join(dir,'cms/news.json'),'utf8'),before);
  fixture.failFiles=true;r=migration(fixture,dir,['--force']);assert.notEqual(r.status,0);assert.equal(fs.readFileSync(path.join(dir,'cms/news.json'),'utf8'),before);assert(!fs.existsSync(path.join(dir,'.migration.lock')));
  delete fixture.failFiles;r=migration(fixture,dir,['--force']);assert.equal(r.status,0,r.stderr);assert(fs.readdirSync(path.join(dir,'backups')).length>=2);
});
test('corrupt stored JSON fails explicitly instead of silently showing defaults',()=>{
  fs.writeFileSync(path.join(tmp,'cms/bad.json'),'{');assert.throws(()=>store.readJSON('bad.json'));
});
test('invalid whole CMS payloads do not wipe content and authentication is rate limited',async()=>{
  assert.equal((await post('/api/docs',{})).status,400);
  assert.equal((await post('/api/newscms',{})).status,400);
  for(let i=0;i<10;i++) assert.equal((await fetch(base+'/api/docs?check=1',{headers:{'x-admin-password':'wrong','x-forwarded-for':'fixture-client'}})).status,401);
  assert.equal((await fetch(base+'/api/docs?check=1',{headers:{'x-admin-password':'wrong','x-forwarded-for':'fixture-client'}})).status,429);
});
test('production preflight validates required configuration and locked browser assets',()=>{
  const {validate}=require('../tools/preflight.js');
  const keys=['ADMIN_PASSWORD','QUOTE_API_KEY','SEC_UA','SITE_URL','HOST'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  Object.assign(process.env,{ADMIN_PASSWORD:'local-only-24-character-fixture-password',QUOTE_API_KEY:'fixture',SEC_UA:'Company ir@example.test',SITE_URL:'https://ir.xmax.com',HOST:'127.0.0.1'});
  assert.equal(validate(),true);process.env.ADMIN_PASSWORD='short';assert.throws(validate,/ADMIN_PASSWORD/);
  for(const key of keys){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}
});

test('migration includes relative legacy body resources and ignores deleted-file trash',()=>{
  const dir=path.join(tmp,'migration-relative'),fixture=source();
  fixture.docs.data.trash=[{url:'https://removed.blob.vercel-storage.com/deleted.pdf'}];
  fixture.news.data.items[0].body='<p><a href="/__blob/docs/relative.pdf">Relative attachment</a><img src="/files/chart.png"></p>';
  const r=migration(fixture,dir);assert.equal(r.status,0,r.stderr);
  const manifest=JSON.parse(fs.readFileSync(path.join(dir,'cms/migration-manifest.json')));
  assert.equal(manifest.files.length,3);assert(manifest.files.some(x=>x.source==='https://old.example/__blob/docs/relative.pdf'));assert(manifest.files.some(x=>x.source==='https://old.example/files/chart.png'));
  assert(!manifest.files.some(x=>x.source.includes('removed.blob')));
});
