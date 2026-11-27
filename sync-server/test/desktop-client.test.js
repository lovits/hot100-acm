'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const {webcrypto} = require('node:crypto');
const mysql = require('mysql2/promise');
const {Repository} = require('../repository');

const root = path.join(__dirname, '../..');
const token = 'temporary-test-token-with-32-bytes-or-more';
const api = 'http://127.0.0.1:18889';
function makeState() {
  return {accepted: [], favorites: [], progressMeta: {}, studyPlan: {learned: {}, learnedMeta: {}, events: []}, studySettings: {dailyGoal: 5, reviewLimit: 20, intervals: [1, 2, 4, 7, 15, 30]}, codes: {}, notes: {}, history: {}, conflicts: []};
}
function client(state) {
  const context = vm.createContext({state, console, TextEncoder, crypto: webcrypto, navigator: {onLine: true}, models: new Map(), session: {token: 'local'}, $: () => null, persist: () => {}, flushDisk: async () => true, renderList: () => {}, renderContent: () => {}, updateStudyBadge: () => {}});
  for (const file of ['study-plan.js', 'sync-core.js', 'sync-controller.js']) vm.runInContext(fs.readFileSync(path.join(root, 'dist', file), 'utf8'), context, {filename: file});
  context.httpCloud = async (method, route, body, query) => {
    const url = new URL(api + route); for (const [key, value] of Object.entries(query || {})) url.searchParams.set(key, value);
    const response = await fetch(url, {method, headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'}, ...(body ? {body: JSON.stringify(body)} : {})});
    const value = await response.json();
    if (!response.ok) { const error = new Error(value.error); error.status = response.status; throw error; }
    if (context.dropNextResponse && method === 'POST') { context.dropNextResponse = false; throw Error('simulated disconnect after commit'); }
    return value;
  };
  vm.runInContext('cloudConfigured=true; cloudRequest=httpCloud;', context);
  return context;
}
const sync = ctx => vm.runInContext('runCloudSync()', ctx);

test('two desktop clients synchronize offline progress and preserve concurrent drafts', {skip: process.env.HOT100_TEST_DB !== '1'}, async () => {
  const pool = mysql.createPool({host: '127.0.0.1', port: 18767, user: 'sync_test', password: 'temporary-sync-test-password', database: 'hot100_sync_test', dateStrings: true, timezone: 'Z'});
  const repo = new Repository(pool);
  await repo.init();
  for (const table of ['sync_changes', 'sync_requests', 'sync_reset_receipts', 'sync_conflicts', 'sync_submissions', 'sync_recoveries', 'sync_snapshots', 'problem_progress', 'study_plan_learned', 'study_events', 'code_drafts_notes', 'sync_meta']) await pool.query(`DELETE FROM ${table}`);
  await repo.init();
  const server = spawn(process.execPath, ['server.js'], {cwd: path.join(root, 'sync-server'), env: {...process.env, MYSQL_HOST: '127.0.0.1', MYSQL_PORT: '18767', MYSQL_USER: 'sync_test', MYSQL_PASSWORD: 'temporary-sync-test-password', MYSQL_DATABASE: 'hot100_sync_test', SYNC_TOKEN: token, PORT: '18889'}, stdio: ['ignore', 'pipe', 'pipe']});
  try {
    await Promise.race([once(server.stdout, 'data'), once(server, 'exit').then(() => {throw Error('API failed to start');})]);
    const now = Date.now() - 10000, a = makeState(), b = makeState();
    a.accepted = [1]; a.favorites = [1]; a.progressMeta['1'] = {solvedAt: now, resetAt: 0, favoriteAt: now};
    a.studyPlan = {learned: {'1': {first: '2026-11-01', last: '2026-11-01', stage: 0, due: '2026-11-02'}}, learnedMeta: {'1': {at: now, deleted: false}}, events: [{id: '1', date: '2026-11-01', kind: 'new', source: 'test', createdAt: now}]};
    a.codes['1'] = 'initial'; a.notes['1'] = 'note';
    a.conflicts.push({key:'codes',id:'1',value:'previous local recovery',time:now});
    const ca = client(a), cb = client(b);
    try { await sync(ca); await sync(cb); } catch (error) {
      console.log('remaining-a', vm.runInContext('JSON.stringify(Hot100SyncCore.operations(Hot100SyncCore.capture(state), state.cloudSync.known))', ca));
      if (b.cloudSync) console.log('remaining-b', vm.runInContext('JSON.stringify(Hot100SyncCore.operations(Hot100SyncCore.capture(state), state.cloudSync.known))', cb));
      throw error;
    }
    assert.deepEqual(b.accepted, [1]); assert.equal(b.codes['1'], 'initial'); assert.equal(b.notes['1'], 'note'); assert.equal(b.studyPlan.events.length, 1);
    assert.ok(b.conflicts.some(c => c.value === 'previous local recovery'));
    const legacy = makeState();
    legacy.accepted = [1]; legacy.favorites = [1];
    legacy.studyPlan = {learned: {'1': {first: '2026-11-01', last: '2026-11-01', stage: 0, due: '2026-11-02'}}, learnedMeta: {}, events: [{id: '1', date: '2026-11-01', kind: 'review', source: 'manual'}]};
    legacy.codes['1'] = 'initial'; legacy.notes['1'] = 'note';
    const cc = client(legacy);
    await sync(cc);
    assert.deepEqual(legacy.accepted, [1]);
    assert.equal(legacy.studyPlan.events[0].kind, 'new');
    assert.ok(legacy.conflicts.some(c => c.key === 'studyEvent'));
    assert.equal(vm.runInContext('Hot100SyncCore.operations(Hot100SyncCore.capture(state),state.cloudSync.known).length', cc), 0);
    a.codes['1'] = 'edit from mac'; b.codes['1'] = 'edit from windows';
    await sync(ca); await sync(cb);
    assert.equal(b.codes['1'], 'edit from mac');
    assert.ok(b.conflicts.some(c => c.value === 'edit from windows'));
    b.accepted = []; b.progressMeta['1'].resetAt = now + 1000;
    b.studyPlan = vm.runInContext('StudyPlan.resetProblem(state.studyPlan, 1, Date.now())', cb);
    await sync(cb); await sync(ca);
    assert.deepEqual(a.accepted, []); assert.equal(a.studyPlan.learned['1'], undefined); assert.equal(a.studyPlan.events.length, 1);
    a.notes['1'] = 'new note'; ca.dropNextResponse = true;
    await assert.rejects(sync(ca), /simulated disconnect/);
    const requestId = a.cloudSync.outbox.body.requestId;
    await sync(ca); assert.equal(a.cloudSync.outbox, null);
    const [rows] = await pool.query('SELECT COUNT(*) AS n FROM sync_requests WHERE request_id=?', [requestId]);
    assert.equal(rows[0].n, 1);
    await sync(cb); assert.equal(b.notes['1'], 'new note');
    a.studyPlan = {learned: {}, learnedMeta: {}, events: [], resetAt: Date.now()};
    a.pendingCloudReset = {kind: 'plan', request: null}; ca.dropNextResponse = true;
    await assert.rejects(sync(ca), /simulated disconnect/);
    const planRequest = a.pendingCloudReset.request.requestId;
    await sync(ca); assert.equal(a.pendingCloudReset, null); assert.equal(a.cloudSync.planEpoch, 1);
    assert.equal((await pool.query('SELECT COUNT(*) AS n FROM sync_reset_receipts WHERE request_id=?', [planRequest]))[0][0].n, 1);
    await sync(cb); assert.equal(b.studyPlan.events.length, 0);
    a.accepted = []; a.favorites = []; a.progressMeta = {}; a.studyPlan = {learned: {}, learnedMeta: {}, events: []}; a.codes = {}; a.notes = {}; a.history = {}; a.conflicts = [];
    a.pendingCloudReset = {kind: 'all', request: null}; ca.dropNextResponse = true;
    await assert.rejects(sync(ca), /simulated disconnect/);
    const resetRequest = a.pendingCloudReset.request.requestId;
    await sync(ca); assert.equal(a.pendingCloudReset, null); assert.equal(a.cloudSync.epoch, 1);
    assert.equal((await pool.query('SELECT COUNT(*) AS n FROM sync_reset_receipts WHERE request_id=?', [resetRequest]))[0][0].n, 1);
    assert.equal((await pool.query('SELECT COUNT(*) AS n FROM sync_snapshots'))[0][0].n, 1);
    await assert.rejects(sync(cb), /DATA_EPOCH_MISMATCH/); assert.equal(b.notes['1'], 'new note');
  } finally { server.kill(); await pool.end(); }
});
