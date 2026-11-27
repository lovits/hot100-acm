'use strict';
let caseRows=[], sourceView=false, sourceDraft=null;
function parseCaseSource(text){
  const lines=text.trim().split(/\r?\n/),count=paramNames().length;
  if(!text.trim()||lines.length%count)throw Error('每个用例需要 '+count+' 行参数');
  const rows=[];
  for(let i=0;i<lines.length;i+=count){
    const row=lines.slice(i,i+count);caseTest(row);rows.push(row);
  }
  return rows;
}

function paramNames(){
  if(!coreMode())return ['stdin'];
  const core=trainingIndex.get(current.id).core;
  return core.kind==='ops'?['operations','arguments']:core.params.map(p=>p.name);
}
function caseValues(input){
  if(!coreMode())return [input];
  const sample=JSON.parse(input);
  const values=trainingIndex.get(current.id).core.kind==='ops'?[sample.ops,sample.args]:sample.args;
  return values.map(value=>JSON.stringify(value));
}
function loadCases(){
  const key=draftKey(current.id), saved=state.testWorkspaces[key];
  const samples=current.tests.slice(0,Math.max(1,current.sampleCount||2));
  caseRows=samples.map(t=>caseValues(t.input));
  caseIndex=0;
  if(Array.isArray(saved?.rows)&&saved.rows.length && saved.rows.every(row=>Array.isArray(row)&&row.length===paramNames().length&&row.every(v=>typeof v==='string'))){
    caseRows=saved.rows.map(row=>row.slice());
    caseIndex=Math.max(0,Math.min(caseRows.length-1,Number(saved.index)||0));
  }else if(typeof state.testInputs[key]==='string'){
    const previous=state.testInputs[key];
    const found=samples.findIndex(t=>t.input===previous);
    if(found>=0)caseIndex=found;
    else try{caseRows.push(caseValues(previous));caseIndex=caseRows.length-1;}catch{}
  }
  sourceDraft=typeof saved?.source==='string'?saved.source:null;
  sourceView=sourceDraft!==null;
  updateCaseInput();
}
function caseTest(row){
  if(!coreMode()){
    const normalize=value=>value.replace(/\r\n/g,'\n').replace(/\n$/,'');
    const match=current.tests.find(t=>normalize(t.input)===normalize(row[0]));
    return {input:row[0],output:match?.output??null};
  }
  const args=row.map((value,i)=>{
    try{return JSON.parse(value);}catch{throw Error(paramNames()[i]+' 的值不是有效的 JSON');}
  });
  const ops=trainingIndex.get(current.id).core.kind==='ops';
  if(ops&&(!Array.isArray(args[0])||!Array.isArray(args[1])||args[0].length!==args[1].length))throw Error('操作序列与参数列表的长度必须一致');
  if(ops){
    const core=trainingIndex.get(current.id).core;
    if(!args[0].length||args[0][0]!==core.className)throw Error('操作序列必须以 '+core.className+' 开头');
    args[0].forEach((name,i)=>{
      const params=name===core.className?core.ops.constructor:core.ops.methods.find(op=>op.name===name)?.args;
      if(!params||!Array.isArray(args[1][i])||args[1][i].length!==params.length)throw Error('第 '+(i+1)+' 个操作或参数不匹配');
    });
  }
  const sample=ops?{ops:args[0],args:args[1]}:{args};
  const match=current.tests.find(t=>JSON.stringify(caseValues(t.input))===JSON.stringify(args.map(v=>JSON.stringify(v))));
  if(match)sample.expected=JSON.parse(match.input).expected;
  return {input:JSON.stringify(sample),output:match?.output??null,sample};
}
function updateCaseInput(){
  try{customInput=caseTest(caseRows[caseIndex]).input;}
  catch{customInput=caseRows[caseIndex].join('\n');}
}
function saveCurrentInput(){
  const key=draftKey(current.id), initial=caseTest(caseValues(current.tests[0].input)).input;
  if(Object.hasOwn(state.testInputs,key)||customInput!==initial)state.testInputs[key]=customInput;
}
function saveCases(){
  updateCaseInput();
  const key=draftKey(current.id);
  state.testWorkspaces[key]={index:caseIndex,rows:caseRows.map(row=>row.slice()),source:sourceDraft};
  state.testInputs[key]=customInput;persist();
}
function visibleTests(){
  if(sourceDraft!==null)parseCaseSource(sourceDraft);
  return caseRows.map((row,i)=>{
    try{return caseTest(row);}catch(error){caseIndex=i;sourceView=false;renderCases();throw Error('Case '+(i+1)+' · '+error.message);}
  });
}
function useExample(index){
  const row=caseValues(current.tests[index].input);
  let found=caseRows.findIndex(value=>JSON.stringify(value)===JSON.stringify(row));
  if(found===-1){caseRows.push(row);found=caseRows.length-1;}
  caseIndex=found;sourceView=false;sourceDraft=null;saveCases();renderCases();
}
function renderCases(){
  const body=$('#test-body'), row=caseRows[caseIndex];
  if(!row)return;
  const names=paramNames();
  const tabs=caseRows.map((_,i)=>'<div class="case-pill '+(i===caseIndex?'active':'')+'"><button type="button" data-pick="'+i+'" aria-pressed="'+(i===caseIndex)+'">Case '+(i+1)+'</button>'+(caseRows.length>1?'<button class="case-remove" data-remove="'+i+'" aria-label="删除 Case '+(i+1)+'">×</button>':'')+'</div>').join('');
  const fields=row.map((v,i)=>'<label class="case-field"><span>'+esc(names[i])+(coreMode()?' =':'')+'</span><textarea data-field="'+i+'" rows="'+Math.min(8,Math.max(1,v.split('\n').length))+'" spellcheck="false">'+esc(v)+'</textarea></label>').join('');
  body.innerHTML='<div class="case-strip"'+(sourceView?' hidden':'')+'>'+tabs+'<button class="case-add" title="添加测试用例" aria-label="添加测试用例"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg></button></div>'+
    (sourceView?'<label class="case-field"><span>Source</span><textarea class="case-source" rows="5" spellcheck="false">'+esc(sourceDraft??caseRows.flat().join('\n'))+'</textarea></label>':fields)+
    (coreMode()?'<div class="case-bottom"><button data-source aria-pressed="'+sourceView+'">'+(sourceView?'参数视图':'Source')+'</button></div>':'');
  body.onclick=e=>{
    const button=e.target.closest('button');if(!button)return;
    if(sourceDraft!==null){
      try{parseCaseSource(sourceDraft);}catch(error){notify(error.message);return;}
    }
    sourceDraft=null;
    if(button.hasAttribute('data-source'))sourceView=!sourceView;
    else if(button.hasAttribute('data-pick')){caseIndex=Number(button.dataset.pick);sourceView=false;}
    else if(button.hasAttribute('data-remove')){
      const idx=Number(button.dataset.remove);caseRows.splice(idx,1);
      caseIndex=Math.min(caseRows.length-1,Math.max(0,caseIndex-(idx<caseIndex?1:0)));
    }else if(button.classList.contains('case-add')){
      caseRows.push(caseRows[caseIndex].slice());caseIndex=caseRows.length-1;sourceView=false;
    }
    saveCases();renderCases();
    body.querySelector('.case-pill.active')?.scrollIntoView({block:'nearest',inline:'nearest'});
  };
  body.oninput=e=>{
    const field=e.target;
    if(field.classList.contains('case-source')){
      sourceDraft=field.value;
      try{
        caseRows=parseCaseSource(sourceDraft);caseIndex=Math.min(caseIndex,caseRows.length-1);
        field.removeAttribute('aria-invalid');
      }catch{field.setAttribute('aria-invalid','true');}
    }else row[Number(field.dataset.field)]=field.value;
    saveCases();
  };
}
function resultField(label,value){
  return '<div class="result-field"><span>'+esc(label)+'</span><pre>'+esc(String(value??''))+'</pre></div>';
}
function renderResults(){
  const body=$('#result-body');
  if(activeJob){body.innerHTML='<div class="result-empty"><span class="spinner"></span><span id="running-label">正在执行代码</span></div>';return;}
  if(!results){body.innerHTML='<div class="result-empty">请先执行代码</div>';return;}
  const item=results.items[resultIndex]||results.items[0];
  const label=results.good?(results.items.every(t=>t.expected==null)?'执行完成':'通过'):results.label.replace('Wrong Answer · 答案错误','解答错误').replace('Runtime Error','执行出错');
  const timing=results.elapsed??item?.ms;
  let html='<div class="judge-heading '+(results.good?'ok':'failed')+'"><strong>'+esc(label)+'</strong>'+(timing!=null?'<span>执行用时 '+esc(String(timing))+' ms</span>':'')+'</div>';
  html+='<div class="case-strip">'+results.items.map((t,i)=>'<button data-result="'+i+'" aria-pressed="'+(i===resultIndex)+'" class="result-case '+(i===resultIndex?'active':'')+'"><i class="'+(t.error||!t.pass?'fail':t.expected==null?'neutral':'pass')+'"></i>Case '+(i+1)+'</button>').join('')+'</div>';
  if(item){
    if(item.input!=null){
      let inputs=[['stdin',item.input]];
      if(coreMode())try{inputs=caseValues(item.input).map((v,i)=>[paramNames()[i]+' =',v]);}catch{}
      html+='<div class="result-group">输入</div>'+inputs.map(([key,value])=>resultField(key,value)).join('');
    }
    if(item.error)html+=resultField('错误信息',item.error);
    if(item.stderr)html+=resultField('标准错误',item.stderr);
    if(item.output!=null)html+=resultField('输出',item.output);
    if(item.expected!=null)html+=resultField('预期结果',item.expected);
  }
  body.innerHTML=html;
}
