import { test as base, expect } from '@playwright/test';

// Keep browser and network diagnostics in the report even when an assertion fails.
const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('response', response => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await use(page);
    await testInfo.attach('browser-errors', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
    expect(errors, 'Browser errors and failed resources').toEqual([]);
  },
});

async function openArticle(page, path) {
  const response = await page.goto(path);
  expect(response.status()).toBe(200);
  await page.evaluate(() => document.fonts.ready);
}

test('BPE: merge a frequent pair and tokenize with the learned rule', async ({ page }) => {
  await openArticle(page, '/2026-09/bpe/');
  const demo = page.locator('figure[data-component="bpe-demo"]');
  await demo.scrollIntoViewIfNeeded();
  await test.step('Train one merge with a known corpus', async () => {
    await demo.locator('#corpus').fill('ab 3\nac 1');
    await demo.locator('#btnStep').click();
    await expect(demo.locator('#mergeList li')).toHaveText(['a b→ab']);
    await expect(demo.locator('#wordTable tr').first().locator('.sym')).toHaveText(['ab', '</w>']);
  });
  await test.step('Apply the learned rule to ab', async () => {
    await demo.getByRole('tab', { name: '推理' }).click();
    await demo.locator('#word').fill('ab');
    await demo.locator('#btnTok').click();
    await demo.getByRole('button', { name: '全部执行', exact: true }).click();
    await expect(demo.locator('#resultSyms .sym')).toHaveText(['ab', '</w>']);
  });
});

test('Floating point: encode 1.5 as fp32', async ({ page }) => {
  await openArticle(page, '/2026-09/floating-points/');
  await page.locator('#mode_section').getByText('fp32', { exact: true }).click();
  await page.locator('#float_value_field').fill('1.5');
  await page.locator('#float_value_field').press('Enter');
  await expect(page.locator('#exact_10')).toHaveText('1.5');
  await expect(page).toHaveURL(/#float32:0x3fc00000$/);
  await expect(page.locator('#bits_container .bit_label')).toHaveCount(32);
});

test('Mixed precision: compare fp16 absorption with fp32 accumulation', async ({ page }) => {
  await openArticle(page, '/2026-09/mixed-precision-training/');
  const figure = page.locator('figure[data-component="update-absorption"]');
  await figure.scrollIntoViewIfNeeded();
  await figure.locator('#up-preset-fp16').click();
  await expect(figure.locator('#up-w')).toHaveValue('1');
  const fp16 = figure.locator('#up-table tbody tr').filter({ hasText: 'fp16' });
  await expect(fp16.locator('td').nth(4)).toHaveText('1');
  await expect(fp16.locator('td').nth(5)).toHaveText('被吸收');
  await expect(fp16.locator('td').nth(6)).toHaveText('1');
  expect(Number(await fp16.locator('td').nth(7).textContent())).toBeGreaterThan(1);
});

test('word2vec: one gradient step raises the probability of the context word', async ({ page }) => {
  await openArticle(page, '/2026-09/word2vec/');
  await test.step('Apply one update to the default (banking, crises) sample', async () => {
    const figure = page.locator('figure[data-component="skipgram-step"]');
    await figure.scrollIntoViewIfNeeded();
    await expect(figure.locator('[data-id="status"] [aria-label*="= 1.744"]')).toBeVisible();
    await figure.locator('[data-id="step"]').click();
    await expect(figure.locator('[data-id="status"]')).toContainText('目标词概率从 0.175 变为 0.238');
  });
  await test.step('Run one epoch of the 2D training', async () => {
    const figure = page.locator('figure[data-component="skipgram-training"]');
    await figure.scrollIntoViewIfNeeded();
    await figure.locator('[data-id="one"]').click();
    await expect(figure.locator('[data-id="progress-label"]')).toHaveText('epoch 1 / 60');
  });
});

test('Home: every article card links to a page that loads', async ({ page }) => {
  await openArticle(page, '/');
  const hrefs = [...new Set(await page.locator('a[href^="2026-09/"]').evaluateAll(links => links.map(link => new URL(link.href).pathname)))];
  expect(hrefs).toHaveLength(7);
  for (const href of hrefs) {
    const response = await page.request.get(href);
    expect(response.status(), href).toBe(200);
  }
});

test('Old topic addresses redirect to the articles', async ({ page }) => {
  const redirects = {
    '/topics/bpe/': '/2026-09/bpe/',
    '/topics/floating_points/': '/2026-09/floating-points/',
    '/topics/word2vec/#s2': '/2026-09/word2vec/#s2',
    '/topics/llm-act-fns/': '/2026-09/llm-act-fns/',
    '/topics/mixed-precision-training/': '/2026-09/mixed-precision-training/',
    '/topics/matrix-calculus/': '/2026-09/matrix-calculus-translation/',
    '/topics/matrix-calculus/deep-learning.html': '/2026-09/matrix-calculus/',
  };
  for (const [from, to] of Object.entries(redirects)) {
    await page.goto(from);
    await expect(page, from).toHaveURL(url => url.pathname + url.hash === to || (url.pathname === to && !to.includes('#')));
  }
});
