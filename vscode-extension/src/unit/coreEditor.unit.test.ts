import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import {coreEditorSource} from '../enhanced/codeTemplates';

test('Python 官方空方法补 pass，多方法与已有实现保留',()=>{
    const source='class Solution:\n    def first(self, n: int) -> int:\n        \n    def second(self):\n        # TODO\n';
    const fixed=coreEditorSource(source,'python3');
    assert.equal((fixed.match(/        pass/g)||[]).length,2);
    const implemented='class Solution:\n    def f(self):\n        return 7\n';
    assert.equal(coreEditorSource(implemented,'python3'),'from typing import *\n'+implemented);
    assert.equal(coreEditorSource('class Solution {};','cpp'),'class Solution {};');
});

test('100 题的 Python 初始模板在两种模式均可解析',()=>{
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
    const rows=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../data/problems.json'),'utf8'));
    const sources=rows.flatMap((p:any)=>[
        {name:p.id+':official-core',code:coreEditorSource(p.officialTemplates.python3,'python3')},
        {name:p.id+':training-core',code:p.core.templates.python3},
        {name:p.id+':acm',code:p.acm.template.python3}
    ]);
    const r=spawnSync('python3',['-c','import json,sys\nfor row in json.load(sys.stdin): compile(row["code"],row["name"],"exec")'],{input:JSON.stringify(sources),encoding:'utf8',timeout:10000});
    assert.equal(r.status,0,r.stderr);
});
