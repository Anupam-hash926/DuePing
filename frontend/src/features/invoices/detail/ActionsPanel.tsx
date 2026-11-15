import React, { useState } from 'react'
import { CheckCircle2, Clock, Plus } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { InvoiceRead, NextActionRead } from '../../../api/types'
import { apiClient } from '../../../api/client'
import { invalidateInvoiceDependencies } from '../../../api/queryClient'
import { GroupedList } from '../../../ui/GroupedList'
import { ListRow } from '../../../ui/ListRow'
import { Button } from '../../../ui/Button'
import { Sheet } from '../../../ui/Sheet'
import { Badge } from '../../../ui/Badge'
import { formatDate } from '../../../lib/format'
import { useCreateAction, useRescheduleAction } from '../../../api/hooks/useMutations'

export interface ActionsPanelProps {
  invoice: InvoiceRead
}

export const ActionsPanel: React.FC<ActionsPanelProps> = ({ invoice }) => {
  const createAction = useCreateAction(invoice.id)
  const allowed = new Set(invoice.allowed_operations)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [desc, setDesc] = useState('')
  const [priority, setPriority] = useState('HIGH')
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split('T')[0])

  // Reschedule state
  const [reschedulingActionId, setReschedulingActionId] = useState<string | null>(null)
  const [newDueDate, setNewDueDate] = useState('')

  const qc = useQueryClient()
  const completeAction = useMutation({
    mutationFn: (actId: string) =>
      apiClient.post<InvoiceRead>(`/invoices/${invoice.id}/actions/${actId}/complete`),
    onSuccess: () => invalidateInvoiceDependencies(qc, invoice.id),
  })
  const rescheduleAction = useRescheduleAction(invoice.id, reschedulingActionId ?? '')

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!desc.trim()) return
    await createAction.mutateAsync({
      description: desc.trim(),
      priority,
      due_date: dueDate,
    })
    setCreateModalOpen(false)
    setDesc('')
  }

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDueDate) return
    await rescheduleAction.mutateAsync({ new_date: newDueDate })
    setReschedulingActionId(null)
    setNewDueDate('')
  }

  const getPriorityVariant = (p: string) => {
    switch (p) {
      case 'URGENT':
      case 'HIGH':
        return 'danger'
      case 'MEDIUM':
        return 'warning'
      default:
        return 'neutral'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-3">
          Next Recovery Actions ({invoice.actions.length})
        </h3>
        {allowed.has('add_action') && (
          <Button size="sm" variant="secondary" onClick={() => setCreateModalOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1 text-tint" />
            Add Action
          </Button>
        )}
      </div>

      {invoice.actions.length === 0 ? (
        <div className="p-8 text-center bg-surface-solid rounded-card border border-hairline text-text-3 text-xs">
          No recovery actions assigned.
        </div>
      ) : (
        <GroupedList>
          {invoice.actions.map((act: NextActionRead) => (
            <ListRow
              key={act.id}
              leading={
                act.status === 'PENDING' ? (
                  <Clock className="w-5 h-5 text-warning flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                )
              }
              title={
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-medium ${act.status === 'COMPLETED' ? 'line-through text-text-3' : 'text-text'}`}>
                    {act.description}
                  </span>
                  <Badge variant={getPriorityVariant(act.priority)} size="sm">
                    {act.priority}
                  </Badge>
                  {act.source === 'PLAYBOOK' && (
                    <Badge variant="purple" size="sm">Playbook</Badge>
                  )}
                </div>
              }
              subtitle={
                <span className="text-text-3">
                  Due {formatDate(act.due_date)}
                  {act.status === 'COMPLETED' && act.completed_at && ` · Completed ${formatDate(act.completed_at)}`}
                </span>
              }
              trailing={
                act.status === 'PENDING' && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs px-2"
                      onClick={() => setReschedulingActionId(act.id)}
                    >
                      Reschedule
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      className="h-7 text-xs px-2.5"
                      onClick={() => completeAction.mutate(act.id)}
                      loading={completeAction.isPending}
                    >
                      Done
                    </Button>
                  </div>
                )
              }
            />
          ))}
        </GroupedList>
      )}

      {/* Create Action Modal */}
      <Sheet open={createModalOpen} onOpenChange={setCreateModalOpen} title="Add Next Action">
        <form onSubmit={handleCreateSubmit} className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-medium text-text-2 block mb-1">Description</label>
            <input
              type="text"
              required
              placeholder="e.g. Call VP of Finance regarding invoice approval..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full h-10 px-3 bg-bg-grouped border border-hairline rounded-input text-text text-sm outline-none focus:border-tint"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-text-2 block mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full h-10 px-3 bg-bg-grouped border border-hairline rounded-input text-text text-sm outline-none focus:border-tint"
              >
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-text-2 block mb-1">Due Date</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-10 px-3 bg-bg-grouped border border-hairline rounded-input text-text text-sm outline-none focus:border-tint"
              />
            </div>
          </div>

          <Button type="submit" variant="primary" loading={createAction.isPending} className="w-full mt-2">
            Create Action
          </Button>
        </form>
      </Sheet>

      {/* Reschedule Action Modal */}
      <Sheet
        open={Boolean(reschedulingActionId)}
        onOpenChange={(open) => !open && setReschedulingActionId(null)}
        title="Reschedule Recovery Action"
      >
        <form onSubmit={handleRescheduleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-medium text-text-2 block mb-1">New Due Date</label>
            <input
              type="date"
              required
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="w-full h-10 px-3 bg-bg-grouped border border-hairline rounded-input text-text text-sm outline-none focus:border-tint"
            />
          </div>

          <Button type="submit" variant="primary" loading={rescheduleAction.isPending} className="w-full">
            Save New Date
          </Button>
        </form>
      </Sheet>
    </div>
  )
}
