import React from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import type { ActionCenterItemRead } from '../../api/types'
import { GroupedList } from '../../ui/GroupedList'
import { ListRow } from '../../ui/ListRow'
import { IconButton } from '../../ui/IconButton'
import { formatMoney, formatDate } from '../../lib/format'

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
                <span className="text-xs text-text-3">
                  {item.client_name} · <Link to={`/app/invoices/${item.invoice_id}`} className="hover:underline text-tint" onClick={(e) => e.stopPropagation()}>{item.invoice_number}</Link>
                </span>
              }
              trailing={
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-text">
                      {formatMoney(item.outstanding)}
                    </div>
                    <div className="text-xs text-text-3">
                      due {formatDate(item.action.due_date)}
                    </div>
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
