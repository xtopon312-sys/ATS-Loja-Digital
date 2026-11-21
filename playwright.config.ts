import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, retries: 0, timeout: 60000,
  expect: { timeout: 10000 }, outputDir: 'output/playwright/phase5/results',
  reporter: [['list'], ['html', { outputFolder: 'output/playwright/phase5/report', open: 'never' }]],
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4175', trace: 'retain-on-failure', screenshot: 'only-on-failure',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  webServer: { command: 'npm run build:local && npm run preview:local -- --port 4175 --strictPort', url: 'http://127.0.0.1:4175', reuseExistingServer: false, timeout: 60000 },
})
