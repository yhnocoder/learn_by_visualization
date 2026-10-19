const { test, expect } = require('@playwright/test');

test('Independent logits update softmax, loss and gradients for 5–8 tokens', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/topics/matrix-calculus/deep-learning.html');
  await page.evaluate(() => MathJax.startup.promise);
  const figure = page.locator('#figLossProbability');
  const set = async (i, value) => {
    await page.locator(`#lpLogit${i}`).evaluate((el, next) => {
      el.value = next; el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  };
  for (const count of [5, 6, 7, 8]) {
    await page.locator('#lpSize').selectOption(String(count));
    await expect(figure.locator('[data-logit]')).toHaveCount(count);
    for (let i = 0; i < count; i++) await set(i, 0);
    await expect(page.locator('#lpLoss')).toHaveText(Math.log(count).toFixed(4));
    await expect(figure.locator('.lp-p')).toHaveText(Array(count).fill((1 / count).toFixed(3)));
    await expect(page.locator('#lpSum')).toHaveText('1.000');
    await expect(page.locator('#lpGradientSum')).toHaveText('0.000');
  }
  await set(0, 4);
  const targetLoss = Number(await page.locator('#lpLoss').textContent());
  expect(targetLoss).toBeLessThan(Math.log(8));
  await set(1, 4);
  expect(Number(await page.locator('#lpLoss').textContent())).toBeGreaterThan(targetLoss);
  // Check against the analytic distribution, not rounded probabilities.
  const denominator = 2 * Math.exp(4) + 6;
  await expect(figure.locator('.lp-p').nth(0)).toHaveText((Math.exp(4) / denominator).toFixed(3));
  await expect(figure.locator('.lp-g').nth(0)).toHaveText(`−${(1 - Math.exp(4) / denominator).toFixed(3)}`);
  await figure.locator('[data-target="7"]').click();
  await expect(figure.locator('.lp-g').nth(7)).toHaveText(`−${(1 - 1 / denominator).toFixed(3)}`);
  await page.locator('#lpSize').selectOption('5');
  await expect(figure.locator('[data-target="0"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#lpReset').click();
  await page.locator('#lpLogit0').focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#lpLogit0')).toHaveValue('2.1');
  await page.locator('#lpSize').selectOption('6');
  await expect(figure.locator('[data-mml-node="merror"], mjx-merror')).toHaveCount(0);
  expect(await figure.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await figure.screenshot({ path: testInfo.outputPath('logits.png') });
  await page.emulateMedia({ colorScheme: 'dark' });
  await figure.screenshot({ path: testInfo.outputPath('logits-dark.png') });
  expect(errors).toEqual([]);
});
