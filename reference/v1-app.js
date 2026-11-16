'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const paths={search:'<circle cx="7" cy="7" r="4.5"/><path d="m11 11 3.5 3.5"/>',left:'<path d="m10 3-5 5 5 5"/>',right:'<path d="m6 3 5 5-5 5"/>',down:'<path d="m4 6 4 4 4-4"/>',panel:'<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M6 3v10"/>',shuffle:'<path d="M2 4h2l8 8h2M11 10l3 2-3 2M2 12h2l3-3m2-2 3-3h2m-3-2 3 2-3 2"/>',timer:'<circle cx="8" cy="9" r="5.5"/><path d="M6 1h4M8 9V6m4-3 1 1"/>',play:'<path d="m5 3 8 5-8 5Z"/>',upload:'<path d="M8 11V2m-3 3 3-3 3 3M3 10v3h10v-3"/>',stop:'<rect x="4" y="4" width="8" height="8" rx="1"/>',file:'<path d="M9 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-8L9 1.5Z"/><path d="M9 2v4h4M5.5 9h5m-5 3h3"/>',book:'<path d="M8 4C6 2 3 2 1.5 3v10c2-1 4-1 6.5 1 2.5-2 4.5-2 6.5-1V3C13 2 10 2 8 4Zm0 0v10"/>',history:'<path d="M2 6a6 6 0 1 1 0 4M2 2v4h4M8 5v4l3 1"/>',code:'<path d="m5 4-4 4 4 4m6-8 4 4-4 4M9 2 7 14"/>',terminal:'<rect x="1.5" y="2.5" width="13" height="11" rx="2"/><path d="m4 6 2 2-2 2m4 0h3"/>',reset:'<path d="M2 6a6 6 0 1 1 0 4M2 2v4h4"/>',copy:'<rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M10 5V2H2v8h3"/>',download:'<path d="M8 1v9m-3-3 3 3 3-3M2 11v3h12v-3"/>',cloud:'<path d="M5 12H4a3 3 0 0 1-1-5.8 5 5 0 0 1 9.5-.5A3 3 0 0 1 12 12h-1m-5-3 2 2 4-4"/>',star:'<path d="m8 1.5 2 4.2 4.5.7-3.3 3.2.8 4.4-4-2.1-4 2.1.8-4.4-3.3-3.2 4.5-.7Z"/>',check:'<path d="m3 8 3 3 7-7"/>','check-square':'<rect x="2" y="2" width="12" height="12" rx="2"/><path d="m5 8 2 2 4-4"/>',help:'<circle cx="8" cy="8" r="6"/><path d="M6 6a2 2 0 1 1 3 1.7C8 8.2 8 8.5 8 9M8 11h.01"/>',close:'<path d="m4 4 8 8M4 12l8-8"/>',fold:'<path d="m5 5 3-3 3 3M3 8h10m-8 3 3 3 3-3"/>',moon:'<path d="M13.5 9.5A6 6 0 0 1 6.5 2a6 6 0 1 0 7 7.5Z"/>',sun:'<circle cx="8" cy="8" r="3"/><path d="M8 0v2m0 12v2M0 8h2m12 0h2M2 2l1.5 1.5m9 9L14 14M2 14l1.5-1.5m9-9L14 2"/>',bulb:'<path d="M5 11C5 8 3 9 3 6a5 5 0 0 1 10 0c0 3-2 2-2 5M5 11h6m-5 3h4"/>',arrow:'<path d="M2 8h12m-5-5 5 5-5 5"/>'};
function icon(name){return `<svg viewBox="0 0 16 16" aria-hidden="true">${paths[name]||paths.code}</svg>`;}
paths.expand='<path d="M6 2H2v4m8-4h4v4M2 10v4h4m8-4v4h-4"/>';
paths.chart='<path d="M3 13V8m5 5V3m5 10V6M1 15h14"/>';
function icons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
function esc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const KEY='hot100-acm-v1';
let saved;
try{saved=JSON.parse(localStorage.getItem(KEY)||'null');}catch{}
let state=Object.assign({codes:{},notes:{},accepted:[],favorites:[],history:{},theme:'light',fontSize:13,last:1},saved&&typeof saved==='object'?saved:{});
for(const k of ['codes','notes','history'])if(!state[k]||typeof state[k]!=='object'||Array.isArray(state[k]))state[k]={};
for(const k of ['accepted','favorites'])if(!Array.isArray(state[k]))state[k]=[];
let problems=[], current, editor, loadingCode=false, mainTab='description', bottomTab='input', categoryFilter='', query='', filterDifficulty='', filterStatus='', allExpanded=false;
const expanded=new Set(['哈希','双指针','滑动窗口']);
let caseIndex=0, customInput='', results=null, resultIndex=0, worker=null, workerReady=false, activeJob=null, watchdog=null, saveTimer, toastTimer;
let clockSeconds=0, clockRunning=false;
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state)); $('#save-state').innerHTML=icon('cloud')+'已保存到本地';}catch{$('#save-state').textContent='保存失败，请下载代码备份';}}
function notify(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3000);}
function difficultyClass(d){return d==='简单'?'easy':d==='中等'?'medium':'hard';}
function applyTheme(){document.body.classList.toggle('dark',state.theme==='dark');$('#theme-btn').innerHTML=icon(state.theme==='dark'?'sun':'moon');}
function renderList(){
  const filtered=problems.filter(p=>(!query||(p.title+' '+p.id+' '+p.category).toLowerCase().includes(query.toLowerCase()))&&(!filterDifficulty||p.difficulty===filterDifficulty)&&(!categoryFilter||p.category===categoryFilter)&&(!filterStatus||(filterStatus==='done'?state.accepted.includes(p.id):filterStatus==='todo'?!state.accepted.includes(p.id):state.favorites.includes(p.id))));
  $('#list-label').innerHTML=`${categoryFilter||'全部题目'} <b>${filtered.length}</b>`;
  $('#clear-filter').hidden=!(query||filterDifficulty||filterStatus||categoryFilter);
  const categories=[...new Set(filtered.map(p=>p.category))];
  $('#problem-list').innerHTML=categories.length?categories.map(cat=>{const items=filtered.filter(p=>p.category===cat),open=query||categoryFilter||filterStatus||filterDifficulty||allExpanded||expanded.has(cat);return `<div class="problem-group"><button class="group-title ${open?'':'collapsed'}" data-group="${esc(cat)}" aria-expanded="${!!open}">${icon('down')}<span>${esc(cat)}</span><small>${items.filter(p=>state.accepted.includes(p.id)).length} / ${items.length}</small></button>${open?items.map(p=>`<button class="problem-row ${p.id===current?.id?'selected':''}" data-problem="${p.id}" title="${p.id}. ${esc(p.title)}" ${p.id===current?.id?'aria-current="true"':''}><span class="row-number">${p.id}.</span><span class="row-name">${esc(p.title)}</span>${state.accepted.includes(p.id)?`<span class="status-mark done">${icon('check')}</span>`:state.favorites.includes(p.id)?`<span class="status-mark starred">${icon('star')}</span>`:`<span class="diff-dot ${difficultyClass(p.difficulty)}" title="${p.difficulty}"></span>`}</button>`).join(''):''}</div>`;}).join(''):'<div class="empty-list">没有找到符合条件的题目<br>试试其他关键词或清除筛选</div>';
  $('#solved-count').textContent=state.accepted.length;$('#progress-fill').style.width=state.accepted.length+'%';
}
function titleHTML(){return `<h1><span class="title-id">${current.id}.</span> ${esc(current.title)}</h1><div class="tags"><span class="tag ${difficultyClass(current.difficulty)}">${current.difficulty}</span><span class="tag">${esc(current.category)}</span><span class="tag mode">ACM 模式</span>${state.accepted.includes(current.id)?`<span class="solved-badge">${icon('check')}已解答</span>`:''}</div>`;}
function renderContent(){
  $$('.panel-tabs [data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===mainTab);b.setAttribute('aria-selected',String(b.dataset.tab===mainTab));});
  const history=state.history[current.id]||[];$('#history-count').textContent=history.length||'';
  let html=titleHTML();
  if(mainTab==='description'){
    html+=`<p class="statement">${esc(current.statement)}</p><div class="format-note">${icon('terminal')}<div><strong>ACM 模式</strong> · 自行读取标准输入并打印答案。<br>无需提交 Solution 类，编写完整 Python 程序即可。</div></div><h3>输入格式</h3><p class="format-text">${esc(current.input)}</p><h3>输出格式</h3><p class="format-text">${esc(current.output)}</p><h3>示例</h3>${current.tests.slice(0,current.sampleCount).map((t,i)=>`<div class="example"><div class="example-head"><span>示例 ${i+1}</span><button class="text-btn" data-use-case="${i}">用作测试 ${icon('arrow')}</button></div><div class="example-content"><div><label>输入</label><pre>${esc(t.input)}</pre></div><div><label>输出</label><pre>${esc(t.output)}</pre></div></div></div>`).join('')}<h3>数据范围</h3><div class="constraints">${esc(current.constraints)}</div><details class="hint"><summary>需要一点思路？展开提示</summary><p>${esc(current.idea[0])}</p></details><p class="small muted" style="margin-top:23px">题目为 ACM 输入输出改编版，多解输出规则以本页为准。</p>`;
  }else if(mainTab==='solution'){
    html+=`<div class="solution-banner">${icon('book')}完整 ACM 题解 · 可直接运行的 Python 程序</div><h3>解题思路</h3><ol class="steps">${current.idea.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><h3>复杂度分析</h3><div class="constraints">${esc(current.complexity)}</div><h3>输入输出处理</h3><p class="format-text">${esc(current.input)}<br>${esc(current.output)}</p><div class="solution-code"><div class="example-head"><span>main.py <span class="muted"> / Python 3</span></span><button class="text-btn" id="copy-solution">复制完整代码</button></div><pre class="code-block cm-s-default" id="solution-code"></pre></div><div class="solution-actions"><button class="button submit" id="load-solution">${icon('code')}载入编辑器</button><button class="button" id="download-solution">${icon('download')}下载题解</button></div><p class="small muted">复杂度默认描述核心算法，输入构建、序列化及输出存储另计。</p><h3>我的笔记</h3><textarea id="notes" class="notes" placeholder="记录易错点、输入处理或你的另一种解法…" aria-label="本题学习笔记">${esc(state.notes[current.id]||'')}</textarea><p class="small muted">笔记仅保存在当前浏览器。</p>`;
  }else{
    html+=`<p class="small muted">仅记录提交；运行样例不会计入通过进度。当前浏览器保留每题最近 20 次提交。</p>${history.length?history.map((h,i)=>`<div class="history-row"><strong class="${h.verdict==='Accepted'?'':'error'}">${esc(h.verdict)}</strong><span class="muted">${h.passed} / ${h.total} 用例</span><span class="time">${esc(new Date(h.time).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}))}</span><div class="small"><span class="muted">Python 3 · ACM</span> <button data-history="${i}">查看该次代码</button></div></div>`).join(''):`<div class="empty-state">${icon('history')}<h3>还没有提交记录</h3>完成代码后，点击右上角「提交」验证练习用例。</div>`}`;
  }
  $('#problem-content').innerHTML=html;
  if(mainTab==='solution'){
    if(CodeMirror.runMode)CodeMirror.runMode(current.solution,'python',$('#solution-code'));else $('#solution-code').textContent=current.solution;
    $('#copy-solution').onclick=()=>copy(current.solution);
    $('#load-solution').onclick=()=>replaceCode(current.solution,'载入题解','这会覆盖编辑器中的当前代码。载入后可运行或提交，验证完整的输入输出流程。');
    $('#download-solution').onclick=()=>download(`hot100_${current.id}_solution.py`,current.solution);
    $('#notes').oninput=e=>{state.notes[current.id]=e.target.value;persist();};
  }
  $('#favorite').classList.toggle('starred',state.favorites.includes(current.id));
  $('#favorite').setAttribute('aria-label',state.favorites.includes(current.id)?'取消收藏':'收藏本题');
}
function pickProblem(id){
  const p=problems.find(p=>p.id===Number(id));if(!p)return;
  if(activeJob)cancelJob(false);
  if(current)saveCode();current=p;state.last=p.id;mainTab='description';bottomTab='input';caseIndex=0;customInput=p.tests[0].input;results=null;
  loadingCode=true;editor.setValue(state.codes[p.id]??p.template);loadingCode=false;
  $('#category-label').textContent=p.category;$('#problem-index').textContent=String(p.order).padStart(2,'0')+' / 100';
  $('#prev').disabled=p.order===1;$('#next').disabled=p.order===100;
  expanded.add(p.category);renderList();renderContent();renderTest();$('#problem-content').scrollTop=0;
  $('#result-dot').textContent='';$('#runtime-state').innerHTML='<i></i> 准备就绪';
  document.title=`${p.id}. ${p.title} · HOT 100 ACM`;
  persist();editor.refresh();document.body.classList.remove('sidebar-open');
}
function go(id){if(current?.id===id)return;location.hash='problem/'+id;}
function renderTest(){
  $('#input-tab').classList.toggle('active',bottomTab==='input');$('#result-tab').classList.toggle('active',bottomTab==='result');
  $('#input-tab').setAttribute('aria-selected',String(bottomTab==='input'));$('#result-tab').setAttribute('aria-selected',String(bottomTab==='result'));
  if(bottomTab==='input'){
    $('#test-body').innerHTML=`<div class="case-tabs">${current.tests.slice(0,2).map((t,i)=>`<button class="case-tab ${caseIndex===i?'selected':''}" data-case="${i}">用例 ${i+1}</button>`).join('')}<button class="case-tab ${caseIndex===-1?'selected':''}" data-case="-1">自定义</button><button class="text-btn" id="restore-case">${icon('reset')}恢复样例</button></div><label class="input-label" for="stdin"><span>标准输入 <span class="muted">stdin</span></span><span>以题目输入格式为准</span></label><textarea class="stdin" id="stdin" spellcheck="false" aria-label="标准输入">${esc(customInput)}</textarea><p class="test-hint">运行当前输入 · 提交检查本题全部 ${current.tests.length} 组练习用例</p>`;
    $('#stdin').oninput=e=>{customInput=e.target.value;caseIndex=-1;$$('[data-case]').forEach(b=>b.classList.toggle('selected',b.dataset.case==='-1'));};
    $('#restore-case').onclick=()=>{caseIndex=0;customInput=current.tests[0].input;renderTest();};
  }else if(activeJob){
    $('#test-body').innerHTML=`<div class="loading-state"><span class="spinner"></span><div id="running-label">${workerReady?'正在运行 Python 程序…':'首次启动 Python 环境，正在加载…'}<p class="small muted">${workerReady?'按真实标准输入执行代码，可随时停止。':'首次加载约 14 MB，之后由浏览器缓存。'}</p></div></div>`;
  }else if(!results){
    $('#test-body').innerHTML=`<div class="empty-state">${icon('terminal')}<h3>让代码跑起来</h3>选择一个测试用例，点击「运行」或按 Ctrl + Enter。</div>`;
  }else{
    const r=results, item=r.items[resultIndex]||r.items[0];
    $('#test-body').innerHTML=`<div class="result-head"><span class="verdict ${r.good?'':'error'}">${esc(r.label)}</span><span class="muted">${r.submit?`${r.passed} / ${r.total} 用例通过`:r.items[0]?.ms!=null?`执行耗时 ${r.items[0].ms} ms`:''}</span></div>${r.submit?`<div class="case-result-tabs">${r.items.map((t,i)=>`<button class="case-result ${t.pass?'':'fail'} ${i===resultIndex?'selected':''}" data-result="${i}">${t.pass?'✓':'×'} 用例 ${i+1}</button>`).join('')}</div>`:''}${item?`${item.error?`<pre class="result-detail">${esc(item.error)}</pre>`:`<div class="result-label">实际输出 stdout</div><pre class="result-detail">${esc(item.output||'（无输出）')}</pre>`}${item.expected!=null?`<div class="result-label">期望输出</div><pre class="result-detail">${esc(item.expected||'（无输出）')}</pre>`:''}${item.stderr?`<div class="result-label">调试输出 stderr</div><pre class="result-detail">${esc(item.stderr)}</pre>`:''}${r.submit?`<details class="small muted" style="margin-top:9px"><summary>查看该用例输入</summary><pre>${esc(item.input)}</pre></details>`:''}`:''}<p class="test-hint">${r.submit&&r.good?'已计入进度。通过的是本站练习用例，不等同于官方完整评测。':r.submit?'请对照输入输出格式与题解检查；修正后可重新提交。':item?.expected==null?'自定义输入仅执行程序，不判定答案，也不计入通过进度。':'运行样例不计入进度，完成后可提交全部练习用例。'}</p>`;
  }
}
function saveCode(){if(current&&editor&&!loadingCode){state.codes[current.id]=editor.getValue();persist();}}
function equalOutput(actual,expected,judge){const a=actual.trim().split(/\s+/).filter(Boolean),b=expected.trim().split(/\s+/).filter(Boolean);if(a.length!==b.length)return false;return a.every((x,i)=>judge==='float'?Number.isFinite(Number(x))&&Math.abs(Number(x)-Number(b[i]))<=1e-6:x===b[i]);}
function setBusy(on){$('#run').disabled=on;$('#submit').disabled=on;$('#stop').hidden=!on;$('#reset-code').disabled=on;}
function armTimeout(ms,message){clearTimeout(watchdog);watchdog=setTimeout(()=>{
  if(!activeJob)return;const job=activeJob;
  worker?.terminate();worker=null;workerReady=false;
  job.items.push({input:job.tests[job.items.length]?.input||'',expected:job.tests[job.items.length]?.output,error:message,output:'',pass:false});
  finishJob(message.startsWith('执行')?'Time Limit Exceeded':'环境启动失败');
},ms);}
function runCode(submit=false){
  if(activeJob)return;saveCode();const code=editor.getValue();if(!code.trim()){notify('请先编写代码');return;}
  const match=current.tests.find(t=>t.input.trim()===customInput.trim());
  const tests=submit?current.tests:[{input:customInput,output:match?.output??null}];
  activeJob={submit,code,problem:current,tests,items:[]};bottomTab='result';results=null;resultIndex=0;setBusy(true);renderTest();
  $('#runtime-state').innerHTML='<i></i> '+(workerReady?'运行中':'加载 Python');
  if(!worker){worker=new Worker('runner.js');worker.onmessage=handleWorker;worker.onerror=event=>{if(!activeJob)return;activeJob.items.push({error:'Python 运行环境无法加载：'+event.message,output:'',pass:false});worker.terminate();worker=null;workerReady=false;finishJob('环境错误');};}
  armTimeout(workerReady?10000:90000,'Python 环境加载超时，请检查网络并重新运行。');
  worker.postMessage({code,inputs:tests.map(t=>t.input)});
}
function handleWorker({data}){
  if(!activeJob)return;
  if(data.type==='ready'){workerReady=true;$('#runtime-state').innerHTML='<i></i> 运行中';}
  if(data.type==='case-start'){
    armTimeout(3000,'执行超过单用例 3 秒限制。请检查死循环或优化算法。');
    if($('#running-label'))$('#running-label').innerHTML=`正在执行用例 ${data.index+1} / ${activeJob.tests.length}<p class="small muted">Python 3 · 标准输入输出</p>`;
  }
  if(data.type==='case-result'){
    clearTimeout(watchdog);const test=activeJob.tests[data.index];
    activeJob.items.push({...data,input:test.input,expected:test.output,pass:!data.error&&(test.output==null||equalOutput(data.output,test.output,activeJob.problem.judge))});
    armTimeout(10000,'执行环境没有响应，请重新运行。');
  }
  if(data.type==='failure'){
    activeJob.items.push({output:'',error:'Python 环境错误：'+data.message,pass:false});worker?.terminate();worker=null;workerReady=false;finishJob('环境错误');
  }
  if(data.type==='done')finishJob();
}
function finishJob(forcedLabel){
  if(!activeJob)return;clearTimeout(watchdog);
  const job=activeJob;activeJob=null;setBusy(false);
  const passed=job.items.filter(t=>t.pass).length,good=passed===job.tests.length;
  const error=job.items.some(t=>t.error);
  const label=forcedLabel||(error?'Runtime Error':good?(job.submit?'Accepted · 通过':job.tests[0].output==null?'运行完成':'样例通过'):'Wrong Answer · 答案错误');
  results={items:job.items,good:!forcedLabel&&good,label,passed,total:job.tests.length,submit:job.submit};
  if(job.submit){
    const verdict=forcedLabel||(error?'Runtime Error':good?'Accepted':'Wrong Answer');
    const history=state.history[job.problem.id]||[];history.unshift({time:Date.now(),verdict,passed,total:job.tests.length,code:job.code});state.history[job.problem.id]=history.slice(0,20);
    if(good&&!forcedLabel&&!state.accepted.includes(job.problem.id)){state.accepted.push(job.problem.id);clockRunning=false;$('#timer').classList.remove('running');notify('通过！又掌握了一道经典题。');}
    persist();renderList();renderContent();
  }
  $('#runtime-state').innerHTML='<i></i> 执行结束';$('#result-dot').textContent=good?' ·':' !';renderTest();
}
function cancelJob(show=true){if(!activeJob)return;clearTimeout(watchdog);worker?.terminate();worker=null;workerReady=false;activeJob=null;setBusy(false);results={good:false,label:'已停止',items:[],submit:false};$('#runtime-state').textContent='已停止';if(show)renderTest();}
function modal(title,html){$('#modal-title').textContent=title;$('#modal-body').innerHTML=html;$('#modal').showModal();}
function closeModal(){$('#modal').close();}
function replaceCode(code,title,description){
  const replace=()=>{editor.setValue(code);saveCode();closeModal();notify('已载入编辑器，可以运行验证');};
  if(editor.getValue()===current.template||editor.getValue()===code){replace();return;}
  modal(title,`<p class="modal-copy">${esc(description)}</p><div class="confirm-actions"><button class="button" id="cancel-replace">保留当前代码</button><button class="button submit" id="confirm-replace">确认替换</button></div>`);$('#cancel-replace').onclick=closeModal;$('#confirm-replace').onclick=replace;
}
async function copy(text){try{await navigator.clipboard.writeText(text);notify('已复制到剪贴板');}catch{notify('浏览器未允许复制，可选中代码后手动复制');}}
function download(name,text,type='text/plain;charset=utf-8'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function roadmap(){
  const cats=[...new Set(problems.map(p=>p.category))];
  modal('学习路线',`<p class="modal-copy">按专题循序推进，从哈希与双指针开始，再逐步练习树、图和动态规划。点击专题进入对应题目。</p><div class="roadmap-grid">${cats.map((cat,i)=>{const ps=problems.filter(p=>p.category===cat),done=ps.filter(p=>state.accepted.includes(p.id)).length;return `<button class="roadmap-card" data-roadmap="${esc(cat)}"><div class="roadmap-top"><span><small>${String(i+1).padStart(2,'0')}</small> ${esc(cat)}</span><small>${done} / ${ps.length}</small></div><div class="progress-track"><div style="width:${done/ps.length*100}%"></div></div></button>`;}).join('')}</div>`);
}
function progress(){
  const submitted=Object.values(state.history).flat(),accepted=submitted.filter(s=>s.verdict==='Accepted').length;
  modal('我的刷题进度',`<div class="stats-grid"><div class="stat"><b>${state.accepted.length}</b><span>已通过 / 100</span></div><div class="stat"><b>${state.favorites.length}</b><span>收藏题目</span></div><div class="stat"><b>${submitted.length}</b><span>保留的提交记录</span></div></div><p class="stat-caption">${['简单','中等','困难'].map(d=>`${d}：${problems.filter(p=>p.difficulty===d&&state.accepted.includes(p.id)).length} / ${problems.filter(p=>p.difficulty===d).length}`).join('　·　')}</p><p class="modal-copy">已保留的提交中有 ${accepted} 次通过。代码、收藏、笔记和提交记录仅保存在当前浏览器，清除浏览器数据会丢失。你可以导出一份备份。</p><button class="button submit" id="export-progress">${icon('download')}导出进度与代码</button><button class="button" id="import-progress" style="margin-left:8px">导入备份</button><input type="file" id="import-file" accept="application/json,.json" hidden><p class="small muted">导入时合并通过记录和收藏；备份中的同题代码、笔记和提交记录会覆盖当前内容。</p>`);
  $('#export-progress').onclick=()=>download('hot100-acm-backup.json',JSON.stringify({app:KEY,...state},null,2),'application/json');
  $('#import-progress').onclick=()=>$('#import-file').click();
  $('#import-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>10000000)throw Error('文件超过 10 MB');const b=JSON.parse(await file.text());if(b.app!==KEY)throw Error('不是本站导出的备份');const ids=new Set(problems.map(p=>p.id));for(const k of ['accepted','favorites']){if(!Array.isArray(b[k]))throw Error('备份格式不完整');state[k]=[...new Set([...state[k],...b[k].filter(id=>ids.has(id))])];}for(const k of ['codes','notes'])for(const [id,val] of Object.entries(b[k]||{})){if(ids.has(+id)&&typeof val==='string')state[k][id]=val;}for(const [id,rows] of Object.entries(b.history||{}))if(ids.has(+id)&&Array.isArray(rows))state.history[id]=rows.filter(r=>typeof r.code==='string'&&typeof r.verdict==='string'&&Number.isFinite(r.time)&&Number.isInteger(r.passed)&&Number.isInteger(r.total)).slice(0,20);persist();loadingCode=true;editor.setValue(state.codes[current.id]??current.template);loadingCode=false;renderList();renderContent();closeModal();notify('备份已导入');}catch(err){notify('导入失败：'+err.message);}};
}
function help(){modal('关于 ACM 训练室',`<div class="modal-copy"><p><strong>写完整程序，从输入到输出。</strong><br>左侧查看题目，右侧编写 Python。使用 input()、sys.stdin 或 sys.stdin.buffer 读取输入，再用 print() 输出答案。</p><p><strong>运行与提交</strong><br>运行执行当前输入；提交检查本题全部练习用例。每用例限时 3 秒，忽略输出空白差异，浮点题绝对误差为 10⁻⁶。这里是学习用的浏览器练习评测，不是隐藏数据的正式竞赛系统；通过少量用例不保证所有输入均正确。</p><p><strong>查看题解</strong><br>每题提供思路、复杂度和完整 Python ACM 程序；链表、树题包含输入结构构造。可复制、下载或载入编辑器验证。</p><p><strong>本地保存</strong><br>代码、笔记与进度保存在当前浏览器，不跨设备同步。请从「我的进度」导出备份。</p><p>题单参考 <a href="https://leetcode.cn/studyplan/top-100-liked/" target="_blank" rel="noopener">LeetCode 热题 100</a>。本站独立制作，题面与输入输出为重新编写的 ACM 改编，不隶属于力扣。题号沿用原题，部分多解题增加了确定输出规则。</p><p class="small muted">Python 3.12 / Pyodide 0.27.7 · CodeMirror 5 · 浏览器内执行<br>Python 环境及编辑器资源随网站提供，不需要另装 Python。</p></div>`);}

async function init(){
  icons();applyTheme();
  const response=await fetch('problems.json');if(!response.ok)throw Error('题库加载失败');problems=await response.json();
  const validIds=new Set(problems.map(p=>p.id));state.accepted=state.accepted.filter(id=>validIds.has(id));state.favorites=state.favorites.filter(id=>validIds.has(id));
  editor=CodeMirror.fromTextArea($('#editor'),{mode:'python',lineNumbers:true,indentUnit:4,tabSize:4,indentWithTabs:false,matchBrackets:true,autoCloseBrackets:true,viewportMargin:20,extraKeys:{Tab:cm=>cm.somethingSelected()?cm.indentSelection('add'):cm.replaceSelection('    ','end'), 'Shift-Tab':cm=>cm.indentSelection('subtract'),'Ctrl-Enter':()=>runCode(false),'Cmd-Enter':()=>runCode(false),'Ctrl-Shift-Enter':()=>runCode(true),'Cmd-Shift-Enter':()=>runCode(true)}});
  editor.getInputField().setAttribute('aria-label','Python 代码编辑器');
  editor.getWrapperElement().style.fontSize=Math.min(20,Math.max(11,Number(state.fontSize)||13))+'px';
  editor.on('change',()=>{if(loadingCode||!current)return;$('#save-state').textContent='保存中…';clearTimeout(saveTimer);saveTimer=setTimeout(saveCode,350);});
  editor.on('cursorActivity',()=>{const c=editor.getCursor();$('#cursor-position').textContent=`行 ${c.line+1}，列 ${c.ch+1}`;});
  window.addEventListener('hashchange',()=>pickProblem(Number(location.hash.match(/^#problem\/(\d+)$/)?.[1])||1));
  pickProblem(Number(location.hash.match(/^#problem\/(\d+)$/)?.[1])||state.last||1);if(!current)pickProblem(1);
  $('#search').oninput=e=>{query=e.target.value;renderList();};$('#difficulty').onchange=e=>{filterDifficulty=e.target.value;renderList();};$('#status-filter').onchange=e=>{filterStatus=e.target.value;renderList();};
  $('#clear-filter').onclick=()=>{query=filterDifficulty=filterStatus=categoryFilter='';$('#search').value='';$('#difficulty').value='';$('#status-filter').value='';renderList();};
  $('#collapse-groups').onclick=()=>{allExpanded=!allExpanded;if(!allExpanded)expanded.clear();renderList();};
  $('#sidebar-toggle').onclick=()=>document.body.classList.remove('sidebar-open');
  $('#drawer-backdrop').onclick=()=>document.body.classList.remove('sidebar-open');
  $('#nav-problems').onclick=()=>{document.body.classList.toggle('sidebar-open');if(document.body.classList.contains('sidebar-open'))$('#search').focus();};
  for(const [id,cl] of [['#focus-description','focus-description'],['#focus-code','focus-code']])$(id).onclick=()=>{const was=document.body.classList.contains(cl);document.body.classList.remove('focus-description','focus-code');if(!was)document.body.classList.add(cl);editor.refresh();};
  function resizePanels(handle,container,variable,vertical,min,max){
    const apply=(value)=>{container.style.setProperty(variable,Math.max(min,Math.min(max,value))+'%');editor.refresh();};
    handle.onpointerdown=e=>{if(innerWidth<=680)return;e.preventDefault();handle.setPointerCapture(e.pointerId);document.body.classList.add('resizing');const move=event=>{const r=container.getBoundingClientRect();apply(100*(vertical?event.clientX-r.left:event.clientY-r.top)/(vertical?r.width:r.height));};const up=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',up);document.body.classList.remove('resizing');};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',up);};
    handle.onkeydown=e=>{const keys=vertical?['ArrowLeft','ArrowRight']:['ArrowUp','ArrowDown'];if(keys.includes(e.key)){e.preventDefault();apply(parseFloat(container.style.getPropertyValue(variable)|| (vertical?'50':'64'))+(e.key===keys[0]?-3:3));}};
  }
  resizePanels($('#vertical-splitter'),$('.workspace'),'--split',true,28,72);
  resizePanels($('#horizontal-splitter'),$('.coding-column'),'--editor-ratio',false,35,80);
  $('#nav-roadmap').onclick=roadmap;$('#nav-progress').onclick=progress;$('#help-btn').onclick=help;
  $('#prev').onclick=()=>go(problems[current.order-2]?.id);$('#next').onclick=()=>go(problems[current.order]?.id);$('#random').onclick=()=>{const pool=problems.filter(p=>p.id!==current.id&&!state.accepted.includes(p.id));const ps=pool.length?pool:problems.filter(p=>p.id!==current.id);go(ps[Math.floor(Math.random()*ps.length)].id);};
  $('#favorite').onclick=()=>{state.favorites=state.favorites.includes(current.id)?state.favorites.filter(id=>id!==current.id):[...state.favorites,current.id];persist();renderList();$('#favorite').classList.toggle('starred',state.favorites.includes(current.id));$('#favorite').setAttribute('aria-label',state.favorites.includes(current.id)?'取消收藏':'收藏本题');};
  $('#run').onclick=()=>runCode(false);$('#submit').onclick=()=>runCode(true);$('#stop').onclick=()=>cancelJob();
  $('#input-tab').onclick=()=>{bottomTab='input';renderTest();};$('#result-tab').onclick=()=>{bottomTab='result';renderTest();};
  $('#theme-btn').onclick=()=>{state.theme=state.theme==='dark'?'light':'dark';applyTheme();persist();};
  $('#copy-code').onclick=()=>copy(editor.getValue());$('#download-code').onclick=()=>download(`hot100_${current.id}_main.py`,editor.getValue());
  $('#reset-code').onclick=()=>replaceCode(current.template,'重置代码','这会将当前题目的编辑器恢复到初始 Python 模板。提交记录中的代码不会被删除。');
  for(const [selector,delta]of [['#font-minus',-1],['#font-plus',1]])$(selector).onclick=()=>{state.fontSize=Math.min(20,Math.max(11,(Number(state.fontSize)||13)+delta));editor.getWrapperElement().style.fontSize=state.fontSize+'px';editor.refresh();persist();};
  $('#timer').onclick=()=>{clockRunning=!clockRunning;$('#timer').classList.toggle('running',clockRunning);};
  setInterval(()=>{if(clockRunning){clockSeconds++;$('#timer-text').textContent=String(Math.floor(clockSeconds/60)).padStart(2,'0')+':'+String(clockSeconds%60).padStart(2,'0');}},1000);
  $('#close-modal').onclick=closeModal;$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
  document.addEventListener('click',e=>{
    const p=e.target.closest('[data-problem]');if(p)go(+p.dataset.problem);
    const g=e.target.closest('[data-group]');if(g){const cat=g.dataset.group;if(allExpanded){allExpanded=false;problems.forEach(p=>expanded.add(p.category));}expanded.has(cat)?expanded.delete(cat):expanded.add(cat);renderList();}
    const t=e.target.closest('[data-tab]');if(t){mainTab=t.dataset.tab;renderContent();$('#problem-content').scrollTop=0;}
    const c=e.target.closest('[data-case]');if(c){caseIndex=+c.dataset.case;if(caseIndex>=0)customInput=current.tests[caseIndex].input;renderTest();$('#stdin').focus();}
    const u=e.target.closest('[data-use-case]');if(u){caseIndex=+u.dataset.useCase;customInput=current.tests[caseIndex].input;bottomTab='input';renderTest();notify(`已选用示例 ${caseIndex+1}`);}
    const r=e.target.closest('[data-result]');if(r){resultIndex=+r.dataset.result;renderTest();}
    const route=e.target.closest('[data-roadmap]');if(route){categoryFilter=route.dataset.roadmap;query=filterDifficulty=filterStatus='';$('#search').value='';$('#difficulty').value='';$('#status-filter').value='';closeModal();renderList();const first=problems.find(p=>p.category===categoryFilter&&!state.accepted.includes(p.id))||problems.find(p=>p.category===categoryFilter);go(first.id);if(innerWidth<=960)document.body.classList.add('sidebar-open');}
    const h=e.target.closest('[data-history]');if(h){const item=state.history[current.id][+h.dataset.history];modal('该次提交的代码',`<p class="small muted">${esc(item.verdict)} · ${esc(new Date(item.time).toLocaleString('zh-CN'))}</p><pre class="code-block cm-s-default" id="history-code"></pre><div class="solution-actions"><button class="button" id="copy-history">复制代码</button><button class="button" id="download-history">下载代码</button></div>`);if(CodeMirror.runMode)CodeMirror.runMode(item.code,'python',$('#history-code'));else $('#history-code').textContent=item.code;$('#copy-history').onclick=()=>copy(item.code);$('#download-history').onclick=()=>download(`submission_${current.id}.py`,item.code);}
  });
  window.addEventListener('beforeunload',saveCode);window.addEventListener('resize',()=>editor.refresh());
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!editor.hasFocus()){e.preventDefault();document.body.classList.add('sidebar-open');$('#search').focus();}if(e.key==='Escape')document.body.classList.remove('sidebar-open');});
}
init().catch(err=>{$('#problem-content').innerHTML=`<div class="empty-state"><h3>加载失败</h3>${esc(err.message)}<p>请刷新页面重试。</p></div>`;console.error(err);});
