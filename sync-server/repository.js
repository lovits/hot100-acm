'use strict';
const {createHash} = require('node:crypto');
const {gzipSync} = require('node:zlib');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const {ClientError} = require('./validation');

const USER = 'personal';
const parseJson = value => typeof value === 'string' ? JSON.parse(value) : value;
const milliseconds = value => value ? new Date(String(value).replace(' ', 'T') + 'Z').getTime() : 0;
const asDate = value => value ? new Date(value) : null;
const hashContent = (code, note) => createHash('sha256').update(JSON.stringify([code, note])).digest('hex');

class Repository {
  constructor(pool) { this.pool = pool; }
  async init() {
    const sql = readFileSync(path.join(__dirname, 'migrations.sql'), 'utf8');
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await this.pool.query(statement);
    const [columns] = await this.pool.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_progress' AND COLUMN_NAME = 'favorite_at'");
    if (!columns.length) await this.pool.query('ALTER TABLE problem_progress ADD COLUMN favorite_at DATETIME(6) NULL');
    const [planColumns] = await this.pool.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sync_meta' AND COLUMN_NAME = 'plan_epoch'");
    if (!planColumns.length) await this.pool.query('ALTER TABLE sync_meta ADD COLUMN plan_epoch BIGINT UNSIGNED NOT NULL DEFAULT 0');
    const [requestColumns] = await this.pool.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sync_requests' AND COLUMN_NAME = 'request_hash'");
    if (!requestColumns.length) await this.pool.query("ALTER TABLE sync_requests ADD COLUMN request_hash CHAR(64) NOT NULL DEFAULT ''");
    await this.pool.query('INSERT IGNORE INTO sync_meta (user_id) VALUES (?)', [USER]);
  }
  async transaction(fn) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT data_epoch, plan_epoch, revision, plan_settings_json FROM sync_meta WHERE user_id=? FOR UPDATE', [USER]);
      const result = await fn(conn, rows[0]);
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally { conn.release(); }
  }
  async changes(conn, revision) {
    const [rows] = await conn.query('SELECT revision, sequence_no AS sequence, kind, entity_key AS entityKey, value_json AS value FROM sync_changes WHERE user_id=? AND revision>? ORDER BY revision, sequence_no', [USER, revision]);
    return rows.map(row => ({...row, revision: Number(row.revision), value: parseJson(row.value)}));
  }
  async pull(epoch, after) {
    return this.transaction(async (conn, meta) => {
      const currentEpoch = Number(meta.data_epoch), revision = Number(meta.revision);
      if (epoch !== currentEpoch) throw new ClientError('DATA_EPOCH_MISMATCH', 409);
      if (after > revision) throw new ClientError('INVALID_REVISION', 409);
      return {epoch: currentEpoch, planEpoch: Number(meta.plan_epoch), revision, changes: await this.changes(conn, after)};
    });
  }
  async sync(body) {
    return this.transaction(async (conn, meta) => {
      const epoch = Number(meta.data_epoch), previous = Number(meta.revision);
      if (body.epoch !== epoch) throw new ClientError('DATA_EPOCH_MISMATCH', 409);
      if (body.baseRevision > previous) throw new ClientError('INVALID_REVISION', 409);
      if (body.planEpoch !== Number(meta.plan_epoch) && body.operations.some(op => op.kind === 'learned' || op.kind === 'event')) throw new ClientError('PLAN_EPOCH_MISMATCH', 409);
      const requestHash = createHash('sha256').update(JSON.stringify(body.operations)).digest('hex');
      const [requests] = await conn.query('SELECT revision, request_hash FROM sync_requests WHERE user_id=? AND device_id=? AND request_id=?', [USER, body.deviceId, body.requestId]);
      if (requests.length && requests[0].request_hash !== requestHash) throw new ClientError('REQUEST_ID_REUSED', 409);
      if (!requests.length) {
        const revision = previous + 1;
        let sequence = 0;
        const emit = async (kind, key, value) => conn.query('INSERT INTO sync_changes VALUES (?,?,?,?,?,?)', [USER, revision, sequence++, kind, key, JSON.stringify(value)]);
        for (const op of body.operations) await this.apply(conn, op, body.deviceId, emit);
        if (sequence) await conn.query('UPDATE sync_meta SET revision=? WHERE user_id=?', [revision, USER]);
        await conn.query('INSERT INTO sync_requests (user_id,device_id,request_id,request_hash,revision) VALUES (?,?,?,?,?)', [USER, body.deviceId, body.requestId, requestHash, sequence ? revision : previous]);
      }
      const [latest] = await conn.query('SELECT revision FROM sync_meta WHERE user_id=?', [USER]);
      return {epoch, planEpoch: Number(meta.plan_epoch), revision: Number(latest[0].revision), changes: await this.changes(conn, body.baseRevision)};
    });
  }
  async apply(conn, op, deviceId, emit) {
    if (op.kind === 'progress') return this.progress(conn, op, emit);
    if (op.kind === 'learned') return this.learned(conn, op, emit);
    if (op.kind === 'event') return this.event(conn, op, emit);
    if (op.kind === 'draft') return this.draft(conn, op, deviceId, emit);
    if (op.kind === 'submission') return this.submission(conn, op, emit);
    if (op.kind === 'settings') return this.settings(conn, op, emit);
    if (op.kind === 'recovery') return this.recovery(conn, op, emit);
    throw new ClientError('INVALID_OPERATION');
  }
  async progress(conn, op, emit) {
    const [rows] = await conn.query('SELECT * FROM problem_progress WHERE user_id=? AND problem_id=?', [USER, op.id]);
    const prior = rows[0];
    const solvedAt = Math.max(op.solvedAt, milliseconds(prior?.solved_at));
    const resetAt = Math.max(op.resetAt, milliseconds(prior?.reset_at));
    const favoriteAt = Math.max(op.favoriteAt, milliseconds(prior?.favorite_at));
    const favorite = op.favoriteAt > milliseconds(prior?.favorite_at) ? op.favorite : !!prior?.favorite;
    const value = {id: op.id, solvedAt, resetAt, solved: solvedAt > resetAt, favorite, favoriteAt};
    if (prior && solvedAt === milliseconds(prior.solved_at) && resetAt === milliseconds(prior.reset_at) && favoriteAt === milliseconds(prior.favorite_at)) return emit('progress', op.id, value);
    await conn.query('INSERT INTO problem_progress (user_id,problem_id,solved,favorite,solved_at,reset_at,favorite_at) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE solved=VALUES(solved),favorite=VALUES(favorite),solved_at=VALUES(solved_at),reset_at=VALUES(reset_at),favorite_at=VALUES(favorite_at)', [USER, op.id, value.solved, favorite, asDate(solvedAt), asDate(resetAt), asDate(favoriteAt)]);
    await emit('progress', op.id, value);
  }
  async learned(conn, op, emit) {
    const [rows] = await conn.query('SELECT * FROM study_plan_learned WHERE user_id=? AND problem_id=?', [USER, op.id]);
    if (rows.length && op.updatedAt <= milliseconds(rows[0].updated_at)) {
      const prior = rows[0], deleted = !!prior.deleted_at;
      return emit('learned', op.id, {kind:'learned', id:op.id, updatedAt:milliseconds(prior.updated_at), deleted, ...(!deleted ? {first:prior.first_date, last:prior.last_date, stage:prior.stage, due:prior.due_date || ''} : {})});
    }
    await conn.query('INSERT INTO study_plan_learned (user_id,problem_id,first_date,last_date,stage,due_date,deleted_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE first_date=VALUES(first_date),last_date=VALUES(last_date),stage=VALUES(stage),due_date=VALUES(due_date),deleted_at=VALUES(deleted_at),updated_at=VALUES(updated_at)', [USER, op.id, op.deleted ? null : op.first, op.deleted ? null : op.last, op.deleted ? 0 : op.stage, op.deleted || !op.due ? null : op.due, op.deleted ? asDate(op.updatedAt) : null, asDate(op.updatedAt)]);
    await emit('learned', op.id, op);
  }
  async event(conn, op, emit) {
    const [result] = await conn.query('INSERT IGNORE INTO study_events (user_id,problem_id,event_date,kind,source,created_at) VALUES (?,?,?,?,?,?)', [USER, op.id, op.date, op.eventKind, op.source, asDate(op.createdAt)]);
    if (result.affectedRows) return emit('event', `${op.id}:${op.date}`, op);
    const [rows] = await conn.query('SELECT kind,source,created_at FROM study_events WHERE user_id=? AND problem_id=? AND event_date=?', [USER,op.id,op.date]);
    return emit('event', `${op.id}:${op.date}`, {kind:'event', id:op.id, date:op.date, eventKind:rows[0].kind, source:rows[0].source, createdAt:milliseconds(rows[0].created_at)});
  }
  async draft(conn, op, deviceId, emit) {
    const [rows] = await conn.query('SELECT * FROM code_drafts_notes WHERE user_id=? AND problem_id=? AND lang=? AND mode=?', [USER, op.id, op.lang, op.mode]);
    const prior = rows[0], hash = hashContent(op.code, op.note), key = `${op.id}:${op.lang}:${op.mode}`;
    if (prior?.content_hash === hash) return emit('draft', key, {id:op.id, lang:op.lang, mode:op.mode, code:prior.code_text, note:prior.note_text, hash, deviceId:prior.device_id});
    if (prior && prior.content_hash !== op.baseHash) {
      const [result] = await conn.query('INSERT INTO sync_conflicts (user_id,problem_id,lang,mode,code_text,note_text,content_hash,device_id) VALUES (?,?,?,?,?,?,?,?)', [USER, op.id, op.lang, op.mode, op.code, op.note, hash, deviceId]);
      await emit('conflict', String(result.insertId), {id: Number(result.insertId), problemId: op.id, lang: op.lang, mode: op.mode, code: op.code, note: op.note, hash, deviceId});
      return;
    }
    await conn.query('INSERT INTO code_drafts_notes (user_id,problem_id,lang,mode,code_text,note_text,content_hash,device_id) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE code_text=VALUES(code_text),note_text=VALUES(note_text),content_hash=VALUES(content_hash),device_id=VALUES(device_id)', [USER, op.id, op.lang, op.mode, op.code, op.note, hash, deviceId]);
    await emit('draft', key, {id: op.id, lang: op.lang, mode: op.mode, code: op.code, note: op.note, hash, deviceId});
  }
  async submission(conn, op, emit) {
    const [result] = await conn.query('INSERT IGNORE INTO sync_submissions VALUES (?,?,?,?)', [USER, op.submissionId, op.id, JSON.stringify(op.value)]);
    if (result.affectedRows) return emit('submission', op.submissionId, op);
    const [rows] = await conn.query('SELECT problem_id,value_json FROM sync_submissions WHERE user_id=? AND submission_id=?', [USER,op.submissionId]);
    return emit('submission', op.submissionId, {kind:'submission', id:rows[0].problem_id, submissionId:op.submissionId, value:parseJson(rows[0].value_json)});
  }
  async settings(conn, op, emit) {
    const [rows] = await conn.query('SELECT plan_settings_json FROM sync_meta WHERE user_id=?', [USER]);
    const previous = parseJson(rows[0].plan_settings_json);
    if (previous && previous.updatedAt >= op.updatedAt) return emit('settings', 'plan', {kind:'settings', ...previous});
    await conn.query('UPDATE sync_meta SET plan_settings_json=? WHERE user_id=?', [JSON.stringify({value: op.value, updatedAt: op.updatedAt}), USER]);
    await emit('settings', 'plan', op);
  }
  async recovery(conn, op, emit) {
    const [rows] = await conn.query('SELECT value_json FROM sync_recoveries WHERE user_id=? AND recovery_id=?', [USER, op.recoveryId]);
    if (rows.length) {
      const prior = parseJson(rows[0].value_json);
      if (prior.value !== op.value || prior.key !== op.key || prior.id !== op.id || prior.time !== op.time) throw new ClientError('RECOVERY_ID_CONFLICT', 409);
      return emit('recovery', op.recoveryId, prior);
    }
    await conn.query('INSERT INTO sync_recoveries VALUES (?,?,?)', [USER, op.recoveryId, JSON.stringify(op)]);
    return emit('recovery', op.recoveryId, op);
  }
  async resetReceipt(conn, deviceId, requestId, hash) {
    const [rows] = await conn.query('SELECT request_hash,result_json FROM sync_reset_receipts WHERE user_id=? AND device_id=? AND request_id=?', [USER, deviceId, requestId]);
    if (!rows.length) return null;
    if (rows[0].request_hash !== hash) throw new ClientError('REQUEST_ID_REUSED', 409);
    return parseJson(rows[0].result_json);
  }
  async saveResetReceipt(conn, deviceId, requestId, hash, result) {
    await conn.query('INSERT INTO sync_reset_receipts VALUES (?,?,?,?,?)', [USER, deviceId, requestId, hash, JSON.stringify(result)]);
  }
  async resetAll(epoch, revision, deviceId, requestId) {
    return this.transaction(async (conn, meta) => {
      const hash = createHash('sha256').update(JSON.stringify(['all', epoch, revision])).digest('hex');
      const receipt = await this.resetReceipt(conn, deviceId, requestId, hash);
      if (receipt) return receipt;
      if (epoch !== Number(meta.data_epoch)) throw new ClientError('DATA_EPOCH_MISMATCH', 409);
      if (revision !== Number(meta.revision)) throw new ClientError('REVISION_MISMATCH', 409);
      const tables = ['sync_meta', 'problem_progress', 'study_plan_learned', 'study_events', 'code_drafts_notes', 'sync_conflicts', 'sync_submissions', 'sync_recoveries'];
      const snapshot = {};
      for (const table of tables) {
        const [rows] = await conn.query(`SELECT * FROM ${table} WHERE user_id=?`, [USER]);
        snapshot[table] = rows;
      }
      await conn.query('INSERT INTO sync_snapshots (user_id,reason,payload_gzip) VALUES (?,?,?)', [USER, 'before_reset_all', gzipSync(Buffer.from(JSON.stringify(snapshot)))]);
      for (const table of tables.filter(t => t !== 'sync_meta')) await conn.query(`DELETE FROM ${table} WHERE user_id=?`, [USER]);
      await conn.query('DELETE FROM sync_changes WHERE user_id=?', [USER]);
      await conn.query('DELETE FROM sync_requests WHERE user_id=?', [USER]);
      await conn.query('UPDATE sync_meta SET data_epoch=data_epoch+1,plan_epoch=plan_epoch+1,revision=revision+1,plan_settings_json=NULL WHERE user_id=?', [USER]);
      const result = {epoch: epoch + 1, planEpoch: Number(meta.plan_epoch) + 1, revision: revision + 1};
      await this.saveResetReceipt(conn, deviceId, requestId, hash, result);
      return result;
    });
  }
  async resetPlan(epoch, planEpoch, revision, deviceId, requestId) {
    return this.transaction(async (conn, meta) => {
      const hash = createHash('sha256').update(JSON.stringify(['plan', epoch, planEpoch, revision])).digest('hex');
      const receipt = await this.resetReceipt(conn, deviceId, requestId, hash);
      if (receipt) return receipt;
      if (epoch !== Number(meta.data_epoch)) throw new ClientError('DATA_EPOCH_MISMATCH', 409);
      if (planEpoch !== Number(meta.plan_epoch)) throw new ClientError('PLAN_EPOCH_MISMATCH', 409);
      if (revision !== Number(meta.revision)) throw new ClientError('REVISION_MISMATCH', 409);
      await conn.query('DELETE FROM study_plan_learned WHERE user_id=?', [USER]);
      await conn.query('DELETE FROM study_events WHERE user_id=?', [USER]);
      const value = {planEpoch: planEpoch + 1};
      await conn.query('INSERT INTO sync_changes VALUES (?,?,?,?,?,?)', [USER, revision + 1, 0, 'plan-reset', 'plan', JSON.stringify(value)]);
      await conn.query('UPDATE sync_meta SET plan_epoch=plan_epoch+1,revision=revision+1 WHERE user_id=?', [USER]);
      const result = {epoch, planEpoch: planEpoch + 1, revision: revision + 1, changes: [{revision: revision + 1, sequence: 0, kind: 'plan-reset', entityKey: 'plan', value}]};
      await this.saveResetReceipt(conn, deviceId, requestId, hash, result);
      return result;
    });
  }
}
module.exports = {Repository, hashContent};
