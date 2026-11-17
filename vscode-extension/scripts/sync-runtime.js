const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'vscode-extension');
for(const file of ['judge.js','core-driver.js','runner.js','LICENSE']){fs.mkdirSync(path.join(out,'runtime/native_judge'),{recursive:true});fs.copyFileSync(path.join(root,'native_judge',file),path.join(out,'runtime/native_judge',file));}
fs.cpSync(path.join(root,'native_judge/include'),path.join(out,'runtime/native_judge/include'),{recursive:true});
fs.mkdirSync(path.join(out,'runtime/dist'),{recursive:true});fs.copyFileSync(path.join(root,'dist/judge-rules.js'),path.join(out,'runtime/dist/judge-rules.js'));
fs.copyFileSync(path.join(root,'dist/training/data/tests.json'),path.join(out,'data/tests.json'));
