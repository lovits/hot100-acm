'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const desktop = require('../native_judge/runner');
const plugin = require('../vscode-extension/runtime/native_judge/runner');

test('static compilation failure retries once with the original dynamic arguments', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hot100-static-fallback-'));
  try {
    const compiler = path.join(dir, process.platform === 'win32' ? 'g++.exe' : 'g++');
    const script = path.join(dir, 'compiler.cjs');
    const log = path.join(dir, 'attempts.txt');
    fs.copyFileSync(process.execPath, compiler);
    fs.writeFileSync(script, `require('node:fs').appendFileSync(${JSON.stringify(log)},process.argv.includes('-static')?'static\\n':'dynamic\\n');if(process.argv.includes('-static'))process.exit(1);process.stdout.write('dynamic-ok');`);
    const args = [script, '-o', path.join(dir, 'a.exe')];
    const result = await desktop.runProcess(compiler, [...args, '-static'], {cwd:dir, phase:'compile'});
    assert.equal(result.code, 0); assert.equal(result.stdout, 'dynamic-ok');
    assert.equal(fs.readFileSync(log, 'utf8'), 'static\ndynamic\n');
    if (process.platform === 'win32') {
      fs.writeFileSync(log, '');
      const pluginResult = await plugin.runProcess(compiler, args, {cwd:dir, phase:'compile'});
      assert.equal(pluginResult.code, 0); assert.equal(pluginResult.stdout, 'dynamic-ok');
      assert.equal(fs.readFileSync(log, 'utf8'), 'static\ndynamic\n');
    }
  } finally { fs.rmSync(dir, {recursive:true, force:true}); }
});
