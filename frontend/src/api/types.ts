/**
 * DuePing API TypeScript types.
 *
 * Strict mirror of Pydantic schemas defined in backend/app/api/schemas.py.
 */

export interface MoneyDTO {
  amount: string
  currency: string
}

export interface SuccessResponse {
  ok: boolean
}

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'DISPUTED' | 'WRITTEN_OFF'
export type BlockerType =
  | 'MISSING_PO'
  | 'AWAITING_APPROVAL'
  | 'DISPUTED_AMOUNT'
  | 'WRONG_DETAILS'
  | 'MISSING_DOCUMENTS'
  | 'NO_RESPONSE'
  | 'OTHER'
export type BlockerStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'
export type PromiseStatus = 'PENDING' | 'KEPT' | 'MISSED' | 'SUPERSEDED'
export type ActionStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED'
export type ActionSource = 'BLOCKER' | 'PROMISE_MISSED' | 'OVERDUE' | 'MANUAL'
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type Channel = 'EMAIL' | 'PHONE' | 'WHATSAPP' | 'MEETING' | 'OTHER'
export type FollowUpOutcome =
  | 'NO_RESPONSE'
  | 'ACKNOWLEDGED'
  | 'PROMISED_PAYMENT'
  | 'DISPUTED'
  | 'PAID'
  | 'OTHER'
export type PaymentMethod = 'BANK_TRANSFER' | 'UPI' | 'CARD' | 'CASH' | 'CHEQUE' | 'OTHER'
export type DocumentType = 'PURCHASE_ORDER' | 'INVOICE_COPY' | 'APPROVAL_EVIDENCE' | 'CONTRACT' | 'OTHER'
export type ReminderTone = 'POLITE' | 'FIRM' | 'FINAL'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

// ---------------------------------------------------------------------------
// Clients & Projects
// ---------------------------------------------------------------------------

export interface ClientSnippet {
  id: string
  name: string
  company_name?: string | null
  reliability_score: number
  risk_level: RiskLevel
}

export interface ClientRead {
  id: string
  name: string
  email: string
  phone?: string | null
  company_name?: string | null
  reliability_score: number
  risk_level: RiskLevel
  promises_kept_count: number
  promises_broken_count: number
  created_at: string
}

export interface ClientCreate {
  name: string
  email: string
  phone?: string | null
  company_name?: string | null
}

export interface ClientUpdate {
  name?: string | null
  email?: string | null
  phone?: string | null
  company_name?: string | null
}

export interface ClientSummaryRead extends ClientRead {
  total_outstanding: MoneyDTO
  invoices: InvoiceSummaryRead[]
}

export interface ProjectSnippet {
  id: string
  project_name: string
}

export interface ProjectRead {
  id: string
  client_id: string
  project_name: string
  description?: string | null
  start_date: string
  status: string
}

export interface ProjectCreate {
  client_id: string
  project_name: string
  description?: string | null
  start_date: string
}

// ---------------------------------------------------------------------------
// Invoice Children
// ---------------------------------------------------------------------------

export interface PaymentRead {
  id: string
  amount: MoneyDTO
  payment_date: string
  method: PaymentMethod
  reference_number?: string | null
  recorded_at: string
}

export interface PaymentCreate {
  amount: string
  payment_date: string
  method: PaymentMethod
  reference_number?: string | null
}

export interface BlockerRead {
  id: string
  type: BlockerType
  description?: string | null
  assigned_to?: string | null
  status: BlockerStatus
  created_at: string
  resolved_at?: string | null
}

export interface BlockerCreate {
  type: BlockerType
  description?: string | null
  assigned_to?: string | null
}

export interface BlockerPatch {
  assigned_to?: string | null
  status?: BlockerStatus | null
}

export interface PromiseRead {
  id: string
  promised_date: string
  amount?: MoneyDTO | null
  note?: string | null
  status: PromiseStatus
  created_at: string
}

export interface PromiseCreate {
  promised_date: string
  amount?: string | null
  note?: string | null
}

export interface FollowUpRead {
  id: string
  contact_date: string
  channel: Channel
  notes: string
  outcome: FollowUpOutcome
  promised_date?: string | null
  promised_amount?: MoneyDTO | null
}

export interface FollowUpCreate {
  channel: Channel
  notes: string
  outcome: FollowUpOutcome
  contact_date?: string | null
  promised_date?: string | null
  promised_amount?: string | null
}

export interface DocumentRead {
  id: string
  document_type: DocumentType
  file_name: string
  file_type: string
  file_path: string
  uploaded_at: string
}

export interface DocumentCreate {
  document_type: DocumentType
  file_name: string
  file_path: string
}

export interface NextActionRead {
  id: string
  invoice_id?: string | null
  description: string
  priority: Priority
  due_date: string
  status: ActionStatus
  source: ActionSource
  completed_at?: string | null
}

export interface NextActionCreate {
  description: string
  priority: Priority
  due_date: string
}

export interface NextActionReschedule {
  new_date: string
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export interface InvoiceSummaryRead {
  id: string
  invoice_number: string
  client: ClientSnippet
  project?: ProjectSnippet | null
  issue_date: string
  due_date: string
  total: MoneyDTO
  amount_paid: MoneyDTO
  outstanding: MoneyDTO
  status: InvoiceStatus
  is_overdue: boolean
  days_overdue: number
  reminder_level: number
  allowed_operations: string[]
  open_blocker_count: number
  pending_action_count: number
}

export interface InvoiceRead extends InvoiceSummaryRead {
  payments: PaymentRead[]
  blockers: BlockerRead[]
  promises: PromiseRead[]
  follow_ups: FollowUpRead[]
  documents: DocumentRead[]
  actions: NextActionRead[]
}

export interface InvoiceCreate {
  client_id: string
  total_amount: string
  issue_date: string
  due_date: string
  invoice_number?: string | null
  project_id?: string | null
}

export interface InvoiceUpdate {
  due_date?: string | null
  total_amount?: string | null
  project_id?: string | null
}

export interface InvoiceWriteOff {
  reason: string
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export interface ReminderRead {
  tone: ReminderTone
  subject: string
  body: string
}

export interface ReminderSentCreate {
  tone: ReminderTone
  channel: Channel
}

// ---------------------------------------------------------------------------
// Action Centre
// ---------------------------------------------------------------------------

export interface ActionCenterItemRead {
  action: NextActionRead
  invoice_id: string
  invoice_number: string
  client_id: string
  client_name: string
  outstanding: MoneyDTO
  days_overdue: number
  score: number
  reason: string
  suggested_tone?: ReminderTone | null
}

export interface StrategyInfoRead {
  key: string
  label: string
}

export interface ActionCenterRead {
  strategy: string
  today: string
  strategies: StrategyInfoRead[]
  items: ActionCenterItemRead[]
  upcoming: ActionCenterItemRead[]
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export interface ImportRequest {
  format: string
  content: string
}

export interface RowErrorRead {
  row_number: number
  messages: string[]
}

export interface ImportResultRead {
  processed: number
  imported: number
  rejected: number
  errors: RowErrorRead[]
  file_errors: string[]
  summary: string
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export interface AgingRowRead {
  bucket: string
  label: string
  count: number
  amount: MoneyDTO
}

export interface TrendPointRead {
  month: string
  collected: MoneyDTO
}

export interface DebtorRowRead {
  client_id: string
  name: string
  outstanding: MoneyDTO
  reliability_score: number | null
}

export interface CollectionReportRead {
  generated_at: string
  total_outstanding: MoneyDTO
  total_overdue: MoneyDTO
  overdue_count: number
  active_count: number
  broken_promises: number
  kept_promises: number
  promise_keep_rate?: number | null
  collected_this_month: MoneyDTO
  status_counts: Record<string, number>
  open_blockers_by_type: Record<string, number>
  top_debtors: DebtorRowRead[]
  collection_trend: TrendPointRead[]
  aging: AgingRowRead[]
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

export interface DailyCheckSummaryRead {
  date: string
  invoices_checked: number
  promises_missed: number
  newly_overdue: number
}

export interface SimulatedDateRead {
  today: string
  simulated: boolean
}

export interface SimulatedDateUpdate {
  date?: string | null
}

export interface SettingsRead {
  sender_name: string
  default_currency: string
}

export interface SettingsUpdate {
  sender_name?: string | null
  default_currency?: string | null
}

export interface AuditEventRead {
  id: string
  occurred_at: string
  event_type: string
  invoice_id?: string | null
  description: string
}

export interface NotificationRead {
  id: string
  message: string
  created_at: string
  is_read: boolean
}

export interface HandlerFailureRead {
  id: string
  occurred_at: string
  event_type: string
  handler: string
  error: string
}
