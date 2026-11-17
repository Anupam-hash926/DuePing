import { test, expect } from '@playwright/test'

const apiBaseURL = process.env.DUEPING_API_URL
  ?? `http://127.0.0.1:${process.env.DUEPING_E2E_API_PORT ?? '8000'}`

test.describe('DuePing End-to-End Demo Flow', () => {
  test.beforeEach(async ({ request }) => {
    const response = await request.post(`${apiBaseURL}/api/system/reset-demo`)
    expect(response.ok(), 'Demo database reset must succeed').toBe(true)
  })

  test('Landing -> Today -> Daily Check -> Notification -> Full Payment -> PAID', async ({ page, request }) => {
    const actionCenterResponse = await request.get(`${apiBaseURL}/api/action-center`)
    expect(actionCenterResponse.ok()).toBe(true)
    const actionCenter = await actionCenterResponse.json()
    expect(actionCenter.items.length).toBeGreaterThan(0)

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
    await expect(page.getByText(/\d+\s+things? need you today/)).toBeVisible()

    // 4. Open Demo Popover from navbar (Demo button)
    const demoBtn = page.getByRole('button', { name: 'Demo', exact: true }).first()
    await expect(demoBtn).toBeVisible()
    await demoBtn.click()

    const todayResponse = await request.get(`${apiBaseURL}/api/system/today`)
    expect(todayResponse.ok()).toBe(true)
    const todayData = await todayResponse.json()
    const dailyCheckDate = new Date(`${todayData.today}T00:00:00.000Z`)
    dailyCheckDate.setUTCDate(dailyCheckDate.getUTCDate() + 4)
    const targetDate = dailyCheckDate.toISOString().slice(0, 10)

    // Set demo date forward to trigger missed-promise notifications.
    const dateInput = page.locator('input[type="date"]').first()
    await expect(dateInput).toBeVisible()
    await dateInput.fill(targetDate)
    const setBtn = page.getByRole('button', { name: 'Set', exact: true })
    await setBtn.click()
    await expect(page.getByText(`Simulated date set to ${targetDate}`)).toBeVisible()
    const updatedTodayResponse = await request.get(`${apiBaseURL}/api/system/today`)
    expect(updatedTodayResponse.ok()).toBe(true)
    expect((await updatedTodayResponse.json()).today).toBe(targetDate)

    // Run Daily Check
    const runCheckBtn = page.getByRole('button', { name: 'Run Daily Check' })
    await expect(runCheckBtn).toBeVisible()
    const notificationsBeforeResponse = await request.get(`${apiBaseURL}/api/notifications?unread=true`)
    expect(notificationsBeforeResponse.ok()).toBe(true)
    const notificationsBefore = await notificationsBeforeResponse.json()
    const previousNotificationIds = new Set(notificationsBefore.map((notification: { id: string }) => notification.id))

    await runCheckBtn.click()
    await expect(page.getByText(/Checked \d+ invoices:/)).toBeVisible()

    const notificationsResponse = await request.get(`${apiBaseURL}/api/notifications?unread=true`)
    expect(notificationsResponse.ok()).toBe(true)
    const notifications = await notificationsResponse.json()
    const newNotifications = notifications.filter(
      (notification: { id: string }) => !previousNotificationIds.has(notification.id)
    )
    expect(newNotifications.length).toBeGreaterThan(0)
    await page.getByRole('button', { name: /Notifications/ }).click()
    await expect(page.getByText(newNotifications[0].message, { exact: true })).toBeVisible()
    await page.keyboard.press('Escape')

    // Close demo popover
    await page.keyboard.press('Escape')

    // 5. Choose an invoice that supports payment and can be fully settled.
    const invoicesResponse = await request.get(`${apiBaseURL}/api/invoices`)
    expect(invoicesResponse.ok()).toBe(true)
    const invoices = await invoicesResponse.json()
    const invoice = invoices.find((candidate: {
      allowed_operations: string[]
      status: string
    }) => candidate.allowed_operations.includes('record_payment') && candidate.status !== 'PAID')
    expect(invoice, 'Seed data should include an invoice that accepts payments').toBeTruthy()

    await page.goto('/app/invoices')
    await expect(page.getByRole('heading', { name: 'Invoices', exact: true })).toBeVisible()
    const invoiceRow = page.getByText(invoice.invoice_number, { exact: true }).first()
    await expect(invoiceRow).toBeVisible()
    await invoiceRow.click()

    // 6. Verify invoice detail page loaded
    await expect(page).toHaveURL(/\/app\/invoices\/.+/)
    await expect(page.getByRole('heading', { name: /INV-/ })).toBeVisible()

    // 7. Record payment
    await page.getByRole('tab', { name: 'Payments' }).click()
    const recordPaymentBtn = page.getByRole('tabpanel', { name: 'Payments' })
      .getByRole('button', { name: 'Record Payment' })
    await expect(recordPaymentBtn).toBeVisible()
    await recordPaymentBtn.click()

    const confirmPaymentBtn = page.getByRole('button', { name: 'Confirm Payment' })
    await expect(confirmPaymentBtn).toBeVisible()
    await confirmPaymentBtn.click()

    // Require a full settlement; a partial payment must fail this flow.
    await expect(page.getByText('Paid', { exact: true })).toBeVisible()
    await expect.poll(async () => {
      const response = await request.get(`${apiBaseURL}/api/invoices/${invoice.id}`)
      expect(response.ok()).toBe(true)
      return (await response.json()).status
    }).toBe('PAID')
  })
})
