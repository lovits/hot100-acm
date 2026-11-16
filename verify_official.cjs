'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {judgeCore,judgeACM}=require('./native_judge/judge');
const problems=require('./dist/training/data/problems.json');
const solutions=require('./dist/training/data/solutions.json');
const acm=process.argv[3]==='acm';
const cases=require(acm?'./reference/leetcode-official-native-acm-cases.json':'./reference/leetcode-official-cases.json');
const language=process.argv[2]||'python3';
const selected=(acm?process.argv[4]:process.argv[3])?.split(',').map(Number);
const reportPath='reference/official-'+(acm?'native-acm':'example')+'-check-'+language+'.json';
(async()=>{const report=selected?JSON.parse(fs.readFileSync(reportPath,'utf8')):{questions:0,cases:0,failures:[]};if(selected){report.failures=report.failures.filter(r=>!selected.includes(r.id));report.retestedIds=selected;}for(const p of problems){if(selected&&!selected.includes(p.id))continue;
 const result=await(acm?judgeACM:judgeCore)({language,code:solutions[p.id][language][acm?'acm':'core'],core:p.core,judge:acm?p.acm.judge:undefined,tests:cases[p.id]});
 if(!selected){report.questions++;report.cases+=cases[p.id].length;}
 if(result.error||!result.results.every(r=>r.ok))report.failures.push({id:p.id,result});
 if(report.questions%20===0)console.log('Official examples:',report.questions,'/ 100');
}fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.equal(report.failures.length,0);})().catch(e=>{console.error(e);process.exitCode=1;});
