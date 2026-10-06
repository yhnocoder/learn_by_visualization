const { defineConfig, devices } = require('@playwright/test');

// 测试运行在构建产物 dist/ 上：npm test 先执行 astro build，再由 astro preview 提供页面。
// 端口默认 4173，可以用环境变量 PW_PORT 指定，以便同时在几个 worktree 里运行测试。
const port = Number(process.env.PW_PORT || 4173);
// 环境里预装的 Chromium 与 Playwright 自带的版本不同时，用环境变量 PW_CHROMIUM 指定可执行文件
const launchOptions = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // --ignore-lock：不检查也不写 astro preview 的锁文件，由 Playwright 管理服务器的启动和退出
    command: `npx --no-install astro preview --host 127.0.0.1 --port ${port} --ignore-lock`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: true,
  },
});
