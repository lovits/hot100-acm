'use strict';
const assert=require('node:assert/strict');
const {judgeACM,judgeCore}=require('./native_judge/judge');
const problems=require('./dist/training/data/problems.json');
const main=require('./dist/problems.json');
const tests=require('./dist/training/data/tests.json');
const solutions=require('./dist/training/data/solutions.json');
assert.equal(problems.length,100);
assert.equal(new Set(problems.map(p=>p.id)).size,100);
assert.deepEqual(problems.map(p=>p.id).sort((a,b)=>a-b),main.map(p=>p.id).sort((a,b)=>a-b));
assert.equal(new Set(problems.flatMap(p=>p.freq.companies.map(c=>c.name))).size,22);
assert.equal(problems.reduce((n,p)=>n+p.freq.companies.length,0),1399);
for(const p of problems){assert.equal(p.title,main.find(q=>q.id===p.id).title);assert.ok(p.freq.value>=0);assert.equal(new Set(p.freq.companies.map(c=>c.name)).size,p.freq.companies.length);}
(async()=>{let passed=0;for(const id of [142,160])for(const language of ['python3','cpp'])for(const mode of ['acm','core']){
 const p=problems.find(p=>p.id===id);
 const args={language,code:solutions[id][language][mode],tests:tests[id][mode],core:p.core};
 const result=await(mode==='core'?judgeCore(args):judgeACM(args));
 assert.ok(!result.error,JSON.stringify(result));
 assert.ok(result.results.every(row=>row.ok),JSON.stringify({id,language,mode,result}));
 passed+=result.results.length;
}console.log('100 question records, 22 companies, 1399 frequencies and',passed,'chain judge cases passed');})().catch(error=>{console.error(error);process.exitCode=1;});
