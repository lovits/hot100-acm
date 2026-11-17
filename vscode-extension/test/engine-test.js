'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {evaluate}=require('../engine'),ps=require('../data/problems.json'),ts=require('../data/tests.json');
const ss=require('../../dist/training/data/solutions.json');
const lang=process.argv[2]||'python3';
(async()=>{const report={language:lang,questions:0,cases:0,failures:[]};for(const p of ps){for(const mode of ['core','acm']){
 assert.ok(['python3','cpp'].includes(lang));const code=ss[p.id][lang][mode];
 const tests=ts[p.id][mode];const r=await evaluate(p,lang,mode,code,tests);report.cases+=tests.length;
 if(r.error||!r.results.every(x=>x.ok))report.failures.push({id:p.id,mode,result:r});
 }report.questions++;if(report.questions%10===0){fs.writeFileSync(`test/results-${lang}.json`,JSON.stringify(report,null,2));console.log(lang,report.questions,report.failures.length);}}
 fs.writeFileSync(`test/results-${lang}.json`,JSON.stringify(report,null,2));assert.equal(report.failures.length,0);})().catch(e=>{console.error(e);process.exitCode=1;});
