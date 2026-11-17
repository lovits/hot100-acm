import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import {cppEditorSource} from '../enhanced/codeTemplates';
test('C++ 核心模板补齐标准头与命名空间，保留解题代码且可重复执行',()=>{
 const source='class Solution { public: int trap(vector<int>& h) { return 123; } };';
 const result=cppEditorSource(source,true);
 assert.ok(result.includes('#include "bits/stdc++.h"'));assert.ok(result.includes('using namespace std;'));assert.ok(result.includes(source));assert.equal(cppEditorSource(result,true),result);
});
test('ACM GNU umbrella 使用本地兼容头，保留 main',()=>{
 const source='#include <bits/stdc++.h>\nusing namespace std;\nint main(){return 0;}';
 const result=cppEditorSource(source);
 assert.ok(result.includes('#include "bits/stdc++.h"'));assert.ok(result.includes('int main(){return 0;}'));assert.equal(cppEditorSource(result),result);
});
test('树和链表辅助声明仅供 IntelliSense 使用',()=>{
 const result=cppEditorSource('class Solution { TreeNode* f(TreeNode* p){return p;} };',true);
 assert.ok(result.includes('#ifdef __INTELLISENSE__'));assert.ok(result.includes('struct TreeNode'));assert.equal(cppEditorSource(result,true),result);
});
