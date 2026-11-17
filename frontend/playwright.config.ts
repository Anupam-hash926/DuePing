import { defineConfig, devices } from '@playwright/test'

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
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'cd ../backend && DUEPING_ENABLE_RESET=1 DUEPING_DB_PATH=/tmp/dueping-e2e.db PYTHONPATH=. .venv/bin/python -m app.infrastructure.seed && DUEPING_ENABLE_RESET=1 DUEPING_DB_PATH=/tmp/dueping-e2e.db PYTHONPATH=. .venv/bin/uvicorn app.api.main:app --host 127.0.0.1 --port 8000',
      url: 'http://127.0.0.1:8000/api/system/health',
      reuseExistingServer: true,
      timeout: 30 * 1000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
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
