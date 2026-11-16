'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {judgeCore,judgeACM}=require('./native_judge/judge');
const ps=require('./dist/training/data/problems.json'),ss=require('./dist/training/data/solutions.json'),tests=require('./dist/training/data/tests.json');
(async()=>{const report={questions:100,cases:0,failures:[]};for(const p of ps){for(const mode of ['core','acm']){
 const r=await(mode==='core'?judgeCore:judgeACM)({language:'python3',core:p.core,judge:p.acm.judge,code:ss[p.id].python3[mode],tests:tests[p.id][mode]});report.cases+=tests[p.id][mode].length;
 if(r.error||!r.results.every(c=>c.ok))report.failures.push({id:p.id,mode,result:r});
}if(report.failures.length)console.log('Dataset failure:',p.id);}
fs.writeFileSync('reference/dataset-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.equal(report.failures.length,0);})().catch(e=>{console.error(e);process.exitCode=1;});
