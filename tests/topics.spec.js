const { test: base, expect } = require('@playwright/test');

// Keep browser and network diagnostics in the report even when an assertion fails.
const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const errors = [];
    const resources = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure().errorText}`));
    page.on('response', response => {
      resources.push({ status: response.status(), url: response.url() });
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await use(page);
    await testInfo.attach('browser-and-resources', {
      body: JSON.stringify({ errors, resources }, null, 2),
      contentType: 'application/json',
    });
    expect(errors, 'Browser errors and failed resources').toEqual([]);
  },
});

async function screenshot(page, testInfo, name, fullPage = true) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage, animations: 'disabled', scale: 'css' }),
    contentType: 'image/png',
  });
}

async function checkMath(page) {
  await page.evaluate(() => window.MathJax.startup.promise);
  await expect(page.locator('section mjx-container[jax="SVG"] > svg').first()).toBeVisible();
  await expect(page.locator('[data-mml-node="merror"], mjx-merror')).toHaveCount(0);
}

async function openTopic(page, testInfo, path, math = false) {
  await test.step('Open topic and check rendering', async () => {
    const response = await page.goto(path);
    expect(response.status()).toBe(200);
    if (math) await checkMath(page);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo(0, 0));
    await screenshot(page, testInfo, 'initial-viewport', false);
    await screenshot(page, testInfo, 'initial-full-page');
  });
}

test('BPE: merge a frequent pair and tokenize with the learned rule', async ({ page }, testInfo) => {
  await openTopic(page, testInfo, '/topics/bpe/');
  await test.step('Train one merge with a known corpus', async () => {
    await page.locator('#corpus').fill('ab 3\nac 1');
    await page.locator('#btnStep').click();
    await expect(page.locator('#mergeList li')).toHaveText(['a b→ab']);
    await expect(page.locator('#wordTable tr').first().locator('.sym')).toHaveText(['ab', '</w>']);
    await screenshot(page, testInfo, 'after-training');
  });
  await test.step('Apply the learned rule to ab', async () => {
    await page.getByRole('tab', { name: '推理' }).click();
    await page.locator('#word').fill('ab');
    await page.locator('#btnTok').click();
    await page.getByRole('button', { name: '全部执行', exact: true }).click();
    await expect(page.locator('#resultSyms .sym')).toHaveText(['ab', '</w>']);
    await screenshot(page, testInfo, 'after-tokenization');
  });
});

test('Floating point: encode 1.5 as fp32', async ({ page }, testInfo) => {
  await openTopic(page, testInfo, '/topics/floating_points/');
  await test.step('Change format and encode a known exact value', async () => {
    await page.locator('#mode_section').getByText('fp32', { exact: true }).click();
    await page.locator('#float_value_field').fill('1.5');
    await page.locator('#float_value_field').press('Enter');
    await expect(page.locator('#exact_10')).toHaveText('1.5');
    await expect(page).toHaveURL(/#float32:0x3fc00000$/);
    await expect(page.locator('#bits_container .bit_label')).toHaveCount(32);
    await screenshot(page, testInfo, 'after-fp32-input');
  });
});

test('Activation functions: adjust the SiLU beta parameter', async ({ page }, testInfo) => {
  await openTopic(page, testInfo, '/topics/llm-act-fns/', true);
  await test.step('Change beta from 1 to 2 and check the transition interval', async () => {
    const figure = page.locator('#fig-silu');
    const curves = figure.locator('svg path');
    const before = await curves.evaluateAll(paths => paths.map(path => path.getAttribute('d')));
    await figure.locator('input[type="range"]').fill('2');
    await expect(figure.locator('.controls .v')).toHaveText('2.00');
    await expect(figure.locator('.chart-status')).toHaveText('gate 过渡区：[-1.10, 1.10]；宽 2.20');
    expect(await curves.evaluateAll(paths => paths.map(path => path.getAttribute('d')))).not.toEqual(before);
    await checkMath(page);
    await screenshot(page, testInfo, 'after-beta-change');
  });
});

test('Mixed precision: compare fp16 absorption with fp32 accumulation', async ({ page }, testInfo) => {
  await openTopic(page, testInfo, '/topics/mixed-precision-training/', true);
  await test.step('Load the fp16 absorption example', async () => {
    await page.locator('#up-preset-fp16').click();
    await expect(page.locator('#up-w')).toHaveValue('1');
    const fp16 = page.locator('#up-table tbody tr').filter({ hasText: 'fp16' });
    await expect(fp16.locator('td').nth(4)).toHaveText('1');
    await expect(fp16.locator('td').nth(5)).toHaveText('被吸收');
    await expect(fp16.locator('td').nth(6)).toHaveText('1');
    expect(Number(await fp16.locator('td').nth(7).textContent())).toBeGreaterThan(1);
    await checkMath(page);
    await screenshot(page, testInfo, 'after-fp16-preset');
  });
});

test('Index: every card links to a topic that loads', async ({ page }, testInfo) => {
  await openTopic(page, testInfo, '/');
  const cards = page.locator('a.card');
  await expect(cards).toHaveCount(4);
  const hrefs = await cards.evaluateAll(links => links.map(link => link.getAttribute('href')));
  for (const href of hrefs) {
    const response = await page.request.get(href);
    expect(response.status(), href).toBe(200);
  }
  // The column setting is hidden on narrow screens.
  if (await page.locator('#cols').isVisible()) {
    await test.step('Column setting persists across reload', async () => {
      await page.locator('#cols button[data-n="5"]').click();
      await page.reload();
      await expect(page.locator('#cols button.on')).toHaveAttribute('data-n', '5');
    });
  }
});
