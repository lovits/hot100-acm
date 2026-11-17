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
});
