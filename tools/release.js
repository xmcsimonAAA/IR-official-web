'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'xmax-release-'));
const name = 'xmax-ir-' + pkg.version;
const target = path.join(stage, name);
const dist = path.join(root, 'dist');
try {
  fs.mkdirSync(target);
  // Explicit allowlist: never package .env, storage, private backups or audit fixtures.
  for (const file of ['api','public','deploy','tools','test','server.js','package.json','package-lock.json','README.md','DEPLOYMENT_HANDOFF.md','CHANGELOG.md','.env.example','node_modules']) {
    fs.cpSync(path.join(root,file),path.join(target,file),{recursive:true,verbatimSymlinks:true});
  }
  const files = [];
  const symlinks = [];
  function scan(dir) { for(const name of fs.readdirSync(dir).sort()) {const full=path.join(dir,name),s=fs.lstatSync(full);if(s.isDirectory())scan(full);else if(s.isSymbolicLink()){const link=fs.readlinkSync(full);if(path.isAbsolute(link)||!path.resolve(dir,link).startsWith(target+path.sep))throw new Error('Unsafe release symlink: '+full);symlinks.push({path:path.relative(target,full),target:link});}else if(s.isFile())files.push({path:path.relative(target,full),size:s.size,sha256:crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')});} }
  scan(target);
  fs.writeFileSync(path.join(target,'release-manifest.json'),JSON.stringify({version:pkg.version,node:pkg.engines.node,dependencies:pkg.dependencies,files,symlinks},null,2));
  fs.mkdirSync(dist,{recursive:true});
  const archive = path.join(dist,name+'.tar.gz');
  execFileSync('tar',['-czf',archive,'-C',stage,name],{env:{...process.env,COPYFILE_DISABLE:'1'}});
  const sum=crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
  fs.writeFileSync(path.join(dist,'SHA256SUMS'),sum+'  '+path.basename(archive)+'\n');
  console.log(archive);console.log('Includes locked pure-JavaScript runtime dependencies; no npm download is required on the target.');
} finally {fs.rmSync(stage,{recursive:true,force:true});}
