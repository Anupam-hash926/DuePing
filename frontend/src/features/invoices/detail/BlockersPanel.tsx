import React, { useState } from 'react'
import { AlertOctagon, CheckCircle2, Plus } from 'lucide-react'
import type { InvoiceRead, BlockerRead } from '../../../api/types'
import { GroupedList } from '../../../ui/GroupedList'
import { ListRow } from '../../../ui/ListRow'
import { Button } from '../../../ui/Button'
import { Sheet } from '../../../ui/Sheet'
import { Badge } from '../../../ui/Badge'
import { formatDate } from '../../../lib/format'
import { useRaiseBlocker, useResolveBlocker } from '../../../api/hooks/useMutations'

export interface BlockersPanelProps {
  invoice: InvoiceRead
  modalOpen: boolean
  onModalChange: (open: boolean) => void
}

export const BlockersPanel: React.FC<BlockersPanelProps> = ({
  invoice,
  modalOpen,
  onModalChange,
}) => {
  const raiseBlocker = useRaiseBlocker(invoice.id)
  const allowed = new Set(invoice.allowed_operations)

  // Raise Form State
  const [type, setType] = useState('MISSING_PO')
  const [description, setDescription] = useState('')
  const [assignedTo, setAssignedTo] = useState('')

  // Resolve State
  const [resolvingBlockerId, setResolvingBlockerId] = useState<string | null>(null)
  const [resolveNote, setResolveNote] = useState('')

  const resolveMutation = useResolveBlocker(invoice.id, resolvingBlockerId ?? '')

  const handleRaiseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return
    await raiseBlocker.mutateAsync({
      type,
      description: description.trim(),
      assigned_to: assignedTo.trim() || undefined,
    })
    onModalChange(false)
    setDescription('')
    setAssignedTo('')
  }

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resolvingBlockerId) return
    await resolveMutation.mutateAsync({
      status: 'RESOLVED',
    })
    setResolvingBlockerId(null)
    setResolveNote('')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-3">
          Payment Blockers ({invoice.blockers.length})
        </h3>
        {allowed.has('raise_blocker') && (
          <Button size="sm" variant="secondary" onClick={() => onModalChange(true)}>
            <Plus className="w-3.5 h-3.5 mr-1 text-warning" />
            Raise Blocker
          </Button>
        )}
      </div>

      {invoice.blockers.length === 0 ? (
        <div className="p-8 text-center bg-surface-solid rounded-card border border-hairline text-text-3 text-xs">
          No blockers active. Invoice is proceeding normally.
        </div>
      ) : (
        <GroupedList>
          {invoice.blockers.map((b: BlockerRead) => (
            <ListRow
              key={b.id}
              leading={
                b.status !== 'RESOLVED' ? (
                  <AlertOctagon className="w-5 h-5 text-warning flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                )
              }
              title={
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-text">{b.description}</span>
                  <Badge variant={b.status !== 'RESOLVED' ? 'warning' : 'neutral'} size="sm">
                    {b.type.replace('_', ' ')}
                  </Badge>
                </div>
              }
              subtitle={
                <span className="text-text-3">
                  Raised {formatDate(b.created_at)}
                  {b.assigned_to && ` · Owner: ${b.assigned_to}`}
                  {b.status === 'RESOLVED' && b.resolved_at && ` · Resolved ${formatDate(b.resolved_at)}`}
                </span>
              }
              trailing={
                b.status !== 'RESOLVED' && allowed.has('resolve_blocker') ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs px-2.5"
                    onClick={() => setResolvingBlockerId(b.id)}
                  >
                    Resolve
                  </Button>
                ) : undefined
              }
            />
          ))}
        </GroupedList>
      )}

      {/* Raise Blocker Modal */}
      <Sheet
        open={modalOpen}
        onOpenChange={onModalChange}
        title="Raise Payment Blocker"
        description="Identifies the root cause preventing payment so the resolution playbook can assign recovery actions."
      >
        <form onSubmit={handleRaiseSubmit} className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-medium text-text-2 block mb-1">Blocker Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full h-10 px-3 bg-bg-grouped border border-hairline rounded-input text-text text-sm outline-none focus:border-tint"
            >
              <option value="MISSING_PO">Missing Purchase Order (PO)</option>
              <option value="AWAITING_APPROVAL">Awaiting Internal Approval</option>
              <option value="DISPUTED_AMOUNT">Disputed Amount / Milestone</option>
              <option value="WRONG_DETAILS">Wrong Bank / Tax Details</option>
              <option value="MISSING_DOCUMENTS">Missing Timesheets / Delivery Proof</option>
              <option value="NO_RESPONSE">No Response from Primary Contact</option>
              <option value="OTHER">Other Operational Friction</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-text-2 block mb-1">Description</label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Finance department requested PO # from procurement manager..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 bg-bg-grouped border border-hairline rounded-input text-text text-sm outline-none focus:border-tint resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-2 block mb-1">Assigned Owner (Optional)</label>
            <input
              type="text"
              placeholder="e.g. John Doe / Client Accounts"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full h-10 px-3 bg-bg-grouped border border-hairline rounded-input text-text text-sm outline-none focus:border-tint"
            />
          </div>

          <Button type="submit" variant="primary" loading={raiseBlocker.isPending} className="w-full mt-2">
            Raise Blocker & Trigger Playbook
          </Button>
        </form>
      </Sheet>

      {/* Resolve Blocker Modal */}
      <Sheet
        open={Boolean(resolvingBlockerId)}
        onOpenChange={(open) => !open && setResolvingBlockerId(null)}
        title="Resolve Blocker"
        description="Marking the blocker as resolved will automatically archive generated actions."
      >
        <form onSubmit={handleResolveSubmit} className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-medium text-text-2 block mb-1">Resolution Note (Optional)</label>
            <textarea
              rows={3}
              placeholder="e.g. Received signed PO from client procurement portal..."
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              className="w-full p-3 bg-bg-grouped border border-hairline rounded-input text-text text-sm outline-none focus:border-tint resize-none"
            />
          </div>

          <Button type="submit" variant="primary" loading={resolveMutation.isPending} className="w-full">
            Mark as Resolved
          </Button>
        </form>
      </Sheet>
    </div>
  )
}
