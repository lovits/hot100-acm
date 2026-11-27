'use strict';

class ClientError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
function check(condition, code = 'INVALID_REQUEST') { if (!condition) throw new ClientError(code); }
function integer(value) { return Number.isSafeInteger(value) && value >= 0; }
function timestamp(value) { return integer(value) && value <= Date.now() + 300000; }
function problemId(value) { return typeof value === 'string' && /^\d{1,10}$/.test(value); }
function smallText(value, max) { return typeof value === 'string' && value.length > 0 && value.length <= max; }
function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}
function validateOperation(op) {
  check(op && typeof op === 'object' && !Array.isArray(op));
  if (op.kind === 'settings') {
    check(timestamp(op.updatedAt) && op.value && typeof op.value === 'object' && !Array.isArray(op.value));
    check(Buffer.byteLength(JSON.stringify(op.value)) <= 16384);
    const {dailyGoal, reviewLimit, intervals} = op.value;
    check(Number.isInteger(dailyGoal) && dailyGoal >= 1 && dailyGoal <= 100 && Number.isInteger(reviewLimit) && reviewLimit >= 1 && reviewLimit <= 100);
    check(Array.isArray(intervals) && intervals.length > 0 && intervals.length <= 20 && intervals.every((n, i) => Number.isInteger(n) && n > 0 && n <= 365 && (!i || n > intervals[i - 1])));
    return;
  }
  if (op.kind === 'recovery') {
    check(smallText(op.recoveryId,255) && smallText(op.key,64) && smallText(op.id,128) && timestamp(op.time));
    check(typeof op.value === 'string' && Buffer.byteLength(op.value) <= 1048576);
    return;
  }
  check(problemId(op.id));
  if (op.kind === 'progress') {
    check(timestamp(op.solvedAt) && timestamp(op.resetAt) && timestamp(op.favoriteAt) && typeof op.favorite === 'boolean');
  } else if (op.kind === 'learned') {
    check(timestamp(op.updatedAt) && op.updatedAt > 0 && typeof op.deleted === 'boolean');
    if (!op.deleted) check(day(op.first) && day(op.last) && (op.due === '' || day(op.due)) && integer(op.stage) && op.stage <= 20);
  } else if (op.kind === 'event') {
    check(day(op.date) && ['new', 'review'].includes(op.eventKind) && ['test', 'manual'].includes(op.source));
    check(timestamp(op.createdAt) && op.createdAt > 0);
  } else if (op.kind === 'draft') {
    check(smallText(op.lang, 32) && /^[a-z0-9_+-]+$/.test(op.lang) && ['acm', 'core', 'note'].includes(op.mode));
    check((op.code === null || typeof op.code === 'string') && (op.note === null || typeof op.note === 'string'));
    check(Buffer.byteLength(op.code || '') + Buffer.byteLength(op.note || '') <= 1048576);
    check(op.baseHash === null || (typeof op.baseHash === 'string' && /^[a-f0-9]{64}$/.test(op.baseHash)));
  } else if (op.kind === 'submission') {
    check(smallText(op.submissionId, 128) && op.value && typeof op.value === 'object' && !Array.isArray(op.value));
    check(Buffer.byteLength(JSON.stringify(op.value)) <= 1048576);
  } else {
    throw new ClientError('INVALID_OPERATION');
  }
}
function validateSync(body) {
  check(body && typeof body === 'object' && integer(body.epoch) && integer(body.planEpoch) && integer(body.baseRevision));
  check(smallText(body.deviceId, 128) && smallText(body.requestId, 128) && Array.isArray(body.operations) && body.operations.length <= 1000);
  body.operations.forEach(validateOperation);
}
module.exports = {ClientError, check, integer, validateSync};
