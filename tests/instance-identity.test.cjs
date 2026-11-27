'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto'), vm=require('node:vm'), os=require('node:os');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const main=fs.readFileSync(path.join(root,'desktop/main.cjs'),'utf8');
const code=main.slice(main.indexOf('function instanceId(){'),main.indexOf('async function live('));
const calculate=folder=>vm.runInNewContext(code+';instanceId()', {root:folder,fs,path,crypto,process});
const python=spawnSync(process.env.PYTHON||'python',['-c','import local_server; print(local_server.INSTANCE_ID)'],{cwd:root,encoding:'utf8'});
assert.equal(python.status,0,python.stderr);
assert.equal(calculate(root),python.stdout.trim());
const names=[...code.matchAll(/'([^']+\.(?:py|cjs|js|html))'/g)].map(x=>x[1]);
assert.ok(names.includes('dist/local.js') && names.includes('dist/test-workspace.js'));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hot100-identity-test-'));
for(const name of names){fs.mkdirSync(path.dirname(path.join(temp,name)),{recursive:true});fs.copyFileSync(path.join(root,name),path.join(temp,name));}
const before=calculate(temp);
fs.appendFileSync(path.join(temp,'dist/local.js'),'\n');
assert.notEqual(calculate(temp),before);
console.log('Electron identity agrees with Python server; changed frontend changes identity');
