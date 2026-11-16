// Exercise persistence independently from the browser UI, using controlled server responses.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const source = fs.readFileSync('dist/local.js', 'utf8');
const badge = {textContent: ''};
const requests = [];
let writes = 0;
const context = vm.createContext({
  state: {}, KEY: 'hot100-acm-v1',
  $: () => badge, localStorage: {setItem() {}, removeItem() {}},
  setTimeout: () => 0, clearTimeout() {}, setInterval() {},
  fetch: async (url, options) => {
    requests.push({url, token: options?.headers?.['X-Hot100-Token']});
    if (url === '/api/session') return {ok: true, json: async () => ({token: 'renewed-token', dataDirectory: 'test-only', revision: 2, state: {notes: {'49': 'remote note'}, accepted: [49]}})};
    if (writes++ === 0) return {ok: false, status: 403, json: async () => ({error: 'expired token'})};
    assert.equal(options.headers['X-Hot100-Token'], 'renewed-token');
    const saved = JSON.parse(options.body);
    assert.equal(saved.revision, 2);
    assert.equal(saved.state.codes['1'], 'print("local")');
    assert.equal(saved.state.notes['49'], 'remote note');
    return {ok: true, status: 200, json: async () => ({revision: 3})};
  },
});
vm.runInContext(source.slice(0, source.indexOf('async function createEditor')), context);
const checks = [];
function test(name, value) {assert.ok(value, name); checks.push(name);}
const result = JSON.parse(vm.runInContext(`JSON.stringify(mergeState(
  normalizeState({codes:{1:'base'}}),
  normalizeState({codes:{1:'local'},accepted:[1],history:{1:[{time:1,code:'old',verdict:'Accepted'}]}}),
  normalizeState({codes:{1:'remote'},accepted:[49],notes:{3:'remote note'}})
))`, context));
test('Concurrent code edits retain local text and a remote recovery copy', result.codes['1'] === 'local' && result.conflicts.some(c => c.id === '1' && c.value === 'remote'));
test('Progress and nonconflicting remote notes survive merging', result.accepted.includes(1) && result.accepted.includes(49) && result.notes['3'] === 'remote note');
test('Legacy submission receives a stable detail route id', result.history['1'][0].id === 'legacy-1-0');
(async () => {
  await vm.runInContext(`(async()=>{
    session={token:'expired-token',revision:1,base:{},directory:'test-only'};
    state=normalizeState({codes:{1:'print("local")'}});
    persist();
    return await flushDisk();
  })()`, context);
  test('An open tab renews its session after server restart and merges disk data', requests.length === 3 && writes === 2 && badge.textContent === '已存储');
  test('Successful retry clears pending save and records the new revision', vm.runInContext('pendingSave===false && session.revision===3', context));
  const report = {passed: checks.length, checks};
  fs.writeFileSync('reference/frontend-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
})().catch(error => {console.error(error); process.exitCode = 1;});
