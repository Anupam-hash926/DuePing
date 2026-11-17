import { test } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/screenshots')

test.describe('Capture Real High-Resolution PNG Screenshots', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ request }) => {
    try {
      await request.post('http://localhost:8000/api/system/reset-demo')
    } catch {
      // ignore
    }
  })

  test('Capture screenshots across light and dark themes', async ({ page }) => {
    const themes = ['light', 'dark'] as const

    for (const theme of themes) {
      // Set theme attribute
      await page.addInitScript((th) => {
        localStorage.setItem('dueping_theme', th)
        sessionStorage.setItem('dueping_loader_seen', '1')
        document.documentElement.setAttribute('data-theme', th)
      }, theme)

      // 1. Landing Hero
      await page.goto('/')
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
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(600) // Allow countup to finish
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

      // 6. Invoice Detail (Blockers tab with pairing)
      const firstInvoice = page.locator('text=/INV-/').first()
      if (await firstInvoice.isVisible()) {
        await firstInvoice.click()
        await page.waitForURL(/\/app\/invoices\/.+/)
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
