import React from 'react'
import { Link } from 'react-router-dom'
import type { DebtorRowRead } from '../../api/types'
import { GroupedList } from '../../ui/GroupedList'
import { ListRow } from '../../ui/ListRow'
import { getReliabilityColor, ProgressRing } from '../../ui/ProgressRing'
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
                {debtor.reliability_score != null && (
                  <ProgressRing
                    size="sm"
                    value={debtor.reliability_score}
                    color={getReliabilityColor(debtor.reliability_score)}
                    ariaLabel={`Reliability ${debtor.reliability_score} out of 100`}
                  />
                )}
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
