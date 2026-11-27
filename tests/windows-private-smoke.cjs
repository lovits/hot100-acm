'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const root = process.argv[2];
const {chromium} = require(path.join(root, 'leetcode_runtime/playwright-core'));

(async () => {
  const browser = await chromium.launch({executablePath: process.env.HOT100_TEST_BROWSER, headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 1320, height: 860}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:23870/', {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => typeof session !== 'undefined' && !!session.token && typeof editor !== 'undefined' && !!editor.instance);
    await page.locator('#nav-study').click();
    assert.equal(await page.locator('#study-plan-dialog').evaluate(dialog => dialog.open), true);
    assert.equal(await page.locator('[data-sp-tab]').count(), 2);
    await page.locator('[data-sp-action="settings"]').click();
    const goal = Number(await page.locator('#sp-goal').inputValue());
    await page.locator('[aria-label="增加新题目标"]').click();
    assert.equal(Number(await page.locator('#sp-goal').inputValue()), goal + 1);
    await page.locator('#close-modal').click();
    await page.locator('[data-sp-action="close"]').click();
    await page.evaluate(() => {
      const id = current.id;
      state.accepted = [id]; state.favorites = [id]; state.notes[id] = 'test note';
      state.studyPlan.events = [{id: String(id), date: '2026-01-01', kind: 'new', source: 'test', createdAt: 1}];
      state.studyPlan.learned[id] = {first: '2026-01-01', last: '2026-01-01', stage: 0, due: '2026-01-02'};
      state.studyPlan.learnedMeta = {[id]: {at: 1, deleted: false}};
      renderContent();
    });
    await page.locator('#sp-solved').click();
    assert.equal(await page.locator('#sp-reset-one').isVisible(), true);
    const style = await page.evaluate(() => ({solved:getComputedStyle(document.querySelector('#sp-solved')).fontSize, reset:getComputedStyle(document.querySelector('#sp-reset-one')).fontSize, background:getComputedStyle(document.querySelector('#sp-reset-one')).backgroundColor}));
    assert.equal(style.reset, style.solved); assert.equal(style.background, 'rgba(0, 0, 0, 0)');
    await page.locator('#sp-reset-one').click();
    const result = await page.evaluate(() => ({solved: state.accepted.includes(current.id), favorite: state.favorites.includes(current.id), note: state.notes[current.id], events: state.studyPlan.events.length, learned: !!state.studyPlan.learned[current.id], resetAt: state.progressMeta[current.id].resetAt}));
    assert.equal(result.solved, false); assert.equal(result.learned, false);
    assert.equal(result.favorite, true); assert.equal(result.note, 'test note'); assert.equal(result.events, 1); assert.ok(result.resetAt > 0);
    assert.equal(await page.locator('#sp-solved').count(), 0);
    assert.deepEqual(errors, []);
    console.log('Windows UI and isolated single-problem reset passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
