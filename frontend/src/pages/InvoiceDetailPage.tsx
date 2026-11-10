import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { apiClient } from '../api/client'
import {
  InvoiceRead,
  AuditEventRead,
  ReminderRead,
} from '../api/types'
import {
  StatusBadge,
  PriorityBadge,
  PromiseBadge,
  BlockerBadge,
} from '../components/Badges'
import { useToast } from '../context/ToastContext'
import { formatDate, formatDateTime, formatMoney } from '../lib/format'

export const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { showSuccess, showError } = useToast()

  const [invoice, setInvoice] = useState<InvoiceRead | null>(null)
  const [auditEvents, setAuditEvents] = useState<AuditEventRead[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Modals & Panels
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false)
  const [showBlockerModal, setShowBlockerModal] = useState<boolean>(false)
  const [showFollowUpModal, setShowFollowUpModal] = useState<boolean>(false)
  const [showDocModal, setShowDocModal] = useState<boolean>(false)
  const [showActionModal, setShowActionModal] = useState<boolean>(false)
  const [showWriteOffModal, setShowWriteOffModal] = useState<boolean>(false)

  // Payment Form
  const [paymentAmount, setPaymentAmount] = useState<string>('')
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState<string>('BANK_TRANSFER')
  const [paymentRef, setPaymentRef] = useState<string>('')

  // Blocker Form
  const [blockerType, setBlockerType] = useState<string>('MISSING_PO')
  const [blockerDesc, setBlockerDesc] = useState<string>('')
  const [blockerOwner, setBlockerOwner] = useState<string>('')

  // Follow-up Form
  const [fuChannel, setFuChannel] = useState<string>('PHONE')
  const [fuNotes, setFuNotes] = useState<string>('')
  const [fuOutcome, setFuOutcome] = useState<string>('PROMISE_TO_PAY')
  const [fuPromisedDate, setFuPromisedDate] = useState<string>('')
  const [fuPromisedAmount, setFuPromisedAmount] = useState<string>('')

  // Document Form
  const [docType, setDocType] = useState<string>('PURCHASE_ORDER')
  const [docFileName, setDocFileName] = useState<string>('')

  // Next Action Form
  const [actionDesc, setActionDesc] = useState<string>('')
  const [actionPriority, setActionPriority] = useState<string>('HIGH')
  const [actionDueDate, setActionDueDate] = useState<string>(new Date().toISOString().split('T')[0])

  // Write off Form
  const [writeOffReason, setWriteOffReason] = useState<string>('')

  // Reschedule Action State
  const [rescheduleActionId, setRescheduleActionId] = useState<string | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState<string>('')

  // Reminder State
  const [reminder, setReminder] = useState<ReminderRead | null>(null)
  const [selectedTone, setSelectedTone] = useState<string>('')
  const [reminderChannel, setReminderChannel] = useState<string>('EMAIL')
  const reminderRef = useRef<HTMLDivElement>(null)

  const loadInvoice = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const inv = await apiClient.get<InvoiceRead>(`/invoices/${id}`)
      setInvoice(inv)
      setPaymentAmount(inv.outstanding.amount)

      // Fetch audit log
      const audit = await apiClient.get<AuditEventRead[]>(`/audit-log?invoice_id=${id}`)
      setAuditEvents(audit)

      // Fetch reminder
      const rem = await apiClient.get<ReminderRead>(`/invoices/${id}/reminder`)
      setReminder(rem)
      setSelectedTone(rem.tone)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [id, showError])

  useEffect(() => {
    loadInvoice()

    const handleRefresh = () => loadInvoice()
    window.addEventListener('dueping:refresh', handleRefresh)
    return () => window.removeEventListener('dueping:refresh', handleRefresh)
  }, [loadInvoice])

  // Scroll to reminder tab if query param present
  useEffect(() => {
    if (searchParams.get('tab') === 'reminder' && reminderRef.current) {
      setTimeout(() => {
        reminderRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 300)
    }
  }, [searchParams, invoice])

  const handleToneChange = async (tone: string) => {
    if (!id) return
    setSelectedTone(tone)
    try {
      const rem = await apiClient.get<ReminderRead>(`/invoices/${id}/reminder?tone=${tone}`)
      setReminder(rem)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  // ---------------- Operations ----------------
  const handleSendInvoice = async () => {
    if (!id) return
    try {
      const updated = await apiClient.post<InvoiceRead>(`/invoices/${id}/send`)
      setInvoice(updated)
      showSuccess(`Invoice ${updated.invoice_number} sent!`)
      loadInvoice()
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !paymentAmount) return
    try {
      const updated = await apiClient.post<InvoiceRead>(`/invoices/${id}/payments`, {
        amount: paymentAmount,
        payment_date: paymentDate,
        method: paymentMethod,
        reference_number: paymentRef || null,
      })
      setInvoice(updated)
      setShowPaymentModal(false)
      showSuccess('Payment recorded successfully!')
      loadInvoice()
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleWriteOff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !writeOffReason) return
    try {
      const updated = await apiClient.post<InvoiceRead>(`/invoices/${id}/write-off`, {
        reason: writeOffReason,
      })
      setInvoice(updated)
      setShowWriteOffModal(false)
      showSuccess('Invoice written off.')
      loadInvoice()
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleRaiseBlocker = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !blockerType) return
    try {
      const updated = await apiClient.post<InvoiceRead>(`/invoices/${id}/blockers`, {
        type: blockerType,
        description: blockerDesc || null,
        assigned_to: blockerOwner || null,
      })
      setInvoice(updated)
      setShowBlockerModal(false)
      setBlockerDesc('')
      setBlockerOwner('')
      showSuccess('Blocker raised! Next action generated by playbook.')
      loadInvoice()
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleResolveBlocker = async (bid: string) => {
    if (!id) return
    try {
      const updated = await apiClient.post<InvoiceRead>(`/invoices/${id}/blockers/${bid}/resolve`)
      setInvoice(updated)
      showSuccess('Blocker resolved.')
      loadInvoice()
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleBlockerInProgress = async (bid: string) => {
    if (!id) return
    try {
      const updated = await apiClient.patch<InvoiceRead>(`/invoices/${id}/blockers/${bid}`, {
        status: 'IN_PROGRESS',
      })
      setInvoice(updated)
      showSuccess('Blocker marked in-progress.')
      loadInvoice()
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleLogFollowUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !fuNotes) return
    try {
      const updated = await apiClient.post<InvoiceRead>(`/invoices/${id}/follow-ups`, {
        channel: fuChannel,
        notes: fuNotes,
        outcome: fuOutcome,
        promised_date: fuPromisedDate || null,
        promised_amount: fuPromisedAmount || null,
      })
      setInvoice(updated)
      setShowFollowUpModal(false)
      setFuNotes('')
      setFuPromisedDate('')
      setFuPromisedAmount('')
      showSuccess('Follow-up logged successfully!')
      loadInvoice()
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleAttachDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !docFileName) return
    try {
      const updated = await apiClient.post<InvoiceRead>(`/invoices/${id}/documents`, {
        document_type: docType,
        file_name: docFileName,
        file_path: `/uploads/docs/${docFileName}`,
      })
      setInvoice(updated)
      setShowDocModal(false)
      setDocFileName('')
      showSuccess('Document attached.')
      loadInvoice()
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleRemoveDocument = async (did: string) => {
    if (!id) return
    try {
      const updated = await apiClient.delete<InvoiceRead>(`/invoices/${id}/documents/${did}`)
      setInvoice(updated)
      showSuccess('Document removed.')
      loadInvoice()
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleAddAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !actionDesc || !actionDueDate) return
    try {
      const updated = await apiClient.post<InvoiceRead>(`/invoices/${id}/actions`, {
        description: actionDesc,
        priority: actionPriority,
        due_date: actionDueDate,
      })
      setInvoice(updated)
      setShowActionModal(false)
      setActionDesc('')
      showSuccess('Manual action added.')
      loadInvoice()
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleCompleteAction = async (aid: string) => {
    if (!id) return
    try {
      const updated = await apiClient.post<InvoiceRead>(`/invoices/${id}/actions/${aid}/complete`)
      setInvoice(updated)
      showSuccess('Action completed.')
      loadInvoice()
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleRescheduleAction = async (aid: string) => {
    if (!id || !rescheduleDate) return
    try {
      const updated = await apiClient.post<InvoiceRead>(`/invoices/${id}/actions/${aid}/reschedule`, {
        new_date: rescheduleDate,
      })
      setInvoice(updated)
      setRescheduleActionId(null)
      setRescheduleDate('')
      showSuccess('Action rescheduled.')
      loadInvoice()
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleMarkReminderSent = async () => {
    if (!id || !reminder) return
    try {
      const updated = await apiClient.post<InvoiceRead>(`/invoices/${id}/reminder/sent`, {
        tone: selectedTone,
        channel: reminderChannel,
      })
      setInvoice(updated)
      showSuccess(`Reminder marked as sent via ${reminderChannel}!`)
      loadInvoice()
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  const copyReminderToClipboard = () => {
    if (!reminder) return
    navigator.clipboard.writeText(`Subject: ${reminder.subject}\n\n${reminder.body}`)
    showSuccess('Reminder copied to clipboard!')
  }

  if (loading && !invoice) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="p-8 text-center text-slate-500 text-sm">Loading Invoice...</div>
      </div>
    )
  }

  if (!invoice) return null

  const allowed = invoice.allowed_operations || []

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Invoice Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {invoice.invoice_number}
              </h1>
              <StatusBadge status={invoice.status} />
              {invoice.is_overdue && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  {invoice.days_overdue}d overdue
                </span>
              )}
            </div>
            <div className="mt-2 text-xs text-slate-500 flex items-center gap-4">
              <span>
                Client:{' '}
                <Link
                  to={`/clients/${invoice.client.id}`}
                  className="font-bold text-indigo-600 hover:underline"
                >
                  {invoice.client.name}
                </Link>
                {invoice.client.company_name && ` (${invoice.client.company_name})`}
              </span>
              <span>•</span>
              <span>Issued: <strong>{formatDate(invoice.issue_date)}</strong></span>
              <span>•</span>
              <span>Due: <strong className="text-slate-800">{formatDate(invoice.due_date)}</strong></span>
              {invoice.project && (
                <>
                  <span>•</span>
                  <span>Project: <strong>{invoice.project.project_name}</strong></span>
                </>
              )}
            </div>
          </div>

          {/* Allowed Operations Buttons */}
          <div className="flex items-center gap-2">
            {allowed.includes('send') && (
              <button
                onClick={handleSendInvoice}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-sm"
              >
                Send Invoice
              </button>
            )}

            {allowed.includes('record_payment') && (
              <button
                onClick={() => setShowPaymentModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-sm"
              >
                + Record Payment
              </button>
            )}

            {allowed.includes('raise_blocker') && (
              <button
                onClick={() => setShowBlockerModal(true)}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg text-xs border border-rose-200"
              >
                + Add Blocker
              </button>
            )}

            {allowed.includes('write_off') && (
              <button
                onClick={() => setShowWriteOffModal(true)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs border border-slate-300"
              >
                Write Off
              </button>
            )}
          </div>
        </div>

        {/* Financial Highlights */}
        <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-slate-500">Total Amount</p>
            <p className="text-lg font-black text-slate-900 mt-1">{formatMoney(invoice.total)}</p>
          </div>
          <div>
            <p className="text-slate-500">Amount Paid</p>
            <p className="text-lg font-black text-emerald-600 mt-1">{formatMoney(invoice.amount_paid)}</p>
          </div>
          <div>
            <p className="text-slate-500">Outstanding Balance</p>
            <p className="text-lg font-black text-rose-600 mt-1">{formatMoney(invoice.outstanding)}</p>
          </div>
          <div>
            <p className="text-slate-500">Reminder Level</p>
            <p className="text-lg font-black text-slate-800 mt-1">Level {invoice.reminder_level}</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Left (Blockers, Payments, Promises) & Right (Next Actions, Reminder, Documents) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-8">
          {/* Section: Blockers */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Payment Blockers</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                  {invoice.blockers.length}
                </span>
              </h2>
              {allowed.includes('raise_blocker') && (
                <button
                  onClick={() => setShowBlockerModal(true)}
                  className="text-xs text-indigo-600 hover:underline font-bold"
                >
                  + Add Blocker
                </button>
              )}
            </div>

            {invoice.blockers.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 italic">No blockers recorded on this invoice.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {invoice.blockers.map((b) => (
                  <div key={b.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BlockerBadge status={b.status} />
                        <span className="font-bold text-slate-800">{b.type.replace(/_/g, ' ')}</span>
                      </div>
                      {b.status !== 'RESOLVED' && (
                        <div className="flex items-center gap-1.5">
                          {b.status === 'OPEN' && (
                            <button
                              onClick={() => handleBlockerInProgress(b.id)}
                              className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 text-[11px] font-semibold"
                            >
                              In Progress
                            </button>
                          )}
                          <button
                            onClick={() => handleResolveBlocker(b.id)}
                            className="px-2 py-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-[11px] font-bold"
                          >
                            Resolve
                          </button>
                        </div>
                      )}
                    </div>
                    {b.description && <p className="mt-2 text-slate-700">{b.description}</p>}
                    <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-3">
                      <span>Owner: <strong>{b.assigned_to || 'Unassigned'}</strong></span>
                      <span>•</span>
                      <span>Raised: {formatDateTime(b.created_at)}</span>
                      {b.resolved_at && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-600">Resolved: {formatDateTime(b.resolved_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Payments */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Payments Received</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                  {invoice.payments.length}
                </span>
              </h2>
              {allowed.includes('record_payment') && (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="text-xs text-emerald-600 hover:underline font-bold"
                >
                  + Record Payment
                </button>
              )}
            </div>

            {invoice.payments.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 italic">No payments recorded yet.</p>
            ) : (
              <div className="mt-3 divide-y divide-slate-100 text-xs">
                {invoice.payments.map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{formatMoney(p.amount)}</p>
                      <p className="text-[11px] text-slate-400">
                        {p.method.replace('_', ' ')} {p.reference_number ? `• Ref: ${p.reference_number}` : ''}
                      </p>
                    </div>
                    <span className="text-slate-600 font-medium">{formatDate(p.payment_date)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Promises & Follow-ups Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Promises & Follow-up History</span>
              </h2>
              <button
                onClick={() => setShowFollowUpModal(true)}
                className="text-xs text-indigo-600 hover:underline font-bold"
              >
                + Log Follow-up
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* Promises List */}
              {invoice.promises.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">Payment Promises</h3>
                  {invoice.promises.map((pr) => (
                    <div key={pr.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <PromiseBadge status={pr.status} />
                          <span className="font-bold text-slate-800">
                            Promised for {formatDate(pr.promised_date)}
                          </span>
                        </div>
                        {pr.amount && (
                          <p className="mt-1 font-semibold text-slate-700">
                            Amount: {formatMoney(pr.amount)}
                          </p>
                        )}
                        {pr.note && <p className="mt-1 text-slate-600 italic">"{pr.note}"</p>}
                      </div>
                      <span className="text-[10px] text-slate-400">{formatDateTime(pr.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Follow-ups List */}
              {invoice.follow_ups.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h3 className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">Follow-up Contacts</h3>
                  {invoice.follow_ups.map((f) => (
                    <div key={f.id} className="p-3 bg-white rounded-lg border border-slate-100 shadow-2xs">
                      <div className="flex justify-between items-center text-[11px] text-slate-500">
                        <span className="font-bold text-indigo-700 uppercase tracking-wide">
                          {f.channel} • {f.outcome.replace('_', ' ')}
                        </span>
                        <span>{formatDateTime(f.contact_date)}</span>
                      </div>
                      <p className="mt-1.5 text-slate-800">{f.notes}</p>
                    </div>
                  ))}
                </div>
              )}

              {invoice.promises.length === 0 && invoice.follow_ups.length === 0 && (
                <p className="text-xs text-slate-400 py-3 italic">No follow-ups or promises logged yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Section: Next Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Next Actions</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                  {invoice.actions.length}
                </span>
              </h2>
              <button
                onClick={() => setShowActionModal(true)}
                className="text-xs text-indigo-600 hover:underline font-bold"
              >
                + Add Action
              </button>
            </div>

            {invoice.actions.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 italic">No pending actions for this invoice.</p>
            ) : (
              <div className="mt-3 space-y-2.5 text-xs">
                {invoice.actions.map((act) => (
                  <div
                    key={act.id}
                    className={`p-3 rounded-lg border ${
                      act.status === 'COMPLETED'
                        ? 'bg-slate-50 border-slate-200 opacity-60'
                        : act.status === 'CANCELLED'
                        ? 'bg-slate-50 border-slate-200 line-through opacity-50'
                        : 'bg-white border-slate-200 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={act.priority} />
                        <span className="font-semibold text-slate-800">{act.description}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {act.source}
                      </span>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Due: <strong>{formatDate(act.due_date)}</strong></span>
                      {act.status === 'PENDING' && (
                        <div className="flex items-center gap-1.5">
                          {rescheduleActionId === act.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={rescheduleDate}
                                onChange={(e) => setRescheduleDate(e.target.value)}
                                className="border rounded px-1.5 py-0.5 text-xs"
                              />
                              <button
                                onClick={() => handleRescheduleAction(act.id)}
                                className="px-2 py-0.5 bg-indigo-600 text-white rounded font-medium"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setRescheduleActionId(null)}
                                className="px-1 text-slate-500"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => handleCompleteAction(act.id)}
                                className="px-2 py-0.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 font-semibold"
                              >
                                Done
                              </button>
                              <button
                                onClick={() => {
                                  setRescheduleActionId(act.id)
                                  setRescheduleDate(act.due_date)
                                }}
                                className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                              >
                                Reschedule
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {act.status === 'COMPLETED' && (
                        <span className="text-emerald-600 font-semibold">Completed</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Reminder Panel */}
          <div ref={reminderRef} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Reminder Generator</span>
                <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                  Template Method Pattern
                </span>
              </h2>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* Tone Selector */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Reminder Tone</label>
                <div className="grid grid-cols-4 gap-2">
                  {['GENTLE', 'POLITE', 'FIRM', 'FINAL'].map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => handleToneChange(tone)}
                      className={`py-1.5 rounded-lg border font-bold text-xs transition ${
                        selectedTone === tone
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>

              {/* Read-only Preview Box */}
              {reminder && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-700">Preview</span>
                    <button
                      onClick={copyReminderToClipboard}
                      className="text-xs text-indigo-600 hover:underline font-bold"
                    >
                      📋 Copy to Clipboard
                    </button>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-[11px] text-slate-800 space-y-2 whitespace-pre-wrap select-text">
                    <div className="font-bold border-b border-slate-200 pb-1">
                      Subject: {reminder.subject}
                    </div>
                    <div>{reminder.body}</div>
                  </div>
                </div>
              )}

              {/* Mark as sent form */}
              <div className="pt-2 flex items-center gap-2">
                <select
                  value={reminderChannel}
                  onChange={(e) => setReminderChannel(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium"
                >
                  <option value="EMAIL">Email</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="PHONE">Phone</option>
                  <option value="LETTER">Letter</option>
                </select>
                <button
                  onClick={handleMarkReminderSent}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg font-bold text-xs shadow-sm"
                >
                  Mark as Sent (Advances Level)
                </button>
              </div>
            </div>
          </div>

          {/* Section: Supporting Documents */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Supporting Documents</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                  {invoice.documents.length}
                </span>
              </h2>
              <button
                onClick={() => setShowDocModal(true)}
                className="text-xs text-indigo-600 hover:underline font-bold"
              >
                + Attach Document
              </button>
            </div>

            {invoice.documents.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 italic">No documents attached.</p>
            ) : (
              <div className="mt-3 divide-y divide-slate-100 text-xs">
                {invoice.documents.map((d) => (
                  <div key={d.id} className="py-2 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800">
                        {d.file_name} <span className="text-slate-400 font-normal">({d.file_type})</span>
                      </p>
                      <p className="text-[11px] text-slate-500 uppercase">{d.document_type.replace('_', ' ')}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveDocument(d.id)}
                      className="text-rose-500 hover:text-rose-700 font-bold px-1"
                      title="Remove document"
                    >
                      × Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Audit Log History */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100">
              Audit Timeline
            </h2>
            <div className="mt-3 max-h-60 overflow-y-auto space-y-2 text-xs divide-y divide-slate-100">
              {auditEvents.map((ev) => (
                <div key={ev.id} className="pt-2 first:pt-0">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-bold text-indigo-600">{ev.event_type}</span>
                    <span>{formatDateTime(ev.occurred_at)}</span>
                  </div>
                  <p className="mt-0.5 text-slate-700">{ev.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Record Payment</h3>
            <form onSubmit={handleRecordPayment} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount</label>
                <input
                  type="text"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full border rounded-lg p-2"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full border rounded-lg p-2"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border rounded-lg p-2 font-medium"
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reference Number</label>
                <input
                  type="text"
                  placeholder="e.g. TXN-12345"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full border rounded-lg p-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-3 py-1.5 text-slate-600 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded font-bold"
                >
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Blocker Modal */}
      {showBlockerModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Add Payment Blocker</h3>
            <p className="text-xs text-slate-500 mt-1">
              Structured blockers trigger resolution strategies in the playbook.
            </p>
            <form onSubmit={handleRaiseBlocker} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Blocker Type</label>
                <select
                  value={blockerType}
                  onChange={(e) => setBlockerType(e.target.value)}
                  className="w-full border rounded-lg p-2 font-medium"
                >
                  <option value="MISSING_PO">Missing PO</option>
                  <option value="AWAITING_APPROVAL">Awaiting Approval</option>
                  <option value="DISPUTED_AMOUNT">Disputed Amount</option>
                  <option value="WRONG_DETAILS">Wrong Details</option>
                  <option value="MISSING_DOCUMENTS">Missing Documents</option>
                  <option value="NO_RESPONSE">No Response</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  value={blockerDesc}
                  onChange={(e) => setBlockerDesc(e.target.value)}
                  placeholder="Details of the obstruction..."
                  rows={3}
                  className="w-full border rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Owner</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={blockerOwner}
                  onChange={(e) => setBlockerOwner(e.target.value)}
                  className="w-full border rounded-lg p-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowBlockerModal(false)}
                  className="px-3 py-1.5 text-slate-600 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 text-white rounded font-bold"
                >
                  Raise Blocker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Follow-up Modal */}
      {showFollowUpModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Log Follow-up & Promise</h3>
            <form onSubmit={handleLogFollowUp} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Channel</label>
                <select
                  value={fuChannel}
                  onChange={(e) => setFuChannel(e.target.value)}
                  className="w-full border rounded-lg p-2 font-medium"
                >
                  <option value="PHONE">Phone</option>
                  <option value="EMAIL">Email</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="IN_PERSON">In Person</option>
                  <option value="LETTER">Letter</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Outcome</label>
                <select
                  value={fuOutcome}
                  onChange={(e) => setFuOutcome(e.target.value)}
                  className="w-full border rounded-lg p-2 font-medium"
                >
                  <option value="PROMISE_TO_PAY">Promise to Pay</option>
                  <option value="DISPUTED">Disputed</option>
                  <option value="CALL_BACK_REQUESTED">Call Back Requested</option>
                  <option value="NO_ANSWER">No Answer</option>
                  <option value="ESCALATED">Escalated</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  value={fuNotes}
                  onChange={(e) => setFuNotes(e.target.value)}
                  placeholder="Conversation notes..."
                  rows={2}
                  className="w-full border rounded-lg p-2"
                  required
                />
              </div>

              {/* Optional Promise fields */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <p className="font-bold text-slate-700 text-[11px]">Payment Commitment (Optional)</p>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Promised Date</label>
                  <input
                    type="date"
                    value={fuPromisedDate}
                    onChange={(e) => setFuPromisedDate(e.target.value)}
                    className="w-full border rounded p-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Promised Amount</label>
                  <input
                    type="text"
                    placeholder="Defaults to full balance if empty"
                    value={fuPromisedAmount}
                    onChange={(e) => setFuPromisedAmount(e.target.value)}
                    className="w-full border rounded p-1.5 bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowFollowUpModal(false)}
                  className="px-3 py-1.5 text-slate-600 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded font-bold"
                >
                  Save Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attach Document Modal */}
      {showDocModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Attach Document</h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Note: Metadata only is stored; no file bytes are uploaded to the server.
            </p>
            <form onSubmit={handleAttachDocument} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select File</label>
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) setDocFileName(file.name)
                  }}
                  className="w-full border rounded-lg p-2"
                  required
                />
                {docFileName && (
                  <p className="mt-1 text-[11px] text-indigo-600 font-semibold">
                    File selected: {docFileName}
                  </p>
                )}
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Document Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full border rounded-lg p-2 font-medium"
                >
                  <option value="PURCHASE_ORDER">Purchase Order</option>
                  <option value="INVOICE_PDF">Invoice PDF</option>
                  <option value="CONTRACT">Contract / Agreement</option>
                  <option value="DELIVERY_PROOF">Proof of Delivery</option>
                  <option value="TIMESHEET">Timesheet</option>
                  <option value="CORRESPONDENCE">Correspondence</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="px-3 py-1.5 text-slate-600 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded font-bold"
                >
                  Attach
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Manual Action Modal */}
      {showActionModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Add Next Action</h3>
            <form onSubmit={handleAddAction} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Call client CFO"
                  value={actionDesc}
                  onChange={(e) => setActionDesc(e.target.value)}
                  className="w-full border rounded-lg p-2"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                <select
                  value={actionPriority}
                  onChange={(e) => setActionPriority(e.target.value)}
                  className="w-full border rounded-lg p-2 font-medium"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={actionDueDate}
                  onChange={(e) => setActionDueDate(e.target.value)}
                  className="w-full border rounded-lg p-2"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowActionModal(false)}
                  className="px-3 py-1.5 text-slate-600 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded font-bold"
                >
                  Add Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Write Off Modal */}
      {showWriteOffModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <h3 className="text-base font-bold text-rose-600">Write Off Invoice</h3>
            <p className="text-xs text-slate-600 mt-1">
              Writing off an invoice marks it as uncollectible and halts all collection actions.
            </p>
            <form onSubmit={handleWriteOff} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason for Write Off</label>
                <textarea
                  value={writeOffReason}
                  onChange={(e) => setWriteOffReason(e.target.value)}
                  placeholder="e.g. Client liquidation"
                  rows={3}
                  className="w-full border rounded-lg p-2"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowWriteOffModal(false)}
                  className="px-3 py-1.5 text-slate-600 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 text-white rounded font-bold"
                >
                  Confirm Write Off
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

