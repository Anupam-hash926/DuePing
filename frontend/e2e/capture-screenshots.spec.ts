import { expect, test, type Page } from '@playwright/test'
import path from 'path'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SCREENSHOT_DIR = path.resolve(
  process.env.DUEPING_SCREENSHOT_DIR ?? path.resolve(__dirname, '../../docs/screenshots')
)
const apiBaseURL = process.env.DUEPING_API_URL
  ?? `http://127.0.0.1:${process.env.DUEPING_E2E_API_PORT ?? '8000'}`
mkdirSync(SCREENSHOT_DIR, { recursive: true })

async function applyTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((selectedTheme) => {
    localStorage.setItem('dueping_theme', selectedTheme)
    document.documentElement.setAttribute('data-theme', selectedTheme)
  }, theme)
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
}

test.describe('Capture Real High-Resolution PNG Screenshots', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ request }) => {
    const response = await request.post(`${apiBaseURL}/api/system/reset-demo`)
    if (!response.ok()) {
      throw new Error(`Demo database reset failed with HTTP ${response.status()}`)
    }
  })

  test('Capture screenshots across light and dark themes', async ({ page }) => {
    const themes = ['light', 'dark'] as const
    await page.addInitScript(() => {
      sessionStorage.setItem('dueping_loader_seen', '1')
    })

    for (const theme of themes) {
      // 1. Landing Hero
      await page.goto('/')
      await applyTheme(page, theme)
      await page.waitForLoadState('networkidle')
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `01-landing-hero-${theme}.png`),
        fullPage: false,
      })
      if (theme === 'light') {
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '01-landing-hero.png'),
          fullPage: false,
        })
      }

      // 2. Pinned Story
      const storyEl = page.locator('#story')
      if (await storyEl.isVisible()) {
        await storyEl.scrollIntoViewIfNeeded()
        await page.waitForTimeout(300)
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `02-pinned-story-${theme}.png`),
          fullPage: false,
        })
        if (theme === 'light') {
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, '02-pinned-story.png'),
            fullPage: false,
          })
        }
      }

      // 3. Today (Action Center)
      await page.goto('/app')
      await applyTheme(page, theme)
      await page.waitForLoadState('networkidle')
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `03-today-action-center-${theme}.png`),
        fullPage: false,
      })
      if (theme === 'light') {
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '03-today-action-center.png'),
          fullPage: false,
        })
      } else {
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '09-dark-mode-today.png'),
          fullPage: false,
        })
      }

      // 4. Overview / Dashboard
      await page.goto('/app/dashboard')
      await applyTheme(page, theme)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(600) // Allow countup to finish
      const keepRateArc = page.locator('[aria-label^="Promise keep rate"] circle').nth(1)
      await expect.poll(async () =>
        keepRateArc.evaluate((circle) => getComputedStyle(circle).stroke)
      ).toMatch(/^rgb\(/)
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `04-overview-dashboard-${theme}.png`),
        fullPage: false,
      })
      if (theme === 'light') {
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '04-overview-dashboard.png'),
          fullPage: false,
        })
      }

      // 5. Invoices List
      await page.goto('/app/invoices')
      await applyTheme(page, theme)
      await page.waitForLoadState('networkidle')
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `05-invoices-list-${theme}.png`),
        fullPage: false,
      })
      if (theme === 'light') {
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '05-invoices-list.png'),
          fullPage: false,
        })
      }

      // 11. New Invoice
      await page.goto('/app/invoices/new')
      await applyTheme(page, theme)
      await page.waitForLoadState('networkidle')
      await expect(page.getByRole('heading', { name: 'New Invoice' })).toBeVisible()
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `11-new-invoice-${theme}.png`),
        fullPage: false,
      })
      if (theme === 'light') {
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '11-new-invoice.png'),
          fullPage: false,
        })
      }

      // 6. Invoice Detail (Blockers tab with pairing)
      await page.goto('/app/invoices')
      await applyTheme(page, theme)
      await page.waitForLoadState('networkidle')
      const firstInvoice = page.locator('text=/INV-/').first()
      if (await firstInvoice.isVisible()) {
        await firstInvoice.click()
        await page.waitForURL(/\/app\/invoices\/.+/)
        await applyTheme(page, theme)
        await page.waitForLoadState('networkidle')

        // Switch to Blockers tab
        const blockersTab = page.getByRole('tab', { name: /Blockers/i })
        if (await blockersTab.isVisible()) {
          await blockersTab.click()
          await page.waitForTimeout(300)
        }

        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `05-invoice-detail-blocker-action-${theme}.png`),
          fullPage: false,
        })
        if (theme === 'light') {
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, '05-invoice-detail-blocker-action.png'),
            fullPage: false,
          })
        }

        // 7. Reminder tab with ChatBubble
        const reminderTab = page.getByRole('tab', { name: /Reminder/i })
        if (await reminderTab.isVisible()) {
          await reminderTab.click()
          await page.waitForTimeout(300)
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `06-reminder-bubble-${theme}.png`),
            fullPage: false,
          })
          if (theme === 'light') {
            await page.screenshot({
              path: path.join(SCREENSHOT_DIR, '06-reminder-bubble.png'),
              fullPage: false,
            })
          }
        }
      }

      // 8. Import Page
      await page.goto('/app/import')
      await applyTheme(page, theme)
      await page.waitForLoadState('networkidle')
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `07-import-result-${theme}.png`),
        fullPage: false,
      })
      if (theme === 'light') {
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '07-import-result.png'),
          fullPage: false,
        })
      }

      // 9. Audit / Activity Log
      await page.goto('/app/audit')
      await applyTheme(page, theme)
      await page.waitForLoadState('networkidle')
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `08-audit-log-${theme}.png`),
        fullPage: false,
      })
      if (theme === 'light') {
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '08-audit-log.png'),
          fullPage: false,
        })
      }

      // 10. Clients (with ProgressRings)
      await page.goto('/app/clients')
      await applyTheme(page, theme)
      await page.waitForLoadState('networkidle')
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `10-clients-progress-rings-${theme}.png`),
        fullPage: false,
      })
      if (theme === 'light') {
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '10-clients-progress-rings.png'),
          fullPage: false,
        })
      }
    }
  })
})
