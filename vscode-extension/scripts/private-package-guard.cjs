'use strict';
if (process.env.HOT100_PRIVATE_SYNC_BUILD !== '1') {
  throw new Error('此工作区包含个人同步定制，禁止作为市场发布包打包。私用 VSIX 请设置 HOT100_PRIVATE_SYNC_BUILD=1。');
}
