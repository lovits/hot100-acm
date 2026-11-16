'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {compareACMOutput}=require('./dist/judge-rules');
const {outputsEqual}=require('./native_judge/judge');
const classic=require('./dist/problems.json'),native=require('./dist/training/data/problems.json');
const report={questions:100,classicCases:0,nativeCases:0,failures:[]};
for(const mode of ['classic','native']){
 execFileSync(process.env.HOT100_PYTHON||'python3',['verify_official_acm.py',...(mode==='native'?['--native']:[])]);
 const rows=JSON.parse(fs.readFileSync('reference/official-'+(mode==='native'?'native-':'')+'acm-results.json','utf8'));
 for(const r of rows){
  const p=(mode==='native'?native:classic).find(p=>p.id===r.id);
  const rule=mode==='native'?p.acm.judge:p.judge;
  let ok=false;
  if(!r.error){
   if(rule&&!['tokens','float'].includes(rule))ok=compareACMOutput(rule,r.got,r.output,r.input);
   else if(mode==='native')ok=outputsEqual(r.output,r.got);
   else{const a=r.got.trim().split(/\s+/),b=r.output.trim().split(/\s+/);ok=a.length===b.length&&a.every((v,i)=>rule==='float'?Math.abs(Number(v)-Number(b[i]))<1e-6:v===b[i]);}
  }
  if(!ok)report.failures.push({mode,...r});report[mode+'Cases']++;
 }
}
fs.writeFileSync('reference/official-acm-check.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));assert.equal(report.failures.length,0);
