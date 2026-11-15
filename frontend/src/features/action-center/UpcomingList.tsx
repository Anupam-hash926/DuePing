import React from 'react'
import { Link } from 'react-router-dom'
import type { ActionCenterItemRead } from '../../api/types'
import { GroupedList } from '../../ui/GroupedList'
import { ListRow } from '../../ui/ListRow'
import { formatMoney, formatDate } from '../../lib/format'

interface UpcomingListProps {
  items: ActionCenterItemRead[]
}

export const UpcomingList: React.FC<UpcomingListProps> = ({ items }) => {
  if (items.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-text-3 px-1">
        Upcoming (Next 7 Days)
      </h3>
      <GroupedList>
        {items.map((item) => {
          const priorityColor =
            item.action.priority === 'CRITICAL'
              ? 'bg-fill-red'
              : item.action.priority === 'HIGH'
              ? 'bg-fill-amber'
              : 'bg-tint'

          return (
            <ListRow
              key={item.action.id}
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
                  {item.client_name} · <Link to={`/app/invoices/${item.invoice_id}`} className="hover:underline text-tint">{item.invoice_number}</Link>
                </span>
              }
              trailing={
                <div className="text-right">
                  <div className="text-sm font-semibold text-text">
                    {formatMoney(item.outstanding)}
                  </div>
                  <div className="text-xs text-text-3">
                    due {formatDate(item.action.due_date)}
                  </div>
                </div>
              }
            />
          )
        })}
      </GroupedList>
    </div>
  )
}
