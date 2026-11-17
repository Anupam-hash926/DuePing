import React from 'react'
import { Link } from 'react-router-dom'
import type { DebtorRowRead } from '../../api/types'
import { GroupedList } from '../../ui/GroupedList'
import { ListRow } from '../../ui/ListRow'
import { ProgressRing } from '../../ui/ProgressRing'
import { formatMoney } from '../../lib/format'

interface DebtorsListProps {
  debtors: DebtorRowRead[]
}

export const DebtorsList: React.FC<DebtorsListProps> = ({ debtors }) => {
  if (debtors.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-text-3 px-1">
        Top Debtors by Exposure
      </h3>
      <GroupedList>
        {debtors.map((debtor) => (
          <ListRow
            key={debtor.client_id}
            leading={
              <div className="flex items-center justify-center">
                <ProgressRing
                  size="sm"
                  value={100}
                  color="var(--tint)"
                  ariaLabel={`Debtor ${debtor.name}`}
                />
              </div>
            }
            title={
              <Link
                to={`/app/clients`}
                className="font-medium text-text hover:text-tint transition-colors"
              >
                {debtor.name}
              </Link>
            }
            subtitle={
              <span className="text-xs text-text-3">
                Client ID: {debtor.client_id.slice(0, 8)}...
              </span>
            }
            trailing={
              <span className="font-semibold text-text">
                {formatMoney(debtor.outstanding)}
              </span>
            }
          />
        ))}
      </GroupedList>
    </div>
  )
}
