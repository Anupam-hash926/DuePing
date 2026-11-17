import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../context/ToastContext'
import { ProgressRing } from '../ui/ProgressRing'
import { SegmentedControl } from '../ui/SegmentedControl'
import { StatusStepper } from '../features/invoices/detail/StatusStepper'
import { FocusCard } from '../features/action-center/FocusCard'
import { NewInvoicePage } from '../features/invoices/NewInvoicePage'
import { formatDate } from '../lib/format'
import type { ActionCenterItemRead } from '../api/types'

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
    it('renders accessible progressbar with aria attributes for score 0, 33, 100', () => {
      const { rerender } = render(<ProgressRing score={0} size={48} />)
      let ring = screen.getByRole('progressbar')
      expect(ring).toHaveAttribute('aria-valuenow', '0')
      expect(ring).toHaveAttribute('aria-valuemin', '0')
      expect(ring).toHaveAttribute('aria-valuemax', '100')
      expect(ring).toHaveAttribute('aria-label', 'Reliability score: 0%')

      rerender(<ProgressRing score={33} size={48} />)
      ring = screen.getByRole('progressbar')
      expect(ring).toHaveAttribute('aria-valuenow', '33')
      expect(ring).toHaveAttribute('aria-label', 'Reliability score: 33%')

      rerender(<ProgressRing score={100} size={48} />)
      ring = screen.getByRole('progressbar')
      expect(ring).toHaveAttribute('aria-valuenow', '100')
      expect(ring).toHaveAttribute('aria-label', 'Reliability score: 100%')
    })

    it('renders stroke dash offset corresponding to progress percentage', () => {
      const { container } = render(<ProgressRing score={50} size={40} strokeWidth={4} />)
      const circles = container.querySelectorAll('circle')
      expect(circles.length).toBe(2) // background track circle + indicator circle
      const indicator = circles[1]
      expect(indicator).toHaveAttribute('stroke-dasharray')
      expect(indicator).toHaveAttribute('stroke-dashoffset')
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
