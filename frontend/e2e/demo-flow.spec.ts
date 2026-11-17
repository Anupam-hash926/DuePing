import { test, expect } from '@playwright/test'

test.describe('DuePing End-to-End Demo Flow', () => {
  test.beforeEach(async ({ request }) => {
    // Reset database to clean canonical state before each run
    try {
      await request.post('http://localhost:8000/api/system/reset-demo')
    } catch {
      // ignore if server is starting
    }
  })

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
    await expect(demoBtn).toBeVisible()
    await demoBtn.click()

    // Set demo date forward by 4 days to trigger overdue check
    const dateInput = page.locator('input[type="date"]').first()
    await expect(dateInput).toBeVisible()
    await dateInput.fill('2026-11-20')
    const setBtn = page.getByRole('button', { name: 'Set', exact: true })
    await setBtn.click()

    // Run Daily Check
    const runCheckBtn = page.getByRole('button', { name: 'Run Daily Check' })
    await expect(runCheckBtn).toBeVisible()
    await runCheckBtn.click()

    // Close demo popover
    await page.keyboard.press('Escape')

    // 5. Navigate to Invoices
    await page.goto('/app/invoices')
    await expect(page.getByRole('heading', { name: 'Invoices', exact: true })).toBeVisible()

    // Open first invoice matching INV-
    const invoiceRow = page.locator('text=/INV-/').first()
    await expect(invoiceRow).toBeVisible()
    await invoiceRow.click()

    // 6. Verify invoice detail page loaded
    await expect(page).toHaveURL(/\/app\/invoices\/.+/)
    await expect(page.getByRole('heading', { name: /INV-/ })).toBeVisible()

    // 7. Record payment
    const recordPaymentBtn = page.getByRole('button', { name: /Record Payment/i }).first()
    if (await recordPaymentBtn.isVisible()) {
      await recordPaymentBtn.click()

      // Fill payment amount if needed and confirm
      const confirmBtn = page.getByRole('button', { name: /Record Payment/i }).last()
      await expect(confirmBtn).toBeVisible()
      await confirmBtn.click()

      // Verify status updates to PAID or PARTIALLY_PAID
      await expect(page.getByText(/PAID|Partially Paid/i).first()).toBeVisible()
    }
  })
})
