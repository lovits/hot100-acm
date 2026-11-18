/**
 * 生成产物级验证：
 * ① webview 页面脚本以模板字符串拼接，tsc 不校验其语法——必须真实调用
 *    generatePanelHtml 并对产物内联脚本做语法编译，才能拦住"页面脚本写坏"类回归；
 *    同时断言产物无内联事件属性（CSP nonce 策略下内联 onclick 点击无反应）。
 * ② 各语言调试驱动产物做语法扫描（Python py_compile / JS node --check /
 *    TS typescript 转换诊断），模板改动导致的语法破坏在此拦下。
 * 依赖本机 python/node（缺失时对应子项跳过）。
 */
import { test } from 'node:test';
import * as assert from 'node:assert';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateDebugFile } from '../utils/debugUtils';

// vscode 桩件：generatePanelHtml 只用到 Uri 与面板 webview 的少量表面
const fakeVscode: any = {
    Uri: {
        file: (p: string) => ({ fsPath: p, toString: () => 'vscode-file:///' + String(p).replace(/\\/g, '/') }),
        joinPath: (base: any, ...parts: string[]) => ({
            fsPath: path.join(base?.fsPath ?? String(base), ...parts),
            toString: () => 'vscode-file:///' + path.join(base?.fsPath ?? String(base), ...parts).replace(/\\/g, '/')
        }),
        parse: (s: string) => ({ fsPath: s, toString: () => s })
    },
    TreeItem: class { },
    ThemeIcon: class { constructor(public id: string) { } },
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    EventEmitter: class {
        event = () => ({ dispose() { } });
        fire() { }
    }
};

function loadProblemPanel(modulePath = '../views/problemPanel'): any {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- 拦截 Module._load mock vscode 模块，ESM import 无法在加载期替换依赖
    const Module = require('module');
    const origLoad = Module._load;
    Module._load = function (request: string, ...rest: unknown[]) {
        if (request === 'vscode') {
            return fakeVscode;
        }
        return origLoad.call(this, request, ...rest);
    };
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- 依赖上方 Module._load mock 生效后再加载，静态 import 会在 mock 前执行
        return require(modulePath);
    } finally {
        Module._load = origLoad;
    }
}

function fakeEnv() {
    const repoRoot = path.join(__dirname, '..', '..');
    const panel: any = {
        webview: {
            cspSource: 'https://test.vscode-cdn.net',
            asWebviewUri: (u: any) => ({ toString: () => 'https://test/' + path.basename(String(u?.fsPath || u)) }),
            postMessage: async () => true
        }
    };
    const context: any = {
        extensionPath: repoRoot,
        globalStorageUri: { fsPath: path.join(os.tmpdir(), 'lc-gen-artifact-test') }
    };
    return { repoRoot, panel, context };
}

test('webview 产物：generatePanelHtml 可生成、页面脚本语法正确、无内联事件属性', () => {
    const { generatePanelHtml } = loadProblemPanel();
    const { panel, context } = fakeEnv();
    const q: any = {
        titleSlug: 'two-sum',
        questionFrontendId: '1',
        translatedTitle: '两数之和',
        title: 'Two Sum',
        difficulty: 'EASY',
        likes: 1,
        dislikes: 0,
        topicTags: [],
        similarQuestions: '[]',
        stats: '{}',
        hints: []
    };
    for (const activeTab of ['problem', 'solution'] as const) {
        const html = generatePanelHtml(
            q,
            '两数之和',
            '简单',
            '<p>题面：<code>nums</code></p>',
            context,
            panel,
            activeTab,
            activeTab === 'solution' ? '<div class="solution-section"><p>题解内容</p></div>' : ''
        );
        assert.ok(html.includes('Content-Security-Policy'), '页面必须带 CSP');
        assert.ok(/script nonce="/.test(html), '内联脚本必须走 nonce（CSP script-src 无 unsafe-inline）');
        // ① 页面脚本语法：模板字符串拼接产物，tsc 不校验，这里用 Function 编译拦语法错误
        for (const m of html.matchAll(/<script nonce="[^"]*">([\s\S]*?)<\/script>/g)) {
            assert.doesNotThrow(() => new Function(m[1]), `页面脚本语法错误（${activeTab} 页）`);
        }
        // ② 内联事件属性（script 正文除外）在 CSP nonce 页会点击无反应
        const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/g, '');
        assert.ok(!/\son[a-z]+\s*=/i.test(withoutScripts), `产物不得含内联事件属性（${activeTab} 页）`);
    }
});

test('webview 产物：文章页返回按钮走 data 属性委托（非内联 onclick）', () => {
    const { generatePanelHtml } = loadProblemPanel();
    const { panel, context } = fakeEnv();
    const q: any = { titleSlug: 'two-sum', questionFrontendId: '1', difficulty: 'EASY', likes: 1, dislikes: 0, topicTags: [] };
    const articleHtml = '<div class="solution-section"><button data-back-list="1">← 返回列表</button><p>文章</p></div>';
    const html = generatePanelHtml(q, '两数之和', '简单', '', context, panel, 'solution', articleHtml);
    assert.ok(html.includes('data-back-list'), '返回按钮应为 data 属性 + click 委托');
    assert.ok(!html.includes('onclick='), '不得回退为内联 onclick');
});

function syntaxCheckDriver(t: { skip: (msg: string) => void }, lang: string, gen: { fileName: string; content: string } | null): void {
    assert.ok(gen, `${lang} 应生成调试驱动`);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-gen-artifact-'));
    try {
        const file = path.join(dir, gen!.fileName);
        fs.writeFileSync(file, gen!.content);
        if (gen!.fileName.endsWith('.py')) {
            const py = process.platform === 'win32' ? 'python' : 'python3';
            if (spawnSync(py, ['--version'], { encoding: 'utf8' }).status !== 0) {
                t.skip('本机无 python，跳过 Python 驱动语法校验');
                return;
            }
            const res = spawnSync(py, ['-m', 'py_compile', file], { encoding: 'utf8' });
            assert.strictEqual(res.status, 0, `Python 驱动语法错误: ${res.stderr}`);
        } else if (gen!.fileName.endsWith('.js')) {
            const res = spawnSync('node', ['--check', file], { encoding: 'utf8' });
            assert.strictEqual(res.status, 0, `JS 驱动语法错误: ${res.stderr}`);
        } else if (gen!.fileName.endsWith('.ts')) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- 测试内运行时取 typescript 转译 TS 驱动做语法校验，避免顶层依赖影响纯逻辑单测加载
            const tsMod = require('typescript');
            const out = tsMod.transpileModule(gen!.content, {
                reportDiagnostics: true,
                compilerOptions: { target: tsMod.ScriptTarget.ES2022 }
            });
            const diags: any[] = out.diagnostics || [];
            assert.strictEqual(diags.length, 0, `TS 驱动语法错误: ${diags.map(d => d.messageText).join('; ')}`);
        }
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

test('调试驱动产物：Python/JS/TS 模板生成的驱动语法有效（常规题 + 设计类 + 多参数）', (t) => {
    const nodeSnippet = 'class Solution:\n    def reverseList(self, head: ListNode) -> ListNode:\n        return head\n';
    syntaxCheckDriver(t, 'python3', generateDebugFile('python3', '206', 'reverse-linked-list', '[1,2,3]', nodeSnippet, '/tmp/206.py', [], [[[1, 2, 3]]]));
    const lcaPy = 'class Solution:\n    def lowestCommonAncestor(self, root: TreeNode, p: TreeNode, q: TreeNode) -> TreeNode:\n        return root\n';
    syntaxCheckDriver(t, 'python3', generateDebugFile('python3', '236', 'lowest-common-ancestor-of-a-binary-tree', '[3,5,1]\n5\n1', lcaPy, '/tmp/236.py', []));
    const specialPy = 'class MinStack:\n    def push(self, val: int) -> None:\n        pass\n';
    syntaxCheckDriver(t, 'python3', generateDebugFile('python3', '155', 'min-stack', '["MinStack"]', specialPy, '/tmp/155.py', [], []));

    const jsSnippet = 'var reverseList = function(head) { return head; };\n';
    syntaxCheckDriver(t, 'javascript', generateDebugFile('javascript', '206', 'reverse-linked-list', '[1,2,3]', jsSnippet, '/tmp/206.js', [], [[[1, 2, 3]]]));
    const lcaJs = 'function lowestCommonAncestor(root, p, q) { return root; }\n';
    syntaxCheckDriver(t, 'javascript', generateDebugFile('javascript', '236', 'lowest-common-ancestor-of-a-binary-tree', '[3,5,1]\n5\n1', lcaJs, '/tmp/236.js', []));

    const tsSnippet = 'function reverseList(head: ListNode): ListNode | null { return head; }\n';
    syntaxCheckDriver(t, 'typescript', generateDebugFile('typescript', '206', 'reverse-linked-list', '[1,2,3]', tsSnippet, '/tmp/206.ts', [], [[[1, 2, 3]]]));
});

test('调试驱动产物：Java 类名与文件名一致（含数字开头 slug）', () => {
    const javaSnippet = 'class Solution {\n    public List<List<Integer>> threeSum(int[] nums) { return null; }\n}\n';
    const gen = generateDebugFile('java', '15', '3sum', '[0,0,0]', javaSnippet, '/tmp/15_3sum.java', []);
    assert.ok(gen);
    assert.strictEqual(gen!.fileName, '_3sumDebug.java');
    assert.ok(gen!.content.includes('public class _3sumDebug'), 'public 类名必须与文件名一致且为合法标识符');
    const base = gen!.fileName.replace(/\.java$/, '');
    assert.ok(gen!.content.includes(`class ${base}`), `类名应与文件名一致: ${base}`);
});


test('重置学习计划：取消不写入，确认仅清空计划并刷新', async () => {
    let choice: string | undefined = undefined;
    fakeVscode.window = { showWarningMessage: async () => choice, createOutputChannel: () => ({}), createStatusBarItem: () => ({}) };
    fakeVscode.StatusBarAlignment = {Left: 1};
    fakeVscode.languages = {createDiagnosticCollection: () => ({})};
    const { Enhancements } = loadProblemPanel('../enhanced/controller');
    const writes: unknown[] = [];
    let refreshes = 0;
    const target = {
        context: {globalState: {update: async (...args: unknown[]) => {writes.push(args);}}},
        provider: {rerender: () => refreshes++},
        showPlan: () => refreshes++
    };
    await Enhancements.prototype.resetPlan.call(target);
    assert.deepStrictEqual(writes, []);
    assert.strictEqual(refreshes, 0);
    choice = '确认重置';
    await Enhancements.prototype.resetPlan.call(target);
    assert.deepStrictEqual(writes, [['enhancedPlan', {learned: {}, events: []}]]);
    assert.strictEqual(refreshes, 2);
});


test('分组入口切换专题、难度与高频，保留组合筛选且解除旧高频排序', async () => {
    const {Hot100Provider}=loadProblemPanel('../views/hot100Provider');
    const state=new Map<string,unknown>([['enhancedFilters',{company:'字节跳动',tag:'数组',sort:'topic'}]]);
    const provider=Object.create(Hot100Provider.prototype);
    provider.store={get:(key:string,fallback:unknown)=>state.get(key)??fallback,update:async(key:string,value:unknown)=>{state.set(key,value);}};
    provider._onDidChangeTreeData={fire:()=>{}};
    await provider.setQuestionOrder('frequency');
    assert.strictEqual(provider.enhancedFilters.sort,'frequency');
    assert.strictEqual(provider.enhancedFilters.company,'字节跳动');
    await provider.setQuestionOrder('difficulty');
    assert.strictEqual(provider.enhancedFilters.sort,'topic');
    assert.strictEqual(provider.currentGroupBy,'difficulty');
    assert.strictEqual(provider.enhancedFilters.tag,'数组');
    await provider.setQuestionOrder('category');
    assert.strictEqual(provider.currentGroupBy,'category');
    assert.strictEqual(provider.flatResults,false);
    provider.questionStatusMap=new Map();provider.filter='all';
    await provider.setQuestionOrder('id');
    const ids=provider.ordered().map((q:{frontendQuestionId:string})=>Number(q.frontendQuestionId));
    assert.ok(ids.length>0);
    assert.deepStrictEqual(ids,[...ids].sort((a:number,b:number)=>a-b));
    assert.strictEqual(provider.enhancedFilters.company,'字节跳动');
});


test('Case 面板：脚本语法、保存、运行及切题后拒绝旧消息',async()=>{
    const {CasePanel}=loadProblemPanel('../enhanced/casePanel');
    const data:any={key:'1:acm',id:'1',title:'两数之和',acm:true,fields:['标准输入'],cases:[{values:['2 5'],expected:'7',custom:false}]};
    const stored=new Map(),messages:any[]=[];let handler:any,runs=0;
    const panel=new CasePanel({workspaceState:{get:(k:string,f:any)=>stored.get(k)??f,update:async(k:string,v:any)=>{stored.set(k,v);}}},async()=>data,async()=>{runs++;return{results:[{ok:true,got:'7'}]};});
    panel.resolveWebviewView({onDidDispose:()=>{},webview:{options:{},html:'',onDidReceiveMessage:(h:any)=>{handler=h;},postMessage:async(m:any)=>{messages.push(m);}}});
    await panel.refresh();
    const html=panel.view.webview.html;
    assert.ok(html.includes('新建测试用例'));assert.ok(html.includes('删除当前自定义用例'));
    for(const m of html.matchAll(/<script nonce="[^"]*">([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new Function(m[1]));
    class Element {
        children:any[]=[];textContent='';value='';hidden=false;disabled=false;onclick?:()=>void;oninput?:()=>void;
        replaceChildren(){this.children=[];}append(...nodes:any[]){this.children.push(...nodes);}setAttribute(){}
    }
    const elements=new Map<string,Element>(),sent:any[]=[];let receive:any;
    const dom={getElementById:(id:string)=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)!;},createElement:()=>new Element()};
    const script=[...html.matchAll(/<script nonce="[^"]*">([\s\S]*?)<\/script>/g)][0][1];
    new Function('document','window','acquireVsCodeApi',script)(dom,{addEventListener:(_:string,h:any)=>{receive=h;}},()=>({postMessage:(m:any)=>sent.push(JSON.parse(JSON.stringify(m)))}));
    const tabs=dom.getElementById('cases');
    assert.strictEqual(tabs.children[0].textContent,'Case 1');tabs.children.at(-1).onclick();
    assert.strictEqual(tabs.children[1].textContent,'Case 2');
    const fields=dom.getElementById('fields');fields.children[0].children[1].value='3 4';fields.children[0].children[1].oninput();
    dom.getElementById('run').onclick!();assert.deepStrictEqual(sent.at(-1).cases[1].values,['3 4']);assert.strictEqual(sent.at(-1).index,1);
    receive({data:{key:data.key,type:'result',result:{results:[{ok:true,got:'7'}]}}});
    assert.strictEqual(dom.getElementById('results').hidden,false);
    dom.getElementById('remove').onclick!();assert.strictEqual(tabs.children.length,2);
    await handler({type:'run',key:data.key,cases:data.cases,index:0});
    assert.strictEqual(runs,1);assert.ok(stored.has('casePanel:1:acm'));
    data.key='2:acm';await handler({type:'run',key:'1:acm',cases:data.cases,index:0});assert.strictEqual(runs,1);
    assert.ok(messages.some(m=>m.type==='result'));
});

test('ACM 本机通过与官网共用完成状态，重复通过只记录同一题',async()=>{
    const {Hot100Provider}=loadProblemPanel('../views/hot100Provider');
    const provider=Object.create(Hot100Provider.prototype),state=new Map();
    provider.store={get:(k:string,f:any)=>state.get(k)??f,update:async(k:string,v:any)=>{state.set(k,v);}};
    provider.questionStatusMap=new Map();provider.solvedDates=new Set();provider.solvedIdsByDate=new Map();provider.rerender=()=>{};
    await provider.recordLocalResult('1',false);assert.strictEqual(provider.isSolved('1'),false);
    await provider.recordLocalResult('1',true);await provider.recordLocalResult('1',true);
    assert.strictEqual(provider.isSolved('1'),true);assert.deepStrictEqual(state.get('enhancedLocalPassed'),{'1':true});
    assert.strictEqual([...provider.solvedIdsByDate.values()][0].size,1);
    provider.questionStatusMap.set('1','ac');assert.strictEqual(provider.isSolved('1'),true);
});

test('多语言 ACM 使用题目评测规则，允许无需排序的答案',()=>{
    const script=`const assert=require('assert/strict'),{evaluate}=require('./engine');
    (async()=>{const p={acm:{judge:'unordered-lines'}};
    const r=await evaluate(p,'javascript','acm','console.log("2 1\\\\n1 2")',[{input:'',output:'1 2\\n2 1'}]);
    assert.equal(r.results[0].ok,true);
    const wrong=await evaluate(p,'javascript','acm','console.log("wrong")',[{input:'',output:'1 2'}]);assert.equal(wrong.results[0].ok,false);
    })().catch(e=>{console.error(e);process.exitCode=1;});`;
    const r=spawnSync(process.execPath,['-e',script],{cwd:path.resolve(__dirname,'../..'),encoding:'utf8',timeout:15000});
    assert.strictEqual(r.status,0,r.stderr);
});
