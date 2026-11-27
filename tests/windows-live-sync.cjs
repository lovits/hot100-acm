'use strict';
const path = require('node:path');
const {chromium} = require(path.join(process.argv[2], 'leetcode_runtime/playwright-core'));

(async () => {
  const browser = await chromium.launch({executablePath: process.env.HOT100_TEST_BROWSER, headless: true});
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:18765/', {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => typeof session !== 'undefined' && !!session.token && typeof cloudConfigured !== 'undefined' && cloudConfigured, null, {timeout: 30000});
    const result = await page.evaluate(async () => {
      await syncCloud();
      return {status: cloudState, revision: state.cloudSync.revision, queued: !!state.cloudSync.outbox, accepted: state.accepted.length, drafts: Object.keys(state.codes).length, recoveries: state.conflicts.length};
    });
    console.log('Windows live sync:', JSON.stringify(result));
    if (result.queued || !result.revision) throw Error('Cloud sync queue was not drained');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
