'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const http = require('node:http');
const {syncRequest} = require('../out/enhanced/syncNetwork');

const server = {host:'hot100.example.ts.net', address:'100.64.0.1'};
const token = 'a'.repeat(64);
test('sync retries transient GET once and never retries POST or certificate errors', async () => {
  const original = http.ClientRequest;
  let attempts = 0, failure = 'ETIMEDOUT';
  http.ClientRequest = function (_options, callback) {
    const request = new EventEmitter();
    request.end = () => queueMicrotask(() => {
      attempts++;
      if (attempts === 1) return request.emit('error', Object.assign(new Error('test'), {code:failure}));
      const response = new EventEmitter(); response.statusCode = 200;
      callback(response);
      response.emit('data', Buffer.from('{}'));
      response.emit('end');
    });
    return request;
  };
  try {
    assert.deepEqual(await syncRequest(server, token, 'GET', '/v1/meta'), {});
    assert.equal(attempts, 2);
    attempts = 0;
    await assert.rejects(syncRequest(server, token, 'POST', '/v1/sync', {}));
    assert.equal(attempts, 1);
    attempts = 0; failure = 'CERT_HAS_EXPIRED';
    await assert.rejects(syncRequest(server, token, 'GET', '/v1/meta'));
    assert.equal(attempts, 1);
  } finally { http.ClientRequest = original; }
});
