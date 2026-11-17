import React from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import type { ActionCenterItemRead } from '../../api/types'
import { GroupedList } from '../../ui/GroupedList'
import { ListRow } from '../../ui/ListRow'
import { IconButton } from '../../ui/IconButton'
import { formatMoney, formatDate } from '../../lib/format'
import { labelOrFallback, priorityLabel } from '../../lib/labels'

interface UpNextListProps {
  items: ActionCenterItemRead[]
  onComplete: (invoiceId: string, actionId: string) => Promise<void>
  onSelect: (index: number) => void
}

export const UpNextList: React.FC<UpNextListProps> = ({ items, onComplete, onSelect }) => {
  if (items.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-text-3 px-1">
        Up Next
      </h3>
      <GroupedList>
        {items.map((item, idx) => {
          const priorityColor =
            item.action.priority === 'CRITICAL'
              ? 'bg-fill-red'
              : item.action.priority === 'HIGH'
              ? 'bg-fill-amber'
              : 'bg-tint'
          const reliabilityFact = item.reason
            ?.split(' · ')
            .map((fact) => fact.trim())
            .find((fact) => fact.toLowerCase().includes('reliability'))

          return (
            <ListRow
              key={item.action.id}
              onClick={() => onSelect(idx + 1)}
              leading={
                <div className="flex items-center justify-center w-6 h-6">
                  <span className={`w-2.5 h-2.5 rounded-full ${priorityColor}`} />
                </div>
              }
              title={
                <span className="font-medium text-text text-sm">
                  {item.action.description}
                </span>
              }
              subtitle={
                <span className="text-xs text-text-3 flex items-center gap-1.5 flex-wrap">
                  <span>{item.client_name}</span>
                  <span>·</span>
                  <Link to={`/app/invoices/${item.invoice_id}`} className="hover:underline text-tint" onClick={(e) => e.stopPropagation()}>{item.invoice_number}</Link>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-bg-grouped border border-hairline text-text">
                    <span className={`w-2 h-2 rounded-full ${priorityColor}`} />
                    {labelOrFallback(priorityLabel, item.action.priority)} priority
                  </span>
                  {item.days_overdue > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-fill-red/10 border border-fill-red/20 text-fill-red">
                      {item.days_overdue} days overdue
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full bg-bg-grouped border border-hairline text-text">
                    Outstanding {formatMoney(item.outstanding)}
                  </span>
                  {reliabilityFact && (
                    <span className="px-2 py-0.5 rounded-full bg-bg-grouped border border-hairline text-text-2">
                      {reliabilityFact}
                    </span>
                  )}
                  {item.suggested_tone && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-tint/10 text-tint border border-tint/20">
                      Suggested: {item.suggested_tone}
                    </span>
                  )}
                </span>
              }
              trailing={
                <div className="flex items-center gap-3">
                  <div className="text-right text-xs text-text-3">
                    due {formatDate(item.action.due_date)}
                  </div>
                  <IconButton
                    aria-label="Complete action"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onComplete(item.invoice_id, item.action.id)
                    }}
                  >
                    <Check className="w-3.5 h-3.5 text-tint" />
                  </IconButton>
                </div>
              }
            />
          )
        })}
      </GroupedList>
    </div>
  )
}
