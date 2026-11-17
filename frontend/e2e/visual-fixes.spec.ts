import { test, expect } from '@playwright/test'

const apiBaseURL = process.env.DUEPING_API_URL
  ?? `http://127.0.0.1:${process.env.DUEPING_E2E_API_PORT ?? '8000'}`

test.describe('DuePing Visual & Responsive Fixes', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ request }) => {
    const response = await request.post(`${apiBaseURL}/api/system/reset-demo`)
    expect(response.ok(), 'Demo database reset must succeed').toBe(true)
  })

  test('Fix 1: Large dashboard values fit at required viewport widths', async ({ page }, testInfo) => {
    await page.goto('/app/dashboard')
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()

    const bigNumeral = page.locator('[data-testid="big-numeral"]').first()
    await expect(bigNumeral).toBeVisible()
    const originalMarkup = await bigNumeral.innerHTML()

    for (const width of [375, 768, 1024, 1280, 1536]) {
      await page.setViewportSize({ width, height: 900 })
      if (width === 768 || width === 1280) {
        await page.screenshot({
          path: testInfo.outputPath(`dashboard-${width}.png`),
          fullPage: true,
        })
      }

      await bigNumeral.evaluate((el) => {
        el.textContent = '₹99,99,99,999.00'
      })
      const isClipped = await bigNumeral.evaluate((el) => el.scrollWidth > el.clientWidth + 2)
      expect(isClipped, `Numeral clipped at ${width}px`).toBe(false)
      await bigNumeral.evaluate((el, markup) => {
        el.innerHTML = markup
      }, originalMarkup)
    }
  })

  test('Fix 2: ProgressRing circular SVG arc exists on Clients page', async ({ page }) => {
    await page.goto('/app/clients')
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible()

    const progressRings = page.getByRole('img', { name: /Reliability .* out of 100/i })
    await expect(progressRings.first()).toBeVisible()

    const count = await progressRings.count()
    expect(count).toBeGreaterThan(0)

    // Verify SVG circles exist inside the ProgressRing
    const circle = progressRings.first().locator('circle')
    const circleCount = await circle.count()
    expect(circleCount).toBeGreaterThanOrEqual(2)
  })

  test('Fix 3: Strategy segmented control labels do not wrap', async ({ page }) => {
    await page.goto('/app')
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()

    const tabList = page.getByRole('tablist', { name: /Sort ranking strategies/i })
    await expect(tabList).toBeVisible()

    const tabs = tabList.getByRole('tab')
    expect(await tabs.count()).toBe(3)

    for (const width of [375, 768, 1024, 1280, 1536]) {
      await page.setViewportSize({ width, height: 900 })
      for (let index = 0; index < await tabs.count(); index += 1) {
        const label = tabs.nth(index).locator('span span').first()
        const wraps = await label.evaluate((el) => {
          const style = window.getComputedStyle(el)
          const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5
          return el.getBoundingClientRect().height > lineHeight + 1
        })
        expect(wraps, `Strategy label wrapped at ${width}px`).toBe(false)
      }

      const widths = await Promise.all(
        [0, 1, 2].map(async (index) => (await tabs.nth(index).boundingBox())?.width ?? 0)
      )
      expect(Math.max(...widths) - Math.min(...widths), `Strategy segments unequal at ${width}px`).toBeLessThanOrEqual(1)
    }
  })
})
