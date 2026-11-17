let vscode=require('vscode');const fs=require('fs'),assert=require('assert/strict'),path=require('path');
exports.run=async()=>{
 const extension=vscode.extensions.getExtension('lovits.hot100-practice'),api=await extension.activate(),e=api.enhancements;
 vscode=require('module').createRequire(path.join(extension.extensionPath,'out/extension.js'))('vscode');
 const ps=require('../data/problems.json'),ss=require('../../dist/training/data/solutions.json');
 const makeQ=p=>({questionFrontendId:String(p.id),questionId:String(p.id),titleSlug:p.url.split('/').filter(Boolean).at(-1),title:p.title,translatedTitle:p.title,difficulty:p.difficulty,translatedContent:p.officialHtml,codeSnippets:Object.entries(p.officialTemplates).map(([langSlug,code])=>({langSlug,lang:langSlug,code})),topicTags:p.topicTags.map(name=>({name,translatedName:name}))});
 api.api.getQuestionContent=async slug=>({data:{question:makeQ(ps.find(p=>p.url.includes('/'+slug+'/')))}});
 api.api.getHot100Problems=async()=>ps.map(p=>({frontendQuestionId:String(p.id),difficulty:({'简单':'EASY','中等':'MEDIUM','困难':'HARD'})[p.difficulty],status:null}));
 api.api.getSubmissions=async()=>[];
 api.provider.refresh();await api.provider.getChildren();
 assert.equal(e.mode('1'),'acm');
 const cfg=vscode.workspace.getConfiguration('hot100Pro');await cfg.update('cppCompilerPath','g++',vscode.ConfigurationTarget.Workspace);await cfg.update('cCompilerPath','gcc',vscode.ConfigurationTarget.Workspace);
 let pickerCalls=0,nextLanguage='python3',lastItems=[];const originalPicker=vscode.window.showQuickPick;
 vscode.window.showQuickPick=async(items,options)=>{if(options?.title==='请选择编程语言'){pickerCalls++;lastItems=await items;assert.equal(options.activeItem,undefined);return lastItems.find(i=>i.detail===nextLanguage);}return originalPicker(items,options);};
 const panels=[],handlers=new Map(),originalCreate=vscode.window.createWebviewPanel;
 vscode.window.createWebviewPanel=(...args)=>{const panel=originalCreate(...args);panels.push(panel);const originalListen=panel.webview.onDidReceiveMessage;panel.webview.onDidReceiveMessage=(handler,...rest)=>{handlers.set(panel,handler);return originalListen.call(panel.webview,handler,...rest);};return panel;};
 try {
 const q=makeQ(ps[0]);await vscode.commands.executeCommand('hot100Pro.openProblem',{frontendQuestionId:'1',titleSlug:'two-sum',title:'两数之和'});
 assert.equal(pickerCalls,1,'problem open must invoke the original language picker');assert.ok(panels.length>0,'problem open must create a statement panel');
 const checks=[];
 for(const language of ['python3','cpp','c'])for(const mode of ['acm','core']){
  await e.switchMode(q,mode,language);const doc=vscode.window.activeTextEditor.document;
  const code=language==='c'?(mode==='core'?fs.readFileSync(path.join(__dirname,'c/1.c'),'utf8'):'#include <stdio.h>\n#include <stdlib.h>\nint main(){int n,t;scanf("%d",&n);int*a=malloc(n*sizeof(int));for(int i=0;i<n;i++)scanf("%d",a+i);scanf("%d",&t);for(int i=0;i<n;i++)for(int j=i+1;j<n;j++)if(a[i]+a[j]==t){printf("%d %d\\n",i,j);return 0;}}'):ss[1][language][mode];
  const edit=new vscode.WorkspaceEdit();edit.replace(doc.uri,new vscode.Range(doc.positionAt(0),doc.positionAt(doc.getText().length)),code);assert.ok(await vscode.workspace.applyEdit(edit));
  const r=await e.runLocal(true,'1');assert.ok(r&&!r.error,JSON.stringify(r));assert.ok(r.results.every(x=>x.ok),JSON.stringify(r));checks.push({language,mode,cases:r.results.length});const custom=mode==='core'?{args:[[-3,4,3,90],0],expected:[0,2]}:{input:'4\n-3 4 3 90\n0\n',output:'0 2\n'};const cr=await e.runLocal(false,'1',[custom]);assert.ok(!cr.error&&cr.results.every(x=>x.ok),JSON.stringify(cr));
 }
 assert.equal(e.state.events.length,1,'six mode/language passes only count one new question');
 await e.switchMode(q,'acm','python3');assert.equal(vscode.window.activeTextEditor.document.getText(),ss[1].python3.acm);
 const initialGroups=vscode.window.tabGroups.all.length,codeColumn=vscode.window.activeTextEditor.viewColumn;
 const problemPanel=panels.find(p=>p.title.startsWith('1.'));
 assert.ok(problemPanel);problemPanel.reveal(problemPanel.viewColumn);
 await handlers.get(problemPanel)({type:'setMode',mode:'core'});
 assert.equal(e.mode('1'),'core');assert.ok(!vscode.window.activeTextEditor.document.uri.fsPath.includes('/acm/'));assert.equal(vscode.window.activeTextEditor.viewColumn,codeColumn);
 await handlers.get(problemPanel)({type:'setMode',mode:'acm'});
 assert.ok(vscode.window.activeTextEditor.document.uri.fsPath.includes('/acm/'));assert.equal(vscode.window.activeTextEditor.viewColumn,codeColumn);
 await Promise.all([e.switchMode(q,'core'),e.switchMode(q,'acm'),e.switchMode(q,'core')]);assert.equal(e.mode('1'),'core');assert.ok(!vscode.window.activeTextEditor.document.uri.fsPath.includes('/acm/'));
 assert.equal(vscode.window.tabGroups.all.length,initialGroups,'mode switches must not add splits');
 const open=()=>vscode.commands.executeCommand('hot100Pro.openProblem',{frontendQuestionId:'1',titleSlug:'two-sum',title:'两数之和'});
 const calls=pickerCalls;await open();await open();assert.equal(pickerCalls,calls+2,'existing panel and draft must still prompt on every click');
 const before=vscode.window.activeTextEditor?.document.uri.toString();nextLanguage='cancel';await open();assert.equal(vscode.window.activeTextEditor?.document.uri.toString(),before,'cancel leaves current draft untouched');
 const supported=require('../out/utils/languageUtils').SUPPORTED_LANGUAGES;
 const richQ={...q,codeSnippets:[...q.codeSnippets,...supported.filter(l=>!q.codeSnippets.some(s=>s.langSlug===l.slug)).map(l=>({lang:l.displayName,langSlug:l.slug,code:l.slug==='javascript'?'var twoSum = function(nums, target) {};':'// '+l.slug+' official fixture'}))]};
 api.api.getQuestionContent=async slug=>({data:{question:slug==='two-sum'?richQ:makeQ(ps.find(p=>p.url.includes('/'+slug+'/')))}});
 nextLanguage='javascript';await open();assert.equal(lastItems.length,supported.length);const originalLanguageCount=lastItems.length;assert.ok(vscode.window.activeTextEditor.document.uri.fsPath.endsWith('.js'));assert.equal(vscode.window.activeTextEditor.document.getText(),'var twoSum = function(nums, target) {};');
 await handlers.get(problemPanel)({type:'setMode',mode:'acm'});assert.ok(vscode.window.activeTextEditor.document.uri.fsPath.endsWith('.js'));assert.ok(vscode.window.activeTextEditor.document.getText().includes("readFileSync"));
 await handlers.get(problemPanel)({type:'setMode',mode:'core'});assert.equal(vscode.window.activeTextEditor.document.getText(),'var twoSum = function(nums, target) {};');nextLanguage='python3';await open();
 const defaults={difficulty:'',company:'',topic:'',tag:'',search:'',due:false,sort:'topic'};
 for(const filters of [{tag:'数组'},{company:'字节跳动'},{difficulty:'中等'},{difficulty:'简单',company:'字节跳动',tag:'哈希表'}]){
  await api.provider.setEnhancedFilters({...defaults,...filters});const filtered=api.provider.filteredCatalog();assert.ok(filtered.length>0);
  const nodes=await api.provider.getChildren();assert.ok(nodes.some(n=>String(n.label).includes('筛选：')));assert.deepEqual(nodes.filter(n=>n.contextValue==='question').map(n=>n.question.frontendQuestionId).sort(),filtered.map(p=>String(p.id)).sort(),undefined);
  assert.ok(!nodes.some(n=>n.category),'active filters return direct question rows without topic folders');
 }
 await api.provider.setEnhancedFilters(defaults);const unfiltered=await api.provider.getChildren();assert.ok(unfiltered.some(n=>n.category),'default view preserves original grouping');
 const stats=api.provider.buildStatsRows();assert.ok(stats.some(n=>n.command?.command==='hot100Pro.studyPlan'));e.showPlan();
 await cfg.update('dailyGoal',5,vscode.ConfigurationTarget.Workspace);await cfg.update('dailyGoal',2,vscode.ConfigurationTarget.Workspace);assert.equal(e.state.events.length,1);assert.equal(vscode.workspace.getConfiguration('hot100Pro').get('dailyGoal'),2);
 const calendarPickerCalls=pickerCalls;await handlers.get(e.planPanel)({type:'open',id:'3'});assert.equal(pickerCalls,calendarPickerCalls+1);assert.ok(vscode.window.visibleTextEditors.some(editor=>path.basename(editor.document.uri.fsPath).startsWith('3_')));
 assert.ok(e.planPanel.webview.html.includes('aria-label="练习日历"'));assert.ok(!e.planPanel.webview.html.includes('<table'));assert.ok(!e.planPanel.webview.html.includes('<details'));
 fs.writeFileSync(path.join(__dirname,'results-pro-host.json'),JSON.stringify({checks,defaultACM:true,modeDraftRestore:true,modePanelMessages:true,stableCodeGroup:true,rapidSwitches:true,combinedFilters:true,flatFilteredResults:true,defaultGroupingPreserved:true,pickerOnEveryClick:true,cancelPreservesDraft:true,originalLanguageCount,javascriptModeDrafts:true,editableGoal:true,calendarOpened:true,calendarTitleOpensProblem:true,newQuestionDeduplicated:true,customCasesInSixModes:true},null,2));
 } finally {vscode.window.showQuickPick=originalPicker;vscode.window.createWebviewPanel=originalCreate;for(const panel of panels)panel.dispose();}
};
