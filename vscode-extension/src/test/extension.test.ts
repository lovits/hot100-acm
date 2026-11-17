import * as assert from 'assert';
import * as vscode from 'vscode';

/**
 * 最小冒烟：扩展可激活、核心命令已注册。
 * （原脚手架 Sample test 从不执行且无断言意义；真实回归靠 src/unit 单测与人工冒烟）
 */
suite('Extension Smoke Test Suite', () => {
	test('扩展可激活且核心命令已注册', async () => {
		const ext = vscode.extensions.getExtension('ShiZiMiao.leetcode');
		assert.ok(ext, '应能找到 ShiZiMiao.leetcode 扩展');
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
		];
		for (const cmd of coreCommands) {
			assert.ok(commands.includes(cmd), `核心命令 ${cmd} 应已注册`);
		}
	});
});
