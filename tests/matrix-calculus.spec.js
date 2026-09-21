const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '../topics/matrix-calculus');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'source-manifest.json'), 'utf8'));

test('Matrix calculus translation preserves original assets and renders on all screens', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/topics/matrix-calculus/');
  await page.locator('article img').last().waitFor();
  await page.evaluate(async () => { await Promise.all([...document.images].map(img => img.decode())); });
  await expect(page.locator('article img')).toHaveCount(455);
  await expect(page.locator('article table')).toHaveCount(3);
  for (const asset of manifest.images) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, asset.path))).digest('hex');
    expect(hash).toBe(asset.sha256);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const broken = await page.locator('article img').evaluateAll(imgs => imgs.filter(i => !i.complete || !i.naturalWidth).map(i => i.src));
  expect(broken).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('translation-light.png'), fullPage: false });
  await page.locator('[id="sec:1.4"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('translation-formulas.png'), fullPage: false });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.locator('[id="sec:1.5"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('translation-dark.png'), fullPage: false });
  expect(errors).toEqual([]);
});

test('Homepage Jacobian keeps expressions fixed and changes one input at a time', async ({ page }, testInfo) => {
  await page.clock.install();
  await page.goto('/');
  const card = page.locator('[data-id="matrix-calculus"]');
  await expect(card.locator('.expression')).toHaveText(['2x', '0', 'y', 'x']);
  await card.focus();
  await page.clock.runFor(1000);
  const first = (await card.locator('.entry').allTextContents()).map(Number);
  expect(first[2]).toBe(1);
  expect(Number(await card.locator('.x-point').getAttribute('cx'))).toBeLessThan(190);
  await expect(card.locator('.y-point')).toHaveAttribute('cy', '45');
  expect(first[3]).toBeLessThan(.1);
  expect(Math.abs(first[0] - 2 * first[3])).toBeLessThanOrEqual(.011);
  await expect(card.locator('.phase-label')).toHaveText('x 变化 · y 保持不变');
  await card.screenshot({ path: testInfo.outputPath('home-math-x.png') });
  await page.clock.runFor(4200);
  const second = (await card.locator('.entry').allTextContents()).map(Number);
  expect(second[0]).toBe(2);
  expect(second[1]).toBe(0);
  expect(second[3]).toBe(1);
  expect(second[2]).toBeLessThan(0);
  await expect(card.locator('.x-point')).toHaveAttribute('cx', '254');
  expect(Number(await card.locator('.y-point').getAttribute('cy'))).toBeGreaterThan(90);
  await expect(card.locator('.phase-label')).toHaveText('y 变化 · x 保持不变');
  await expect(card.locator('.expression')).toHaveText(['2x', '0', 'y', 'x']);
  await card.screenshot({ path: testInfo.outputPath('home-math-y.png') });
  await card.click();
  await expect(page).toHaveURL(/topics\/matrix-calculus\/$/);
});
