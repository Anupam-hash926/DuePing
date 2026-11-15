import React, { useState } from 'react'
import { PhoneCall, Shield, Plus } from 'lucide-react'
import type { InvoiceRead, AuditEventRead, FollowUpRead } from '../../../api/types'
import { GroupedList } from '../../../ui/GroupedList'
import { ListRow } from '../../../ui/ListRow'
import { Button } from '../../../ui/Button'
import { Sheet } from '../../../ui/Sheet'
import { Badge } from '../../../ui/Badge'
import { formatDateTime } from '../../../lib/format'
import { useLogFollowUp } from '../../../api/hooks/useMutations'

export interface HistoryPanelProps {
  invoice: InvoiceRead
  auditEvents: AuditEventRead[]
  followUpModalOpen: boolean
  onFollowUpModalChange: (open: boolean) => void
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  invoice,
  auditEvents,
  followUpModalOpen,
  onFollowUpModalChange,
}) => {
  const logFollowUp = useLogFollowUp(invoice.id)
  const allowed = new Set(invoice.allowed_operations)

  const [channel, setChannel] = useState('PHONE')
  const [outcome, setOutcome] = useState('PROMISE_TO_PAY')
  const [notes, setNotes] = useState('')
  const [promisedDate, setPromisedDate] = useState('')
  const [promisedAmount, setPromisedAmount] = useState('')

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await logFollowUp.mutateAsync({
      channel,
      outcome,
      notes: notes.trim() || 'Follow-up logged',
      promised_date: outcome === 'PROMISE_TO_PAY' && promisedDate ? promisedDate : undefined,
      promised_amount: outcome === 'PROMISE_TO_PAY' && promisedAmount ? promisedAmount : undefined,
    })
    onFollowUpModalChange(false)
    setNotes('')
    setPromisedDate('')
    setPromisedAmount('')
  }

  return (
    <div className="space-y-8">
      {/* Follow-up Touchpoints */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-3">
            Communication History ({invoice.follow_ups.length})
          </h3>
          {allowed.has('log_follow_up') && (
            <Button size="sm" variant="secondary" onClick={() => onFollowUpModalChange(true)}>
              <Plus className="w-3.5 h-3.5 mr-1 text-tint" />
              Log Follow-Up
            </Button>
          )}
        </div>

        {invoice.follow_ups.length === 0 ? (
          <div className="p-6 text-center bg-surface-solid rounded-card border border-hairline text-text-3 text-xs">
            No communication history logged.
          </div>
        ) : (
          <GroupedList>
            {invoice.follow_ups.map((fu: FollowUpRead) => (
              <ListRow
                key={fu.id}
                leading={<PhoneCall className="w-4 h-4 text-tint flex-shrink-0" />}
                title={
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text">{fu.channel}</span>
                    <Badge variant="neutral" size="sm">{fu.outcome.replace('_', ' ')}</Badge>
                  </div>
                }
                subtitle={<span className="text-text-2">{fu.notes ?? 'No notes recorded'}</span>}
                trailing={<span className="text-text-3 text-xs">{formatDateTime(fu.contact_date)}</span>}
              />
            ))}
          </GroupedList>
        )}
      </div>

      {/* Domain Event Audit Trail */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-3">
          Domain Event Audit Trail ({auditEvents.length})
        </h3>

        {auditEvents.length === 0 ? (
          <div className="p-6 text-center bg-surface-solid rounded-card border border-hairline text-text-3 text-xs">
            No audit events found.
          </div>
        ) : (
          <GroupedList>
            {auditEvents.map((ev) => (
              <ListRow
                key={ev.id}
                leading={<Shield className="w-4 h-4 text-purple flex-shrink-0" />}
                title={
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text">{ev.event_type}</span>
                  </div>
                }
                subtitle={<span className="text-text-2">{ev.description}</span>}
                trailing={<span className="text-text-3 text-xs">{formatDateTime(ev.occurred_at)}</span>}
              />
            ))}
          </GroupedList>
        )}
      </div>

      {/* Log Follow-Up Sheet */}
      <Sheet
        open={followUpModalOpen}
        onOpenChange={onFollowUpModalChange}
        title="Log Communication Touchpoint"
      >
        <form onSubmit={handleFollowUpSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-text-2 block mb-1">Channel</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full h-10 px-3 bg-bg-grouped border border-hairline rounded-input text-text text-sm outline-none focus:border-tint"
              >
                <option value="PHONE">Phone Call</option>
                <option value="EMAIL">Email</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="IN_PERSON">In Person</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-text-2 block mb-1">Outcome</label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="w-full h-10 px-3 bg-bg-grouped border border-hairline rounded-input text-text text-sm outline-none focus:border-tint"
              >
                <option value="PROMISE_TO_PAY">Promise to Pay</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="DISPUTE_RAISED">Dispute Raised</option>
                <option value="WRONG_CONTACT">Wrong Contact</option>
                <option value="NO_ANSWER">No Answer</option>
                <option value="ESCALATED">Escalated</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-text-2 block mb-1">Notes</label>
            <textarea
              rows={3}
              placeholder="e.g. Spoke with accountant; promised transfer by Friday..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 bg-bg-grouped border border-hairline rounded-input text-text text-sm outline-none focus:border-tint resize-none"
            />
          </div>

          {outcome === 'PROMISE_TO_PAY' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-bg-grouped rounded-input border border-hairline">
              <div>
                <label className="text-xs font-medium text-text-2 block mb-1">Promised Date</label>
                <input
                  type="date"
                  value={promisedDate}
                  onChange={(e) => setPromisedDate(e.target.value)}
                  className="w-full h-9 px-2.5 bg-surface-solid border border-hairline rounded-input text-text text-xs outline-none focus:border-tint"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-2 block mb-1">Promised Amount</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={invoice.outstanding.amount}
                  value={promisedAmount}
                  onChange={(e) => setPromisedAmount(e.target.value)}
                  className="w-full h-9 px-2.5 bg-surface-solid border border-hairline rounded-input text-text text-xs outline-none focus:border-tint"
                />
              </div>
            </div>
          )}

          <Button type="submit" variant="primary" loading={logFollowUp.isPending} className="w-full mt-2">
            Save Follow-up
          </Button>
        </form>
      </Sheet>
    </div>
  )
}
