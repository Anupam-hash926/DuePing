import { defineConfig, devices } from '@playwright/test'

const apiPort = process.env.DUEPING_E2E_API_PORT ?? '8000'
const webPort = process.env.DUEPING_E2E_WEB_PORT ?? '5173'
const apiURL = process.env.DUEPING_API_URL ?? `http://127.0.0.1:${apiPort}`
const webURL = process.env.DUEPING_WEB_URL ?? `http://127.0.0.1:${webPort}`

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 8000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: webURL,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'node ./scripts/start-e2e-backend.mjs',
      url: `${apiURL}/api/system/health`,
      env: {
        DUEPING_E2E_API_PORT: apiPort,
        DUEPING_API_URL: apiURL,
      },
      reuseExistingServer: false,
      timeout: 60 * 1000,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${webPort} --strictPort`,
      url: webURL,
      env: { DUEPING_API_URL: apiURL },
      reuseExistingServer: false,
      timeout: 30 * 1000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
