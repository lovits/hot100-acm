'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const target = path.join(root, 'vscode-extension/vendor/hot100-sync');
fs.mkdirSync(target, {recursive: true});
for (const file of ['study-plan.js', 'sync-core.js']) fs.copyFileSync(path.join(root, 'dist', file), path.join(target, file));
