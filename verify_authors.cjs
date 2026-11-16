const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/dist/authors.js', 'utf8');
async function check(response, expected, error) {
  const context = vm.createContext({fetch: async () => response});
  vm.runInContext(source.slice(0, source.indexOf('function authorArticles')), context);
  if (error) await assert.rejects(vm.runInContext('loadAuthorLibrary()', context), error);
  else {
    await vm.runInContext('loadAuthorLibrary()', context);
    assert.equal(vm.runInContext('JSON.stringify(authorLibrary)', context), JSON.stringify(expected));
  }
}
(async () => {
  await check({status:404, ok:false}, []);
  const articles = [{problemId:1,authorSlug:'jyd'}];
  await check({status:200, ok:true,json:async()=>articles}, articles);
  await check({status:500, ok:false}, null, /读取失败/);
  await check({status:200, ok:true,json:async()=>({})}, null, /格式无效/);
  console.log('Author library: missing, installed, server error and invalid index checks passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
