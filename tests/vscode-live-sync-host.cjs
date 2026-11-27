'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vscode = require('vscode');

exports.run = async () => {
  const ext = vscode.extensions.getExtension('lovits.hot100-practice');
  assert.ok(ext);
  const api = await ext.activate();
  const sync = api.privateSync, context = api.enhancements.context;
  for (let i = 0; i < 100 && !context.globalState.get('hot100PrivateSyncServer'); i++) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(context.globalState.get('hot100PrivateSyncServer'), 'desktop sync configuration imported');
  await sync.sync(true);
  await sync.sync(true);
  const model = sync.model;
  console.log('VS Code received:', JSON.stringify({revision:model.cloudSync.revision, accepted:model.accepted.length, drafts:Object.keys(model.codes).length, recoveries:model.conflicts.length, knownProgress:Object.keys(model.cloudSync.known.progress).length}));
  assert.ok(model.cloudSync.revision > 0);
  assert.equal(model.cloudSync.outbox, null);
  assert.ok(model.accepted.length >= 3);
  assert.ok(Object.keys(model.codes).length >= 23);
  const folder = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'leetcode');
  const files = await fs.readdir(folder, {recursive: true});
  assert.ok(files.some(file => /\.(py|cpp|java|js|ts|go|rs)$/i.test(file)));
  console.log('VS Code live private sync passed:', JSON.stringify({revision:model.cloudSync.revision, accepted:model.accepted.length, drafts:Object.keys(model.codes).length, recoveries:model.conflicts.length}));
};
