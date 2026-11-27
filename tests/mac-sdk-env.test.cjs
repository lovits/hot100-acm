'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const child = require('node:child_process');

test('macOS compiler SDK discovery is scoped and respects existing settings', () => {
  const platform = Object.getOwnPropertyDescriptor(process, 'platform');
  const originalExec = child.execFileSync;
  const originalSdk = process.env.SDKROOT;
  let calls = 0;
  try {
    Object.defineProperty(process, 'platform', {value:'darwin', configurable:true});
    delete process.env.SDKROOT;
    child.execFileSync = (command, args) => {
      assert.equal(command, '/usr/bin/xcrun');
      assert.deepEqual(args, ['--show-sdk-path']);
      calls++;
      return '/test/MacOSX.sdk\n';
    };
    const runners = [require('../native_judge/runner'), require('../vscode-extension/runtime/native_judge/runner')];
    for (const runner of runners) {
      assert.equal(runner.compilerEnv('/opt/homebrew/bin/g++-16', true).SDKROOT, '/test/MacOSX.sdk');
      assert.equal(process.env.SDKROOT, undefined);
      assert.equal(runner.compilerEnv('/usr/bin/python3', true).SDKROOT, undefined);
      assert.equal(runner.compilerEnv('/usr/bin/clang++', false).SDKROOT, undefined);
      process.env.SDKROOT = '/user/sdk';
      assert.equal(runner.compilerEnv('/usr/bin/clang++', true).SDKROOT, '/user/sdk');
      delete process.env.SDKROOT;
    }
    assert.equal(calls, 2);
    child.execFileSync = () => { throw new Error('xcrun unavailable'); };
    for (const runner of runners) {
      delete require.cache[require.resolve(runner === runners[0] ? '../native_judge/runner' : '../vscode-extension/runtime/native_judge/runner')];
    }
    for (const name of ['../native_judge/runner', '../vscode-extension/runtime/native_judge/runner']) {
      assert.equal(require(name).compilerEnv('/usr/bin/gcc', true).SDKROOT, undefined);
    }
  } finally {
    child.execFileSync = originalExec;
    Object.defineProperty(process, 'platform', platform);
    if (originalSdk === undefined) delete process.env.SDKROOT;
    else process.env.SDKROOT = originalSdk;
  }
});
