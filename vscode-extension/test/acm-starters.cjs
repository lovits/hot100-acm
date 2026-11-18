'use strict';
const assert=require('node:assert/strict');
const {evaluate}=require('../engine'),problems=require('../data/problems.json'),tests=require('../data/tests.json');
const language=process.argv[2]||'python3';
(async()=>{let count=0;const failures=[];for(const p of problems){
 const code=p.acm.template[language];if(!code)continue;
 // TODO templates need to start, not solve the question yet.
 const result=await evaluate(p,language,'acm',code,[{input:tests[p.id].acm[0].input}]);
 if(result.error||result.results.some(r=>r.error))failures.push({id:p.id,result});count++;
 }console.log(language,'ACM starters checked:',count,'failures:',JSON.stringify(failures));assert.equal(failures.length,0);})().catch(e=>{console.error(e);process.exitCode=1;});
