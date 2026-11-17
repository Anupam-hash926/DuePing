import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../context/ToastContext'
import { getReliabilityColor, ProgressRing } from '../ui/ProgressRing'
import { SegmentedControl } from '../ui/SegmentedControl'
import { StatusStepper } from '../features/invoices/detail/StatusStepper'
import { FocusCard } from '../features/action-center/FocusCard'
import { NewInvoicePage } from '../features/invoices/NewInvoicePage'
import { UpNextList } from '../features/action-center/UpNextList'
import { DebtorsList } from '../features/dashboard/DebtorsList'
import { formatDate } from '../lib/format'
import type { ActionCenterItemRead, DebtorRowRead } from '../api/types'

function renderWithProviders(ui: React.ReactElement, client = new QueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

describe('Phase 11 Step 2: Visual Bugs & Fixes', () => {
  describe('2.2 ProgressRing component', () => {
    it('uses the required green, amber, and red reliability thresholds', () => {
      expect(getReliabilityColor(80)).toBe('var(--fill-green)')
      expect(getReliabilityColor(50)).toBe('var(--fill-amber)')
      expect(getReliabilityColor(49)).toBe('var(--fill-red)')
    })

    it('renders the exact 0, 33, and 100 percent arcs with an image label', async () => {
      const { container, rerender } = render(
        <ProgressRing value={0} size={48} ariaLabel="Reliability 0 out of 100" />
      )
      expect(screen.getByRole('img', { name: 'Reliability 0 out of 100' })).toBeVisible()
      const indicator = container.querySelectorAll('circle')[1]
      const circumference = 2 * Math.PI * ((48 - 3.5) / 2)

      await waitFor(() => {
        expect(Number(indicator.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference)
      })

      rerender(<ProgressRing value={33} size={48} ariaLabel="Reliability 33 out of 100" />)
      expect(screen.getByRole('img', { name: 'Reliability 33 out of 100' })).toBeInTheDocument()
      await waitFor(() => {
        expect(Number(indicator.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference * 0.67)
      })

      rerender(<ProgressRing value={100} size={48} ariaLabel="Reliability 100 out of 100" />)
      expect(screen.getByRole('img', { name: 'Reliability 100 out of 100' })).toBeInTheDocument()
      await waitFor(() => {
        expect(Number(indicator.getAttribute('stroke-dashoffset'))).toBeCloseTo(0)
      })
    })

    it('uses the debtor reliability score rather than a full ring', () => {
      const debtors: DebtorRowRead[] = [{
        client_id: 'c-1',
        name: 'Acme Corp',
        outstanding: { amount: '22000.00', currency: 'INR' },
        reliability_score: 42,
      }]
      renderWithProviders(<DebtorsList debtors={debtors} />)

      expect(screen.getByRole('img', { name: 'Reliability 42 out of 100' })).toBeInTheDocument()
    })

    it('shows the final arc immediately when reduced motion is requested', async () => {
      vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
      try {
        const { container } = render(
          <ProgressRing value={33} size={48} ariaLabel="Reliability 33 out of 100" />
        )
        const indicator = container.querySelectorAll('circle')[1]
        const expectedOffset = 2 * Math.PI * ((48 - 3.5) / 2) * 0.67
        await waitFor(() => {
          expect(Number(indicator.getAttribute('stroke-dashoffset'))).toBeCloseTo(expectedOffset)
        })
      } finally {
        vi.unstubAllGlobals()
      }
    })
  })

  describe('2.3 SegmentedControl layout', () => {
    it('renders segmented control without wrapping and with custom titles', () => {
      const options = [
        { id: 'RISK', label: 'Risk', title: 'Risk-weighted' },
        { id: 'AMOUNT', label: 'Amount', title: 'Highest amount' },
        { id: 'OLDEST', label: 'Oldest', title: 'Oldest due' },
      ]
      render(
        <SegmentedControl
          options={options}
          value="RISK"
          onChange={() => {}}
          ariaLabel="Sort ranking strategies"
        />
      )

      expect(screen.getByRole('tablist', { name: 'Sort ranking strategies' })).toBeInTheDocument()
      const riskTab = screen.getByRole('tab', { name: 'Risk' })
      expect(riskTab).toHaveAttribute('title', 'Risk-weighted')
      expect(riskTab).toHaveAttribute('aria-selected', 'true')
    })

    it('keeps arrow-key navigation between strategy tabs', () => {
      const onChange = vi.fn()
      render(
        <SegmentedControl
          options={[
            { value: 'RISK', label: 'Risk' },
            { value: 'AMOUNT', label: 'Amount' },
            { value: 'OLDEST', label: 'Oldest' },
          ]}
          value="RISK"
          onChange={onChange}
          ariaLabel="Sort ranking strategies"
        />
      )

      fireEvent.keyDown(screen.getByRole('tab', { name: 'Risk' }), { key: 'ArrowRight' })
      expect(onChange).toHaveBeenCalledWith('AMOUNT')
    })
  })

  describe('2.4 FocusCard chip deduplication', () => {
    const mockItem: ActionCenterItemRead = {
      action: {
        id: 'act-1',
        invoice_id: 'inv-1',
        description: 'Send reminder for invoice INV-100',
        due_date: '2026-11-20',
        priority: 'CRITICAL',
        source: 'OVERDUE',
        status: 'PENDING',
      },
      invoice_id: 'inv-1',
      invoice_number: 'INV-100',
      client_id: 'c-1',
      client_name: 'Acme Corp',
      outstanding: { amount: '50000.00', currency: 'INR' },
      days_overdue: 12,
      reason: 'CRITICAL priority · 12 days overdue · ₹50,000 outstanding · Reliability score 42%',
      score: 95,
      suggested_tone: 'FIRM',
    }

    it('renders days overdue and priority only once despite redundant reason tokens', () => {
      renderWithProviders(
        <FocusCard
          item={mockItem}
          totalCount={1}
          currentIndex={0}
          onComplete={vi.fn()}
          onReschedule={vi.fn()}
          onNext={vi.fn()}
          onPrev={vi.fn()}
        />
      )

      // "12 days overdue" should appear exactly once (in the overdue pill)
      const overdueMatches = screen.getAllByText(/12 days overdue/i)
      expect(overdueMatches).toHaveLength(1)

      // "Critical priority" should appear exactly once
      const priorityMatches = screen.getAllByText(/Critical priority/i)
      expect(priorityMatches).toHaveLength(1)

      // Extra tokens like reliability score should be retained
      expect(screen.getByText('Reliability score 42%')).toBeInTheDocument()
      // Suggested tone should be displayed
      expect(screen.getByText('Suggested: FIRM')).toBeInTheDocument()
    })

    describe('2.4 UpNextList facts', () => {
      it('shows each structured fact once and omits repeated reason tokens', () => {
        const item: ActionCenterItemRead = {
          action: {
            id: 'act-up-next',
            invoice_id: 'inv-up-next',
            description: 'Send reminder for invoice INV-100',
            due_date: '2026-11-20',
            priority: 'CRITICAL',
            source: 'OVERDUE',
            status: 'PENDING',
          },
          invoice_id: 'inv-up-next',
          invoice_number: 'INV-100',
          client_id: 'c-1',
          client_name: 'Acme Corp',
          outstanding: { amount: '22000.00', currency: 'INR' },
          days_overdue: 12,
          reason: 'CRITICAL priority · 12 days overdue · ₹22,000 outstanding · Reliability score 42%',
          score: 95,
          suggested_tone: 'FIRM',
        }
        renderWithProviders(
          <UpNextList items={[item]} onComplete={vi.fn()} onSelect={vi.fn()} />
        )

        expect(screen.getAllByText(/Critical priority/i)).toHaveLength(1)
        expect(screen.getAllByText(/12 days overdue/i)).toHaveLength(1)
        expect(screen.getAllByText(/₹22,000/)).toHaveLength(1)
        expect(screen.getByText('Reliability score 42%')).toBeInTheDocument()
        expect(screen.getByText('Suggested: FIRM')).toBeInTheDocument()
      })
    })
  })

  describe('2.5 StatusStepper branch rendering', () => {
    it('renders dispute branch without placing dispute on linear happy path', () => {
      render(<StatusStepper status="DISPUTED" amountPaid={0} />)

      // Main happy path steps exist
      expect(screen.getByText('Draft')).toBeInTheDocument()
      expect(screen.getByText('Sent')).toBeInTheDocument()
      expect(screen.getByText('Partial')).toBeInTheDocument()
      expect(screen.getByText('Settled')).toBeInTheDocument()

      // Sent step should be active/highlighted since amountPaid is 0
      const sentText = screen.getByText('Sent')
      expect(sentText.className).toContain('text-tint')

      // Dispute branch banner
      const branch = screen.getByTestId('status-stepper-branch')
      expect(branch).toBeInTheDocument()
      expect(screen.getByText(/Dispute active: collection paused/i)).toBeInTheDocument()
    })

    it('renders written off branch with danger styling', () => {
      render(<StatusStepper status="WRITTEN_OFF" amountPaid={500} />)

      // Partial step should be highlighted because amountPaid > 0
      const partialText = screen.getByText('Partial')
      expect(partialText.className).toContain('text-tint')

      const branch = screen.getByTestId('status-stepper-branch')
      expect(branch).toBeInTheDocument()
      expect(screen.getByText(/Written off: bad debt recorded/i)).toBeInTheDocument()
    })
  })

  describe('2.6 NewInvoicePage Form Validation', () => {
    it('disables submit button when required amount is missing or due date is before issue date', () => {
      const client = new QueryClient()
      client.setQueryData(['clients'], [
        { id: 'c-1', name: 'Test Client', company_name: null, default_payment_terms_days: 14 },
      ])

      renderWithProviders(<NewInvoicePage />, client)

      const submitBtn = screen.getByRole('button', { name: /Create Draft Invoice/i })
      // Initially amount is empty, so submit should be disabled
      expect(submitBtn).toBeDisabled()

      // Enter valid amount
      const amountInput = screen.getByPlaceholderText('0.00')
      fireEvent.change(amountInput, { target: { value: '1500.00' } })

      // With default future dates, it should now be enabled
      expect(submitBtn).not.toBeDisabled()

      // Set due date before issue date
      const dateInputs = screen.getAllByDisplayValue(/20\d\d-\d\d-\d\d/)
      // Issue date is first, Due date is second
      fireEvent.change(dateInputs[0], { target: { value: '2026-11-20' } })
      fireEvent.change(dateInputs[1], { target: { value: '2026-11-10' } })

      // Error message should appear and submit button should be disabled
      expect(screen.getByText('Due date cannot be before issue date')).toBeInTheDocument()
      expect(submitBtn).toBeDisabled()
    })
  })

  describe('2.7 Date formatting consistency', () => {
    it('formats September dates as "Sep" and never "Sept"', () => {
      const formatted = formatDate('2026-09-15')
      expect(formatted).toContain('Sep')
      expect(formatted).not.toContain('Sept')
    })
  })
})
