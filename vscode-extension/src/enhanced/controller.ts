import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Hot100Provider } from '../views/hot100Provider';
import { LeetCodeApi } from '../core/leetcodeApi';
import { catalog, catalogById, defaultFilters, Filters } from './catalog';
import { dayTasks, emptyPlan, intervalsOf, recordResult, replan, PlanState, addDays } from './studyPlan';
import { localDateStr } from '../utils/studyStats';
import { escapeHtml } from '../utils/htmlUtil';
import { tryBeginJudge, releaseJudge } from '../judgeFeedback';
import { resolveToolchain } from './toolchain';
import { langSlugOfExtension } from '../utils/languageUtils';
// Existing six-mode evaluator; it invokes the selected local executables, with no bundled interpreter/compiler.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {evaluate}=require('../../engine');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {header}=require('../../c-driver');
export class Enhancements {
    private output=vscode.window.createOutputChannel('Hot100 本机评测');
    private planPanel?: vscode.WebviewPanel;
    private tests:Record<string,Record<string,any[]>>;
    private files=new Map<string,string>();
    readonly changed=new vscode.EventEmitter<string>();
    constructor(private context:vscode.ExtensionContext, private provider:Hot100Provider, private api:LeetCodeApi) {
        this.tests=JSON.parse(fs.readFileSync(path.join(context.extensionPath,'data/tests.json'),'utf8'));
        context.subscriptions.push(this.output,this.changed);
        context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async editor=>{
            if(!editor)return;const file=editor.document.uri.fsPath,id=path.basename(file).match(/^(\d+)[_.-]/)?.[1];
            const lang=langSlugOfExtension(path.extname(file).slice(1));
            if(!id||!lang||!catalogById.has(id))return;
            const mode=file.replace(/\\/g,'/').includes('/acm/')||path.basename(file).includes('-acm.')?'acm':'core';
            const different=this.mode(id)!==mode||context.globalState.get('enhancedLanguage','python3')!==lang;
            if(different){await context.globalState.update('enhancedModes',{...this.modeMap,[id]:mode});await context.globalState.update('enhancedLanguage',lang);this.changed.fire(id);}
            await vscode.commands.executeCommand('setContext','hot100Pro.acmActive',mode==='acm');
        }));
        const command=(name:string,handler:(...args:any[])=>unknown)=>context.subscriptions.push(vscode.commands.registerCommand('hot100Pro.'+name,async(...args)=>{try{return await handler(...args);}catch(e){vscode.window.showErrorMessage(String(e));}}));
        command('filter',()=>this.chooseFilter()); command('clearFilters',async()=>{provider.setStatusFilter('all');await provider.setEnhancedFilters({...defaultFilters});});
        command('studyPlan',()=>this.showPlan());command('configurePlan',()=>this.configurePlan());command('includeSolved',()=>this.includeSolved());
        command('localRun',()=>this.runLocal(false));command('localSubmit',()=>this.runLocal(true));
        command('open',async()=>{await vscode.commands.executeCommand('workbench.view.extension.hot100-pro-enhanced');const p=catalog[0];return vscode.commands.executeCommand('hot100Pro.openProblem',{frontendQuestionId:String(p.id),titleSlug:p.url.split('/').filter(Boolean).at(-1),title:p.title});});
        command('confirmReview',async(id:string)=>{if(!catalogById.has(String(id)))return;const choice=await vscode.window.showWarningMessage('确认已独立完成这道题的复习？','确认完成');if(choice==='确认完成')await this.record(String(id),true,'manual');});
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e=>{if(e.affectsConfiguration('hot100Pro')){provider.rerender();if(this.planPanel)this.showPlan();}}));
    }
    get modeMap():Record<string,string>{return this.context.globalState.get('enhancedModes',{});}
    mode(id:string):'acm'|'core'{return this.modeMap[id]==='core'?'core':'acm';}
    get state():PlanState{return this.context.globalState.get('enhancedPlan',emptyPlan());}
    get intervals():number[]{return intervalsOf(vscode.workspace.getConfiguration('hot100Pro').get('reviewIntervals'));}
    async prepare(q:any,root:string,forceMode?:'core'|'acm',forceLanguage?:string) {
        const id=String(q.questionFrontendId),p=catalogById.get(id);if(!p)return undefined;
        const mode=forceMode||this.mode(id);
        const preferred=forceLanguage||this.context.globalState.get<string>('enhancedLanguage','python3');
        const language=['python3','cpp','c'].includes(preferred)?preferred:'python3';
        const ext=({python3:'py',cpp:'cpp',c:'c'} as Record<string,string>)[language];if(!ext)return undefined;
        const folder=vscode.Uri.file(path.join(root,'leetcode',mode==='acm'?'acm':''));await vscode.workspace.fs.createDirectory(folder);
        const uri=vscode.Uri.joinPath(folder,`${id}_${q.titleSlug}.${ext}`);
        try{await vscode.workspace.fs.stat(uri);}catch(e){if(!(e instanceof vscode.FileSystemError && e.code==='FileNotFound'))throw e;
            const text=mode==='core'?(language==='c'?header+'\n':language==='python3'?'from typing import *\n':'')+p.officialTemplates[language]:language==='c'?'#include <stdio.h>\n#include <stdlib.h>\n\nint main(void) {\n    // 读取输入，计算并输出结果\n    return 0;\n}\n':p.acm.template[language];
            await vscode.workspace.fs.writeFile(uri,Buffer.from(text));
        }
        this.files.set(`${id}:${mode}:${language}`,uri.fsPath);
        await vscode.commands.executeCommand('setContext','hot100Pro.acmActive',mode==='acm');
        return {filePath:uri.fsPath,language,mode};
    }
    async switchMode(q:any,mode:'acm'|'core',language?:string) {
        const prior=this.context.workspaceState.get<any>('currentProblem');
        const root=prior?.filePath?vscode.workspace.getWorkspaceFolder(vscode.Uri.file(prior.filePath))?.uri.fsPath:undefined;
        const folder=root||vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if(!folder)throw Error('请先打开用于保存代码的工作区文件夹。');
        const openEditors=vscode.window.visibleTextEditors;const column=openEditors.find(e=>e.document.uri.fsPath===prior?.filePath)?.viewColumn;
        const selected=await this.prepare(q,folder,mode,language);if(!selected)return;
        await this.context.globalState.update('enhancedModes',{...this.modeMap,[String(q.questionFrontendId)]:mode});
        await vscode.commands.executeCommand('setContext','hot100Pro.acmActive',mode==='acm');
        if(language)await this.context.globalState.update('enhancedLanguage',language);
        await this.context.workspaceState.update('currentProblem',{...prior,titleSlug:q.titleSlug,questionId:q.questionId,questionFrontendId:q.questionFrontendId,lang:selected.language,filePath:selected.filePath});
        const doc=await vscode.workspace.openTextDocument(vscode.Uri.file(selected.filePath));
        await vscode.window.showTextDocument(doc,{viewColumn:column,preview:false});
    }
    async chooseLanguage(q:any){
        const choice=await vscode.window.showQuickPick([{label:'Python',value:'python3'},{label:'C++',value:'cpp'},{label:'C',value:'c'}],{title:'本机评测语言'});
        if(choice)await this.switchMode(q,this.mode(String(q.questionFrontendId)),choice.value);
    }
    async record(id:string,ok:boolean,source:'test'|'manual'='test') {
        await this.context.globalState.update('enhancedPlan',recordResult(this.state,id,ok,localDateStr(),this.intervals,source));
        this.provider.rerender();if(this.planPanel)this.showPlan();
    }
    async runLocal(all:boolean,expectedId?:string) {
        if(!vscode.workspace.isTrusted)throw Error('请先信任工作区，再执行本机代码。');
        const current=this.context.workspaceState.get<any>('currentProblem');
        const active=vscode.window.activeTextEditor;
        const candidate=active?.document.uri.scheme==='file'&&/\.(py|cpp|c)$/.test(active.document.uri.fsPath)&&(!expectedId||path.basename(active.document.uri.fsPath).startsWith(expectedId+'_'))?active:undefined;
        const editor=candidate||vscode.window.visibleTextEditors.find(e=>e.document.uri.fsPath===current?.filePath);
        const storedFile=expectedId&&String(current?.questionFrontendId)!==expectedId?this.files.get(`${expectedId}:${this.mode(expectedId)}:${this.context.globalState.get('enhancedLanguage','python3')}`):current?.filePath;
        const uri=(editor&&(!expectedId||path.basename(editor.document.uri.fsPath).startsWith(expectedId+'_'))?editor.document.uri:undefined)||(storedFile?vscode.Uri.file(storedFile):undefined);
        if(!uri)throw Error('请先打开一道题目的代码文件。');
        const doc=editor?.document.uri.toString()===uri.toString()?editor.document:await vscode.workspace.openTextDocument(uri);
        if(!['.py','.cpp','.c'].includes(path.extname(uri.fsPath)))throw Error('本机评测支持 Python、C++、C；其他语言可继续使用原有官网流程。');
        const match=path.basename(uri.fsPath).match(/^(\d+)[_.-]/);const id=match?.[1],p=id?catalogById.get(id):undefined;
        if(!p||expectedId&&String(p.id)!==expectedId)throw Error('请先打开这道题对应的代码文件。');
        const language=uri.fsPath.endsWith('.cpp')?'cpp':uri.fsPath.endsWith('.c')?'c':'python3';
        const mode=uri.fsPath.replace(/\\/g,'/').includes('/acm/')||path.basename(uri.fsPath).includes('-acm.')?'acm':'core';
        if(!tryBeginJudge())return;
        try{
            await doc.save();const tools=await resolveToolchain(language,uri);
            const cases=this.tests[id!][mode].slice(0,all?undefined:p.acm.examples.length||1);
            this.output.clear();this.output.show(true);this.output.appendLine(`${p.id}. ${p.title} · ${language} · ${mode==='acm'?'ACM':'核心代码'} · ${all?'全部用例':'示例'}`);
            this.output.appendLine(`VS Code 工具链：${Object.values(tools).join(', ')||'系统 PATH 中的解释器/编译器'}`);
            const result:any=await vscode.window.withProgress<any>({location:vscode.ProgressLocation.Notification,title:'Hot100 正在使用本机环境运行'},()=>evaluate(p,language,mode,doc.getText(),cases,tools));
            if(result.error){this.output.appendLine(result.error);if(result.compileError)this.output.appendLine(result.compileError);vscode.window.showErrorMessage('本机评测失败，请查看“Hot100 本机评测”输出。');return result;}
            const passed=result.results.filter((r:any)=>r.ok).length;
            this.output.appendLine(`${passed}/${result.results.length} 通过`);
            result.results.forEach((r:any,i:number)=>this.output.appendLine(`用例 ${i+1}：${r.ok?'通过':JSON.stringify(r)}`));
            if(all){const accepted=passed===result.results.length;await this.provider.recordLocalResult(String(p.id),accepted);await this.record(String(p.id),accepted);}
            vscode.window.showInformationMessage(`Hot100 ${passed}/${result.results.length} 通过`);return result;
        }finally{releaseJudge();}
    }
    async chooseFilter() {
        const f=this.provider.enhancedFilters;
        const choice=await vscode.window.showQuickPick(['专题','算法标签','公司','难度','完成状态','排序','搜索','仅待复习','清空筛选'],{title:'筛选题库（条件组合生效）'});if(!choice)return;
        if(choice==='清空筛选'){await this.provider.setEnhancedFilters({...defaultFilters});this.provider.setStatusFilter('all');return;}
        if(choice==='完成状态'){await vscode.commands.executeCommand('hot100Pro.setStatusFilter');return;}
        if(choice==='搜索'){const value=await vscode.window.showInputBox({title:'搜索题号、题名或标签',value:f.search});if(value!==undefined)await this.provider.setEnhancedFilters({...f,search:value});return;}
        if(choice==='仅待复习'){await this.provider.setEnhancedFilters({...f,due:!f.due});return;}
        const keys:Record<string,keyof Filters>={'专题':'topic','算法标签':'tag','公司':'company','难度':'difficulty','排序':'sort'};const key=keys[choice];
        const values=choice==='专题'?[...new Set(catalog.map(p=>p.topic))]:choice==='算法标签'?[...new Set(catalog.flatMap(p=>p.topicTags))]:choice==='公司'?[...new Set(catalog.flatMap(p=>p.freq.companies.map(c=>c.name)))]:choice==='难度'?['简单','中等','困难']:['专题顺序','高频优先'];
        const selected=await vscode.window.showQuickPick(['全部',...values],{title:choice});if(selected===undefined)return;
        await this.provider.setEnhancedFilters({...f,[key]:key==='sort'?(selected==='高频优先'?'frequency':'topic'):selected==='全部'?'':selected});
    }
    async configurePlan() {
        const cfg=vscode.workspace.getConfiguration('hot100Pro');
        const kind=await vscode.window.showQuickPick(['每日新题目标','每日复习上限','复习日期间隔'],{title:'修改学习计划'});if(!kind)return;
        const interval=kind==='复习日期间隔';const key=interval?'reviewIntervals':kind==='每日新题目标'?'dailyGoal':'reviewLimit';
        const raw=await vscode.window.showInputBox({title:kind,value:interval?this.intervals.join(','):String(cfg.get(key,key==='dailyGoal'?5:20)),prompt:interval?'首次完成后的第几天复习，例如 1,2,4,7,15,30':'输入 1–100 的整数，已完成记录保留'});if(raw===undefined)return;
        const value=interval?raw.split(/[,，\s]+/).map(Number):Number(raw);
        if(interval?(JSON.stringify(intervalsOf(value))!==JSON.stringify(value)):(!Number.isInteger(value)||Number(value)<1||Number(value)>100)){throw Error('请输入合法的正整数；复习日期需递增且不超过365天。');}
        await cfg.update(key,value,vscode.ConfigurationTarget.Global);
        if(interval)await this.context.globalState.update('enhancedPlan',replan(this.state,value as number[]));
        this.provider.rerender();this.showPlan();
    }
    async includeSolved() {
        const choices=catalog.filter(p=>this.provider.isSolved(String(p.id))&&!this.state.learned[p.id]).map(p=>({label:`${p.id}. ${p.title}`,id:String(p.id)}));
        if(!choices.length){vscode.window.showInformationMessage('已有通过记录均已纳入计划。');return;}
        const selected=await vscode.window.showQuickPick(choices,{canPickMany:true,title:'将已有通过记录纳入复习（从今天开始排期）'});if(!selected?.length)return;
        const state=this.state,today=localDateStr();for(const item of selected)state.learned[item.id]={first:today,last:today,stage:0,due:addDays(today,this.intervals[0])};
        await this.context.globalState.update('enhancedPlan',state);this.provider.rerender();this.showPlan();
    }
    showPlan() {
        if(!this.planPanel){this.planPanel=vscode.window.createWebviewPanel('hot100Pro.studyPlan','Hot100 学习计划',vscode.ViewColumn.Active,{enableScripts:true,localResourceRoots:[]});this.planPanel.onDidDispose(()=>this.planPanel=undefined);this.planPanel.webview.onDidReceiveMessage(async m=>{try{
            if(m?.type==='configure')await this.configurePlan();if(m?.type==='include')await this.includeSolved();
            if((m?.type==='open'||m?.type==='manual')&&catalogById.has(String(m.id))){if(m.type==='manual')await vscode.commands.executeCommand('hot100Pro.confirmReview',String(m.id));else await this.openId(String(m.id));}
        }catch(e){vscode.window.showErrorMessage(String(e));}});}
        const cfg=vscode.workspace.getConfiguration('hot100Pro'),goal=cfg.get<number>('dailyGoal',5),limit=cfg.get<number>('reviewLimit',20),today=localDateStr();
        const eligible=this.provider.filteredCatalog().filter(p=>!this.provider.isSolved(String(p.id))).map(p=>String(p.id));
        const task=dayTasks(this.state,today,eligible,goal,limit);const ids=(items:string[],manual=false)=>items.map(id=>`<button data-id="${id}" data-action="open">${escapeHtml(catalogById.get(id)?.title||id)}</button>${manual?` <button data-id="${id}" data-action="manual">确认复习完成</button>`:''}`).join(' ')||'—';
        let projected=this.state;const rows=[];
        for(let i=0;i<14;i++){const date=addDays(today,i),t=dayTasks(projected,date,eligible,goal,limit);rows.push(`<tr><td>${date}${i===0?'（今天）':''}</td><td>${t.newDone.length} / ${t.newDone.length+t.newIds.length}</td><td>${t.reviewDone.length} / ${t.reviewIds.length+t.reviewDone.length}</td><td>${t.overdue}</td><td>${ids(t.newIds)}</td><td>${ids(t.reviewIds,i===0)}</td></tr>`);for(const id of [...t.newIds,...t.reviewIds])projected=recordResult(projected,id,true,date,this.intervals);}
        const nonce=Date.now().toString(36);this.planPanel.webview.html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'nonce-${nonce}';script-src 'nonce-${nonce}'"><meta name="viewport" content="width=device-width,initial-scale=1"><style nonce="${nonce}">body{font-family:var(--vscode-font-family);color:var(--vscode-editor-foreground);background:var(--vscode-editor-background);font-size:var(--vscode-font-size);padding:20px;line-height:1.7}h1{font-size:22px}table{border-collapse:collapse;width:100%}th,td{text-align:left;vertical-align:top;border-bottom:1px solid var(--vscode-panel-border);padding:9px}button{font:inherit;color:var(--vscode-textLink-foreground);background:transparent;border:1px solid var(--vscode-button-border,transparent);border-radius:4px;cursor:pointer;padding:3px 6px}button:focus-visible{outline:1px solid var(--vscode-focusBorder)}.table{overflow:auto}p{color:var(--vscode-descriptionForeground)}</style></head><body><h1>学习计划</h1><button data-action="configure">修改目标与复习间隔</button><button data-action="include">纳入已有通过题目</button><p>今日新题 ${task.newDone.length}/${task.newDone.length+task.newIds.length}（每日目标 ${goal}） · 复习 ${task.reviewDone.length}/${task.reviewIds.length+task.reviewDone.length} · 逾期 ${task.overdue} 道。复习日期：${this.intervals.join('、')} 天。未来安排按当前目标与筛选范围预估，实际完成后更新。</p><div class="table"><table><thead><tr><th>日期</th><th>新题完成/安排</th><th>复习完成/安排</th><th>逾期</th><th>新题</th><th>复习题</th></tr></thead><tbody>${rows.join('')}</tbody></table></div><script nonce="${nonce}">const api=acquireVsCodeApi();document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b)api.postMessage({type:b.dataset.action,id:b.dataset.id});});</script></body></html>`;
    }
    async openId(id:string){const p=catalogById.get(id);if(p)await vscode.commands.executeCommand('hot100Pro.openProblem',{frontendQuestionId:id,titleSlug:p.url.split('/').filter(Boolean).at(-1),title:p.title});}
    async getQuestion(slug:string){
        try{return await this.api.getQuestionContent(slug);}catch(e){const p=catalog.find(p=>p.url.split('/').filter(Boolean).at(-1)===slug);if(!p)throw e;return{data:{question:{questionId:String(p.id),questionFrontendId:String(p.id),title:p.title,translatedTitle:p.title,titleSlug:slug,difficulty:p.difficulty,translatedContent:p.officialHtml,codeSnippets:Object.entries(p.officialTemplates).map(([langSlug,code])=>({langSlug,lang:langSlug,code})),topicTags:p.topicTags.map(name=>({name,translatedName:name}))}}};}
    }
}
