'use strict';
if (process.env.HOT100_TEST_DB !== '1') throw Error('Only the isolated test database may be reset');
const mysql = require('mysql2/promise');
const {Repository} = require('../repository');
(async () => {
  const pool = mysql.createPool({host: '127.0.0.1', port: 18767, user: 'sync_test', password: 'temporary-sync-test-password', database: 'hot100_sync_test', dateStrings: true, timezone: 'Z'});
  try {
    const [[row]] = await pool.query('SELECT DATABASE() AS name');
    if (row.name !== 'hot100_sync_test') throw Error('Unexpected test database');
    const repo = new Repository(pool); await repo.init();
    for (const table of ['sync_changes', 'sync_requests', 'sync_reset_receipts', 'sync_conflicts', 'sync_submissions', 'sync_recoveries', 'sync_snapshots', 'problem_progress', 'study_plan_learned', 'study_events', 'code_drafts_notes', 'sync_meta']) await pool.query(`DELETE FROM ${table}`);
    await repo.init();
  } finally { await pool.end(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
