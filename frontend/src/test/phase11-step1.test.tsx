import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
  eventTypeLabel,
} from '../lib/labels'
import { BlockersPanel } from '../features/invoices/detail/BlockersPanel'
import { HistoryPanel } from '../features/invoices/detail/HistoryPanel'
import { NewInvoicePage } from '../features/invoices/NewInvoicePage'
import type { InvoiceRead, AuditEventRead } from '../api/types'

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
      'ActionRescheduled',
    ]

    for (const ev of requiredEvents) {
      expect(eventTypeLabel[ev]).toBeDefined()
      expect(labelForEventType(ev)).not.toBe(ev)
    }

    // Fallback for unknown event name
    expect(labelForEventType('CustomStateChanged')).toBe('Custom State Changed')
  })

  it('provides complete enum label dictionaries without raw constant leaks', () => {
    expect(invoiceStatusLabel['PARTIALLY_PAID']).toBe('Partially paid')
    expect(invoiceStatusLabel['WRITTEN_OFF']).toBe('Written off')
    expect(blockerTypeLabel['MISSING_PO']).toBe('Missing PO')
    expect(blockerTypeLabel['WRONG_GSTIN']).toBe('Wrong GSTIN')
    expect(promiseStatusLabel['CANCELLED']).toBe('Cancelled')
    expect(actionSourceLabel['PROMISE_MISSED']).toBe('Missed promise')
    expect(priorityLabel['CRITICAL']).toBe('Critical')
    expect(channelLabel['BANK_TRANSFER']).toBeUndefined()
    expect(channelLabel['WHATSAPP']).toBe('WhatsApp')
    expect(followUpOutcomeLabel['PROMISE_TO_PAY']).toBe('Promise to pay')
    expect(paymentMethodLabel['BANK_TRANSFER']).toBe('Bank transfer')
    expect(documentTypeLabel['PURCHASE_ORDER']).toBe('Purchase order')
    expect(reminderToneLabel['POLITE']).toBe('Polite')

    expect(labelOrFallback(channelLabel, 'PHONE')).toBe('Phone')
    expect(labelOrFallback(channelLabel, 'UNKNOWN_CHANNEL')).toBe('Unknown Channel')
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
