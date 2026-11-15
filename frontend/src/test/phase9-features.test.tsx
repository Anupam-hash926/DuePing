import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { StatusStepper } from '../features/invoices/detail/StatusStepper'
import { FocusCard } from '../features/action-center/FocusCard'
import { ReminderPanel } from '../features/invoices/detail/ReminderPanel'
import { queryKeys, invalidateInvoiceDependencies } from '../api/queryClient'
import type { InvoiceRead, ActionCenterItemRead, ReminderRead } from '../api/types'

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
})

const mockInvoice: InvoiceRead = {
  id: 'inv-test-1',
  invoice_number: 'INV-2026-001',
  client: { id: 'c1', name: 'Acme Corp', reliability_score: 95, risk_level: 'LOW' },
  issue_date: '2026-11-01',
  due_date: '2026-11-15',
  total: { amount: '1000.00', currency: 'GBP' },
  amount_paid: { amount: '0.00', currency: 'GBP' },
  outstanding: { amount: '1000.00', currency: 'GBP' },
  status: 'SENT',
  is_overdue: false,
  days_overdue: 0,
  reminder_level: 1,
  allowed_operations: ['record_payment', 'raise_blocker', 'record_promise', 'send_reminder'],
  open_blocker_count: 0,
  pending_action_count: 1,
  payments: [],
  blockers: [],
  promises: [],
  follow_ups: [],
  documents: [],
  actions: [
    {
      id: 'act-1',
      invoice_id: 'inv-test-1',
      description: 'Follow up on invoice delivery',
      due_date: '2026-11-16',
      priority: 'MEDIUM',
      source: 'MANUAL',
      status: 'PENDING',
      completed_at: null,
    },
  ],
}

const mockReminder: ReminderRead = {
  subject: 'Friendly reminder: Invoice INV-2026-001 is due',
  body: 'Hi Acme team, just checking in regarding invoice INV-2026-001 for GBP 1,000.00.',
  tone: 'POLITE',
}

const mockActionItem: ActionCenterItemRead = {
  action: {
    id: 'act-focus-1',
    invoice_id: 'inv-test-1',
    description: 'Call billing team regarding missing PO',
    due_date: '2026-11-15',
    priority: 'HIGH',
    source: 'BLOCKER',
    status: 'PENDING',
    completed_at: null,
  },
  invoice_id: 'inv-test-1',
  invoice_number: 'INV-2026-001',
  client_id: 'c1',
  client_name: 'Acme Corp',
  outstanding: { amount: '1000.00', currency: 'GBP' },
  days_overdue: 5,
  reason: 'MISSING_PO · Blocked for 5 days',
  score: 85,
}

describe('Phase 9 Tests: StatusStepper', () => {
  it('highlights current status step accurately', () => {
    render(<StatusStepper status="SENT" />)
    expect(screen.getByText('Sent')).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('Settled')).toBeInTheDocument()

    // Sent step should carry active/highlight styling
    const sentText = screen.getByText('Sent')
    expect(sentText.className).toContain('text-tint')
  })

  it('renders disputed status banner correctly as active special state', () => {
    render(<StatusStepper status="DISPUTED" />)
    expect(screen.getByText(/Commercial dispute raised/i)).toBeInTheDocument()
  })
})

describe('Phase 9 Tests: FocusCard Keyboard Shortcuts', () => {
  it('triggers onComplete when pressing "d" or "D"', async () => {
    const handleComplete = vi.fn().mockResolvedValue(undefined)
    const handleReschedule = vi.fn().mockResolvedValue(undefined)
    const handleNext = vi.fn()
    const handlePrev = vi.fn()

    render(
      <MemoryRouter>
        <FocusCard
          item={mockActionItem}
          totalCount={3}
          currentIndex={0}
          onComplete={handleComplete}
          onReschedule={handleReschedule}
          onNext={handleNext}
          onPrev={handlePrev}
        />
      </MemoryRouter>
    )

    expect(screen.getByText('Call billing team regarding missing PO')).toBeInTheDocument()

    // Press 'd'
    fireEvent.keyDown(window, { key: 'd' })
    await waitFor(() => {
      expect(handleComplete).toHaveBeenCalledWith('inv-test-1', 'act-focus-1')
    })
  })

  it('triggers navigation on ArrowRight and ArrowLeft', () => {
    const handleComplete = vi.fn().mockResolvedValue(undefined)
    const handleReschedule = vi.fn().mockResolvedValue(undefined)
    const handleNext = vi.fn()
    const handlePrev = vi.fn()

    render(
      <MemoryRouter>
        <FocusCard
          item={mockActionItem}
          totalCount={3}
          currentIndex={0}
          onComplete={handleComplete}
          onReschedule={handleReschedule}
          onNext={handleNext}
          onPrev={handlePrev}
        />
      </MemoryRouter>
    )

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(handleNext).toHaveBeenCalled()

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(handlePrev).toHaveBeenCalled()
  })
})

describe('Phase 9 Tests: ReminderPanel', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    vi.clearAllMocks()
  })

  it('copies generated reminder to clipboard when clicking Copy', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ReminderPanel invoice={mockInvoice} initialReminder={mockReminder} />
      </QueryClientProvider>
    )

    const copyBtn = screen.getByText('Copy Text')
    fireEvent.click(copyBtn)

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockReminder.body)
  })

  it('allows switching tone via SegmentedControl', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ReminderPanel invoice={mockInvoice} initialReminder={mockReminder} />
      </QueryClientProvider>
    )

    const firmTab = screen.getByRole('tab', { name: 'Firm' })
    expect(firmTab).toBeInTheDocument()
    fireEvent.click(firmTab)
    expect(firmTab.getAttribute('aria-selected')).toBe('true')
  })
})

describe('Phase 9 Tests: Query Hooks Invalidation', () => {
  it('invalidates dependent queries on invoice mutation', () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')

    invalidateInvoiceDependencies(qc, 'inv-test-1')

    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.invoice('inv-test-1') })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['invoices'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['action-center'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard'] })
  })
})
