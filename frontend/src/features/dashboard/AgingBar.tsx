import React, { useState } from 'react'
import type { AgingRowRead } from '../../api/types'
import { GroupedList } from '../../ui/GroupedList'
import { ListRow } from '../../ui/ListRow'
import { formatMoney } from '../../lib/format'

interface AgingBarProps {
  aging: AgingRowRead[]
}

const BUCKET_COLORS = [
  '#34C759', // Current - green/teal
  '#30B0C7', // 1-30d - cyan
  '#FF9500', // 31-60d - orange
  '#FF3B30', // 61-90d - red
  '#991B1B', // 90+d - deep red
]

export const AgingBar: React.FC<AgingBarProps> = ({ aging }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const totalAmount = aging.reduce(
    (sum, row) => sum + parseFloat(row.amount.amount || '0'),
    0
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-3 px-1">
          Aging Distribution
        </h3>
        {hoveredIdx !== null && (
          <div className="text-xs font-medium text-text animate-fade-in">
            <span className="font-semibold">{aging[hoveredIdx].label}:</span>{' '}
            {formatMoney(aging[hoveredIdx].amount)} ({aging[hoveredIdx].count} invoices)
          </div>
        )}
      </div>

      {/* Stacked horizontal bar */}
      <div
        className="w-full h-7 rounded-full overflow-hidden flex bg-hairline p-0.5 gap-0.5"
        role="progressbar"
        aria-label="Aging distribution"
      >
        {aging.map((row, idx) => {
          const val = parseFloat(row.amount.amount || '0')
          const pct = totalAmount > 0 ? (val / totalAmount) * 100 : 0
          if (pct === 0) return null

          return (
            <div
              key={row.bucket}
              style={{
                width: `${pct}%`,
                backgroundColor: BUCKET_COLORS[idx % BUCKET_COLORS.length],
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="h-full first:rounded-l-full last:rounded-r-full transition-opacity duration-150 cursor-pointer hover:opacity-85"
              title={`${row.label}: ${formatMoney(row.amount)} (${row.count} invoices)`}
            />
          )
        })}
      </div>

      {/* Inset list of the 5 buckets */}
      <GroupedList>
        {aging.map((row, idx) => (
          <ListRow
            key={row.bucket}
            leading={
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ backgroundColor: BUCKET_COLORS[idx % BUCKET_COLORS.length] }}
              />
            }
            title={<span className="font-medium text-text">{row.label}</span>}
            subtitle={<span className="text-xs text-text-3">{row.count} invoices</span>}
            trailing={
              <span className="font-semibold text-text">
                {formatMoney(row.amount)}
              </span>
            }
          />
        ))}
      </GroupedList>
    </div>
  )
}
