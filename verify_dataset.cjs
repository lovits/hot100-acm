'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {judgeCore,judgeACM}=require('./native_judge/judge');
const ps=require('./dist/training/data/problems.json'),ss=require('./dist/training/data/solutions.json'),tests=require('./dist/training/data/tests.json');
const language=process.argv[2]||'python3';
assert.ok(['python3','cpp'].includes(language));
(async()=>{const report={language,questions:ps.length,cases:0,failures:[]};for(const p of ps){for(const mode of ['core','acm']){
 const r=await(mode==='core'?judgeCore:judgeACM)({language,core:p.core,judge:p.acm.judge,code:ss[p.id][language][mode],tests:tests[p.id][mode]});report.cases+=tests[p.id][mode].length;
 if(r.error||!r.results.every(c=>c.ok))report.failures.push({id:p.id,mode,result:r});
}if(report.failures.length)console.log('Dataset failure:',p.id);}
fs.writeFileSync('reference/dataset-check'+(language==='python3'?'':'-'+language)+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.equal(report.failures.length,0);})().catch(e=>{console.error(e);process.exitCode=1;});
