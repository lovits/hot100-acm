import * as path from 'path';
import * as fs from 'fs';
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
});
