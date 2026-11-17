import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Hot100Provider } from '../views/hot100Provider';
import { LeetCodeApi } from '../core/leetcodeApi';
import { catalog, catalogById, Filters } from './catalog';
import { dayTasks, emptyPlan, intervalsOf, recordResult, replan, PlanState, addDays } from './studyPlan';
import { localDateStr } from '../utils/studyStats';
import { tryBeginJudge, releaseJudge } from '../judgeFeedback';
import { resolveToolchain } from './toolchain';
import { getExtension, langSlugOfExtension, normalizeLangSlug } from '../utils/languageUtils';
import { selectLanguage } from '../views/languageQuickPick';
import { acmTemplate, cppEditorSource } from './codeTemplates';
import { renderStudyCalendar } from './studyCalendar';
// Existing six-mode evaluator; it invokes the selected local executables, with no bundled interpreter/compiler.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {evaluate}=require('../../engine');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {header}=require('../../c-driver');
export class Enhancements {
    private output=vscode.window.createOutputChannel('Hot100 本机评测');
    private planPanel?: vscode.WebviewPanel;
    private usagePanel?: vscode.WebviewPanel;
    private tests:Record<string,Record<string,any[]>>;
    private files=new Map<string,string>();
    private codeColumns=new Map<string,vscode.ViewColumn>();
    private switching=Promise.resolve();
    private changingEditor=false;
    readonly changed=new vscode.EventEmitter<string>();
    constructor(private context:vscode.ExtensionContext, private provider:Hot100Provider, private api:LeetCodeApi) {
        this.tests=JSON.parse(fs.readFileSync(path.join(context.extensionPath,'data/tests.json'),'utf8'));
        context.subscriptions.push(this.output,this.changed);
        context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async editor=>{
            if(!editor||this.changingEditor)return;const file=editor.document.uri.fsPath,id=path.basename(file).match(/^(\d+)[_.-]/)?.[1];
            const lang=langSlugOfExtension(path.extname(file).slice(1));
            if(!id||!lang||!catalogById.has(id))return;
            const mode=file.replace(/\\/g,'/').includes('/acm/')||path.basename(file).includes('-acm.')?'acm':'core';
            this.codeColumns.set(id,editor.viewColumn||vscode.ViewColumn.One);
            const different=this.mode(id)!==mode||this.language(id)!==lang;
            if(different){await context.globalState.update('enhancedModes',{...this.modeMap,[id]:mode});await this.rememberLanguage(id,lang);this.changed.fire(id);}
            await vscode.commands.executeCommand('setContext','hot100Pro.acmActive',mode==='acm');
        }));
        const command=(name:string,handler:(...args:any[])=>unknown)=>context.subscriptions.push(vscode.commands.registerCommand('hot100Pro.'+name,async(...args)=>{try{return await handler(...args);}catch(e){vscode.window.showErrorMessage(String(e));}}));
        command('usageGuide',()=>this.showUsageGuide());
        command('filter',()=>this.chooseFilter()); command('clearFilters',()=>provider.clearEnhancedFilters());
        command('resetPlan',()=>this.resetPlan());command('studyPlan',()=>this.showPlan());command('configurePlan',()=>this.configurePlan());command('includeSolved',()=>this.includeSolved());
        command('localRun',()=>this.runLocal(false));command('localSubmit',()=>this.runLocal(true));command('localCustom',()=>this.customLocal());
        command('open',async()=>{await vscode.commands.executeCommand('workbench.view.extension.hot100-pro-enhanced');const p=catalog[0];return vscode.commands.executeCommand('hot100Pro.openProblem',{frontendQuestionId:String(p.id),titleSlug:p.url.split('/').filter(Boolean).at(-1),title:p.title});});
        command('confirmReview',async(id:string)=>{if(!catalogById.has(String(id)))return;const choice=await vscode.window.showWarningMessage('确认已独立完成这道题的复习？','确认完成');if(choice==='确认完成')await this.record(String(id),true,'manual');});
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e=>{if(e.affectsConfiguration('hot100Pro')){provider.rerender();if(this.planPanel)this.showPlan();}}));
    }
    get modeMap():Record<string,string>{return this.context.globalState.get('enhancedModes',{});}
    mode(id:string):'acm'|'core'{return this.modeMap[id]==='core'?'core':'acm';}
    get state():PlanState{return this.context.globalState.get('enhancedPlan',emptyPlan());}
    get intervals():number[]{return intervalsOf(vscode.workspace.getConfiguration('hot100Pro').get('reviewIntervals'));}
    language(id:string):string {return this.context.globalState.get<Record<string,string>>('enhancedLanguages',{})[id]||this.context.globalState.get('enhancedLanguage','python3');}
    private async rememberLanguage(id:string,language:string) {
        await this.context.globalState.update('enhancedLanguages',{...this.context.globalState.get<Record<string,string>>('enhancedLanguages',{}),[id]:language});
        await this.context.globalState.update('enhancedLanguage',language);
    }
    codeColumn(id:string):vscode.ViewColumn {
        const prior=this.context.workspaceState.get<any>('currentProblem');
        const groups=vscode.window.tabGroups.all;
        const current=groups.find(group=>group.tabs.some(tab=>tab.input instanceof vscode.TabInputText && tab.input.uri.fsPath===prior?.filePath && String(prior.questionFrontendId)===id));
        if(current)return current.viewColumn;
        const remembered=this.codeColumns.get(id);
        if(remembered&&groups.some(g=>g.viewColumn===remembered))return remembered;
        const match=groups.find(group=>group.tabs.some(tab=>tab.input instanceof vscode.TabInputText && path.basename(tab.input.uri.fsPath).startsWith(id+'_')));
        const editor=vscode.window.visibleTextEditors.find(e=>e.document.uri.fsPath===prior?.filePath);
        return match?.viewColumn||editor?.viewColumn||vscode.ViewColumn.One;
    }
    async prepare(q:any,root:string,forceMode?:'core'|'acm',forceLanguage?:string) {
        const id=String(q.questionFrontendId),p=catalogById.get(id);if(!p)return undefined;
        const mode=forceMode||this.mode(id),language=normalizeLangSlug(forceLanguage||this.language(id));
        const ext=getExtension(language);if(ext==='txt')throw Error('请选择题目支持的编程语言。');
        const snippet=q.codeSnippets?.find((s:any)=>normalizeLangSlug(s.langSlug)===language)?.code||p.officialTemplates[language];
        if(mode==='core'&&!snippet)throw Error(`该题没有 ${language} 的官方模板，请重新选择语言。`);
        const folder=vscode.Uri.file(path.join(root,'leetcode',mode==='acm'?'acm':''));await vscode.workspace.fs.createDirectory(folder);
        const uri=vscode.Uri.joinPath(folder,`${id}_${p.url.split('/').filter(Boolean).at(-1)}.${ext}`);
        try{await vscode.workspace.fs.stat(uri);}catch(e){if(!(e instanceof vscode.FileSystemError && e.code==='FileNotFound'))throw e;
            const text=mode==='core'?(language==='c'?header+'\n':language==='python3'?'from typing import *\n':'')+snippet:p.acm.template[language]||acmTemplate(language);
            await vscode.workspace.fs.writeFile(uri,Buffer.from(text));
        }
        if(language==='cpp') {
            const includeFolder=vscode.Uri.joinPath(folder,'bits'),includeFile=vscode.Uri.joinPath(includeFolder,'stdc++.h');
            try{await vscode.workspace.fs.stat(includeFile);}catch(e){
                if(!(e instanceof vscode.FileSystemError && e.code==='FileNotFound'))throw e;
                await vscode.workspace.fs.createDirectory(includeFolder);
                await vscode.workspace.fs.writeFile(includeFile,await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(this.context.extensionPath,'runtime/native_judge/include/bits/stdc++.h'))));
            }

            const doc=await vscode.workspace.openTextDocument(uri),source=doc.getText(),updated=cppEditorSource(source,mode==='core');
            if(updated!==source) {
                const edit=new vscode.WorkspaceEdit();
                edit.replace(uri,new vscode.Range(doc.positionAt(0),doc.positionAt(source.length)),updated);
                if(!await vscode.workspace.applyEdit(edit))throw Error('无法补齐 C++ 头文件，请重试。');
            }
        }
        this.files.set(`${id}:${mode}:${language}`,uri.fsPath);
        return {filePath:uri.fsPath,language,mode};
    }
    switchMode(q:any,mode:'acm'|'core',language?:string,rootFolder?:string) {
        const next=this.switching.then(()=>this.activateCode(q,mode,language,rootFolder));
        this.switching=next.then(()=>undefined,()=>undefined);return next;
    }
    private async activateCode(q:any,mode:'acm'|'core',language?:string,rootFolder?:string) {
        const id=String(q.questionFrontendId),prior=this.context.workspaceState.get<any>('currentProblem');
        const root=prior?.filePath?vscode.workspace.getWorkspaceFolder(vscode.Uri.file(prior.filePath))?.uri.fsPath:undefined;
        const folder=rootFolder||root||vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if(!folder)throw Error('请先打开用于保存代码的工作区文件夹。');
        const column=this.codeColumn(id),selected=await this.prepare(q,folder,mode,language);if(!selected)return;
        this.changingEditor=true;
        try {
            const doc=await vscode.workspace.openTextDocument(vscode.Uri.file(selected.filePath));
            await vscode.window.showTextDocument(doc,{viewColumn:column,preview:false});
            this.codeColumns.set(id,column);
            await this.context.globalState.update('enhancedModes',{...this.modeMap,[id]:mode});
            await this.rememberLanguage(id,selected.language);
            await this.context.workspaceState.update('currentProblem',{...prior,titleSlug:q.titleSlug,questionId:q.questionId,questionFrontendId:q.questionFrontendId,lang:selected.language,filePath:selected.filePath,testCases:q.exampleTestcases||q.sampleTestCase});
            await vscode.commands.executeCommand('setContext','hot100Pro.acmActive',mode==='acm');
            this.changed.fire(id);
        } finally {this.changingEditor=false;}
    }
    async chooseLanguage(q:any){
        const choice=await selectLanguage(q.codeSnippets||[]);
        if(choice)await this.switchMode(q,this.mode(String(q.questionFrontendId)),choice.langSlug);
    }
    async record(id:string,ok:boolean,source:'test'|'manual'='test',alreadySolved=false) {
        await this.context.globalState.update('enhancedPlan',recordResult(this.state,id,ok,localDateStr(),this.intervals,source,alreadySolved));
        this.provider.rerender();if(this.planPanel)this.showPlan();
    }
    async runLocal(all:boolean,expectedId?:string,customTests?:any[]) {
        if(!vscode.workspace.isTrusted)throw Error('请先信任工作区，再执行本机代码。');
        const current=this.context.workspaceState.get<any>('currentProblem');
        const active=vscode.window.activeTextEditor;
        const candidate=active?.document.uri.scheme==='file'&&/\.(py|cpp|c)$/.test(active.document.uri.fsPath)&&(!expectedId||path.basename(active.document.uri.fsPath).startsWith(expectedId+'_'))?active:undefined;
        const editor=candidate||vscode.window.visibleTextEditors.find(e=>e.document.uri.fsPath===current?.filePath);
        const storedFile=expectedId&&String(current?.questionFrontendId)!==expectedId?this.files.get(`${expectedId}:${this.mode(expectedId)}:${this.language(expectedId)}`):current?.filePath;
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
            const cases=customTests||this.tests[id!][mode].slice(0,all?undefined:p.acm.examples.length||1);
            this.output.clear();this.output.show(true);this.output.appendLine(`${p.id}. ${p.title} · ${language} · ${mode==='acm'?'ACM':'核心代码'} · ${customTests?'自定义用例':all?'全部用例':'示例'}`);
            this.output.appendLine(`VS Code 工具链：${Object.values(tools).join(', ')||'系统 PATH 中的解释器/编译器'}`);
            const result:any=await vscode.window.withProgress<any>({location:vscode.ProgressLocation.Notification,title:'Hot100 正在使用本机环境运行'},()=>evaluate(p,language,mode,doc.getText(),cases,tools));
            if(result.error){this.output.appendLine(result.error);if(result.compileError)this.output.appendLine(result.compileError);vscode.window.showErrorMessage('本机评测失败，请查看“Hot100 本机评测”输出。');return result;}
            const passed=result.results.filter((r:any)=>r.ok).length;
            this.output.appendLine(`${passed}/${result.results.length} 通过`);
            result.results.forEach((r:any,i:number)=>this.output.appendLine(`用例 ${i+1}：${r.ok?'通过':JSON.stringify(r)}`));
            if(all&&!customTests){const accepted=passed===result.results.length,alreadySolved=this.provider.isSolved(String(p.id));await this.provider.recordLocalResult(String(p.id),accepted);await this.record(String(p.id),accepted,'test',alreadySolved);}
            vscode.window.showInformationMessage(`Hot100 ${passed}/${result.results.length} 通过`);return result;
        }finally{releaseJudge();}
    }
    async customLocal() {
        const current=this.context.workspaceState.get<any>('currentProblem');
        const file=vscode.window.activeTextEditor?.document.uri.fsPath||current?.filePath||'';
        const id=path.basename(file).match(/^(\d+)[_.-]/)?.[1];if(!id||!catalogById.has(id))throw Error('请先打开一道题目的代码。');
        const mode=file.replace(/\\/g,'/').includes('/acm/')||path.basename(file).includes('-acm.')?'acm':'core';
        const raw=await vscode.window.showInputBox({title:mode==='acm'?'自定义 ACM 用例（input / output）':'自定义核心用例（args / expected；设计类另含 ops）',value:JSON.stringify(this.tests[id][mode][0]),prompt:'修改用例 JSON，换行使用 \\n；自定义测试不计入刷题完成记录。'});
        if(raw===undefined)return;let test:any;try{test=JSON.parse(raw);}catch{throw Error('请输入有效的 JSON 用例。');}
        if(!test||typeof test!=='object'||(mode==='acm'?(typeof test.input!=='string'||typeof test.output!=='string'):(!Array.isArray(test.args)||!Object.hasOwn(test,'expected'))))throw Error('用例缺少必要的输入或期望输出。');
        return this.runLocal(false,id,[test]);
    }
    async chooseFilter() {
        const f=this.provider.enhancedFilters;
        const choice=await vscode.window.showQuickPick(['专题','算法标签','公司','难度','完成状态','搜索','仅待复习','清空筛选'],{title:'筛选题库（条件组合生效）'});if(!choice)return;
        if(choice==='清空筛选'){await this.provider.clearEnhancedFilters();return;}
        if(choice==='完成状态'){await vscode.commands.executeCommand('hot100Pro.setStatusFilter');return;}
        if(choice==='搜索'){const value=await vscode.window.showInputBox({title:'搜索题号、题名或标签',value:f.search});if(value!==undefined)await this.provider.setEnhancedFilters({...f,search:value});return;}
        if(choice==='仅待复习'){await this.provider.setEnhancedFilters({...f,due:!f.due});return;}
        const keys:Record<string,keyof Filters>={'专题':'topic','算法标签':'tag','公司':'company','难度':'difficulty'};const key=keys[choice];
        const values=choice==='专题'?[...new Set(catalog.map(p=>p.topic))]:choice==='算法标签'?[...new Set(catalog.flatMap(p=>p.topicTags))]:choice==='公司'?[...new Set(catalog.flatMap(p=>p.freq.companies.map(c=>c.name)))]:['简单','中等','困难'];
        const selected=await vscode.window.showQuickPick(['全部',...values],{title:choice});if(selected===undefined)return;
        await this.provider.setEnhancedFilters({...f,[key]:selected==='全部'?'':selected});
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
    async resetPlan() {
        const choice=await vscode.window.showWarningMessage('重置学习计划？将清空全部学习与复习记录、日历和完成进度，从零开始；保留目标设置、题库通过状态、收藏、笔记和代码。此操作无法撤销。',{modal:true},'确认重置');
        if(choice!=='确认重置')return;
        await this.context.globalState.update('enhancedPlan',emptyPlan());
        this.provider.rerender();this.showPlan();
    }
    async includeSolved() {
        const choices=catalog.filter(p=>this.provider.isSolved(String(p.id))&&!this.state.learned[p.id]).map(p=>({label:`${p.id}. ${p.title}`,id:String(p.id)}));
        if(!choices.length){vscode.window.showInformationMessage('已有通过记录均已纳入计划。');return;}
        const selected=await vscode.window.showQuickPick(choices,{canPickMany:true,title:'将已有通过记录纳入复习（从今天开始排期）'});if(!selected?.length)return;
        const state=this.state,today=localDateStr();for(const item of selected)state.learned[item.id]={first:today,last:today,stage:0,due:addDays(today,this.intervals[0])};
        await this.context.globalState.update('enhancedPlan',state);this.provider.rerender();this.showPlan();
    }
    showUsageGuide() {
        if(!this.usagePanel) {
            this.usagePanel=vscode.window.createWebviewPanel('hot100Pro.usageGuide','运行与提交说明',vscode.ViewColumn.Active,{enableScripts:false,localResourceRoots:[]});
            this.context.subscriptions.push(this.usagePanel);
            this.usagePanel.onDidDispose(()=>this.usagePanel=undefined);
            this.usagePanel.webview.html=fs.readFileSync(path.join(this.context.extensionPath,'运行与提交说明.html'),'utf8');
        } else this.usagePanel.reveal();
    }
    showPlan() {
        if(!this.planPanel){this.planPanel=vscode.window.createWebviewPanel('hot100Pro.studyPlan','Hot100 学习计划',vscode.ViewColumn.Active,{enableScripts:true,localResourceRoots:[]});this.planPanel.onDidDispose(()=>this.planPanel=undefined);this.planPanel.webview.onDidReceiveMessage(async m=>{try{
            if(m?.type==='reset')await this.resetPlan();
            if(m?.type==='configure')await this.configurePlan();if(m?.type==='include')await this.includeSolved();
            if((m?.type==='open'||m?.type==='manual')&&catalogById.has(String(m.id))){if(m.type==='manual'){const id=String(m.id),today=localDateStr();if(dayTasks(this.state,today,[],0,100).reviewIds.includes(id))await this.record(id,true,'manual');}else await this.openId(String(m.id));}
        }catch(e){vscode.window.showErrorMessage(String(e));}});}
        const cfg=vscode.workspace.getConfiguration('hot100Pro'),goal=cfg.get<number>('dailyGoal',5),limit=cfg.get<number>('reviewLimit',20),today=localDateStr();
        this.planPanel.webview.html=renderStudyCalendar({state:this.state,today,goal,limit,intervals:this.intervals,company:this.provider.enhancedFilters.company});
    }

    async openId(id:string){const p=catalogById.get(id);if(p)await vscode.commands.executeCommand('hot100Pro.openProblem',{frontendQuestionId:id,titleSlug:p.url.split('/').filter(Boolean).at(-1),title:p.title});}
    async getQuestion(slug:string){
        try{return await this.api.getQuestionContent(slug);}catch(e){const p=catalog.find(p=>p.url.split('/').filter(Boolean).at(-1)===slug);if(!p)throw e;return{data:{question:{questionId:String(p.id),questionFrontendId:String(p.id),title:p.title,translatedTitle:p.title,titleSlug:slug,difficulty:p.difficulty,translatedContent:p.officialHtml,codeSnippets:Object.entries(p.officialTemplates).map(([langSlug,code])=>({langSlug,lang:langSlug,code})),topicTags:p.topicTags.map(name=>({name,translatedName:name}))}}};}
    }
}
