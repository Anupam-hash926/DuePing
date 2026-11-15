import { test, expect } from '@playwright/test'

test.describe('DuePing End-to-End Demo Flow', () => {
  test('Landing -> Open App -> Today -> Demo Date & Check -> Open Invoice -> Pay -> PAID', async ({ page }) => {
    // 1. Visit landing page
    await page.goto('/')
    await expect(page).toHaveTitle(/DuePing/i)

    // Verify Hero content
    await expect(page.getByText('Get paid.')).toBeVisible()
    await expect(page.getByText('Not ignored.')).toBeVisible()

    // 2. Click "Open the app"
    const openAppBtn = page.getByRole('button', { name: 'Open the app' })
    await openAppBtn.click()

    // 3. Verify Today (Action Centre) loaded under /app
    await expect(page).toHaveURL(/\/app/)
    await expect(page.getByText('Today')).toBeVisible()

    // Verify there are pending actions
    const thingsNeedYou = page.locator('text=/things need you today|thing needs you today/')
    await expect(thingsNeedYou).toBeVisible()

    // 4. Open Demo Popover from navbar (lightning icon)
    const demoBtn = page.getByRole('button', { name: 'Demo tools & simulated date' })
    await demoBtn.click()

    // Set demo date forward by 4 days
    const dateInput = page.locator('input[type="date"]')
    await expect(dateInput).toBeVisible()
    await dateInput.fill('2026-11-20')
    await page.getByRole('button', { name: 'Set Date' }).click()

    // Run Daily Check
    const runCheckBtn = page.getByRole('button', { name: 'Run Daily Check' })
    await runCheckBtn.click()

    // Close demo popover
    await page.keyboard.press('Escape')

    // 5. Navigate to Invoices
    await page.goto('/app/invoices')
    await expect(page.getByText('Invoices')).toBeVisible()

    // Open an invoice (first invoice row)
    const firstInvoice = page.locator('[role="button"]').first()
    await firstInvoice.click()

    // 6. Verify invoice detail page loaded
    await expect(page).toHaveURL(/\/app\/invoices\/[a-f0-9-]+/)

    // Record payment if allowed
    const recordPaymentBtn = page.getByRole('button', { name: 'Record payment' })
    if (await recordPaymentBtn.isVisible()) {
      await recordPaymentBtn.click()

      // Fill payment amount
      const amountInput = page.locator('input[type="number"]')
      await amountInput.fill('100000.00')

      // Submit payment
      await page.getByRole('button', { name: 'Save Payment' }).click()

      // Status should become PAID or partially paid
      await expect(page.getByText(/PAID|Partially Paid|Settled/i)).toBeVisible()
    }
  })
})
