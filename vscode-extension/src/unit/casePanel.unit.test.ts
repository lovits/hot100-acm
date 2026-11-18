import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import {officialInput,caseFields,seedCases} from '../enhanced/caseInputs';
test('官方测试参数按参数顺序逐行序列化，拒绝格式错误',()=>{
 assert.equal(officialInput(['[2,7,11,15]','9']),'[2,7,11,15]\n9');
 assert.throws(()=>officialInput(['not json']));
});
test('核心代码使用官方参数及示例，设计类以两个字段填写',()=>{
 const p={core:{params:[{name:'local'}]},acm:{examples:[{}]}};
 const q={metaData:JSON.stringify({params:[{name:'nums'},{name:'target'}]}),exampleTestcases:'[2,7]\n9\n[3,3]\n6'};
 assert.deepEqual(caseFields(q,p),['nums','target']);
 assert.equal(seedCases(q,p,[],false).length,2);
 assert.deepEqual(seedCases(q,p,[],false)[1].values,['[3,3]','6']);
 assert.deepEqual(caseFields({metaData:'{"systemdesign":true}'},p),['操作名称数组','每次操作的参数数组']);
});
test('ACM 示例保持完整标准输入、期望输出与示例数量',()=>{
 const p={acm:{examples:[{},{}]}};
 const cases=seedCases({},p,[{input:'2\n3 4\n',output:'7'},{input:'0\n',output:'0'},{input:'1',output:'1'}],true);
 assert.equal(cases.length,2);assert.equal(cases[0].values[0],'2\n3 4\n');assert.equal(cases[0].custom,false);
});
