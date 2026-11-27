'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require(path.join(process.argv[2], 'leetcode_runtime/playwright-core'));

(async () => {
  const browser = await chromium.launch({executablePath: process.env.HOT100_TEST_BROWSER, headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 1320, height: 860}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:23870/', {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => typeof session !== 'undefined' && !!session.token && typeof editor !== 'undefined' && !!editor.instance);
    await page.locator('#nav-study').click();
    assert.equal(await page.locator('#study-plan-dialog').evaluate(el => el.open), true);
    assert.equal(await page.locator('[data-sp-tab]').count(), 2);
    assert.ok(await page.locator('.sp-days').count());
    await page.locator('[data-sp-tab="done"]').click();
    await page.locator('#sp-search').fill('1');
    await page.locator('#sp-filter').selectOption({index: 1});
    await page.locator('[data-sp-action="close"]').click();
    await page.locator('#nav-backup').click();
    assert.match(await page.locator('#modal').innerText(), /导出|备份/);
    await page.locator('#close-modal').click();
    await page.locator('#nav-reset').click();
    assert.equal(await page.locator('#sp-reset-plan').count(), 1);
    assert.equal(await page.locator('#sp-reset-all').isDisabled(), true);
    await page.locator('#close-modal').click();
    await page.locator('#nav-leetcode').click();
    await page.locator('#lc-browser').waitFor();
    assert.equal(await page.locator('#lc-browser').count(), 1);
    assert.equal(await page.locator('#lc-session').count(), 1);
    await page.locator('#close-modal').click();
    await page.locator('#nav-sync').click();
    await page.locator('#cloud-host').waitFor();
    assert.equal(await page.locator('#cloud-host').count(), 1);
    await page.locator('#close-modal').click();
    const theme = await page.locator('body').getAttribute('class');
    await page.locator('#theme-btn').click();
    assert.notEqual(await page.locator('body').getAttribute('class'), theme);
    await page.locator('#timer').click();
    assert.equal(await page.locator('#timer').evaluate(el => el.classList.contains('running')), true);
    assert.deepEqual(errors, []);
    console.log('Windows feature checks passed: study plan, backup, reset safeguards, LeetCode login, cloud, theme and timer');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
