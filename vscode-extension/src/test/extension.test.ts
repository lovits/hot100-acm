import * as path from 'path';
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
    test('侧栏说明打开 Markdown 渲染预览', async () => {
        await vscode.commands.executeCommand('hot100Pro.usageGuide');
        const uri=vscode.Uri.file(path.join(vscode.extensions.getExtension('lovits.hot100-practice')!.extensionPath,'运行与提交说明.md'));
        const doc=await vscode.workspace.openTextDocument(uri);
        assert.strictEqual(doc.languageId,'markdown');
        assert.ok(doc.getText().includes('| 功能 | Mac | Windows/Linux |'));
        assert.ok(!doc.getText().includes('报错及修复'));
        for(let i=0;i<30;i++) {
            if(vscode.window.tabGroups.all.some(g=>g.tabs.some(t=>t.input instanceof vscode.TabInputWebview&&t.label.includes('运行与提交说明'))))return;
            await new Promise(resolve=>setTimeout(resolve,100));
        }
        assert.fail('应打开说明的 Markdown 预览页');
    });
});
