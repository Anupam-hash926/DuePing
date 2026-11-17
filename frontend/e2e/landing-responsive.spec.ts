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

      if (vp.width === 375) {
        const tiles = page.locator('section').filter({
          has: page.getByRole('heading', { name: 'Every Dimension of Receivables' }),
        }).locator('div.grid > div')
        const firstTile = await tiles.nth(0).boundingBox()
        const secondTile = await tiles.nth(1).boundingBox()
        expect(firstTile).not.toBeNull()
        expect(secondTile).not.toBeNull()
        expect(secondTile!.y).toBeGreaterThan(firstTile!.y)
      }
    })
  })
}

test('loader can be skipped and remains dismissed for the tab session', async ({ page }) => {
  await page.goto('/')
  const splash = page.locator('[aria-label="Skip splash animation"]')
  await expect(splash).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(splash).toBeHidden()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('dueping_loader_seen'))).toBe('1')

  await page.goto('/app')
  await page.goto('/')
  await expect(splash).toHaveCount(0)
})

test('pinned story supports keyboard navigation with reduced motion enabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('[aria-label="Skip splash animation"]')).toHaveCount(0)
  await expect(page.getByText(/Beat 01 \/ 04/i)).toBeVisible()

  const next = page.getByRole('button', { name: 'Next', exact: true })
  await next.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText(/Beat 02 \/ 04/i)).toBeVisible()
})
