import { test, expect } from '@playwright/test'

test.describe('DuePing Visual & Responsive Fixes', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ request }) => {
    try {
      await request.post('http://localhost:8000/api/system/reset-demo')
    } catch {
      // ignore
    }
  })

  test('Fix 1: No clipped numeral at 1280px on Overview / Dashboard', async ({ page }) => {
    await page.goto('/app/dashboard')
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()

    // Inspect the primary outstanding BigNumeral
    const bigNumeral = page.locator('[data-testid="big-numeral"]').first()
    await expect(bigNumeral).toBeVisible()

    // Ensure the element's scrollWidth does not exceed clientWidth (no text clipping)
    const isClipped = await bigNumeral.evaluate((el) => el.scrollWidth > el.clientWidth + 2)
    expect(isClipped).toBe(false)
  })

  test('Fix 2: ProgressRing circular SVG arc exists on Clients page', async ({ page }) => {
    await page.goto('/app/clients')
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible()

    // Find progressbar role elements for reliability scores
    const progressRings = page.getByRole('progressbar')
    await expect(progressRings.first()).toBeVisible()

    const count = await progressRings.count()
    expect(count).toBeGreaterThan(0)

    // Verify SVG circles exist inside the ProgressRing
    const circle = progressRings.first().locator('circle')
    const circleCount = await circle.count()
    expect(circleCount).toBeGreaterThanOrEqual(2)
  })

  test('Fix 3: Strategy segmented control tabs do not wrap on Action Center', async ({ page }) => {
    await page.goto('/app')
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()

    const tabList = page.getByRole('tablist', { name: /Sort ranking strategies/i })
    await expect(tabList).toBeVisible()

    // Verify all 3 tabs are horizontally aligned on the same row (top offsets equal)
    const tabs = tabList.getByRole('tab')
    expect(await tabs.count()).toBe(3)

    const box0 = await tabs.nth(0).boundingBox()
    const box1 = await tabs.nth(1).boundingBox()
    const box2 = await tabs.nth(2).boundingBox()

    expect(box0).not.toBeNull()
    expect(box1).not.toBeNull()
    expect(box2).not.toBeNull()

    // Top coordinates must be within 2px (aligned on one line, no vertical wrapping)
    expect(Math.abs(box0!.y - box1!.y)).toBeLessThanOrEqual(2)
    expect(Math.abs(box1!.y - box2!.y)).toBeLessThanOrEqual(2)
  })
})
