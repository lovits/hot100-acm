'use strict';
const vscode=require('vscode');
const sanitize=require('sanitize-html');
const {evaluate}=require('./engine');
const {header}=require('./c-driver');
const problems=require('./data/problems.json'),tests=require('./data/tests.json');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function activate(context){
 let current=problems.find(p=>p.id===context.globalState.get('lastQuestion'))||problems[0],language=context.globalState.get('language','python3'),mode=context.globalState.get('mode','core'),panel,busy=false;
 const changed=new vscode.EventEmitter(),output=vscode.window.createOutputChannel('Hot100 测试结果');context.subscriptions.push(changed,output);
 const progress=()=>context.globalState.get('passed',{});
 const provider={onDidChangeTreeData:changed.event,getTreeItem:p=>{const item=new vscode.TreeItem(`${p.id}. ${p.title}`);item.description=`${p.difficulty} · ${p.freq.value} 次${progress()[p.id]?' · 已通过':''}`;item.tooltip=`${p.topicTags.join(' · ')}\n考察 ${p.freq.value} 次`;item.command={command:'hot100.open',title:'打开',arguments:[p]};return item;},getChildren:()=>problems};
 context.subscriptions.push(vscode.window.registerTreeDataProvider('hot100.questions',provider));
 const command=(name,fn)=>context.subscriptions.push(vscode.commands.registerCommand('hot100.'+name,async(...args)=>{try{await fn(...args);}catch(e){vscode.window.showErrorMessage('Hot100：'+e.message);}}));
 async function draft(){
  const dir=vscode.Uri.joinPath(context.globalStorageUri,'drafts');await vscode.workspace.fs.createDirectory(dir);
  const uri=vscode.Uri.joinPath(dir,`${current.id}-${mode}.${{python3:'py',cpp:'cpp',c:'c'}[language]}`);
  try{await vscode.workspace.fs.stat(uri);}catch(e){if(e.code!=='FileNotFound')throw e;await vscode.workspace.fs.writeFile(uri,Buffer.from(template()));}
  return vscode.workspace.openTextDocument(uri);
 }
 function template(){if(mode==='core')return (language==='python3'?'from typing import *\n':language==='c'?header+'\n':'')+current.officialTemplates[language];if(language==='c')return '#include <stdio.h>\n#include <stdlib.h>\n\nint main(void) {\n    // 读取输入，计算并输出结果\n    return 0;\n}\n';return current.acm.template[language];}
 async function open(p){
  if(p&&problems.includes(p))current=p;await context.globalState.update('lastQuestion',current.id);
  if(!panel){panel=vscode.window.createWebviewPanel('hot100.practice','Hot100 题目',vscode.ViewColumn.One,{enableScripts:true,localResourceRoots:[]});panel.onDidDispose(()=>panel=undefined,null,context.subscriptions);panel.webview.onDidReceiveMessage(async m=>{try{if(m?.type==='choose')await choose();else if(m?.type==='run'||m?.type==='submit')await run(m.type==='submit');else if(m?.type==='language'&&['python3','cpp','c'].includes(m.value)){language=m.value;await context.globalState.update('language',language);await open();}else if(m?.type==='mode'&&['core','acm'].includes(m.value)){mode=m.value;await context.globalState.update('mode',mode);await open();}else if(m?.type==='custom')await custom();}catch(e){vscode.window.showErrorMessage('Hot100：'+e.message);}},null,context.subscriptions);}
  panel.webview.html=render(current,language,mode);panel.reveal(vscode.ViewColumn.One,true);
  await vscode.window.showTextDocument(await draft(),{viewColumn:vscode.ViewColumn.Two,preview:false,preserveFocus:false});
 }
 async function choose(){
  const items=problems.map(p=>({label:`${p.id}. ${p.title}`,description:`${p.difficulty} · ${p.topicTags.join(' / ')} · 考察 ${p.freq.value} 次`,detail:p.freq.companies.map(c=>`${c.name} ${c.value} 次`).join(' · '),p}));
  const item=await vscode.window.showQuickPick(items,{placeHolder:'搜索题目、编号、类别或公司',matchOnDescription:true,matchOnDetail:true});if(item)await open(item.p);
 }
 async function run(submit,customTests){
  if(busy)return;if(!vscode.workspace.isTrusted)throw Error('请先信任工作区，再运行你编写的代码。');
  const p=current,lang=language,selectedMode=mode,doc=await draft();await doc.save();const code=doc.getText();busy=true;
  try{
   if(panel)panel.webview.postMessage({type:'result',text:'正在测试…'});
   output.clear();output.show(true);output.appendLine(`${p.id}. ${p.title} · ${lang} · ${selectedMode} · ${submit?'提交':'运行'}`);
   const selected=customTests||tests[p.id][selectedMode].slice(0,submit?undefined:p.acm.examples.length||1);
   const r=await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:'Hot100 正在运行测试'},()=>evaluate(p,lang,selectedMode,code,selected));
   if(r.error){if(panel&&current===p&&mode===selectedMode&&language===lang)panel.webview.postMessage({type:'result',text:'运行失败，请查看测试结果面板'});output.appendLine(r.error);if(r.compileError)output.appendLine(r.compileError);return r;}
   const passed=r.results.filter(x=>x.ok).length;
   const elapsed=r.elapsed??r.results.reduce((sum,x)=>sum+(x.ms||0),0);output.appendLine(`${passed}/${r.results.length} 通过 · ${elapsed}ms`);r.results.forEach((x,i)=>output.appendLine(`用例 ${i+1}：${x.ok?'通过':'未通过'}${x.ms!==undefined?' · '+x.ms+'ms':''}\n${x.ok?'':JSON.stringify(x,null,2)}`));
   if(submit&&passed===r.results.length){await context.globalState.update('passed',{...progress(),[p.id]:true});changed.fire();}
   if(panel&&current===p&&mode===selectedMode&&language===lang)panel.webview.postMessage({type:'result',text:`${passed}/${r.results.length} 通过`});
   return r;
  }finally{busy=false;}
 }
 async function custom(){
  const input=await vscode.window.showInputBox({title:mode==='core'?'输入核心模式用例 JSON（含 args/expected 或 ops/args/expected）':'输入 ACM 用例 JSON（含 input/output，换行使用 \\n）',value:JSON.stringify(tests[current.id][mode][0])});
  if(input===undefined)return;let t;try{t=JSON.parse(input);}catch{throw Error('请输入有效 JSON。');}
  if(mode==='acm'?(typeof t.input!=='string'||typeof t.output!=='string'):(!Array.isArray(t.args)||!Object.hasOwn(t,'expected')))throw Error('用例缺少所需字段。');
  await run(false,[t]);
 }
 command('open',open);command('choose',choose);command('run',()=>run(false));command('submit',()=>run(true));
 return{open,run,choose,getState:()=>({id:current.id,language,mode}),setState:async(id,l,m)=>{current=problems.find(p=>p.id===id);language=l;mode=m;await open();}};
}
function render(p,language,mode){
 const statement=sanitize(p.officialHtml,{allowedTags:[...sanitize.defaults.allowedTags,'img','sup','sub'],allowedAttributes:{...sanitize.defaults.allowedAttributes,img:['src','alt','width','height']},allowedSchemes:['https'],allowProtocolRelative:false});
 const nonce=require('node:crypto').randomBytes(16).toString('hex');
 const options=(list,value)=>list.map(([k,n])=>`<option value="${k}" ${k===value?'selected':''}>${n}</option>`).join('');
 return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';"><style nonce="${nonce}">body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);line-height:1.7;padding:20px;max-width:860px;margin:auto;color:var(--vscode-editor-foreground);background:var(--vscode-editor-background)}header{display:flex;flex-wrap:wrap;gap:8px;align-items:center}h1{font-size:24px;line-height:1.4}button,select{font:inherit;color:var(--vscode-button-foreground);background:var(--vscode-button-background);border:1px solid var(--vscode-contrastBorder,transparent);border-radius:4px;padding:7px 12px;cursor:pointer}select{color:var(--vscode-dropdown-foreground);background:var(--vscode-dropdown-background)}button:focus-visible,select:focus-visible{outline:1px solid var(--vscode-focusBorder);outline-offset:2px}.tags{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0}.tag{padding:2px 9px;border-radius:12px;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground)}img{max-width:100%;height:auto}article code{font-family:var(--vscode-editor-font-family)}article pre{background:var(--vscode-textCodeBlock-background);padding:12px;border-radius:4px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.8}a{color:var(--vscode-textLink-foreground)}details{margin:12px 0}#result{margin:12px 0;font-weight:600}hr{border:0;border-top:1px solid var(--vscode-panel-border)}</style></head><body><header><button data-action="choose">Leetcode 热题 100 ▾</button><select aria-label="编程语言" id="language">${options([['python3','Python'],['cpp','C++'],['c','C']],language)}</select><select aria-label="代码模式" id="mode">${options([['core','核心代码模式'],['acm','ACM 模式']],mode)}</select><button data-action="run">运行示例</button><button data-action="submit">提交测试</button><button data-action="custom">自定义用例</button></header><h1>${p.id}. ${escape(p.title)}</h1><div class="tags">${[p.difficulty,...p.topicTags,`考察 ${p.freq.value} 次`].map(t=>`<span class="tag">${escape(t)}</span>`).join('')}</div><details><summary>公司考察记录</summary>${p.freq.companies.map(c=>escape(c.name)+' '+c.value+' 次').join(' · ')}</details><a href="${escape(p.url)}">查看力扣原题</a><div id="result" role="status" aria-live="polite"></div><hr><article>${statement}</article>${mode==='acm'?`<hr><h2>输入格式</h2><pre>${escape(p.acm.input)}</pre><h2>输出格式</h2><pre>${escape(p.acm.output)}</pre>${p.acm.examples.map((e,i)=>`<h3>示例 ${i+1}</h3><pre>输入：\n${escape(e.input)}\n输出：\n${escape(e.output)}</pre>`).join('')}`:''}<script nonce="${nonce}">const api=acquireVsCodeApi();document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>api.postMessage({type:b.dataset.action}));for(const id of ['language','mode'])document.getElementById(id).onchange=e=>api.postMessage({type:id,value:e.target.value});window.addEventListener('message',e=>{if(e.data.type==='result')document.getElementById('result').textContent=e.data.text;});</script></body></html>`;
}
module.exports={activate,render};
