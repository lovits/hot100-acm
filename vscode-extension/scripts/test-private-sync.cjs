'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {runTests} = require('@vscode/test-electron');

if (process.env.HOT100_TEST_DB !== '1') throw Error('This test requires the isolated Hot100 test database and API.');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hot100-vscode-private-test-'));
const workspace = path.join(temp, 'workspace'); fs.mkdirSync(workspace);
runTests({
  vscodeExecutablePath: '/Applications/Visual Studio Code.app/Contents/MacOS/Code',
  extensionDevelopmentPath: path.resolve(__dirname, '..'),
  extensionTestsPath: path.resolve(__dirname, '../test/private-sync-host.cjs'),
  extensionTestsEnv: {HOME: temp, USERPROFILE: temp, LOCALAPPDATA: path.join(temp, 'local-app-data')},
  launchArgs: [workspace, '--user-data-dir', path.join(temp, 'user'), '--extensions-dir', path.join(temp, 'extensions'), '--disable-extensions', '--disable-telemetry', '--disable-workspace-trust', '--skip-welcome', '--disable-updates']
}).then(code => {process.exitCode = code;}).catch(error => {console.error(error);process.exitCode = 1;});
