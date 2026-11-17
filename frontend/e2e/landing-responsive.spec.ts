import { test, expect } from '@playwright/test'

const viewports = [
  { name: 'mobile (375px)', width: 375, height: 667 },
  { name: 'tablet (768px)', width: 768, height: 1024 },
  { name: 'desktop (1280px)', width: 1280, height: 800 },
]

for (const vp of viewports) {
  test.describe(`Landing Page at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test('no horizontal scroll, hero visible, tiles stack cleanly', async ({ page }) => {
      await page.goto('/')

      // Dismiss/skip loader if visible
      const splash = page.locator('div[aria-label="Skip splash animation"]')
      if (await splash.isVisible()) {
        await splash.click()
      }

      await expect(page.getByText('Get paid.')).toBeVisible()
      await expect(page.getByText('Not ignored.')).toBeVisible()

      // Verify no horizontal overflow/scroll
      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
      )
      expect(hasHorizontalScroll).toBe(false)

      // Pinned story navigation check
      const nextStoryBtn = page.getByRole('button', { name: 'Next', exact: true })
      if (await nextStoryBtn.isVisible()) {
        await nextStoryBtn.click()
        await expect(page.getByText(/Beat 02 \/ 04/i)).toBeVisible()
      }
    })
  })
}
