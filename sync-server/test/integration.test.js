'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {gunzipSync} = require('node:zlib');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const mysql = require('mysql2/promise');
const {Repository, hashContent} = require('../repository');
const {validateSync} = require('../validation');

test('transactional sync, concurrent changes, conflict retention, replay and reset', {skip: process.env.HOT100_TEST_DB !== '1'}, async () => {
  const pool = mysql.createPool({host: '127.0.0.1', port: 18767, user: 'sync_test', password: 'temporary-sync-test-password', database: 'hot100_sync_test', dateStrings: true, timezone: 'Z', connectionLimit: 4});
  const repo = new Repository(pool);
  try {
    await repo.init();
    for (const table of ['sync_changes', 'sync_requests', 'sync_reset_receipts', 'sync_conflicts', 'sync_submissions', 'sync_recoveries', 'sync_snapshots', 'problem_progress', 'study_plan_learned', 'study_events', 'code_drafts_notes', 'sync_meta']) await pool.query(`DELETE FROM ${table}`);
    await repo.init();
    const now = Date.now() - 10000;
    const request = (id, baseRevision, operations, epoch = 0, planEpoch = 0) => ({epoch, planEpoch, baseRevision, deviceId: id, requestId: `${id}-${baseRevision}`, operations});
    const a = request('mac', 0, [
      {kind: 'progress', id: '1', solvedAt: now, resetAt: 0, favorite: true, favoriteAt: now},
      {kind: 'event', id: '1', date: '2026-11-27', eventKind: 'new', source: 'test', createdAt: now},
      {kind: 'draft', id: '1', lang: 'python3', mode: 'acm', code: 'original', note: null, baseHash: null}
    ]);
    validateSync(a);
    const initial = await repo.sync(a);
    assert.equal(initial.revision, 1);
    assert.equal(initial.changes.length, 3);
    const originalHash = hashContent('original', null);
    const [reset, edit] = await Promise.all([
      repo.sync(request('win', 1, [{kind: 'progress', id: '1', solvedAt: now, resetAt: now + 1000, favorite: true, favoriteAt: now}])),
      repo.sync(request('mac', 1, [{kind: 'draft', id: '1', lang: 'python3', mode: 'acm', code: 'mac edit', note: null, baseHash: originalHash}]))
    ]);
    assert.deepEqual([reset.revision, edit.revision].sort(), [2, 3]);
    const offlineEdit = {...request('win', 1, [{kind: 'draft', id: '1', lang: 'python3', mode: 'acm', code: 'win edit', note: null, baseHash: originalHash}]), requestId: 'win-offline-edit'};
    const conflict = await repo.sync(offlineEdit);
    assert.equal(conflict.changes.filter(c => c.kind === 'conflict').length, 1);
    assert.equal((await repo.sync(offlineEdit)).revision, conflict.revision);
    await assert.rejects(repo.sync({...offlineEdit, operations: []}), /REQUEST_ID_REUSED/);
    const [drafts] = await pool.query('SELECT code_text FROM code_drafts_notes');
    const [conflicts] = await pool.query('SELECT code_text FROM sync_conflicts');
    assert.equal(drafts[0].code_text, 'mac edit');
    assert.equal(conflicts[0].code_text, 'win edit');
    const [progress] = await pool.query('SELECT solved FROM problem_progress');
    assert.equal(progress[0].solved, 0);
    const planReset = await repo.resetPlan(0, 0, conflict.revision, 'mac', 'reset-plan-1');
    assert.deepEqual(await repo.resetPlan(0, 0, conflict.revision, 'mac', 'reset-plan-1'), planReset);
    await assert.rejects(repo.sync({...a, requestId: 'stale-plan'}), /PLAN_EPOCH_MISMATCH/);
    assert.equal((await pool.query('SELECT COUNT(*) AS n FROM study_events'))[0][0].n, 0);
    assert.equal((await pool.query('SELECT COUNT(*) AS n FROM problem_progress'))[0][0].n, 1);
    await assert.rejects(repo.resetAll(0, 1, 'mac', 'reset-all-stale'), /REVISION_MISMATCH/);
    const result = await repo.resetAll(0, planReset.revision, 'mac', 'reset-all-1');
    assert.deepEqual(await repo.resetAll(0, planReset.revision, 'mac', 'reset-all-1'), result);
    assert.equal(result.epoch, 1);
    await assert.rejects(repo.sync(a), /DATA_EPOCH_MISMATCH/);
    const [snapshots] = await pool.query('SELECT payload_gzip FROM sync_snapshots');
    const snapshot = JSON.parse(gunzipSync(snapshots[0].payload_gzip).toString());
    assert.equal(snapshot.sync_conflicts[0].code_text, 'win edit');
    assert.equal((await repo.pull(1, result.revision)).changes.length, 0);
    const token = 'temporary-test-token-with-32-bytes-or-more';
    const server = spawn(process.execPath, ['server.js'], {cwd: require('node:path').join(__dirname, '..'), env: {...process.env, MYSQL_HOST: '127.0.0.1', MYSQL_PORT: '18767', MYSQL_USER: 'sync_test', MYSQL_PASSWORD: 'temporary-sync-test-password', MYSQL_DATABASE: 'hot100_sync_test', SYNC_TOKEN: token, PORT: '18888'}, stdio: ['ignore', 'pipe', 'pipe']});
    try {
      await Promise.race([once(server.stdout, 'data'), once(server, 'exit').then(() => {throw new Error('API failed to start');})]);
      const url = 'http://127.0.0.1:18888';
      assert.equal((await fetch(url + '/v1/meta')).status, 401);
      const headers = {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'};
      const meta = await (await fetch(url + '/v1/meta', {headers})).json();
      assert.equal(meta.epoch, 1);
      const bad = await fetch(url + '/v1/sync', {method: 'POST', headers, body: JSON.stringify({...request('mac', result.revision, [], 1, result.planEpoch), operations: [{kind: 'progress', id: '1', solvedAt: 'bad'}]})});
      assert.equal(bad.status, 400);
      assert.equal((await (await fetch(url + '/v1/meta', {headers})).json()).revision, result.revision);
    } finally { server.kill(); }
  } finally { await pool.end(); }
});
