import * as path from 'path';
import * as fs from 'fs';
import {createRequire} from 'module';
import * as assert from 'assert';
import * as vscode from 'vscode';

/**
 * 最小冒烟：扩展可激活、核心命令已注册。
 * （原脚手架 Sample test 从不执行且无断言意义；真实回归靠 src/unit 单测与人工冒烟）
 */
suite('Extension Smoke Test Suite', () => {
	test('扩展可激活且核心命令已注册', async () => {
		const ext = vscode.extensions.getExtension('lovits.hot100-practice');
		assert.ok(ext, '应能找到 lovits.hot100-practice 扩展');
		await ext!.activate();

		const commands = await vscode.commands.getCommands(true);
		const coreCommands = [
			'hot100Pro.login',
			'hot100Pro.logout',
			'hot100Pro.test',
			'hot100Pro.submit',
			'hot100Pro.debug',
			'hot100Pro.viewSolution',
			'hot100Pro.refreshList',
            'hot100Pro.resetPlan',
            'hot100Pro.usageGuide',
		];
		for (const cmd of coreCommands) {
			assert.ok(commands.includes(cmd), `核心命令 ${cmd} 应已注册`);
		}
	});
    test('侧栏说明打开独立 HTML 页面且重复点击复用页面', async () => {
        const ext=vscode.extensions.getExtension('lovits.hot100-practice')!;
        const html=fs.readFileSync(path.join(ext.extensionPath,'运行与提交说明.html'),'utf8');
        assert.ok(html.startsWith('<!doctype html>'));
        assert.ok(html.includes('<kbd>Cmd + Option + T</kbd>')||html.includes('<kbd>Cmd + Option + t</kbd>'));
        assert.ok(!html.includes('<script'));
        await vscode.commands.executeCommand('hot100Pro.usageGuide');
        await vscode.commands.executeCommand('hot100Pro.usageGuide');
        for(let i=0;i<30;i++) {
            const tabs=vscode.window.tabGroups.all.flatMap(g=>g.tabs).filter(t=>t.input instanceof vscode.TabInputWebview&&t.label==='运行与提交说明');
            if(tabs.length===1)return;
            await new Promise(resolve=>setTimeout(resolve,100));
        }
        assert.fail('应打开并复用 HTML 说明页');
    });
    test('打开题目左侧题面右侧代码，模式切换保持右侧代码分组', async () => {
        const ext=vscode.extensions.getExtension('lovits.hot100-practice')!;
        const api=await ext.activate();
        const runtime=createRequire(path.join(ext.extensionPath,'out/extension.js'))('vscode') as typeof vscode;
        const window=runtime.window as any,original=window.showQuickPick,originalError=window.showErrorMessage;
        const errors:string[]=[];window.showErrorMessage=async(message:string)=>{errors.push(message);return undefined;};
        const p=JSON.parse(fs.readFileSync(path.join(ext.extensionPath,'data/problems.json'),'utf8'))[0];
        const q={questionFrontendId:String(p.id),questionId:String(p.id),titleSlug:'two-sum',title:p.title,translatedTitle:p.title,difficulty:'EASY',translatedContent:p.officialHtml,codeSnippets:Object.entries(p.officialTemplates).map(([langSlug,code])=>({langSlug,lang:langSlug,code})),topicTags:p.topicTags.map((name:string)=>({name,translatedName:name}))};
        api.api.getQuestionContent=async()=>({data:{question:q}});
        api.api.getHot100Problems=async()=>[];
        window.showQuickPick=async(items:any,options:any)=>options?.title==='请选择编程语言'?(await items).find((item:any)=>item.detail==='python3'):original(items,options);
        try {
            await runtime.commands.executeCommand('hot100Pro.openProblem',{frontendQuestionId:'1',titleSlug:'two-sum',title:'两数之和'});
            const statement=()=>runtime.window.tabGroups.all.find(g=>g.tabs.some(t=>t.input instanceof runtime.TabInputWebview&&t.label==='1. 两数之和'));
            for(let i=0;i<30&&!statement();i++)await new Promise(resolve=>setTimeout(resolve,100));
            assert.strictEqual(statement()?.viewColumn,runtime.ViewColumn.One,JSON.stringify({errors,tabs:runtime.window.tabGroups.all.map(g=>({column:g.viewColumn,tabs:g.tabs.map(t=>t.label)})),workspace:runtime.workspace.workspaceFolders?.map(f=>f.uri.fsPath)}));
            for(const mode of ['core','acm'] as const) {
                await api.enhancements.switchMode(q,mode,'python3');
                assert.strictEqual(runtime.window.activeTextEditor?.viewColumn,runtime.ViewColumn.Two);
                assert.strictEqual(statement()?.viewColumn,runtime.ViewColumn.One);
            }
        } finally {window.showQuickPick=original;window.showErrorMessage=originalError;}
    });
    test('底部 Case 面板可打开并完成客户端就绪握手',async()=>{
        const api=await vscode.extensions.getExtension('lovits.hot100-practice')!.activate();
        await vscode.commands.executeCommand('hot100Pro.testCases');
        for(let i=0;i<80;i++){
            if(api.enhancements.casePanel.ready===api.enhancements.casePanel.key&&api.enhancements.casePanel.key)return;
            await new Promise(resolve=>setTimeout(resolve,100));
        }
        assert.fail('Case 面板应完成 HTML 脚本就绪握手');
    });
    test('核心代码官方测试：发送自定义参数并轮询官方结果（模拟服务）',async()=>{
        const api=await vscode.extensions.getExtension('lovits.hot100-practice')!.activate(),e=api.enhancements;
        const q=(await api.api.getQuestionContent('two-sum')).data.question;
        await e.switchMode(q,'core','python3');
        const cookie=await e.context.secrets.get('leetcode_session_cookie');
        const run=api.api.runCode,check=api.api.checkSubmission;let sent:any[]=[];
        api.api.runCode=async(...args:any[])=>{sent=args;return{interpret_id:'offline-test'};};
        api.api.checkSubmission=async()=>({state:'SUCCESS',status_msg:'Accepted',run_success:true,correct_answer:true,code_answer:['[0,1]']});
        try{
            await e.context.secrets.store('leetcode_session_cookie','offline-test-only');
            const result:any=await vscode.commands.executeCommand('hot100Pro.officialCaseTest',{q,filePath:vscode.window.activeTextEditor!.document.uri.fsPath,lang:'python3',input:'[2,7]\n9'});
            assert.strictEqual(sent[4],'[2,7]\n9');assert.strictEqual(sent[2],'python3');assert.strictEqual(result.status_msg,'Accepted');
        }finally{
            api.api.runCode=run;api.api.checkSubmission=check;
            if(cookie)await e.context.secrets.store('leetcode_session_cookie',cookie);else await e.context.secrets.delete('leetcode_session_cookie');
        }
    });
    test('ACM 本机运行通过打勾，重复通过不重复增加进度，错误与自定义测试不标完成',async()=>{
        const api=await vscode.extensions.getExtension('lovits.hot100-practice')!.activate(),e=api.enhancements;
        const q=(await api.api.getQuestionContent('two-sum')).data.question;
        await e.switchMode(q,'acm','python3');
        const doc=vscode.window.activeTextEditor!.document;
        const runtime=createRequire(path.join(vscode.extensions.getExtension('lovits.hot100-practice')!.extensionPath,'out/extension.js'))('vscode') as typeof vscode;
        const win=runtime.window as any,info=win.showInformationMessage;win.showInformationMessage=async()=>undefined;
        const writes:any[]=[],record=e.provider.recordLocalResult,solved=e.provider.isSolved,plan=e.record;let done=false;
        e.provider.recordLocalResult=async(id:string,ok:boolean)=>{writes.push([id,ok]);if(ok)done=true;};
        e.provider.isSolved=()=>done;e.record=async(...args:any[])=>writes.push(['plan',...args]);
        const setCode=async(code:string)=>{const edit=new vscode.WorkspaceEdit();edit.replace(doc.uri,new vscode.Range(doc.positionAt(0),doc.positionAt(doc.getText().length)),code);await vscode.workspace.applyEdit(edit);};
        try{
            await setCode('print("-1 -1")');await vscode.commands.executeCommand('hot100Pro.localRun');assert.strictEqual(done,false);
            const correct='import sys\nxs=list(map(int,sys.stdin.read().split()))\nn=xs[0]; a=xs[1:1+n]; target=xs[1+n]\nfor i in range(n):\n for j in range(i+1,n):\n  if a[i]+a[j]==target: print(i,j); sys.exit()\n';
            await setCode(correct);
            const before=writes.length;await e.runLocal(false,'1',[{input:'2\n2 7\n9',output:'0 1'}]);assert.strictEqual(writes.length,before);assert.strictEqual(done,false);
            await vscode.commands.executeCommand('hot100Pro.localRun');assert.strictEqual(done,true);
            await vscode.commands.executeCommand('hot100Pro.localRun');
            const events=writes.filter(w=>w[0]==='plan'&&w[2]===true);assert.strictEqual(events.length,2);assert.strictEqual(events[0][4],false);assert.strictEqual(events[1][4],true);
        }finally{e.provider.recordLocalResult=record;e.provider.isSolved=solved;e.record=plan;win.showInformationMessage=info;}
    });

});
