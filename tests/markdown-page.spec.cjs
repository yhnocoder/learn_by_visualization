const { test, expect } = require('@playwright/test');

// Markdown 页面（src/topics/matrix-calculus/partials.md）：/topics/matrix-calculus/partials/
// 检查构建时渲染的公式、:mark[...] 标记、<gradient-figure> 交互图，以及页面里不含开发时的编辑器。

const PATH = '/topics/matrix-calculus/partials/';

test('Markdown page: formulas, marks and the gradient figure render', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

  const response = await page.goto(PATH);
  expect(response.status()).toBe(200);
  await expect(page.locator('h1')).toHaveText('标量对向量：偏导数与梯度');
  expect(await page.locator('article mjx-container').count()).toBeGreaterThan(80);
  await expect(page.locator('article mjx-container merror')).toHaveCount(0);
  await expect(page.locator('article mark')).toHaveCount(5);

  // 图由 custom element 在浏览器端 MathJax 就绪后生成，初始位置来自属性 x0="1.2" y0="0.8"
  const figure = page.locator('gradient-figure');
  await expect(figure.locator('[data-grad="px"]')).toHaveText('5.760');
  await expect(figure.locator('[data-grad="py"]')).toHaveText('4.320');
  await expect(figure.locator('figcaption p')).toHaveCount(3);
  await figure.locator('input[data-grad="x"]').fill('-1');
  await expect(figure.locator('[data-grad="px"]')).toHaveText('-4.800');

  await expect(page.locator('.md-edit-toggle')).toHaveCount(0);
  expect(errors).toEqual([]);
});
