'use strict';
// The login process uses a disposable browser profile and sends the resulting cookie only to the local server.
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const packaged = path.join(root, 'leetcode_runtime');
const source = path.join(root, 'vscode-extension');
const modulePath = fs.existsSync(path.join(packaged, 'browserLogin.js')) ? path.join(packaged, 'browserLogin.js') : path.join(source, 'out/core/browserLogin.js');
const vendorPath = fs.existsSync(path.join(packaged, 'playwright-core')) ? path.join(packaged, 'playwright-core') : path.join(source, 'vendor/playwright-core');
async function main() {
  const login = require(modulePath);
  const channel = login.pickChromiumChannel(fs.existsSync, process.platform, process.env);
  if (!channel) return {status: 'error', message: '未找到 Chrome 或 Edge，请使用手动 Cookie 登录。'};
  return login.loginWithBrowser({channel, requirePlaywright: () => require(vendorPath)});
}
main().then(result => { process.stdout.write(JSON.stringify(result)); }).catch(() => { process.stdout.write(JSON.stringify({status: 'error', message: '浏览器登录启动失败。'})); });
