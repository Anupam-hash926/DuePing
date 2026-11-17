import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const apiBaseURL = process.env.DUEPING_API_URL
  ?? `http://127.0.0.1:${process.env.DUEPING_E2E_API_PORT ?? '8000'}`

test.describe('Accessibility Audits (Axe WCAG 2.1 AA)', () => {
  test.beforeEach(async ({ request }) => {
    const response = await request.post(`${apiBaseURL}/api/system/reset-demo`)
    expect(response.ok(), 'Demo database reset must succeed').toBe(true)
  })

  const routes = [
    { name: 'Landing Page', path: '/' },
    { name: 'Action Center (Today)', path: '/app' },
    { name: 'Overview / Dashboard', path: '/app/dashboard' },
    { name: 'Invoices List', path: '/app/invoices' },
  ]

  for (const route of routes) {
    test(`Route ${route.name} (${route.path}) has 0 serious or critical a11y violations`, async ({
      page,
    }) => {
      await page.goto(route.path)
      // Allow react rendering and any animations to settle
      await page.waitForLoadState('networkidle')

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()

      const seriousOrCritical = accessibilityScanResults.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical'
      )

      expect(seriousOrCritical).toEqual([])
    })
  }

  test('Route Invoice Detail (/app/invoices/:id) has 0 serious or critical a11y violations', async ({
    page,
  }) => {
    await page.goto('/app/invoices')
    await page.waitForLoadState('networkidle')

    const firstInvoiceRow = page.locator('text=/INV-/').first()
    await expect(firstInvoiceRow).toBeVisible()
    await firstInvoiceRow.click()
    await page.waitForURL(/\/app\/invoices\/.+/)
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    const seriousOrCritical = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    )

    expect(seriousOrCritical).toEqual([])
  })
})
