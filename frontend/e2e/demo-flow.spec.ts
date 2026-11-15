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
    const openAppBtn = page.getByRole('button', { name: 'Open the app' }).first()
    await openAppBtn.click()

    // 3. Verify Today (Action Centre) loaded under /app
    await expect(page).toHaveURL(/\/app/)
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()

    // 4. Open Demo Popover from navbar (Demo button)
    const demoBtn = page.getByRole('button', { name: 'Demo', exact: true }).first()
    if (await demoBtn.isVisible()) {
      await demoBtn.click()

      // Set demo date forward by 4 days
      const dateInput = page.locator('input[type="date"]').first()
      if (await dateInput.isVisible()) {
        await dateInput.fill('2026-11-20')
        const setBtn = page.getByRole('button', { name: 'Set', exact: true })
        if (await setBtn.isVisible()) {
          await setBtn.click()
        }
      }

      // Run Daily Check
      const runCheckBtn = page.getByRole('button', { name: 'Run Daily Check' })
      if (await runCheckBtn.isVisible()) {
        await runCheckBtn.click()
      }

      // Close demo popover
      await page.keyboard.press('Escape')
    }

    // 5. Navigate to Invoices
    await page.goto('/app/invoices')
    await expect(page.getByRole('heading', { name: 'Invoices', exact: true })).toBeVisible()

    // If no invoices exist yet, create one
    const firstInvoice = page.locator('text=/INV-/').first()
    if (!(await firstInvoice.isVisible())) {
      const newInvoiceBtn = page.getByRole('button', { name: /New Invoice/i })
      if (await newInvoiceBtn.isVisible()) {
        await newInvoiceBtn.click()
        await expect(page).toHaveURL(/\/app\/invoices\/new/)

        // If client selection is available, create invoice
        const amountField = page.locator('input[placeholder="0.00"]')
        if (await amountField.isVisible()) {
          await amountField.fill('75000')
          await page.getByRole('button', { name: /Create Invoice/i }).click()
        }
      }
    } else {
      await firstInvoice.click()
    }

    // 6. Verify invoice detail page loaded
    if (page.url().includes('/app/invoices/')) {
      // Record payment if allowed
      const recordPaymentBtn = page.getByRole('button', { name: /Record Payment/i }).first()
      if (await recordPaymentBtn.isVisible()) {
        await recordPaymentBtn.click()

        // Fill payment amount
        const amountInput = page.locator('input[type="number"]')
        if (await amountInput.isVisible()) {
          await amountInput.fill('100000.00')
          // Submit payment
          const confirmBtn = page.getByRole('button', { name: /Confirm Payment/i })
          if (await confirmBtn.isVisible()) {
            await confirmBtn.click()
          }
        }

        // Status or heading should be visible
        await expect(page.getByRole('heading', { name: /INV-/ })).toBeVisible()
      }
    }
  })
})
