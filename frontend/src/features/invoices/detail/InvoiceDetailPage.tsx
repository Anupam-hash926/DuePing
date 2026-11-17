import React, { useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, Ban } from 'lucide-react'
import { useInvoice, useAudit } from '../../../api/hooks/useQueries'
import { useWriteOff } from '../../../api/hooks/useMutations'
import { InvoiceHeader } from './InvoiceHeader'
import { StatusStepper } from './StatusStepper'
import { PaymentsPanel } from './PaymentsPanel'
import { BlockersPanel } from './BlockersPanel'
import { PromisesTimeline } from './PromisesTimeline'
import { DocumentsPanel } from './DocumentsPanel'
import { ActionsPanel } from './ActionsPanel'
import { ReminderPanel } from './ReminderPanel'
import { HistoryPanel } from './HistoryPanel'
import { Tabs } from '../../../ui/Tabs'
import { Sheet } from '../../../ui/Sheet'
import { Button } from '../../../ui/Button'
import { Skeleton } from '../../../ui/Skeleton'

export const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab') ?? 'timeline'
  const currentTab = rawTab === 'overview' ? 'blockers' : rawTab === 'history' ? 'timeline' : rawTab

  const { data: invoice, isLoading, error } = useInvoice(id)
  const { data: auditEvents } = useAudit(id)
  const writeOff = useWriteOff(id ?? '')

  // Modals controlled across panels
  const [paymentOpen, setPaymentOpen] = useState(() => searchParams.get('record_payment') === '1')
  const [blockerOpen, setBlockerOpen] = useState(false)
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [writeOffOpen, setWriteOffOpen] = useState(false)
  const [writeOffReason, setWriteOffReason] = useState('')

  const handleTabChange = (val: string) => {
    setSearchParams({ tab: val }, { replace: true })
  }

  const handleOpenPayment = () => {
    setSearchParams({ tab: 'payments' }, { replace: true })
    setPaymentOpen(true)
  }

  const handleOpenBlocker = () => {
    setSearchParams({ tab: 'blockers' }, { replace: true })
    setBlockerOpen(true)
  }

  const handleOpenFollowUp = () => {
    setSearchParams({ tab: 'timeline' }, { replace: true })
    setFollowUpOpen(true)
  }

  const handleWriteOffSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!writeOffReason.trim()) return
    await writeOff.mutateAsync({ reason: writeOffReason.trim() })
    setWriteOffOpen(false)
    setWriteOffReason('')
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-48 w-full" variant="rectangular" />
        <Skeleton className="h-64 w-full" variant="rectangular" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="p-12 text-center bg-surface-solid rounded-card border border-hairline space-y-4">
        <h2 className="text-lg font-semibold text-text">Invoice Not Found</h2>
        <p className="text-sm text-text-2">The requested invoice could not be loaded or has been deleted.</p>
        <Link to="/app/invoices">
          <Button variant="secondary" size="sm">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Back to Invoices
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        to="/app/invoices"
        className="inline-flex items-center text-xs font-medium text-text-3 hover:text-text transition-colors gap-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Invoices</span>
      </Link>

      {/* Aggregate Header */}
      <InvoiceHeader
        invoice={invoice}
        onOpenPayment={handleOpenPayment}
        onOpenBlocker={handleOpenBlocker}
        onOpenFollowUp={handleOpenFollowUp}
        onOpenWriteOff={() => setWriteOffOpen(true)}
      />

      {/* Lifecycle Progression */}
      <StatusStepper status={invoice.status} amountPaid={invoice.amount_paid.amount} />

      {/* Structured Domain Tabs per Spec 10.4: Timeline · Blockers · Payments · Documents · Reminder */}
      <Tabs
        defaultValue={currentTab}
        value={currentTab}
        onValueChange={handleTabChange}
        tabs={[
          {
            value: 'timeline',
            label: 'Timeline',
            content: (
              <HistoryPanel
                invoice={invoice}
                auditEvents={auditEvents ?? []}
                followUpModalOpen={followUpOpen}
                onFollowUpModalChange={setFollowUpOpen}
              />
            ),
          },
          {
            value: 'blockers',
            label: 'Blockers',
            content: (
              <div className="space-y-6">
                <BlockersPanel invoice={invoice} modalOpen={blockerOpen} onModalChange={setBlockerOpen} />
                <ActionsPanel invoice={invoice} />
              </div>
            ),
          },
          {
            value: 'payments',
            label: 'Payments',
            content: (
              <div className="space-y-6">
                <PaymentsPanel invoice={invoice} modalOpen={paymentOpen} onModalChange={setPaymentOpen} />
                <PromisesTimeline invoice={invoice} />
              </div>
            ),
          },
          {
            value: 'documents',
            label: 'Documents',
            content: <DocumentsPanel invoice={invoice} />,
          },
          {
            value: 'reminder',
            label: 'Reminder',
            content: <ReminderPanel invoice={invoice} />,
          },
        ]}
      />

      {/* Write Off Modal */}
      <Sheet open={writeOffOpen} onOpenChange={setWriteOffOpen} title="Write Off Invoice">
        <form onSubmit={handleWriteOffSubmit} className="space-y-4 mt-2">
          <p className="text-xs text-text-2">
            Writing off marks this invoice balance as uncollectible bad debt. This action cannot be undone.
          </p>
          <div>
            <label className="text-xs font-medium text-text-2 block mb-1">Reason for Write Off</label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Client declared bankruptcy / statutory dispute settled..."
              value={writeOffReason}
              onChange={(e) => setWriteOffReason(e.target.value)}
              className="w-full p-3 bg-bg-grouped border border-hairline rounded-input text-text text-sm outline-none focus:border-tint resize-none"
            />
          </div>
          <Button type="submit" variant="danger" loading={writeOff.isPending} className="w-full">
            <Ban className="w-3.5 h-3.5 mr-1.5" />
            Confirm Write Off
          </Button>
        </form>
      </Sheet>
    </div>
  )
}
