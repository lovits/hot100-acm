'use strict';
const languages = {python3:'Python', cpp:'C++', c:'C'};
const extensions = {python3:'py', cpp:'cpp', c:'c'};
let trainingTests = {};
function language(){ return state.practiceLanguage || 'python3'; }
function coreMode(){ return state.practiceMode === 'core'; }
function classic(){ return language()==='python3' && !coreMode(); }
function draftKey(id){ return classic()?String(id):[id,language(),coreMode()?'core':'acm'].join(':'); }
function practiceTemplate(problem){
  if(classic()) return problem.template;
  const row=trainingIndex.get(problem.id);
  return (coreMode()?row.core.templates:row.acm.template)[language()] ??
    '#include <stdio.h>\n\nint main(void) {\n    // 读取输入并输出答案\n    return 0;\n}\n';
}
function practiceProblem(p){
  if(classic()) return p;
  const row=trainingIndex.get(p.id), core=row.core;
  const tests=coreMode()?trainingTests[p.id].core.map(t=>({input:JSON.stringify(t,null,2),output:JSON.stringify(t.expected)})):trainingTests[p.id].acm;
  return {...p,statement:row.desc,tests,sampleCount:Math.min(2,tests.length),
    input:coreMode()?(core.kind==='ops'?'按模板实现 '+core.className+' 类，评测器会依次调用操作序列。':'按模板实现 '+core.method+'，参数为 '+core.params.map(v=>v.name+' ('+({list:'ListNode',listArray:'ListNode[]',tree:'TreeNode',grid:'char[][]',randomList:'Node'}[v.type]||v.type)+')').join('、')):row.acm.input,
    output:coreMode()?(core.mutates>=0?'原地修改指定参数，由评测器检查结果。':core.returnsDesc||'评测器对比各次调用结果。'):row.acm.output};
}
function syncControls(){
  $('#practice-language').value=language();
  $('#practice-mode').value=coreMode()?'core':'acm';
  $('#practice-mode option[value="core"]').disabled=language()==='c';
}
function switchPractice(lang,mode){
  if(activeJob) cancelJob(false);
  saveCode();saveView();state.testInputs[draftKey(current.id)]=customInput;
  state.practiceLanguage=lang;state.practiceMode=lang==='c'?'acm':mode;
  const id=current.id;current=null;pickProblem(id);syncControls();
}
function bindPractice(){
  syncControls();
  $('#practice-language').onchange=e=>switchPractice(e.target.value,coreMode()?'core':'acm');
  $('#practice-mode').onchange=e=>switchPractice(language(),e.target.value);
  enableDiagnostics();
  $('#reset-code').onclick=()=>replaceCode(practiceTemplate(problems.find(p=>p.id===current.id)),'重置模板','恢复当前题目、语言和模式的初始模板。');
}
async function nativeAction(action){
  if(activeJob) return;
  const code=editor.getValue(), submit=action==='judge';
  const tests=submit?current.tests:visibleTests();
  const job={submit,code,problem:current,check:action==='check',tests,items:[],native:true,language:language(),mode:coreMode()?'core':'acm'};
  saveCode();activeJob=job;bottomTab='result';resultIndex=0;
  document.body.classList.remove('tests-collapsed');state.testsCollapsed=false;
  setBusy(true);renderTest();$('#runtime-state').textContent=action==='check'?'检查语法中':'本机评测中';
  try{
    const body={problemId:current.id,language:language(),mode:job.mode,code};
    
    if(!submit)body.samples=tests.map(t=>coreMode()?{...t.sample,expected:t.sample.expected??null}:{input:t.input,output:t.output});
    const resp=await fetch('/api/judge',{method:'POST',headers:{'Content-Type':'application/json','X-Hot100-Token':session.token},body:JSON.stringify(body)});
    const result=await resp.json();
    if(activeJob!==job)return;
    if(!result.ok)throw Error(result.compileError||result.stderr||result.error||'运行失败');
    job.elapsed=result.elapsed;
    job.items=result.results.map((entry,i)=>{
      const test=tests[i],hasOutput=Object.hasOwn(entry,'got');
      const error=entry.error&&(!hasOutput||entry.phase!=='run'||entry.timedOut)?entry.error:'';
      const output=hasOutput?(coreMode()?JSON.stringify(entry.got):entry.got):undefined;
      return {input:test.input,expected:test.output,output,pass:!error&&(test.output==null||entry.ok),error,stderr:entry.stderr,ms:entry.ms};
    });
    finishJob();
  }catch(error){
    if(activeJob!==job)return;
    job.items=[{input:tests[0]?.input,pass:false,error:error.message}];finishJob(action==='check'?'语法检查失败':'执行失败');
  }
}
