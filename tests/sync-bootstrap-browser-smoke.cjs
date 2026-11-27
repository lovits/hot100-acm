'use strict';
// Set HOT100_PLAYWRIGHT to a playwright-core module path and HOT100_BROWSER to a browser executable.
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const {chromium} = require(process.env.HOT100_PLAYWRIGHT || 'playwright-core');

const serverSource = `import sys, local_server
class Transport:
    def __init__(self, directory): pass
    def request(self, method, path, payload=None, query=None): return 200, {'epoch':1,'planEpoch':1,'revision':28}
local_server.SyncTransport = Transport
server=local_server.make_server(int(sys.argv[1]),sys.argv[2])
print('READY',flush=True)
server.serve_forever()
`;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function unusedPort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function setup() {
  const port = await unusedPort();
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'hot100-browser-test-'));
  const server = spawn(process.env.PYTHON || 'python', ['-u', '-c', serverSource, String(port), data], {cwd:path.join(__dirname, '..'), stdio:['ignore','pipe','pipe']});
  let output = ''; server.stdout.on('data', b => output += b); server.stderr.on('data', b => output += b);
  for (let i = 0; i < 100 && !output.includes('READY'); i++) {
    if (server.exitCode !== null) throw Error('test server exited: ' + output);
    await delay(100);
  }
  if (!output.includes('READY')) { server.kill(); throw Error('test server failed to start: ' + output); }
  const browser = await chromium.launch({headless:true, ...(process.env.HOT100_BROWSER ? {executablePath:process.env.HOT100_BROWSER} : {})});
  const context = await browser.newContext(), requests = [], errors = [];
  context.on('page', page => page.on('pageerror', e => errors.push(e.message)));
  await context.route('**/api/sync/status', r => r.fulfill({json:{configured:true}}));
  await context.route('**/api/sync/request', r => {
    const request = r.request().postDataJSON(); requests.push(request);
    let result;
    if (request.method === 'GET' && request.path === '/v1/meta') result = {epoch:1,planEpoch:1,revision:28};
    else if (request.method === 'POST' && request.path === '/v1/sync') result = {revision:29,planEpoch:1,changes:request.body.operations.filter(x=>x.kind==='settings').map(value=>({kind:'settings',entityKey:'settings',value}))};
    else if (request.method === 'GET' && request.path === '/v1/changes') result = {revision:29,planEpoch:1,changes:[]};
    else throw Error('unexpected cloud request');
    return r.fulfill({json:result});
  });
  async function open() {
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`, {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => typeof editor !== 'undefined' && editor.instance && cloudState === 'conflict', {timeout:30000});
    return page;
  }
  async function close() {
    await browser.close();
    if (server.exitCode === null) { server.kill(); await new Promise(resolve => server.once('exit', resolve)); }
  }
  return {open,close,context,requests,errors};
}
async function staleTab() {
  const test = await setup();
  try {
    const a = await test.open();
    await a.evaluate(() => {pickProblem(2);pickProblem(1);switchPractice('cpp','acm');switchPractice('python3','acm');});
    assert.equal(await a.evaluate(() => Hot100SyncCore.isPristine(state)), true);
    assert.equal(await a.evaluate(() => flushDisk()), true);
    const b = await test.open();
    await b.evaluate(() => flushDisk());
    await a.reload({waitUntil:'domcontentloaded'});
    await a.waitForFunction(() => typeof editor !== 'undefined' && editor.instance && cloudState === 'conflict');
    assert.equal(await a.evaluate(() => Hot100SyncCore.isPristine(state) && pristineBrowserStorage()), true);
    assert.equal(test.requests.filter(x => x.method === 'POST').length, 0);
    const syncing = a.evaluate(() => syncCloud(true));
    await a.locator('#cloud-bootstrap-confirm').click(); await syncing;
    const saved = await b.evaluate(async () => { state.codes['1:python3:core'] = 'stale data'; persist(); return flushDisk(); });
    assert.equal(saved, false);
    await b.reload({waitUntil:'domcontentloaded'});
    await b.waitForFunction(() => typeof editor !== 'undefined' && editor.instance);
    assert.equal(await b.evaluate(() => state.codes['1:python3:core'] || ''), '');
    assert.ok(await b.evaluate(() => !!session.storageNamespace));
    assert.equal(await b.evaluate(async () => { editor.setValue('print(42)'); saveCode(); return flushDisk(); }), true);
    await b.reload({waitUntil:'domcontentloaded'});
    await b.waitForFunction(() => typeof editor !== 'undefined' && editor.instance);
    assert.equal(await b.evaluate(() => editor.getValue()), 'print(42)');
    assert.equal(await b.evaluate(() => {caseRows[0]=['custom test input'];saveCases();pickProblem(2);pickProblem(1);return customInput;}), 'custom test input');
    assert.deepEqual(test.errors, []);
  } finally { await test.close(); }
}
async function editDuringBootstrap() {
  const test = await setup();
  try {
    const a = await test.open(), b = await test.open();
    await b.evaluate(() => flushDisk());
    await a.reload({waitUntil:'domcontentloaded'});
    await a.waitForFunction(() => typeof editor !== 'undefined' && editor.instance && cloudState === 'conflict');
    let release, entered;
    const blocked = new Promise(resolve => release = resolve), arrived = new Promise(resolve => entered = resolve);
    await test.context.route('**/api/sync/bootstrap', async route => { entered(); await blocked; await route.continue(); });
    const syncing = a.evaluate(async () => {try {await syncCloud(true); return 'ok';} catch(e) {return e.message;}});
    await a.locator('#cloud-bootstrap-confirm').click();
    await arrived;
    await b.evaluate(() => {state.codes['1'] = 'edit while connecting'; persist();});
    release();
    const result = await syncing;
    assert.match(result, /数据发生变化|本地数据已变化/);
    assert.equal(test.requests.filter(x => x.method === 'POST').length, 0);
    assert.deepEqual(test.errors, []);
  } finally { await test.close(); }
}
(async () => {await staleTab();await editDuringBootstrap();console.log('desktop browser bootstrap, stale tab, concurrent edit, and save/reload passed');})()
  .catch(error => {console.error(error);process.exitCode=1;});
