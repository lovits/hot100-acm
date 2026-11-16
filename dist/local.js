'use strict';
// Local persistence is independent of browser origin storage and application updates.
let session={token:null,revision:0,base:{},directory:''},pendingSave=false,saving=null,diskTimer;
let route={path:'',kind:'description',detail:''}, routeEpoch=0;
let models=new Map(), lastFocus=null,restoringReading=false,serviceStopped=false;
const clone=x=>JSON.parse(JSON.stringify(x));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function normalizeState(value={}){
  const next={codes:{},notes:{},accepted:[],favorites:[],history:{},editorViews:{},reading:{},testInputs:{},conflicts:[],theme:'light',fontSize:14,last:1,testsCollapsed:true,...value};
  for(const k of ['codes','notes','history','editorViews','reading','testInputs','testWorkspaces','codeBookmarks'])if(!next[k]||typeof next[k]!=='object'||Array.isArray(next[k]))next[k]={};
  for(const k of ['accepted','favorites','conflicts'])if(!Array.isArray(next[k]))next[k]=[];
  for(const [id,rows] of Object.entries(next.history))next.history[id]=(Array.isArray(rows)?rows:[]).filter(r=>r&&typeof r.code==='string').map((r,i)=>({...r,id:r.id||`legacy-${r.time}-${i}`}));
  return next;
}
function mergeState(base,local,remote){
  const result=normalizeState(remote), conflicts=[...(remote.conflicts||[]),...(local.conflicts||[])];
  for(const key of new Set([...Object.keys(local),...Object.keys(remote)])){
    if(key==='conflicts')continue;
    if(key==='history'){
      result.history={...remote.history};
      for(const id of new Set([...Object.keys(local.history||{}),...Object.keys(remote.history||{})])){
        const rows=[...(remote.history?.[id]||[]),...(local.history?.[id]||[])];
        result.history[id]=[...new Map(rows.map(r=>[r.id||`${r.time}-${r.code}`,r])).values()].sort((a,b)=>b.time-a.time);
      }
    }else if(key==='accepted')result[key]=[...new Set([...(local[key]||[]),...(remote[key]||[])])];
    else if(['codes','notes','editorViews','reading','testInputs','testWorkspaces','codeBookmarks'].includes(key)){
      result[key]={...remote[key]};
      for(const [id,value] of Object.entries(local[key]||{}))if(!same(value,base[key]?.[id])){
        if(['codes','notes'].includes(key)&&remote[key]?.[id]!=null&&!same(remote[key][id],base[key]?.[id])&&!same(remote[key][id],value))conflicts.push({key,id,time:Date.now(),value:remote[key][id]});
        result[key][id]=value;
      }
    }else if(!same(local[key],base[key]))result[key]=local[key];
  }
  result.conflicts=[...new Map(conflicts.map(c=>[`${c.key}-${c.id}-${c.value}`,c])).values()];
  return normalizeState(result);
}
async function loadSession(){
  const response=await fetch('/api/session');
  if(!response.ok)throw Error('请通过桌面快捷方式启动本地服务。');
  const data=await response.json();session={token:data.token,revision:data.revision,base:clone(data.state),directory:data.dataDirectory};
  const previousDirectory=localStorage.getItem('hot100-directory');
  const sameDirectory=!previousDirectory||previousDirectory===data.dataDirectory;
  let pending;try{pending=JSON.parse(localStorage.getItem('hot100-pending')||'null');}catch{}
  if(!sameDirectory)pending=null;
  const initial=Object.keys(data.state).length?data.state:(sameDirectory?state:{});
  state=normalizeState(pending?mergeState(pending.base||{},pending.state,initial):initial);
  localStorage.setItem('hot100-directory',data.dataDirectory);
  if(data.recovered)setTimeout(()=>notify('主数据损坏，已从上一次备份恢复。原文件仍保留。'),1500);
  if(data.recoveryWarning)setTimeout(()=>modal('学习数据恢复提示',`<p>${esc(data.recoveryWarning)}</p>`),1600);
}
persist=function(){
  if(serviceStopped)return;
  pendingSave=true;
  try{localStorage.setItem(KEY,JSON.stringify(state));localStorage.setItem('hot100-pending',JSON.stringify({base:session.base,state}));}catch{}
  if($('#save-state'))$('#save-state').textContent='保存中…';
  clearTimeout(diskTimer);diskTimer=setTimeout(flushDisk,250);
};
async function flushDisk(){
  if(saving)return saving;
  if(!session.token)return false;
  saving=(async()=>{
    try{
      while(pendingSave){
        pendingSave=false;const snapshot=clone(state),base=clone(session.base);
        const response=await fetch('/api/progress',{method:'POST',headers:{'Content-Type':'application/json','X-Hot100-Token':session.token},body:JSON.stringify({revision:session.revision,state:snapshot})});
        const data=await response.json();
        if(response.status===403){
          const renewed=await fetch('/api/session');
          if(!renewed.ok)throw Error('本地服务连接需要刷新');
          const latest=await renewed.json();
          if(latest.dataDirectory!==session.directory)throw Error('学习数据目录已变更，请刷新页面');
          state=mergeState(base,state,latest.state);session.token=latest.token;session.base=clone(latest.state);session.revision=latest.revision;pendingSave=true;continue;
        }
        if(response.status===409){state=mergeState(base,state,data.state);session.base=clone(data.state);session.revision=data.revision;pendingSave=true;continue;}
        if(!response.ok)throw Error(data.error||'保存失败');
        session.revision=data.revision;session.base=snapshot;
        if(!pendingSave)localStorage.removeItem('hot100-pending');
      }
      $('#save-state').textContent='已存储';return true;
    }catch(error){pendingSave=true;$('#save-state').textContent='暂存于浏览器 · 等待重连';return false;}
    finally{saving=null;}
  })();return saving;
}
setInterval(()=>{if(pendingSave&&!saving)flushDisk();},5000);

async function createEditor(){
  window.MonacoEnvironment={getWorkerUrl:()=>new URL('vendor/monaco/vs/base/worker/workerMain.js',location.href).href};
  require.config({paths:{vs:'vendor/monaco/vs'}});
  await new Promise((resolve,reject)=>require(['vs/editor/editor.main'],resolve,reject));
  monaco.editor.defineTheme('hot100-dark',{base:'vs-dark',inherit:true,rules:[],colors:{'editor.background':'#262626','editorGutter.background':'#262626','editorLineNumber.foreground':'#858585'}});
  const instance=monaco.editor.create($('#editor'),{language:'python',value:'',theme:state.theme==='dark'?'hot100-dark':'vs',fontSize:state.fontSize,fontFamily:'Consolas, "Cascadia Code", monospace',lineHeight:21,lineNumbersMinChars:3,tabSize:4,insertSpaces:true,minimap:{enabled:false},automaticLayout:true,scrollBeyondLastLine:false,renderLineHighlight:'none',padding:{top:12,bottom:16},overviewRulerLanes:0,folding:true,wordWrap:'on',renderValidationDecorations:'on',ariaLabel:'代码编辑器',bracketPairColorization:{enabled:true}});
  instance.addCommand(monaco.KeyMod.CtrlCmd|monaco.KeyCode.Enter,()=>runCode(false));
  instance.addCommand(monaco.KeyMod.CtrlCmd|monaco.KeyMod.Shift|monaco.KeyCode.Enter,()=>runCode(true));
  instance.onDidScrollChange(()=>saveView());
  const adapter={instance,getValue:()=>instance.getValue(),setValue:v=>instance.setValue(v),refresh:()=>instance.layout(),hasFocus:()=>instance.hasTextFocus(),focus:()=>instance.focus(),getWrapperElement:()=>$('#editor'),getInputField:()=>$('#editor'),getCursor:()=>{const p=instance.getPosition()||{lineNumber:1,column:1};return{line:p.lineNumber-1,ch:p.column-1};},on:(event,cb)=>event==='change'?instance.onDidChangeModelContent(cb):instance.onDidChangeCursorPosition(cb),switchProblem:p=>{
    const key=draftKey(p.id),lang=language(), ext=extensions[lang];
    if(!models.has(key)){
      const value=state.codes[key]??(!classic()?localStorage.getItem('hot100-acm:v2:'+key):null)??practiceTemplate(p);
      const model=monaco.editor.createModel(value,lang==='python3'?'python':lang,monaco.Uri.parse('inmemory://hot100/'+key.replaceAll(':','/')+'/main.'+ext));
      model.updateOptions({tabSize:4,insertSpaces:true});models.set(key,model);
    }
    const model=models.get(key);models.delete(key);models.set(key,model);
    instance.setModel(model);if(state.editorViews[key])instance.restoreViewState(state.editorViews[key]);
    // Text and cursor positions live in state; retain undo models for eight recent drafts.
    while(models.size>8){const oldest=models.keys().next().value;models.get(oldest).dispose();models.delete(oldest);}
  }};
  return adapter;
}
function saveView(){if(current&&editor&&!loadingCode){state.editorViews[draftKey(current.id)]=editor.instance.saveViewState();persist();}}
paths.format='<path d="M2 3h12M2 6h7M2 9h12M2 12h7"/>';
paths.bookmark='<path d="M4 2h8v12l-4-3-4 3z"/>';
paths.flask='<path d="M6 1h4M6 1v5L2 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l-4-7V1M4 10h8"/>';
paths.tag='<path d="M2 2h6l6 6-6 6-6-6V2Z"/><circle cx="5" cy="5" r=".7"/>';
paths.link='<path d="m6 10 4-4M5 11l-1 1a3 3 0 0 1-4-4l3-3a3 3 0 0 1 4 0m2 6a3 3 0 0 0 4 0l3-3a3 3 0 0 0-4-4l-1 1"/>';
paths.sort='<path d="M4 2v12m-2-2 2 2 2-2M9 3h5M9 7h4M9 11h3"/>';
const oldTheme=applyTheme;
applyTheme=function(){oldTheme();if(window.monaco&&editor)monaco.editor.setTheme(state.theme==='dark'?'hot100-dark':'vs');};
function readingViewport(kind=route.kind){
  const ids={solutions:'#solution-content',submissions:'#history-content'};
  return $(ids[kind]||'#problem-content');
}
let detailProblem, solutionDetailId='', historyDetailId='';

function tabPath(tab){return `#/problems/${current?.id||state.last}/${({description:'description',solution:'solutions',history:'submissions'})[tab]||tab}`;}
function navigate(path){rememberReading();saveCode();saveView();if(location.hash===path)routePage();else location.hash=path;}
go=function(id){if(id)navigate(`#/problems/${id}/description`);closeDrawer();};
function rememberReading(){if(!route.path||restoringReading)return;state.reading[route.path]=readingViewport().scrollTop;}
function routePage(){
  rememberReading();const epoch=++routeEpoch;
  let path=location.hash||`#/problems/${state.last||1}/description`;
  const legacy=path.match(/^#problem\/(\d+)/);if(legacy)path=`#/problems/${legacy[1]}/description`;
  const match=path.match(/^#\/problems\/(\d+)\/(description|solutions|submissions)(?:\/([^/]+))?$/);
  if(!match||!problems.some(p=>p.id===+match[1])){
    const fallback=problems.find(p=>p.id===state.last)||problems[0];
    history.replaceState(null,'',`#/problems/${fallback.id}/description`);
    return routePage();
  }
  if(location.hash!==path)history.replaceState(null,'',path);
  const desiredReading=state.reading[path]||0;restoringReading=true;
  const id=+match[1];route={path,kind:match[2],detail:match[3]||''};
  mainTab={description:'description',solutions:'solution',submissions:'history'}[route.kind];
  if(detailProblem!==id){detailProblem=id;solutionDetailId=historyDetailId='';}
  if(route.kind==='solutions')solutionDetailId=route.detail;
  if(route.kind==='submissions')historyDetailId=route.detail;
  if(current?.id!==id)pickProblem(id);else renderContent();
  document.dispatchEvent(new CustomEvent('show-reading-pane',{detail:mainTab}));
  document.title=`${current.id}. ${current.title} · Hot100 ACM`;
  requestAnimationFrame(()=>{if(epoch!==routeEpoch)return;const target=readingViewport();target.scrollTop=desiredReading;restoringReading=false;editor.refresh();});
}
pickProblem=function(id){
  const p=practiceProblem(problems.find(p=>p.id===Number(id))||problems[0]);
  if(activeJob)cancelJob(false);if(current){saveCode();saveView();state.testInputs[draftKey(current.id)]=customInput;}
  loadingCode=true;current=p;state.last=p.id;editor.switchProblem(p);loadingCode=false;
  solutionQuery='';solutionTopic='不限';
  bottomTab='input';loadCases();results=null;
  $('#category-label').textContent=p.category;$('#problem-index').textContent=`${p.order} / 100`;
  $('#prev').disabled=false;$('#next').disabled=false;expanded.add(p.category);
  renderList();renderContent();renderTest();$('#result-dot').textContent='';$('#runtime-state').innerHTML='<i></i> 准备就绪';persist();
};
function closeDrawer(){document.body.classList.remove('sidebar-open');$('#sidebar').inert=true;$('#nav-problems').setAttribute('aria-expanded','false');if(lastFocus)lastFocus.focus();}
function openDrawer(){lastFocus=document.activeElement;$('#sidebar').inert=false;document.body.classList.add('sidebar-open');renderList();$('#nav-problems').setAttribute('aria-expanded','true');$('#search').focus();}
function codeHTML(code){return `<pre class="code-block annotated-code">${esc(code)}</pre>`;}
const annotatedCodeSources=new WeakMap();
function difficultyBadge(problem){return `<span class="difficulty-badge ${difficultyClass(problem.difficulty)}" aria-label="难度：${esc(problem.difficulty)}">${esc(problem.difficulty)}</span>`;}
paths.company='<rect x="3" y="5" width="10" height="8" rx="1.5"/><path d="M6 5V3h4v2M3 8h10M7 8v2h2V8"/>';
function relatedMetadata(p){
  const freq=trainingIndex.get(p.id)?.freq;
  const companies=freq?.companies||[];
  const chips=(items)=>items.filter(v=>typeof v==='string'&&v.trim()).map(v=>`<span class="topic-chip">${esc(v)}</span>`).join('');
  return `<div class="problem-meta"><div class="tags">${difficultyBadge(p)}
    ${freq?`<span class="tag" title="CodeTop 最近考察：${esc(freq.lastAsked||'未知')}">🔥 考察 ${esc(freq.value)} 次</span>`:''}
    <button type="button" class="tag meta-button" data-meta="topics" aria-expanded="false">${icon('tag')}相关标签</button>
    <button type="button" class="tag meta-button companies" data-meta="companies" aria-expanded="false">${icon('company')}相关企业</button>
    <button class="tag hint-link" data-show-hint>${icon('bulb')}提示</button>
    <a class="tag source-link" href="${esc(p.sourceUrl)}" target="_blank" rel="noopener">${icon('link')}查看力扣原题</a></div>
    <div class="meta-values" data-values="topics" hidden aria-label="算法标签">${chips(p.topicTags||[])||'暂无标签'}</div>
    <div class="meta-values" data-values="companies" hidden aria-label="相关企业">${companies.map(c=>`<span class="topic-chip" title="最近考察：${esc(c.lastAsked||'未知')}">${esc(c.name)} · ${esc(c.value)} 次</span>`).join('')||'暂无企业记录'}</div></div>`;
}
document.addEventListener('click',e=>{
  const button=e.target.closest('[data-meta]');if(!button)return;
  const group=button.closest('.problem-meta'),panel=group.querySelector('[data-values="'+button.dataset.meta+'"]');
  const open=panel.hidden;
  for(const other of group.querySelectorAll('[data-meta]'))other.setAttribute('aria-expanded',String(open && other===button));
  for(const other of group.querySelectorAll('[data-values]'))other.hidden=!(open && other===panel);
});
titleHTML=function(){return `<div class="problem-title-line"><h1><span class="title-id">${current.id}.</span> ${esc(current.title)}</h1><button type="button" class="icon-btn" id="favorite">${icon('star')}</button>${state.accepted.includes(current.id)?`<span class="solved-badge">${icon('check')}已解答</span>`:''}</div>${relatedMetadata(current)}`;};
function descriptionHTML(){
  return `${titleHTML()}<p class="statement">${esc(current.statement)}</p><h3>输入格式</h3><p class="format-text">${esc(current.input)}</p><h3>输出格式</h3><p class="format-text">${esc(current.output)}</p>${current.tests.slice(0,current.sampleCount).map((test,i)=>`<div class="example"><div class="example-head"><strong>示例 ${i+1}：</strong><button class="text-btn" data-use-case="${i}">用作测试 ${icon('arrow')}</button></div><div class="example-content"><div><label>输入：</label><pre>${esc(test.input)}</pre></div><div><label>输出：</label><pre>${esc(test.output)}</pre></div></div></div>`).join('')}<h3>提示：</h3><div class="constraints">${esc(current.constraints)}</div><details class="hint"><summary>${icon('bulb')}提示 1 ${icon('down')}</summary><p>${esc(current.idea[0])}</p></details>`;
}
async function colorizeCode(){
  const epoch=routeEpoch;
  for(const el of $$('.annotated-code')){const value=annotatedCodeSources.get(el)??el.textContent;annotatedCodeSources.set(el,value);const html=await monaco.editor.colorize(value,el.dataset.language||'python',{tabSize:4});if(epoch===routeEpoch&&el.isConnected)el.innerHTML=html;}
}
let solutionQuery='',solutionTopic='不限',solutionSort='recommended';
function solutionEntries(){
  let rows=availableSolutions().filter(s=>(solutionAuthor==='all'||(s.authorSlug||'local')===solutionAuthor)&&(!solutionQuery||`${s.author||'Hot100 ACM'} ${s.title} ${s.summary} ${s.insight||''} ${s.code||''}`.toLowerCase().includes(solutionQuery.toLowerCase()))&&(solutionTopic==='不限'||solutionTopic==='Python3'||current.topicTags.includes(solutionTopic)));
  if(solutionSort==='title')rows=rows.slice().sort((a,b)=>a.title.localeCompare(b.title,'zh-CN'));
  return rows.map(s=>s.sourceType?authorCard(s):`<a class="solution-card" href="#/problems/${current.id}/solutions/${s.id}"><span class="solution-author-avatar">${icon('code')}</span><div class="solution-entry"><div class="solution-author">Hot100 ACM <span>· 本地题解</span></div><h2>${esc(s.title)} <span class="solution-label">ACM</span></h2><p>${esc(s.summary)}</p><div class="solution-entry-tags">${current.topicTags.filter(Boolean).map(tag=>`<span class="topic-chip">${esc(tag)}</span>`).join('')}<span class="topic-chip">Python3</span></div><div class="solution-entry-foot">${icon('file')}完整程序 ${icon('code')}中文注释</div></div></a>`).join('')||`<div class="empty-state">${solutionAuthor==='jyd'?'尚未找到 Krahets 在本题的可导入正文。':solutionAuthor==='endlesscheng'?'本题作者题解尚未导入。':'没有匹配的题解，试试其他关键词。'}</div>`;
}
function solutionList(){
  const tags=['不限','Python3',...current.topicTags.filter(Boolean)];
  if(!tags.includes(solutionTopic))solutionTopic='不限';
  return `<div class="solution-author-filters">${[['all','全部'],['endlesscheng','灵茶山艾府'],['jyd','Krahets'],['local','本站 ACM']].filter(([key])=>key==='all'||key==='local'||authorLibrary.some(article=>article.authorSlug===key)).map(([key,name])=>`<button data-solution-author="${key}" class="${solutionAuthor===key?'selected':''}" aria-pressed="${solutionAuthor===key}">${name}</button>`).join('')}</div><div class="solution-tags">${tags.map(tag=>`<button data-solution-topic="${esc(tag)}" class="${tag===solutionTopic?'selected':''}" aria-pressed="${tag===solutionTopic}">${esc(tag)}</button>`).join('')}</div><div class="local-solution-notice">${icon('code')}本地题解库${difficultyBadge(current)}<span>${availableSolutions().length} 篇题解</span></div><div class="solution-entries">${solutionEntries()}</div>`;
}
function solutionDetail(s){
  const section=(key,title,content)=>`<section class="lesson-section" id="lesson-${key}"><h2>${title}</h2>${content}</section>`;
  return `<article class="compact-lesson"><h1 class="lesson-title">${esc(s.title)}</h1><div class="lesson-author"><span class="solution-author-avatar">${icon('code')}</span><div><span>Hot100 ACM</span><p>本地题解 · ${current.id}. ${esc(current.title)}</p></div></div><div class="lesson-topic-tags"><span class="solution-label">ACM 题解</span>${current.topicTags.filter(Boolean).map(tag=>`<span class="topic-chip">${esc(tag)}</span>`).join('')}<span class="topic-chip">Python3</span>${difficultyBadge(current)}</div>`+
  section('insight','思路',`<p>${esc(s.insight)}</p>`)+
  section('steps','怎么做',`<ol>${s.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`)+
  section('program','完整代码',`<div class="solution-code"><div class="example-head"><span>main.py · Python3</span><button class="text-btn" id="copy-solution">复制完整代码</button></div>${codeHTML(s.code)}</div><div class="solution-actions"><button class="button submit" id="load-solution">载入编辑器</button><button class="button" id="download-solution">下载 main.py</button></div>`)+
  section('cost','复杂度与易错点',`<p><strong>${esc(s.complexity.summary)}</strong></p><div class="lesson-callout warning">${s.pitfalls.map(x=>`<p>${esc(x)}</p>`).join('')}</div>`)+
  `<details class="lesson-more"><summary>展开样例推演与补充说明</summary><div class="lesson-more-body"><h3>直接做法</h3><p>${esc(s.naive)}</p>${s.variables.length?`<h3>关键变量</h3><div class="table-scroll"><table><thead><tr><th>变量</th><th>含义</th></tr></thead><tbody>${s.variables.map(v=>`<tr><td><code>${esc(v.name)}</code></td><td>${esc(v.meaning)}</td></tr>`).join('')}</tbody></table></div>`:''}${s.structure.length?`<h3>节点构造与输出</h3>${s.structure.map(x=>`<p>${esc(x)}</p>`).join('')}`:''}<h3>样例推演</h3><p>${esc(s.walkthrough.note)}</p><div class="example-content"><b>样例输入</b><pre>${esc(s.walkthrough.input)}</pre><b>最终输出</b><pre>${esc(s.walkthrough.output)}</pre></div><div class="table-scroll trace-scroll"><table class="trace-table"><thead><tr><th>步骤 / 代码行</th><th>此时变量</th><th>接下来做什么</th></tr></thead><tbody>${s.walkthrough.rows.map(r=>`<tr><td>${r.step}<br><small>第 ${r.line} 行</small></td><td><pre>${esc(r.state)}</pre></td><td><p>${esc(r.explanation)}</p><code>${esc(r.code)}</code></td></tr>`).join('')}</tbody></table></div><h3>为什么正确</h3><p>${esc(s.correctness)}</p><h3>复杂度补充</h3><p>${esc(s.complexity.reason)}</p><p class="small muted">${esc(s.complexity.scope)}</p></div></details><details class="lesson-more"><summary>参考资料</summary><ul>${s.references.map(r=>`<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a></li>`).join('')}</ul></details><h3>我的笔记</h3><textarea class="notes" id="notes" aria-label="本题学习笔记" placeholder="记一句思路，或一个容易写错的地方…">${esc(state.notes[current.id]||'')}</textarea><p class="small muted">自动保存到本机。</p></article>`;
}
function historyList(){
  const rows=state.history[current.id]||[];
  return `<h2 class="history-heading">提交记录</h2>${rows.length?`<table class="submission-table"><thead><tr><th>状态</th><th>用例</th><th>提交时间</th></tr></thead><tbody>${rows.map(r=>`<tr><td><a class="${r.verdict==='Accepted'?'accepted':'rejected'}" href="#/problems/${current.id}/submissions/${r.id}">${esc(r.verdict)} ${icon('right')}</a><small>${languages[r.language]||'Python'} · ${r.mode==='core'?'核心代码':'ACM'}</small></td><td>${r.passed} / ${r.total}</td><td>${esc(new Date(r.time).toLocaleString('zh-CN'))}</td></tr>`).join('')}</tbody></table>`:`<div class="empty-state">${icon('history')}<h3>还没有提交记录</h3><p>写好程序后，点击上方「提交」。</p></div>`}`;
}
function historyDetail(item){
  return `<a class="back-link" href="${tabPath('history')}">${icon('left')} 全部提交</a><h1 class="${item.verdict==='Accepted'?'accepted':'rejected'}">${esc(item.verdict)}</h1><p class="muted">${esc(new Date(item.time).toLocaleString('zh-CN'))} · ${languages[item.language]||'Python'} · ${item.mode==='core'?'核心代码':'ACM'} · ${item.passed} / ${item.total} 用例通过</p><div class="lesson-callout">本站是练习评测，通过少量用例不代表通过力扣官方完整评测。</div>${(item.items||[]).map((r,i)=>`<details class="submission-case" ${r.pass?'':'open'}><summary>${r.pass?'✓':'×'} 用例 ${i+1} ${r.ms!=null?`· ${r.ms} ms`:''}</summary><b>输入</b><pre>${esc(r.input)}</pre><b>实际输出</b><pre>${esc(r.output||'（无输出）')}</pre>${r.expected!=null?`<b>期望输出</b><pre>${esc(r.expected)}</pre>`:''}${r.error?`<pre class="rejected">${esc(r.error)}</pre>`:''}</details>`).join('')}${!item.items?'<p class="small muted">旧版记录保留了代码和通过数，没有逐用例详情。</p>':''}<h3>本次提交的代码</h3><div class="solution-actions"><button class="button" id="copy-history-v2">复制代码</button><button class="button" id="restore-history-v2">恢复到编辑器</button></div>${codeHTML(item.code)}`;
}
function contentToolbar(solution){
  const bar=$('#content-toolbar');
  bar.innerHTML=solution?`<a class="back-link" href="${tabPath('solution')}">${icon('left')}全部题解</a><div class="content-tools"><button class="icon-btn tiny" id="copy-solution-link" title="复制题解链接" aria-label="复制题解链接">${icon('link')}</button><button class="icon-btn tiny" id="lesson-directory" title="目录" aria-label="题解目录" aria-expanded="false">${icon('panel')}</button></div><div class="lesson-directory" hidden>${[['insight','思路'],['steps','怎么做'],['program','完整代码'],['cost','复杂度与易错点']].map(([key,title])=>`<button data-section="lesson-${key}">${title}</button>`).join('')}</div>`:`<label class="solution-search">${icon('search')}<input id="solution-search" aria-label="搜索题解内容" placeholder="搜索内容" value="${esc(solutionQuery)}"></label><label class="solution-sort">${icon('sort')}<select id="solution-sort" aria-label="题解排序"><option value="recommended">推荐</option><option value="title" ${solutionSort==='title'?'selected':''}>标题</option></select></label>`;
  if(solution){
    $('#copy-solution-link').onclick=()=>copy(location.href.split('#')[0]+tabPath('solution')+'/'+solution.id);
    $('#lesson-directory').onclick=()=>{const directory=$('.lesson-directory');directory.hidden=!directory.hidden;$('#lesson-directory').setAttribute('aria-expanded',String(!directory.hidden));};
  }else{
    $('#solution-search').oninput=e=>{solutionQuery=e.target.value;$('.solution-entries').innerHTML=solutionEntries();};
    $('#solution-sort').onchange=e=>{solutionSort=e.target.value;$('.solution-entries').innerHTML=solutionEntries();};
  }
}
function updateFavorite(){
  const button=$('#favorite');
  const selected=state.favorites.includes(current.id);
  button.setAttribute('aria-pressed',String(selected));
  button.title=selected?'取消收藏':'收藏本题';
  button.setAttribute('aria-label',button.title);
}
renderContent=function(){
  if(!current)return;
  document.body.dataset.content=mainTab;
  const description=$('#problem-content');
  const descriptionKey=[current.id,draftKey(current.id),state.accepted.includes(current.id)].join('/');
  if(description.dataset.version!==descriptionKey){
    description.dataset.version=descriptionKey;
    description.innerHTML=descriptionHTML();
    $('#favorite').onclick=()=>{
      const id=current.id;
      state.favorites=state.favorites.includes(id)?state.favorites.filter(value=>value!==id):[...state.favorites,id];
      updateFavorite();renderList();persist();
    };
  }
  updateFavorite();
  $$('.panel-tabs [data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===mainTab)));
  const rows=state.history[current.id]||[];
  $('#history-count').textContent=rows.length||'';
  const solution=availableSolutions().find(s=>s.id===solutionDetailId);
  const item=rows.find(r=>r.id===historyDetailId);
  $('#solution-content').innerHTML=solution?(solution.sourceType?authorDetail(solution):solutionDetail(solution)):solutionList();
  $('#history-content').innerHTML=item?historyDetail(item):historyList();
  contentToolbar(solution);
  if(solution?.sourceType)mountAuthorArticle(solution,routeEpoch,state.reading[tabPath('solution')+'/'+solution.id]||0);
  else if(solution){$('#copy-solution').onclick=()=>copy(solution.code);$('#download-solution').onclick=()=>download(`hot100_${current.id}_main.py`,solution.code);$('#load-solution').onclick=()=>{switchPractice('python3','acm');replaceCode(solution.code,'载入完整题解','当前代码会先保留在本机恢复副本中，再载入这份带注释的 ACM 程序。');};$('#notes').oninput=e=>{state.notes[current.id]=e.target.value;persist();};}
  if(item){$('#copy-history-v2').onclick=()=>copy(item.code);$('#restore-history-v2').onclick=()=>{switchPractice(item.language||'python3',item.mode||'acm');replaceCode(item.code,'恢复这次提交','将保留当前代码副本，然后载入这次提交的代码。');};}
  colorizeCode();
};
const oldReplace=replaceCode;
replaceCode=function(code,title,description){if(current&&editor.getValue()!==code){state.conflicts.push({key:'codes',id:String(current.id),time:Date.now(),value:editor.getValue()});persist();}oldReplace(code,title,description);};
cancelJob=function(show=true){if(!activeJob)return;worker?.terminate();worker=null;workerReady=false;activeJob.silent=!show;const test=activeJob.tests[activeJob.items.length];activeJob.items.push({input:test?.input||'',expected:test?.output,error:'执行已由你停止。',output:'',pass:false});finishJob('Stopped · 已停止');if(show)renderTest();};
const oldRun=runCode;
runCode=function(submit=false){document.body.classList.remove('tests-collapsed');state.testsCollapsed=false;if(classic())oldRun(submit);else nativeAction(submit?'judge':'run');};

function topicTagsHTML(problem,withNumber=true){
  const tags=[...new Set((problem.topicTags||[]).filter(tag=>typeof tag==='string'&&tag.trim()))];
  const freq=trainingIndex.get(problem.id)?.freq,company=$('#drawer-company').value;
  const count=company?freq?.companies.find(c=>c.name===company)?.value:freq?.value;
  return `<span class="topic-tags">${withNumber?`<span class="topic-chip"># ${problem.id}</span>`:''}${count!=null?`<span class="topic-chip frequency-chip" title="CodeTop${company?' · '+esc(company):' · 全部公司'}">${company?esc(company)+' · ':''}考察 ${esc(count)} 次</span>`:''}${tags.slice(0,3).map(tag=>`<span class="topic-chip">${esc(tag)}</span>`).join('')}${tags.length>3?`<span class="topic-chip topic-overflow" tabindex="0" title="${esc(tags.slice(3).join('、'))}">${tags.length-3}+<span class="topic-popover">${tags.slice(3).map(tag=>`<span class="topic-chip">${esc(tag)}</span>`).join('')}</span></span>`:''}</span>`;
}
const trainingIndex = new Map();
async function loadTrainingIndex(){
  const [rows,tests]=await Promise.all(['problems','tests'].map(async k=>(await fetch('training/data/'+k+'.json')).json()));trainingTests=tests;
  rows.forEach(row=>trainingIndex.set(row.id,row));
}
function mergeTrainingProgress(){
  const solved=JSON.parse(localStorage.getItem('hot100-acm:v2:progress')||'{}');
  const added=problems.filter(p=>solved[p.id]==='solved'&&!state.accepted.includes(p.id));
  const updates=JSON.parse(localStorage.getItem('training-favorite-changes')||'{}');
  const favorites=new Set(state.favorites);
  Object.entries(updates).forEach(([id,on])=>on?favorites.add(Number(id)):favorites.delete(Number(id)));
  if(added.length||Object.keys(updates).length){
    state.accepted.push(...added.map(p=>p.id));state.favorites=[...favorites];persist();
    localStorage.removeItem('training-favorite-changes');
  }
}
window.addEventListener('pageshow',e=>{if(e.persisted) location.reload();});
function catalogRow(problem,directory=false){
  const selected=directory&&problem.id===current?.id;
  const done=state.accepted.includes(problem.id);
  const inside=`<span class="catalog-status ${done?'accepted':''}">${done?icon('check'):''}</span><span class="catalog-question"><span class="catalog-headline"><span class="catalog-name">${directory?problem.id+'. ':''}${esc(problem.title)}</span>${state.favorites.includes(problem.id)?icon('star'):''}${difficultyBadge(problem)}</span>${state.showTopicTags!==false?topicTagsHTML(problem,!directory):''}</span>`;
  return directory?`<button class="problem-row directory-row ${selected?'selected':''}" data-problem="${problem.id}" ${selected?'aria-current="true"':''}>${inside}</button>`:`<a class="catalog-row" href="#/problems/${problem.id}/description">${inside}</a>`;
}
renderList=function(){
  if(!document.body.classList.contains('sidebar-open'))return;
  const filtered=problems.filter(p=>(!$('#drawer-company').value||trainingIndex.get(p.id)?.freq?.companies?.some(c=>c.name===$('#drawer-company').value))&&(!query||`${p.title} ${p.id} ${p.category} ${(p.topicTags||[]).join(' ')}`.toLowerCase().includes(query.toLowerCase()))&&(!filterDifficulty||p.difficulty===filterDifficulty)&&(!categoryFilter||p.category===categoryFilter)&&(!filterStatus||(filterStatus==='done'?state.accepted.includes(p.id):filterStatus==='todo'?!state.accepted.includes(p.id):state.favorites.includes(p.id))));
  $('#list-label').innerHTML=`${esc(categoryFilter||'全部题目')} <b>${filtered.length}</b>`;
  $('#clear-filter').hidden=!(query||filterDifficulty||filterStatus||categoryFilter||$('#drawer-company').value||$('#drawer-sort').value!=='topic');
  const categories=[...new Set(filtered.map(p=>p.category))];
  $('#problem-list').innerHTML=categories.map(category=>`<section class="directory-group"><h3>${esc(category)}</h3>${filtered.filter(p=>p.category===category).map(p=>catalogRow(p,true)).join('')}</section>`).join('')||'<div class="empty-list">没有找到符合条件的题目</div>';
  const sort=$('#drawer-sort').value;
  if(sort!=='topic'&&filtered.length)$('#problem-list').innerHTML=sortedProblems(filtered,sort).map(p=>catalogRow(p,true)).join('');
  $('#solved-count').textContent=state.accepted.length;
  $('#progress-fill').style.width=state.accepted.length+'%';
  $('#drawer-show-tags').checked=state.showTopicTags!==false;
};
function setTopicTags(show){
  state.showTopicTags=show;
  renderList();
  persist();
}
function sortedProblems(rows,sort){
  const levels=['简单','中等','困难'];
  const company=$('#drawer-company').value;
  const rank=p=>company?-(trainingIndex.get(p.id)?.freq?.companies.find(c=>c.name===company)?.value||0):(trainingIndex.get(p.id)?.freq?.rank??Infinity);
  return rows.slice().sort((a,b)=>(sort==='hot'?rank(a)-rank(b):sort==='difficulty'?levels.indexOf(a.difficulty)-levels.indexOf(b.difficulty):0)||a.id-b.id);
}
progress=function(){
  saveCode();
  modal('学习进度与本地备份',`<div class="stats-grid"><div class="stat"><b>${state.accepted.length}</b><span>已通过 / 100</span></div><div class="stat"><b>${state.favorites.length}</b><span>已收藏</span></div><div class="stat"><b>${Object.values(state.history).flat().length}</b><span>提交记录</span></div></div><p>代码、进度、笔记和记录自动保存到电脑。更新网站文件不会覆盖这些数据。</p><p class="data-path">进度文件　<code>${esc(session.directory)}${session.directory.includes('\\')?'\\':'/'}learning.json</code></p><div class="solution-actions"><button class="button" id="change-directory">更改保存位置</button><button class="button submit" id="export-v2">导出完整备份</button><button class="button" id="import-v2">导入旧版 / 本地备份</button></div><input id="import-file-v2" type="file" accept=".json" hidden><p class="small muted">在线版记录需先在原网址导出 JSON，再在此导入。导入会合并提交记录，原有同题代码保留恢复副本。</p><details><summary>代码恢复副本（${state.conflicts.length}）</summary>${state.conflicts.slice().reverse().map((c,i)=>`<div class="recovery-row"><span>${c.id} · ${c.key==='notes'?'笔记':'代码'} · ${new Date(c.time).toLocaleString('zh-CN')}</span><button class="text-btn" data-recovery="${state.conflicts.length-1-i}">下载副本</button></div>`).join('')||'<p class="muted">暂无副本</p>'}</details>`);
  $('#change-directory').onclick=storageSettings;
  $('#export-v2').onclick=()=>download('hot100-acm-backup.json',JSON.stringify({app:KEY,schemaVersion:2,...state},null,2),'application/json');
  $('#import-v2').onclick=()=>$('#import-file-v2').click();
  $('#import-file-v2').onchange=async e=>{try{
    const file=e.target.files[0];if(!file)return;if(file.size>64*1024*1024)throw Error('文件超过 64 MB');
    const imported=JSON.parse(await file.text());if(imported.app!==KEY)throw Error('不是本站导出的备份');
    const incoming=normalizeState(imported);const ids=new Set(problems.map(p=>String(p.id)));
    for(const key of ['theme','fontSize','last','split','editorRatio','testsCollapsed','catalogFilters'])if(!Object.hasOwn(imported,key))incoming[key]=state[key];
    for(const key of ['codes','notes'])for(const [id,value] of Object.entries(incoming[key]))if(!(ids.has(id)||(key==='codes'&&ids.has(id.split(':')[0])&&/^\d+:(c:acm|cpp:(acm|core)|python3:core)$/.test(id)))||typeof value!=='string')throw Error('代码或笔记数据格式不正确');
    incoming.accepted=incoming.accepted.filter(id=>ids.has(String(id))).map(Number);incoming.favorites=incoming.favorites.filter(id=>ids.has(String(id))).map(Number);
    const previousFavorites=state.favorites;state=mergeState({},incoming,state);state.favorites=[...new Set([...previousFavorites,...incoming.favorites])];
    for(const [id,model] of models){const value=state.codes[id];if(typeof value==='string'&&value!==model.getValue()){loadingCode=true;model.setValue(value);loadingCode=false;}}
    applyTheme();editor.instance.updateOptions({fontSize:state.fontSize});
    document.body.classList.toggle('tests-collapsed',!!state.testsCollapsed);
    persist();await flushDisk();renderList();renderContent();closeModal();notify('备份已导入，原有代码副本已保留');
  }catch(error){notify('导入失败：'+error.message);}};
};

async function boot(){
  const [problemResponse]=await Promise.all([fetch('problems.json'),loadSession(),loadTrainingIndex(),loadAuthorLibrary()]);await init(problemResponse);bindPractice();mergeTrainingProgress();
  for(const category of new Set(problems.map(p=>p.category)))$('#drawer-category').add(new Option(category,category));
  for(const company of [...new Set([...trainingIndex.values()].flatMap(p=>(p.freq?.companies||[]).map(c=>c.name)))].sort((a,b)=>a.localeCompare(b,'zh-CN')))$('#drawer-company').add(new Option(company,company));
  $('#drawer-category').onchange=e=>{categoryFilter=e.target.value;renderList();};
  $('#drawer-company').onchange=$('#drawer-sort').onchange=renderList;
  const clear=$('#clear-filter').onclick;
  $('#clear-filter').onclick=()=>{$('#drawer-company').value=$('#drawer-category').value='';$('#drawer-sort').value='topic';clear();};
  // Keep the editor mounted while changing only the left content panel.
  $('.top-right').prepend($('#timer'));
  $('.editor-status').prepend($('#save-state'));
  installCodeToolbar();
  $('.editor-status>span:last-child').hidden=true;
  $('#prev').onclick=()=>go(problems[(current.order+problems.length-2)%problems.length].id);
  $('#next').onclick=()=>go(problems[current.order%problems.length].id);
  $('[data-tab="solution"] [data-icon]').dataset.icon='flask';icons($('.panel-tabs'));
  $('#input-tab').onclick=()=>{document.body.classList.remove('tests-collapsed');state.testsCollapsed=false;$('#collapse-tests').setAttribute('aria-expanded','true');bottomTab='input';renderTest();persist();};
  $('#result-tab').onclick=()=>{document.body.classList.remove('tests-collapsed');state.testsCollapsed=false;$('#collapse-tests').setAttribute('aria-expanded','true');bottomTab='result';renderTest();persist();};
  installDrawerResize();
  $('#sidebar').inert=true;$('#sidebar').setAttribute('aria-label','题库抽屉');
  $('#nav-problems').onclick=()=>document.body.classList.contains('sidebar-open')?closeDrawer():openDrawer();
  $('#drawer-show-tags').onchange=e=>setTopicTags(e.target.checked);
  $('#sidebar-toggle').onclick=closeDrawer;$('#drawer-backdrop').onclick=closeDrawer;
  $('#collapse-tests').onclick=()=>{const collapsed=document.body.classList.toggle('tests-collapsed');state.testsCollapsed=collapsed;$('#collapse-tests').setAttribute('aria-expanded',String(!collapsed));persist();};
  document.body.classList.toggle('tests-collapsed',!!state.testsCollapsed);
  for(const [selector,key]of [['.workspace','split'],['.coding-column','editorRatio']]){
    const el=$(selector),variable=key==='split'?'--split':'--editor-ratio';if(state[key])el.style.setProperty(variable,state[key]);
    new MutationObserver(()=>{const value=el.style.getPropertyValue(variable);if(value&&state[key]!==value){state[key]=value;persist();}}).observe(el,{attributes:true,attributeFilter:['style']});
  }

  for(const selector of ['#problem-content','#solution-content','#history-content'])$(selector).addEventListener('scroll',e=>{
    if(!current||restoringReading||!e.target.clientHeight)return;
    const path={'#problem-content':tabPath('description'),
      '#solution-content':tabPath('solution')+(solutionDetailId?'/'+solutionDetailId:''),
      '#history-content':tabPath('history')+(historyDetailId?'/'+historyDetailId:'')}[selector];
    state.reading[path]=e.target.scrollTop;persist();
  },{passive:true});
  document.addEventListener('click',e=>{
    const topic=e.target.closest('[data-solution-topic]');if(topic){solutionTopic=topic.dataset.solutionTopic;const y=$('#solution-content').scrollTop;renderContent();$('#solution-content').scrollTop=y;}
    const hint=e.target.closest('[data-show-hint]');if(hint){$('.hint').open=true;$('.hint').scrollIntoView({block:'nearest',behavior:'instant'});}
    const section=e.target.closest('[data-section]');if(section){document.getElementById(section.dataset.section)?.scrollIntoView({block:'start',behavior:'instant'});$('.lesson-directory').hidden=true;$('#lesson-directory').setAttribute('aria-expanded','false');}
    const recovery=e.target.closest('[data-recovery]');if(recovery){const c=state.conflicts[+recovery.dataset.recovery];download(`recovered_${c.id}.${c.key==='codes'?'py':'txt'}`,c.value);}
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape')closeDrawer();
    if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!editor.hasFocus()){e.preventDefault();openDrawer();}
    if(e.key==='Tab'&&document.body.classList.contains('sidebar-open')){
      const focusable=$$('#sidebar button, #sidebar input, #sidebar select, #drawer-resizer').filter(el=>!el.disabled&&el.offsetParent!==null),first=focusable[0],last=focusable.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){rememberReading();saveCode();saveView();flushDisk();}});
  window.addEventListener('pagehide',()=>{rememberReading();saveCode();saveView();});
  $('#shutdown').onclick=async()=>{
    saveCode();saveView();rememberReading();persist();
    if(!await flushDisk()){notify('数据尚未保存到电脑，请先导出备份后重试。');return;}
    const response=await fetch('/api/shutdown',{method:'POST',headers:{'X-Hot100-Token':session.token}});
    if(response.ok){serviceStopped=true;pendingSave=false;worker?.terminate();modal('本地服务已退出','<p>学习数据已保存。关闭本页即可，下次双击桌面「Hot100 ACM 刷题」重新启动。</p>');}
  };
}
boot().then(installDocking).catch(error=>{document.body.classList.remove('catalog-mode');$('#problem-content').innerHTML=`<div class="empty-state"><h3>暂时无法打开</h3><p>${esc(error.message)}</p><p>请双击桌面「Hot100 ACM 刷题」重新启动。</p></div>`;console.error(error);});





