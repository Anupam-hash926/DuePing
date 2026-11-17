/**
 * Human-readable labels for domain enums, status codes, and domain event types.
 */

// Invoice status
export const invoiceStatusLabel: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  DISPUTED: 'Disputed',
  WRITTEN_OFF: 'Written off',
}

// Blocker type
export const blockerTypeLabel: Record<string, string> = {
  MISSING_PO: 'Missing PO',
  AWAITING_APPROVAL: 'Awaiting approval',
  WRONG_GSTIN: 'Wrong GSTIN',
  QUANTITY_MISMATCH: 'Quantity mismatch',
  WRONG_AMOUNT: 'Wrong amount',
  GOODS_NOT_DELIVERED: 'Goods not delivered',
  PORTAL_ISSUE: 'Portal issue',
  OTHER: 'Other',
}

// Promise status
export const promiseStatusLabel: Record<string, string> = {
  PENDING: 'Pending',
  KEPT: 'Kept',
  MISSED: 'Missed',
  CANCELLED: 'Cancelled',
}

// Action source
export const actionSourceLabel: Record<string, string> = {
  BLOCKER: 'Blocker',
  PROMISE_MISSED: 'Missed promise',
  OVERDUE: 'Overdue',
  MANUAL: 'Manual',
}

// Priority
export const priorityLabel: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

// Channel
export const channelLabel: Record<string, string> = {
  EMAIL: 'Email',
  PHONE: 'Phone',
  WHATSAPP: 'WhatsApp',
  IN_PERSON: 'In person',
  PORTAL: 'Portal',
  OTHER: 'Other',
}

// Follow-up outcome
export const followUpOutcomeLabel: Record<string, string> = {
  PROMISE_TO_PAY: 'Promise to pay',
  DISPUTE_RAISED: 'Dispute raised',
  NO_RESPONSE: 'No response',
  PAID: 'Paid',
  PARTIAL_PAYMENT: 'Partial payment',
  ESCALATED: 'Escalated',
  OTHER: 'Other',
}

// Payment method
export const paymentMethodLabel: Record<string, string> = {
  BANK_TRANSFER: 'Bank transfer',
  UPI: 'UPI',
  CARD: 'Card',
  CHEQUE: 'Cheque',
  CASH: 'Cash',
  OTHER: 'Other',
}

// Document type
export const documentTypeLabel: Record<string, string> = {
  INVOICE: 'Invoice',
  PURCHASE_ORDER: 'Purchase order',
  CONTRACT: 'Contract',
  PROOF_OF_DELIVERY: 'Proof of delivery',
  CREDIT_NOTE: 'Credit note',
  PAYMENT_RECEIPT: 'Payment receipt',
  OTHER: 'Other',
}

// Reminder tone
export const reminderToneLabel: Record<string, string> = {
  POLITE: 'Polite',
  FIRM: 'Firm',
  FINAL: 'Final',
}

// Domain event class name -> human label
export const eventTypeLabel: Record<string, string> = {
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
}

/** Convert an event class name to a human-readable label. Unknown values fallback to CamelCase split. */
export function labelForEventType(raw: string): string {
  if (eventTypeLabel[raw]) return eventTypeLabel[raw]
  return raw.replace(/([A-Z])/g, ' $1').trim()
}

/** Pluralize a noun: plural(1, 'blocker') -> '1 blocker', plural(2, 'blocker') -> '2 blockers' */
export function plural(n: number, noun: string): string {
  return `${n} ${n === 1 ? noun : noun + 's'}`
}

/** Get human label for any enum value, with fallback to title-cased raw string. */
export function labelOrFallback(map: Record<string, string>, raw?: string | null): string {
  if (!raw) return '—'
  return (
    map[raw] ??
    raw
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  )
}
