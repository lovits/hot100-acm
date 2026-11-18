'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {buildCDriver}=require('./c-driver');
const {compareCoreResult}=require('./runtime/dist/judge-rules');
const {judgeACM,judgeCore}=require('./runtime/native_judge/judge');
const {runProcess,commandExists}=require('./runtime/native_judge/runner');
function canonical(v){if(typeof v==='string'&&/^(list|tree|randomList|grid):/.test(v))return JSON.parse(v.slice(v.indexOf(':')+1));return v;}
async function judgeC(p,code,tests){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hot100-vscode-c-'));
 try{
  const cc=await commandExists('gcc');if(!cc)return{error:'未找到 C 编译器 gcc，请先安装并加入 PATH。'};
  const source=path.join(tmp,'main.c'),bin=path.join(tmp,process.platform==='win32'?'main.exe':'main');
  fs.writeFileSync(source,buildCDriver(p,code,tests));
  const compile=await runProcess(cc,[source,'-std=c11','-O2','-lm','-o',bin],{cwd:tmp,phase:'compile'});
  if(compile.code!==0||compile.timedOut)return{error:compile.timedOut?`C 编译超时（${compile.ms}ms）`:compile.stderr||compile.error||`C 编译失败，退出码 ${compile.code}`,phase:'compile',elapsedMs:compile.ms,timedOut:compile.timedOut};
  const results=[];
  for(let i=0;i<tests.length;i++){
   const run=await runProcess(bin,[String(i)],{cwd:tmp});
   if(run.code!==0||run.timedOut){results.push({ok:false,error:run.timedOut?'运行超时':run.stderr||'程序异常退出',ms:run.ms});continue;}
   try{const r=JSON.parse(run.stdout),expected=canonical(tests[i].expected);r.ok=r.identityOK!==false&&r.copyOK!==false&&(p.core.comparison?compareCoreResult(p.core.comparison,r.got,expected,tests[i].args):JSON.stringify(r.got)===JSON.stringify(expected));r.expected=expected;r.ms=run.ms;results.push(r);}
   catch(e){results.push({ok:false,error:'输出解析失败：'+e.message,got:run.stdout});}
  }return{results};
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
async function evaluate(p,language,mode,code,tests,tools){
 if(tools)return require('./runtime/native_judge/toolchain').withToolchain(tools,()=>evaluate(p,language,mode,code,tests));
 if(mode==='acm'&&!['python3','cpp','c'].includes(language))return require('./acm-languages').evaluateACM(p,language,code,tests);
 if(mode==='core'&&language==='c')return judgeC(p,code,tests);
 return(mode==='core'?judgeCore:judgeACM)({language,code,core:p.core,judge:p.acm.judge,tests});
}
module.exports={evaluate};
