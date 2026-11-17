import React, { useState } from 'react'
import { Calendar, Plus } from 'lucide-react'
import type { InvoiceRead, PromiseRead } from '../../../api/types'
import { GroupedList } from '../../../ui/GroupedList'
import { ListRow } from '../../../ui/ListRow'
import { Button } from '../../../ui/Button'
import { Sheet } from '../../../ui/Sheet'
import { Badge } from '../../../ui/Badge'
import { MoneyText } from '../../../ui/MoneyText'
import { formatDate } from '../../../lib/format'
import { promiseStatusLabel } from '../../../lib/labels'
import { useRecordPromise } from '../../../api/hooks/useMutations'

export interface PromisesTimelineProps {
  invoice: InvoiceRead
}

export const PromisesTimeline: React.FC<PromisesTimelineProps> = ({ invoice }) => {
  const recordPromise = useRecordPromise(invoice.id)
  const allowed = new Set(invoice.allowed_operations)

  const [modalOpen, setModalOpen] = useState(false)
  const [promiseDate, setPromiseDate] = useState('')
  const [amount, setAmount] = useState(invoice.outstanding.amount)
  const [note, setNote] = useState('')

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'KEPT': return 'success'
      case 'PENDING': return 'warning'
      case 'MISSED': return 'danger'
      default: return 'neutral'
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!promiseDate) return
    await recordPromise.mutateAsync({
      promised_date: promiseDate,
      amount: amount ? amount : undefined,
      note: note.trim() || undefined,
    })
    setModalOpen(false)
    setNote('')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-3">
          Payment Commitments ({invoice.promises.length})
        </h3>
        {allowed.has('record_promise') && (
          <Button size="sm" variant="secondary" onClick={() => setModalOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1 text-tint" />
            Record Promise
          </Button>
        )}
      </div>

      {invoice.promises.length === 0 ? (
        <div className="p-8 text-center bg-surface-solid rounded-card border border-hairline text-text-3 text-xs">
          No explicit payment commitments logged yet.
        </div>
      ) : (
        <GroupedList>
          {invoice.promises.map((p: PromiseRead) => (
            <ListRow
              key={p.id}
              leading={<Calendar className="w-5 h-5 text-text-3 flex-shrink-0" />}
              title={
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text">Promised for {formatDate(p.promised_date)}</span>
                  {p.amount && (
                    <span className="text-xs text-text-2">
                      (<MoneyText amount={p.amount.amount} currency={p.amount.currency} />)
                    </span>
                  )}
                  <Badge variant={getStatusVariant(p.status)} size="sm" dot>
                    {promiseStatusLabel[p.status] ?? p.status}
                  </Badge>
                </div>
              }
              subtitle={
                <span className="text-text-3">
                  Recorded {formatDate(p.created_at)}
                  {p.note && ` · "${p.note}"`}
                </span>
              }
            />
          ))}
        </GroupedList>
      )}

      {/* Record Promise Modal */}
      <Sheet
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Record Payment Promise"
        description="Logs a client commitment. If breached on the daily check, reliability score drops."
      >
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-medium text-text-2 block mb-1">Promised Date</label>
            <input
              type="date"
              required
              value={promiseDate}
              onChange={(e) => setPromiseDate(e.target.value)}
              className="w-full h-10 px-3 bg-bg-grouped border border-hairline rounded-input text-text text-sm outline-none focus:border-tint"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-2 block mb-1">Promised Amount (Optional)</label>
            <input
              type="number"
              step="0.01"
              placeholder={invoice.outstanding.amount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full h-10 px-3 bg-bg-grouped border border-hairline rounded-input text-text text-sm outline-none focus:border-tint"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-2 block mb-1">Context Note</label>
            <textarea
              rows={3}
              placeholder="e.g. Finance manager confirmed payout schedule during weekly call..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-3 bg-bg-grouped border border-hairline rounded-input text-text text-sm outline-none focus:border-tint resize-none"
            />
          </div>

          <Button type="submit" variant="primary" loading={recordPromise.isPending} className="w-full mt-2">
            Save Commitment
          </Button>
        </form>
      </Sheet>
    </div>
  )
}
