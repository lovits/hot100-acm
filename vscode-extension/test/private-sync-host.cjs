'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vscode = require('vscode');

exports.run = async () => {
  const ext = vscode.extensions.getExtension('lovits.hot100-practice');
  assert.ok(ext, 'development extension is available');
  const api = await ext.activate(), sync = api.privateSync, ctx = api.enhancements.context;
  const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const file = path.join(root, 'leetcode', 'acm', '1_two-sum.py');
  await fs.mkdir(path.dirname(file), {recursive: true});
  await fs.writeFile(file, 'initial code');
  await ctx.globalState.update('enhancedLocalPassed', {'1': true});
  await ctx.globalState.update('hot100Favorites', ['1']);
  await ctx.globalState.update('enhancedPlan', {learned: {'1': {first: '2026-11-01', last: '2026-11-01', stage: 0, due: '2026-11-02'}}, events: [{id: '1', date: '2026-11-01', kind: 'new', source: 'test'}]});
  const token = 'temporary-test-token-with-32-bytes-or-more';
  sync.request = async (method, route, body) => {
    const response = await fetch('http://127.0.0.1:18890' + route, {method, headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'}, ...(body ? {body: JSON.stringify(body)} : {})});
    const value = await response.json(); if (!response.ok) throw Error(value.error); return value;
  };
  await ctx.globalState.update('hot100PrivateSyncServer', {host: 'test.tailnet.ts.net', address: '100.64.0.1'});
  await ctx.secrets.store('hot100PrivateSyncToken', 'temporary-test-token-with-32-bytes-or-more');
  try { await sync.sync(true); } catch (error) {
    console.log('remaining private test operations', JSON.stringify(sync.core.operations(sync.core.capture(sync.model), sync.model.cloudSync.known)));
    throw error;
  }
  let cloud = sync.model.cloudSync;
  assert.ok(cloud.revision > 0);
  assert.equal(cloud.known.drafts['1:python3:acm'].code, 'initial code');
  await sync.request('POST', '/v1/sync', {epoch:cloud.epoch, planEpoch:cloud.planEpoch, baseRevision:cloud.revision, deviceId:'desktop-test', requestId:'desktop-solved', operations:[{kind:'progress', id:'3', solvedAt:1, resetAt:0, favorite:false, favoriteAt:0}]});
  await sync.sync(true);
  await sync.sync(true);
  assert.equal(api.provider.isSolved('3'), true, 'remote progress survives repeated sync');
  cloud = sync.model.cloudSync;
  const now = Date.now(), ops = [
    {kind: 'progress', id: '1', solvedAt: 1, resetAt: now, favorite: true, favoriteAt: 1},
    {kind: 'learned', id: '1', updatedAt: now, deleted: true},
    {kind: 'draft', id: '1', lang: 'python3', mode: 'acm', code: 'desktop edit', note: null, baseHash: cloud.known.drafts['1:python3:acm'].hash}
  ];
  await sync.request('POST', '/v1/sync', {epoch: cloud.epoch, planEpoch: cloud.planEpoch, baseRevision: cloud.revision, deviceId: 'desktop-test', requestId: 'desktop-1', operations: ops});
  await sync.sync(true);
  assert.equal(api.provider.isSolved('1'), false);
  assert.equal(await fs.readFile(file, 'utf8'), 'desktop edit');
  assert.equal(ctx.globalState.get('enhancedPlan').learned['1'], undefined);
  const doc = await vscode.workspace.openTextDocument(file);
  const edit = new vscode.WorkspaceEdit();
  edit.replace(doc.uri, new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), 'unsaved local edit');
  assert.equal(await vscode.workspace.applyEdit(edit), true);
  cloud = sync.model.cloudSync;
  await sync.request('POST', '/v1/sync', {epoch: cloud.epoch, planEpoch: cloud.planEpoch, baseRevision: cloud.revision, deviceId: 'desktop-test', requestId: 'desktop-2', operations: [{kind: 'draft', id: '1', lang: 'python3', mode: 'acm', code: 'another desktop edit', note: null, baseHash: cloud.known.drafts['1:python3:acm'].hash}]});
  await sync.sync(true);
  assert.equal(doc.getText(), 'unsaved local edit');
  assert.ok(sync.model.conflicts.length > 0, 'concurrent version retained');
  await sync.resetPlan();
  await sync.sync(true);
  const meta = await sync.request('GET', '/v1/meta');
  assert.equal(meta.planEpoch, 1, 'plan reset reaches the server');
  assert.equal(ctx.globalState.get('enhancedPlan').events.length, 0);
  assert.equal(doc.getText(), 'unsaved local edit', 'plan reset preserves unsaved code');
  await api.enhancements.record('2', true, 'test', false);
  await sync.sync(true);
  const afterReset = ctx.globalState.get('enhancedPlan');
  assert.equal(afterReset.events.length, 1);
  assert.equal(afterReset.events[0].id, '2');
  assert.ok(afterReset.events[0].createdAt > afterReset.resetAt);
  const latest = await sync.request('GET', `/v1/changes?epoch=${meta.epoch}&after=${meta.revision}`);
  assert.ok(latest.changes.some(change => change.kind === 'event' && change.value.id === '2'));
  console.log('Private VS Code sync integration passed');
};
