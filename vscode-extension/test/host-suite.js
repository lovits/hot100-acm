const vscode=require('vscode'),fs=require('fs'),assert=require('assert/strict'),path=require('path');
exports.run=async()=>{
 const extension=vscode.extensions.getExtension('lovits.hot100-practice'),api=await extension.activate(),e=api.enhancements;
 const ps=require('../data/problems.json'),ss=require('../../dist/training/data/solutions.json');
 const makeQ=p=>({questionFrontendId:String(p.id),questionId:String(p.id),titleSlug:p.url.split('/').filter(Boolean).at(-1),title:p.title,translatedTitle:p.title,difficulty:p.difficulty,translatedContent:p.officialHtml,codeSnippets:Object.entries(p.officialTemplates).map(([langSlug,code])=>({langSlug,lang:langSlug,code})),topicTags:p.topicTags.map(name=>({name,translatedName:name}))});
 api.api.getQuestionContent=async slug=>({data:{question:makeQ(ps.find(p=>p.url.includes('/'+slug+'/')))}});
 api.api.getHot100Problems=async()=>ps.map(p=>({frontendQuestionId:String(p.id),difficulty:({'简单':'EASY','中等':'MEDIUM','困难':'HARD'})[p.difficulty],status:null}));
 api.provider.refresh();await api.provider.getChildren();
 assert.equal(e.mode('1'),'acm');
 const cfg=vscode.workspace.getConfiguration('hot100Pro');await cfg.update('cppCompilerPath','g++',vscode.ConfigurationTarget.Workspace);await cfg.update('cCompilerPath','gcc',vscode.ConfigurationTarget.Workspace);
 const q=makeQ(ps[0]);await vscode.commands.executeCommand('hot100Pro.openProblem',{frontendQuestionId:'1',titleSlug:'two-sum',title:'两数之和'});
 const checks=[];
 for(const language of ['python3','cpp','c'])for(const mode of ['acm','core']){
  await e.switchMode(q,mode,language);const doc=vscode.window.activeTextEditor.document;
  const code=language==='c'?(mode==='core'?fs.readFileSync(path.join(__dirname,'c/1.c'),'utf8'):'#include <stdio.h>\n#include <stdlib.h>\nint main(){int n,t;scanf("%d",&n);int*a=malloc(n*sizeof(int));for(int i=0;i<n;i++)scanf("%d",a+i);scanf("%d",&t);for(int i=0;i<n;i++)for(int j=i+1;j<n;j++)if(a[i]+a[j]==t){printf("%d %d\\n",i,j);return 0;}}'):ss[1][language][mode];
  const edit=new vscode.WorkspaceEdit();edit.replace(doc.uri,new vscode.Range(doc.positionAt(0),doc.positionAt(doc.getText().length)),code);assert.ok(await vscode.workspace.applyEdit(edit));
  const r=await e.runLocal(true,'1');assert.ok(r&&!r.error,JSON.stringify(r));assert.ok(r.results.every(x=>x.ok),JSON.stringify(r));checks.push({language,mode,cases:r.results.length});
 }
 assert.equal(e.state.events.length,1,'six mode/language passes only count one new question');
 await e.switchMode(q,'acm','python3');assert.equal(vscode.window.activeTextEditor.document.getText(),ss[1].python3.acm);
 await api.provider.setEnhancedFilters({difficulty:'简单',company:'字节跳动',topic:'',tag:'哈希表',search:'',due:false,sort:'frequency'});
 const filtered=api.provider.filteredCatalog();assert.ok(filtered.length>0&&filtered.some(p=>p.id===1));assert.ok(filtered.every(p=>p.difficulty==='简单'&&p.topicTags.includes('哈希表')&&p.freq.companies.some(c=>c.name==='字节跳动')));
 const nodes=await api.provider.getChildren();assert.ok(nodes.some(n=>String(n.label).includes('筛选：')));
 const stats=api.provider.buildStatsRows();assert.ok(stats.some(n=>n.command?.command==='hot100Pro.studyPlan'));e.showPlan();
 await cfg.update('dailyGoal',5,vscode.ConfigurationTarget.Workspace);await cfg.update('dailyGoal',2,vscode.ConfigurationTarget.Workspace);assert.equal(e.state.events.length,1);assert.equal(vscode.workspace.getConfiguration('hot100Pro').get('dailyGoal'),2);
 fs.writeFileSync(path.join(__dirname,'results-pro-host.json'),JSON.stringify({checks,defaultACM:true,modeDraftRestore:true,combinedFilters:true,editableGoal:true,reviewPlanOpened:true,newQuestionDeduplicated:true},null,2));
};
