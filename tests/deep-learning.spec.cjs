const { test: base, expect } = require('@playwright/test');

// 《深度学习中的矩阵微积分》页面：/topics/matrix-calculus/deep-learning/
// 检查页面没有错误、公式没有 merror、计算图和交互图都已画出，以及左侧前文笔记侧边栏的展开与收起。

const PATH = '/topics/matrix-calculus/deep-learning/';

// 收集浏览器错误和失败的请求，测试结束时要求为空
const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure().errorText}`));
    page.on('response', response => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await use(page);
    expect(errors, 'Browser errors and failed resources').toEqual([]);
  },
});

async function openPage(page) {
  const response = await page.goto(PATH);
  expect(response.status()).toBe(200);
  await page.evaluate(() => window.MathJax.startup.promise);
  await page.evaluate(() => document.fonts.ready);
  // 图由各组件的模块脚本在浏览器端 MathJax 就绪后画出，最后画的是反向传播步骤图
  await expect(page.locator('#bpSvg > *').first()).toBeAttached();
}

async function openFold(page, summary) {
  const fold = page.locator('details.fold', { has: page.locator('summary', { hasText: summary }) });
  if (!(await fold.evaluate(d => d.open))) await fold.locator('summary').click();
  await expect(fold).toHaveAttribute('open', '');
  return fold;
}

test('Deep learning matrix calculus: formulas, graphs and figures render', async ({ page }) => {
  await openPage(page);

  await test.step('Formulas have no errors', async () => {
    await expect(page.locator('[data-mml-node="merror"], mjx-merror')).toHaveCount(0);
    expect(await page.locator('article mjx-container').count()).toBeGreaterThan(500);
  });

  await test.step('Computation graphs are drawn and their formulas keep their own size', async () => {
    for (const id of ['modelSvg3', 'tailSvgLoss', 'tailSvgHead', 'chainSvg', 'pathsSvg', 'vecPathsSvg', 'headPathsSvg', 'bpSvg']) {
      expect(await page.locator(`#${id} > *`).count(), id).toBeGreaterThan(0);
    }
    // 图里的公式是嵌套的 svg.tex；宽度应由它自己的 width 属性决定，不能被拉伸到整张图的宽度
    const sizes = await page.locator('#modelSvg3 svg.tex').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().width));
    expect(sizes.length).toBeGreaterThan(10);
    expect(Math.max(...sizes)).toBeLessThan(200);
  });

  await test.step('Graphs inside folded blocks are drawn', async () => {
    await openFold(page, '什么是 SwiGLU FFN');
    await openFold(page, '什么是 GQA Attention');
    for (const id of ['ffnSvg', 'attnSvg', 'gqaSvg']) {
      expect(await page.locator(`#${id} > *`).count(), id).toBeGreaterThan(0);
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
  });

  await test.step('Interactive figures are drawn', async () => {
    for (const id of ['tanSvg', 'dSvg', 'gField', 'gSx', 'gSy', 'ropeSvg']) {
      expect(await page.locator(`#${id} > *`).count(), id).toBeGreaterThan(0);
    }
    // 热力图先画在 canvas 上，再作为 data URL 放进 #gField 的 <image>
    await expect(page.locator('#gField image').first()).toHaveAttribute('href', /^data:image\/png/);
    for (const id of ['figJac', 'figOuter', 'figSum']) {
      expect(await page.locator(`#${id} .mat .c`).count(), id).toBeGreaterThan(0);
    }
  });

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Deep learning matrix calculus: interactive figures respond', async ({ page }) => {
  await openPage(page);

  await test.step('Tangent figure: switching to sin x gives slope cos 1', async () => {
    await openFold(page, '割线、切线与导数的图像');
    await expect(page.locator('#tanV')).toHaveText('3.000');
    await page.locator('#figTan .fn button[data-fn="sin"]').click();
    await expect(page.locator('#figTan .fn button[data-fn="sin"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tanV')).toHaveText('0.540');
  });

  await test.step('Jacobian figure: hovering a weight cell typesets the explanation', async () => {
    const cell = page.locator('#figJac .mat.w .c').first();
    await cell.scrollIntoViewIfNeeded();
    await cell.hover();
    await expect(page.locator('#jsay')).toContainText('的系数');
    await expect(page.locator('#jsay mjx-container').first()).toBeVisible();
    await expect(page.locator('[data-mml-node="merror"], mjx-merror')).toHaveCount(0);
  });

  await test.step('Backprop steps: next and previous move the counter', async () => {
    await expect(page.locator('#bpCnt')).toHaveText('第 1 / 12 步');
    await page.locator('#bpNext').click();
    await expect(page.locator('#bpCnt')).toHaveText('第 2 / 12 步');
    await expect(page.locator('#bpSvg rect.hlrect').first()).toBeAttached();
    await page.locator('#bpPrev').click();
    await expect(page.locator('#bpCnt')).toHaveText('第 1 / 12 步');
  });

  await test.step('RoPE figure: shifting both positions keeps the rotated dot product', async () => {
    await openFold(page, '什么是 RoPE');
    const before = await page.locator('#ropeDot').textContent();
    await page.locator('#ropeUp').click();
    await expect(page.locator('#ropeTv')).toHaveText('4');
    await expect(page.locator('#ropeD')).toHaveText('2');
    await expect(page.locator('#ropeDot')).toHaveText(before);
  });
});

test('Deep learning matrix calculus: recap sidebar collapses and expands', async ({ page }) => {
  await openPage(page);
  const nav = page.locator('nav.recap');
  const fab = page.locator('.recap-fab');
  const narrow = await page.evaluate(() => matchMedia('(max-width:1240px)').matches);

  if (!narrow) {
    // 宽屏：侧边栏在正文左侧，收起后正文栏变宽
    await expect(nav).toBeVisible();
    await expect(fab).toBeHidden();
    const article = page.locator('article');
    const before = (await article.boundingBox()).width;
    await page.locator('.recap-foot button').click();
    await expect(nav).toHaveClass(/is-collapsed/);
    await expect(fab).toBeVisible();
    await expect.poll(async () => (await article.boundingBox()).width).toBeGreaterThan(before);
    await fab.click();
    await expect(nav).not.toHaveClass(/is-collapsed/);
    await expect(fab).toBeHidden();
    await expect.poll(async () => (await article.boundingBox()).width).toBe(before);
  } else {
    // 窄屏：侧边栏是从左侧滑出的抽屉，点击遮罩关闭
    await expect(nav).toHaveClass(/is-drawer/);
    await expect(fab).toBeVisible();
    await fab.click();
    await expect(nav).toHaveClass(/is-open/);
    await expect(page.locator('.recap-backdrop')).toBeVisible();
    await expect(nav.locator('.recap-list a').first()).toBeVisible();
    const { width } = page.viewportSize();
    await page.mouse.click(width - 10, 300);
    await expect(nav).not.toHaveClass(/is-open/);
    await expect(page.locator('.recap-backdrop')).toBeHidden();
    await expect(fab).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
