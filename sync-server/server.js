'use strict';
const http = require('node:http');
const {timingSafeEqual} = require('node:crypto');
const mysql = require('mysql2/promise');
const {Repository} = require('./repository');
const {ClientError, check, integer, validateSync} = require('./validation');

const token = process.env.SYNC_TOKEN;
if (!token || Buffer.byteLength(token) < 32) throw new Error('SYNC_TOKEN must contain at least 32 bytes');
const pool = mysql.createPool({host: process.env.MYSQL_HOST || '127.0.0.1', port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE || 'hot100', connectionLimit: 4, timezone: 'Z', dateStrings: true});
const repository = new Repository(pool);

function authorized(req) {
  const supplied = Buffer.from(req.headers.authorization || '');
  const expected = Buffer.from(`Bearer ${token}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
function respond(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
  res.end(body);
}
async function readBody(req) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 5 * 1024 * 1024) throw new ClientError('BODY_TOO_LARGE', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ClientError('INVALID_JSON'); }
}
async function handler(req, res) {
  try {
    if (!authorized(req)) return respond(res, 401, {error: 'UNAUTHORIZED'});
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/v1/meta') {
      const value = await repository.transaction(async (_conn, meta) => ({epoch: Number(meta.data_epoch), planEpoch: Number(meta.plan_epoch), revision: Number(meta.revision)}));
      return respond(res, 200, value);
    }
    if (req.method === 'GET' && url.pathname === '/v1/changes') {
      const epoch = Number(url.searchParams.get('epoch')), after = Number(url.searchParams.get('after'));
      check(url.searchParams.has('epoch') && url.searchParams.has('after') && integer(epoch) && integer(after));
      return respond(res, 200, await repository.pull(epoch, after));
    }
    if (req.method === 'POST' && url.pathname === '/v1/sync') {
      const body = await readBody(req);
      validateSync(body);
      return respond(res, 200, await repository.sync(body));
    }
    if (req.method === 'POST' && url.pathname === '/v1/reset-all') {
      const body = await readBody(req);
      check(body && integer(body.epoch) && integer(body.revision) && typeof body.deviceId === 'string' && body.deviceId.length > 0 && body.deviceId.length <= 128 && typeof body.requestId === 'string' && body.requestId.length > 0 && body.requestId.length <= 128);
      return respond(res, 200, await repository.resetAll(body.epoch, body.revision, body.deviceId, body.requestId));
    }
    if (req.method === 'POST' && url.pathname === '/v1/reset-plan') {
      const body = await readBody(req);
      check(body && integer(body.epoch) && integer(body.planEpoch) && integer(body.revision) && typeof body.deviceId === 'string' && body.deviceId.length > 0 && body.deviceId.length <= 128 && typeof body.requestId === 'string' && body.requestId.length > 0 && body.requestId.length <= 128);
      return respond(res, 200, await repository.resetPlan(body.epoch, body.planEpoch, body.revision, body.deviceId, body.requestId));
    }
    respond(res, 404, {error: 'NOT_FOUND'});
  } catch (error) {
    if (error instanceof ClientError) return respond(res, error.status, {error: error.code});
    console.error('sync request failed:', error.message);
    respond(res, 500, {error: 'INTERNAL_ERROR'});
  }
}
repository.init().then(() => {
  http.createServer(handler).listen(Number(process.env.PORT || 8080), '0.0.0.0', () => console.log('Hot100 sync API listening'));
}).catch(error => { console.error('sync startup failed:', error.message); process.exitCode = 1; });
