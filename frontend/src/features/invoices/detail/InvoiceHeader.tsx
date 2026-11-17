import React from 'react'
import { Link } from 'react-router-dom'
import { Send, DollarSign, AlertOctagon, PhoneCall, Ban } from 'lucide-react'
import type { InvoiceRead } from '../../../api/types'
import { Badge } from '../../../ui/Badge'
import { Button } from '../../../ui/Button'
import { MoneyText } from '../../../ui/MoneyText'
import { PingMark } from '../../../ui/PingMark'
import { formatDate } from '../../../lib/format'
import { invoiceStatusLabel, plural } from '../../../lib/labels'
import { useSendInvoice } from '../../../api/hooks/useMutations'

export interface InvoiceHeaderProps {
  invoice: InvoiceRead
  onOpenPayment: () => void
  onOpenBlocker: () => void
  onOpenFollowUp: () => void
  onOpenWriteOff: () => void
}

export const InvoiceHeader: React.FC<InvoiceHeaderProps> = ({
  invoice,
  onOpenPayment,
  onOpenBlocker,
  onOpenFollowUp,
  onOpenWriteOff,
}) => {
  const sendInvoice = useSendInvoice(invoice.id)
  const allowed = new Set(invoice.allowed_operations)

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'PAID': return 'success'
      case 'PARTIALLY_PAID': return 'tint'
      case 'DISPUTED': return 'warning'
      case 'WRITTEN_OFF': return 'danger'
      case 'SENT': return 'neutral'
      default: return 'neutral'
    }
  }

  return (
    <div className="glass rounded-card border border-hairline p-6 shadow-float space-y-6">
      {/* Top row: Invoice #, badges, actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-text">
            {invoice.invoice_number}
          </h1>
          <Badge variant={getStatusVariant(invoice.status)} dot>
            {invoiceStatusLabel[invoice.status] ?? invoice.status.replace('_', ' ')}
          </Badge>
          {invoice.is_overdue && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill bg-danger/10 border border-danger/20 text-danger text-xs font-medium">
              <PingMark size="sm" pulse={false} color="#FF3B30" />
              <span>{plural(invoice.days_overdue, 'day')} overdue</span>
            </div>
          )}
        </div>

        {/* Action Buttons based on allowed_operations */}
        <div className="flex items-center gap-2 flex-wrap">
          {allowed.has('send') && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => sendInvoice.mutate()}
              loading={sendInvoice.isPending}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Send
            </Button>
          )}

          {allowed.has('record_payment') && (
            <Button size="sm" variant="secondary" onClick={onOpenPayment}>
              <DollarSign className="w-3.5 h-3.5 mr-1.5 text-success" />
              Record Payment
            </Button>
          )}

          {allowed.has('raise_blocker') && (
            <Button size="sm" variant="secondary" onClick={onOpenBlocker}>
              <AlertOctagon className="w-3.5 h-3.5 mr-1.5 text-warning" />
              Raise Blocker
            </Button>
          )}

          {allowed.has('log_follow_up') && (
            <Button size="sm" variant="secondary" onClick={onOpenFollowUp}>
              <PhoneCall className="w-3.5 h-3.5 mr-1.5 text-tint" />
              Follow-up
            </Button>
          )}

          {allowed.has('write_off') && (
            <Button size="sm" variant="ghost" onClick={onOpenWriteOff} className="text-danger hover:text-danger">
              <Ban className="w-3.5 h-3.5 mr-1.5" />
              Write Off
            </Button>
          )}
        </div>
      </div>

      {/* Meta Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-hairline text-xs">
        <div>
          <span className="text-text-3 font-medium uppercase tracking-wider block mb-1">Client</span>
          <Link
            to={`/app/clients/${invoice.client.id}`}
            className="font-medium text-text hover:text-tint transition-colors"
          >
            {invoice.client.name}
          </Link>
          {invoice.project && (
            <span className="text-text-3 block mt-0.5">{invoice.project.project_name}</span>
          )}
        </div>

        <div>
          <span className="text-text-3 font-medium uppercase tracking-wider block mb-1">Issue / Due Date</span>
          <div className="text-text font-medium">{formatDate(invoice.issue_date)}</div>
          <div className="text-text-2 mt-0.5">Due {formatDate(invoice.due_date)}</div>
        </div>

        <div>
          <span className="text-text-3 font-medium uppercase tracking-wider block mb-1">Total & Paid</span>
          <div className="text-text font-medium">
            <MoneyText amount={invoice.total.amount} currency={invoice.total.currency} />
          </div>
          <div className="text-success mt-0.5">
            Paid <MoneyText amount={invoice.amount_paid.amount} currency={invoice.amount_paid.currency} />
          </div>
        </div>

        <div>
          <span className="text-text-3 font-medium uppercase tracking-wider block mb-1">Outstanding</span>
          <div className="text-lg font-semibold tracking-tight text-text">
            <MoneyText amount={invoice.outstanding.amount} currency={invoice.outstanding.currency} splitDecimals />
          </div>
        </div>
      </div>
    </div>
  )
}
