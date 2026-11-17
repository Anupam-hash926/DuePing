/**
 * Human-readable labels for domain enums, status codes, and domain event types.
 */
import type {
  ActionSource,
  ActionStatus,
  BlockerStatus,
  BlockerType,
  Channel,
  DocumentType,
  FollowUpOutcome,
  InvoiceStatus,
  PaymentMethod,
  Priority,
  PromiseStatus,
  ReminderTone,
  RiskLevel,
} from '../api/types'

export const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  DISPUTED: 'Disputed',
  WRITTEN_OFF: 'Written off',
}

export const blockerTypeLabel: Record<BlockerType, string> = {
  MISSING_PO: 'Missing PO',
  AWAITING_APPROVAL: 'Awaiting approval',
  DISPUTED_AMOUNT: 'Disputed amount',
  WRONG_DETAILS: 'Wrong details',
  MISSING_DOCUMENTS: 'Missing documents',
  NO_RESPONSE: 'No response',
  OTHER: 'Other',
}

export const blockerStatusLabel: Record<BlockerStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
}

export const promiseStatusLabel: Record<PromiseStatus, string> = {
  PENDING: 'Pending',
  KEPT: 'Kept',
  MISSED: 'Missed',
  SUPERSEDED: 'Superseded',
}

export const actionStatusLabel: Record<ActionStatus, string> = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export const actionSourceLabel: Record<ActionSource, string> = {
  BLOCKER: 'Blocker',
  PROMISE_MISSED: 'Missed promise',
  OVERDUE: 'Overdue',
  MANUAL: 'Manual',
}

export const priorityLabel: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

export const channelLabel: Record<Channel, string> = {
  EMAIL: 'Email',
  PHONE: 'Phone',
  WHATSAPP: 'WhatsApp',
  MEETING: 'Meeting',
  OTHER: 'Other',
}

export const followUpOutcomeLabel: Record<FollowUpOutcome, string> = {
  NO_RESPONSE: 'No response',
  ACKNOWLEDGED: 'Acknowledged',
  PROMISED_PAYMENT: 'Promised payment',
  DISPUTED: 'Disputed',
  PAID: 'Paid',
  OTHER: 'Other',
}

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Bank transfer',
  UPI: 'UPI',
  CARD: 'Card',
  CASH: 'Cash',
  CHEQUE: 'Cheque',
  OTHER: 'Other',
}

export const documentTypeLabel: Record<DocumentType, string> = {
  PURCHASE_ORDER: 'Purchase order',
  INVOICE_COPY: 'Invoice copy',
  APPROVAL_EVIDENCE: 'Approval evidence',
  CONTRACT: 'Contract',
  OTHER: 'Other',
}

export const reminderToneLabel: Record<ReminderTone, string> = {
  POLITE: 'Polite',
  FIRM: 'Firm',
  FINAL: 'Final',
}

export const riskLevelLabel: Record<RiskLevel, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
}

type DomainEventType =
  | 'DomainEvent'
  | 'InvoiceSent'
  | 'PaymentReceived'
  | 'InvoicePaid'
  | 'InvoiceDisputed'
  | 'DisputeResolved'
  | 'InvoiceWrittenOff'
  | 'BlockerRaised'
  | 'BlockerResolved'
  | 'PromiseRecorded'
  | 'PromiseKept'
  | 'PromiseMissed'
  | 'InvoiceBecameOverdue'
  | 'FollowUpLogged'
  | 'ReminderSent'
  | 'DocumentAttached'
  | 'DocumentRemoved'
  | 'ActionCreated'
  | 'ActionCompleted'
  | 'ActionReopened'
  | 'ActionRescheduled'
  | 'ActionsCancelled'

export const eventTypeLabel: Record<DomainEventType, string> = {
  DomainEvent: 'Activity recorded',
  InvoiceSent: 'Invoice sent',
  PaymentReceived: 'Payment received',
  InvoicePaid: 'Invoice paid',
  InvoiceDisputed: 'Invoice disputed',
  DisputeResolved: 'Dispute resolved',
  InvoiceWrittenOff: 'Written off',
  BlockerRaised: 'Blocker raised',
  BlockerResolved: 'Blocker resolved',
  PromiseRecorded: 'Promise recorded',
  PromiseKept: 'Promise kept',
  PromiseMissed: 'Promise missed',
  InvoiceBecameOverdue: 'Became overdue',
  FollowUpLogged: 'Follow-up logged',
  ReminderSent: 'Reminder sent',
  DocumentAttached: 'Document attached',
  DocumentRemoved: 'Document removed',
  ActionCreated: 'Action created',
  ActionCompleted: 'Action completed',
  ActionReopened: 'Action reopened',
  ActionRescheduled: 'Action rescheduled',
  ActionsCancelled: 'Actions cancelled',
}

/** Convert an event class name to a human label. Unknown values are title-cased. */
export function labelForEventType(raw: string): string {
  if (raw in eventTypeLabel) return eventTypeLabel[raw as DomainEventType]
  return raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/** Pluralize a noun: plural(1, 'blocker') -> '1 blocker', plural(2, 'blocker') -> '2 blockers' */
export function plural(n: number, noun: string): string {
  return `${n} ${n === 1 ? noun : noun + 's'}`
}

/** Get a human label for an enum value; unknown values are title-cased, never raw constants. */
export function labelOrFallback(map: Record<string, string>, raw?: string | null): string {
  if (!raw) return '—'
  return (
    map[raw] ??
    raw
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  )
}
