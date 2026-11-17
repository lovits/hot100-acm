#!/usr/bin/env node
/**
 * README/MARKETPLACE 同步校验（CI 步 + 本地可跑）：
 * 两文件正文必须一致，唯一允许的差异是 README 文末的 fork 归属块
 * （`---` 分隔线 + fork 声明引用行）——MARKETPLACE 是商店专用版，不得带 fork 说明。
 * 不一致即退出 1，提示以 README 为准同步。
 */
import fs from 'node:fs';

const readme = fs.readFileSync('README.md', 'utf8');
const marketplace = fs.readFileSync('MARKETPLACE.md', 'utf8');

/** 剥离 README 文末 fork 块（分隔线 + 空行 + fork 引用行）与两文件尾部空白 */
function normalize(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n?---\n\n> 本项目 fork 自 [^\n]*\n?$/, '\n')
    .replace(/\s+$/, '') + '\n';
}

const a = normalize(readme);
const b = normalize(marketplace);
if (a !== b) {
  console.error('✗ README.md 与 MARKETPLACE.md 正文不一致（除文末 fork 块外应完全相同）。');
  console.error('  改 README 正文时请同步 MARKETPLACE.md（商店详情页取自后者，见 AGENTS.md 打包说明）。');
  const al = a.split('\n');
  const bl = b.split('\n');
  for (let i = 0; i < Math.max(al.length, bl.length); i++) {
    if (al[i] !== bl[i]) {
      console.error(`  首处差异在第 ${i + 1} 行：\n    README:     ${al[i] ?? '<文件尾>'}\n    MARKETPLACE: ${bl[i] ?? '<文件尾>'}`);
      break;
    }
  }
  process.exit(1);
}
console.log('✔ README.md 与 MARKETPLACE.md 正文一致（fork 块除外）');
