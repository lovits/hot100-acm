'use strict';
const path = require('node:path');
const {chromium} = require(path.join(process.argv[2], 'leetcode_runtime/playwright-core'));

(async () => {
  const browser = await chromium.launch({executablePath: process.env.HOT100_TEST_BROWSER, headless: true});
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:18765/', {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => typeof cloudConfigured !== 'undefined' && cloudConfigured && !!session.token, null, {timeout: 30000});
    const result = await page.evaluate(async () => {
      const meta = await cloudRequest('GET', '/v1/meta');
      await syncCloud();
      return {serverRevision: meta.revision, localRevision: state.cloudSync?.revision, status: cloudState, queued: !!state.cloudSync?.outbox, recoveries: state.conflicts.length};
    });
    if (!Number.isInteger(result.serverRevision) || result.localRevision < result.serverRevision || result.queued || result.status === 'offline') throw Error(JSON.stringify(result));
    console.log('Authenticated cloud sync check:', JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
