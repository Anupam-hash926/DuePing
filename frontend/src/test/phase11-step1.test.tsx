import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../context/ToastContext'
import {
  plural,
  labelForEventType,
  labelOrFallback,
  invoiceStatusLabel,
  blockerTypeLabel,
  promiseStatusLabel,
  actionSourceLabel,
  priorityLabel,
  channelLabel,
  followUpOutcomeLabel,
  paymentMethodLabel,
  documentTypeLabel,
  reminderToneLabel,
  blockerStatusLabel,
  actionStatusLabel,
  eventTypeLabel,
} from '../lib/labels'
import { BlockersPanel } from '../features/invoices/detail/BlockersPanel'
import { HistoryPanel } from '../features/invoices/detail/HistoryPanel'
import { ActionsPanel } from '../features/invoices/detail/ActionsPanel'
import { DocumentsPanel } from '../features/invoices/detail/DocumentsPanel'
import { PaymentsPanel } from '../features/invoices/detail/PaymentsPanel'
import { PromisesTimeline } from '../features/invoices/detail/PromisesTimeline'
import { ReminderPanel } from '../features/invoices/detail/ReminderPanel'
import { NewInvoicePage } from '../features/invoices/NewInvoicePage'
import { FocusCard } from '../features/action-center/FocusCard'
import { UpNextList } from '../features/action-center/UpNextList'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import type { ActionCenterItemRead, InvoiceRead, AuditEventRead } from '../api/types'

// Setup query client wrapper
function renderWithProviders(ui: React.ReactElement, queryClient = new QueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

const baseInvoice: InvoiceRead = {
  id: 'inv-1',
  invoice_number: 'INV-2026-001',
  client: { id: 'c1', name: 'Acme Corp', reliability_score: 95, risk_level: 'LOW' },
  issue_date: '2026-10-01',
  due_date: '2026-10-15',
  total: { amount: '1000.00', currency: 'INR' },
  amount_paid: { amount: '0.00', currency: 'INR' },
  outstanding: { amount: '1000.00', currency: 'INR' },
  status: 'SENT',
  is_overdue: false,
  days_overdue: 0,
  reminder_level: 0,
  allowed_operations: ['raise_blocker', 'log_follow_up'],
  open_blocker_count: 0,
  pending_action_count: 0,
  payments: [],
  blockers: [],
  promises: [],
  follow_ups: [],
  documents: [],
  actions: [],
}

describe('Step 1.3: Labels and Pluralization', () => {
  it('pluralizes correctly for 0, 1, and many', () => {
    expect(plural(0, 'blocker')).toBe('0 blockers')
    expect(plural(1, 'blocker')).toBe('1 blocker')
    expect(plural(2, 'blocker')).toBe('2 blockers')
    expect(plural(5, 'action')).toBe('5 actions')
    expect(plural(1, 'action')).toBe('1 action')
  })

  it('maps all domain event types to human labels', () => {
    const requiredEvents = [
      'DomainEvent',
      'InvoiceSent',
      'PaymentReceived',
      'InvoicePaid',
      'InvoiceDisputed',
      'DisputeResolved',
      'InvoiceWrittenOff',
      'BlockerRaised',
      'BlockerResolved',
      'PromiseRecorded',
      'PromiseKept',
      'PromiseMissed',
      'InvoiceBecameOverdue',
      'FollowUpLogged',
      'ReminderSent',
      'DocumentAttached',
      'DocumentRemoved',
      'ActionCreated',
      'ActionCompleted',
      'ActionReopened',
      'ActionRescheduled',
      'ActionsCancelled',
    ]

    expect(Object.keys(eventTypeLabel).sort()).toEqual(requiredEvents.sort())
    for (const ev of requiredEvents) {
      expect(labelForEventType(ev)).not.toBe(ev)
    }

    // Fallback for unknown event name
    expect(labelForEventType('CustomStateChanged')).toBe('Custom State Changed')
    expect(labelForEventType('NEW_EVENT_TYPE')).toBe('New Event Type')
  })

  it('provides complete enum label dictionaries without raw constant leaks', () => {
    const enumLabels: Record<string, Record<string, string>> = {
      invoiceStatusLabel: {
        DRAFT: 'Draft',
        SENT: 'Sent',
        PARTIALLY_PAID: 'Partially paid',
        PAID: 'Paid',
        DISPUTED: 'Disputed',
        WRITTEN_OFF: 'Written off',
      },
      blockerTypeLabel: {
        MISSING_PO: 'Missing PO',
        AWAITING_APPROVAL: 'Awaiting approval',
        DISPUTED_AMOUNT: 'Disputed amount',
        WRONG_DETAILS: 'Wrong details',
        MISSING_DOCUMENTS: 'Missing documents',
        NO_RESPONSE: 'No response',
        OTHER: 'Other',
      },
      blockerStatusLabel: { OPEN: 'Open', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved' },
      promiseStatusLabel: {
        PENDING: 'Pending',
        KEPT: 'Kept',
        MISSED: 'Missed',
        SUPERSEDED: 'Superseded',
      },
      actionStatusLabel: { PENDING: 'Pending', COMPLETED: 'Completed', CANCELLED: 'Cancelled' },
      actionSourceLabel: {
        BLOCKER: 'Blocker',
        PROMISE_MISSED: 'Missed promise',
        OVERDUE: 'Overdue',
        MANUAL: 'Manual',
      },
      priorityLabel: { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' },
      channelLabel: {
        EMAIL: 'Email',
        PHONE: 'Phone',
        WHATSAPP: 'WhatsApp',
        MEETING: 'Meeting',
        OTHER: 'Other',
      },
      followUpOutcomeLabel: {
        NO_RESPONSE: 'No response',
        ACKNOWLEDGED: 'Acknowledged',
        PROMISED_PAYMENT: 'Promised payment',
        DISPUTED: 'Disputed',
        PAID: 'Paid',
        OTHER: 'Other',
      },
      paymentMethodLabel: {
        BANK_TRANSFER: 'Bank transfer',
        UPI: 'UPI',
        CARD: 'Card',
        CASH: 'Cash',
        CHEQUE: 'Cheque',
        OTHER: 'Other',
      },
      documentTypeLabel: {
        PURCHASE_ORDER: 'Purchase order',
        INVOICE_COPY: 'Invoice copy',
        APPROVAL_EVIDENCE: 'Approval evidence',
        CONTRACT: 'Contract',
        OTHER: 'Other',
      },
      reminderToneLabel: { POLITE: 'Polite', FIRM: 'Firm', FINAL: 'Final' },
    }

    const actualMaps: Record<string, Record<string, string>> = {
      invoiceStatusLabel,
      blockerTypeLabel,
      blockerStatusLabel,
      promiseStatusLabel,
      actionStatusLabel,
      actionSourceLabel,
      priorityLabel,
      channelLabel,
      followUpOutcomeLabel,
      paymentMethodLabel,
      documentTypeLabel,
      reminderToneLabel,
    }

    for (const [mapName, expected] of Object.entries(enumLabels)) {
      const actual = actualMaps[mapName as keyof typeof actualMaps]
      expect(Object.keys(actual).sort(), mapName).toEqual(Object.keys(expected).sort())
      for (const [value, label] of Object.entries(expected)) {
        expect(actual[value], `${mapName}.${value}`).toBe(label)
        expect(actual[value], `${mapName}.${value}`).not.toMatch(/_/)
      }
    }

    expect(labelOrFallback(channelLabel, 'PHONE')).toBe('Phone')
    expect(labelOrFallback(channelLabel, 'UNKNOWN_CHANNEL')).toBe('Unknown Channel')
  })

  it('renders human-readable labels for invoice enum values', () => {
    const invoice: InvoiceRead = {
      ...baseInvoice,
      blockers: [{
        id: 'blocker-1',
        type: 'DISPUTED_AMOUNT',
        description: 'Amount is disputed',
        status: 'OPEN',
        created_at: '2026-11-17T10:00:00Z',
      }],
      actions: [{
        id: 'action-1',
        invoice_id: 'inv-1',
        description: 'Review the account',
        priority: 'HIGH',
        due_date: '2026-11-17',
        status: 'PENDING',
        source: 'MANUAL',
      }],
      documents: [{
        id: 'doc-1',
        document_type: 'APPROVAL_EVIDENCE',
        file_name: 'approval.pdf',
        file_type: 'application/pdf',
        file_path: '/approval.pdf',
        uploaded_at: '2026-11-17T10:00:00Z',
      }],
      payments: [{
        id: 'payment-1',
        amount: { amount: '100.00', currency: 'INR' },
        payment_date: '2026-11-17',
        method: 'BANK_TRANSFER',
        recorded_at: '2026-11-17T10:00:00Z',
      }],
      promises: [{
        id: 'promise-1',
        promised_date: '2026-11-20',
        status: 'SUPERSEDED',
        created_at: '2026-11-17T10:00:00Z',
      }],
    }

    renderWithProviders(
      <>
        <BlockersPanel invoice={invoice} modalOpen={false} onModalChange={vi.fn()} />
        <ActionsPanel invoice={invoice} />
        <DocumentsPanel invoice={invoice} />
        <PaymentsPanel invoice={invoice} modalOpen={false} onModalChange={vi.fn()} />
        <PromisesTimeline invoice={invoice} />
      </>
    )

    expect(screen.getByText('Disputed amount')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Approval evidence')).toBeInTheDocument()
    expect(screen.getByText('Bank transfer')).toBeInTheDocument()
    expect(screen.getByText('Superseded')).toBeInTheDocument()
    expect(screen.queryByText('DISPUTED_AMOUNT')).not.toBeInTheDocument()
    expect(screen.queryByText('HIGH')).not.toBeInTheDocument()
    expect(screen.queryByText('APPROVAL_EVIDENCE')).not.toBeInTheDocument()
    expect(screen.queryByText('BANK_TRANSFER')).not.toBeInTheDocument()
    expect(screen.queryByText('SUPERSEDED')).not.toBeInTheDocument()
  })

  it('renders the reminder tone as a human-readable label', () => {
    renderWithProviders(
      <ReminderPanel
        invoice={baseInvoice}
        initialReminder={{
          tone: 'FINAL',
          subject: 'Payment reminder',
          body: 'Please arrange payment.',
        }}
      />
    )

    expect(screen.getByText('Final Tone')).toBeInTheDocument()
    expect(screen.queryByText('FINAL Tone')).not.toBeInTheDocument()
  })

  it('renders dashboard blocker types as human-readable labels', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(['settings'], { default_currency: 'INR', sender_name: 'DuePing' })
    queryClient.setQueryData(['dashboard'], {
      generated_at: '2026-11-17T10:00:00Z',
      total_outstanding: { amount: '1000.00', currency: 'INR' },
      total_overdue: { amount: '500.00', currency: 'INR' },
      overdue_count: 1,
      active_count: 1,
      broken_promises: 0,
      kept_promises: 1,
      promise_keep_rate: 100,
      collected_this_month: { amount: '0.00', currency: 'INR' },
      status_counts: {},
      open_blockers_by_type: { DISPUTED_AMOUNT: 1 },
      top_debtors: [],
      collection_trend: [],
      aging: [],
    })

    renderWithProviders(<DashboardPage />, queryClient)

    expect(screen.getByText('Disputed amount')).toBeInTheDocument()
    expect(screen.queryByText('DISPUTED_AMOUNT')).not.toBeInTheDocument()
  })

  it('offers only backend-supported follow-up enum values', () => {
    renderWithProviders(
      <HistoryPanel
        invoice={baseInvoice}
        auditEvents={[]}
        followUpModalOpen
        onFollowUpModalChange={vi.fn()}
      />
    )

    expect(screen.getByRole('option', { name: 'Meeting' })).toHaveValue('MEETING')
    expect(screen.getByRole('option', { name: 'Promised payment' })).toHaveValue('PROMISED_PAYMENT')
    expect(screen.queryByRole('option', { name: 'In Person' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Promise to Pay' })).not.toBeInTheDocument()
  })

  it('offers only backend-supported document type values', () => {
    renderWithProviders(
      <DocumentsPanel
        invoice={{ ...baseInvoice, allowed_operations: [...baseInvoice.allowed_operations, 'attach_document'] }}
      />
    )
    fireEvent.click(screen.getByText('Attach Document'))

    expect(screen.getByRole('option', { name: 'Approval evidence' })).toHaveValue('APPROVAL_EVIDENCE')
    expect(screen.queryByRole('option', { name: 'Timesheet' })).not.toBeInTheDocument()
  })
})

describe('Step 1.4: State-aware Empty States', () => {
  it('renders "Nothing is holding this invoice back" when not overdue and no blockers', () => {
    renderWithProviders(
      <BlockersPanel
        invoice={{ ...baseInvoice, is_overdue: false, blockers: [] }}
        modalOpen={false}
        onModalChange={vi.fn()}
      />
    )

    expect(
      screen.getByText('No blockers. Nothing is holding this invoice back.')
    ).toBeInTheDocument()
  })

  it('renders "Raise one to get a recommended next step" when overdue and no blockers', () => {
    renderWithProviders(
      <BlockersPanel
        invoice={{ ...baseInvoice, is_overdue: true, days_overdue: 10, blockers: [] }}
        modalOpen={false}
        onModalChange={vi.fn()}
      />
    )

    expect(
      screen.getByText('No blockers recorded. Raise one to get a recommended next step.')
    ).toBeInTheDocument()
  })

  it('renders HistoryPanel with human event label instead of raw class name', () => {
    const mockAuditEvents: AuditEventRead[] = [
      {
        id: 'aud-1',
        invoice_id: 'inv-1',
        event_type: 'InvoiceSent',
        description: 'Invoice sent to customer via email',
        occurred_at: '2026-11-17T10:00:00Z',
      },
    ]

    renderWithProviders(
      <HistoryPanel
        invoice={baseInvoice}
        auditEvents={mockAuditEvents}
        followUpModalOpen={false}
        onFollowUpModalChange={vi.fn()}
      />
    )

    expect(screen.getByText('Invoice sent')).toBeInTheDocument()
    expect(screen.queryByText('InvoiceSent')).not.toBeInTheDocument()
    expect(screen.getByText(/Conversations/)).toBeInTheDocument()
    expect(screen.getByText(/Activity/)).toBeInTheDocument()
  })
})

describe('Step 1.1: Live suggested reminder tone', () => {
  const actionItem: ActionCenterItemRead = {
    action: {
      id: 'action-1',
      invoice_id: 'inv-1',
      description: 'Send a reminder to Acme about overdue invoice INV-2026-001',
      priority: 'HIGH' as const,
      due_date: '2026-11-17',
      status: 'PENDING' as const,
      source: 'OVERDUE',
    },
    invoice_id: 'inv-1',
    invoice_number: 'INV-2026-001',
    client_id: 'c1',
    client_name: 'Acme Corp',
    outstanding: { amount: '1000.00', currency: 'INR' },
    days_overdue: 30,
    score: 85,
    reason: 'HIGH priority · 30 days overdue · INR 1,000.00 outstanding · client reliability 95%',
    suggested_tone: 'FINAL' as const,
  }

  it('shows the suggested tone on the Focus card', () => {
    renderWithProviders(
      <FocusCard
        item={actionItem}
        totalCount={1}
        currentIndex={0}
        onComplete={vi.fn().mockResolvedValue(undefined)}
        onReschedule={vi.fn().mockResolvedValue(undefined)}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />
    )

    expect(screen.getByText('Suggested: FINAL')).toBeInTheDocument()
  })

  it('shows the suggested tone in the Up Next list', () => {
    renderWithProviders(
      <UpNextList
        items={[actionItem]}
        onComplete={vi.fn().mockResolvedValue(undefined)}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('Suggested: FINAL')).toBeInTheDocument()
  })
})

describe('Step 1.2: Dynamic Currency in NewInvoicePage', () => {
  it('renders the Total amount label using dynamic currency from settings', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    // Pre-populate settings query with INR
    queryClient.setQueryData(['settings'], {
      id: 'default',
      default_currency: 'INR',
      sender_name: 'Antigravity Finance',
      sender_email: 'finance@dueping.example.com',
      company_name: 'DuePing Corp',
    })
    queryClient.setQueryData(['clients'], [
      { id: 'c1', name: 'Acme Corp', email: 'acme@example.com' },
    ])

    renderWithProviders(<NewInvoicePage />, queryClient)

    expect(screen.getByText(/Total amount \(INR\) \*/i)).toBeInTheDocument()
    expect(screen.queryByText(/Total Amount \(GBP\)/i)).not.toBeInTheDocument()
  })
})
