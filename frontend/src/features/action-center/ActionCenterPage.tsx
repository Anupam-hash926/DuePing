import React, { useState, useMemo } from 'react'
import { useActionCenter } from '../../api/hooks/useQueries'
import { useCompleteAnyAction, useRescheduleAnyAction } from '../../api/hooks/useMutations'
import { LargeTitle } from '../../ui/LargeTitle'
import { SegmentedControl } from '../../ui/SegmentedControl'
import { EmptyState } from '../../ui/EmptyState'
import { Skeleton } from '../../ui/Skeleton'
import { useToast } from '../../context/ToastContext'
import { FocusCard } from './FocusCard'
import { UpNextList } from './UpNextList'
import { UpcomingList } from './UpcomingList'
import { formatDate, formatMoney } from '../../lib/format'
import type { ActionCenterItemRead } from '../../api/types'

export const ActionCenterPage: React.FC = () => {
  const { showSuccess, showError } = useToast()
  const [selectedStrategy, setSelectedStrategy] = useState<string>('')
  const [focusIndex, setFocusIndex] = useState<number>(0)

  const { data, isLoading } = useActionCenter(selectedStrategy || undefined)

  const completeMutation = useCompleteAnyAction()
  const rescheduleMutation = useRescheduleAnyAction()

  const currentStrategy = selectedStrategy || data?.strategy || 'risk'
  const items: ActionCenterItemRead[] = data?.items ?? []
  const upcomingItems: ActionCenterItemRead[] = data?.upcoming ?? []

  // Ensure focusIndex is within bounds
  const activeFocusIndex = focusIndex >= items.length ? Math.max(0, items.length - 1) : focusIndex
  const focusItem = items[activeFocusIndex]
  const remainingItems = items.filter((_: ActionCenterItemRead, idx: number) => idx !== activeFocusIndex)

  // Total stake calculation
  const totalStake = useMemo(() => {
    return items.reduce((acc: number, item: ActionCenterItemRead) => acc + parseFloat(item.outstanding.amount || '0'), 0)
  }, [items])

  const handleComplete = async (invoiceId: string, actionId: string) => {
    try {
      await completeMutation.mutateAsync({ invoiceId, actionId })
      showSuccess('Action completed')
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleReschedule = async (invoiceId: string, actionId: string, newDate: string) => {
    try {
      await rescheduleMutation.mutateAsync({ invoiceId, actionId, newDate })
      showSuccess(`Action rescheduled to ${formatDate(newDate)}`)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full rounded-[28px]" variant="rectangular" />
      </div>
    )
  }

  const strategyOptions = (data?.strategies ?? [
    { key: 'risk', label: 'Risk-weighted' },
    { key: 'amount', label: 'Largest amount' },
    { key: 'overdue', label: 'Most overdue' },
  ]).map((s) => ({
    value: s.key,
    label: s.label,
  }))

  const todayDisplay = data?.today ? formatDate(data.today) : formatDate(new Date().toISOString())

  return (
    <div className="space-y-8">
      {/* Title & Date */}
      <div>
        <LargeTitle
          title="Today"
          subtitle={todayDisplay}
        />
      </div>

      {/* Strategy Switcher */}
      <div className="max-w-md">
        <SegmentedControl
          value={currentStrategy}
          onChange={(val) => {
            setSelectedStrategy(val)
            setFocusIndex(0)
          }}
          options={strategyOptions}
        />
      </div>

      {/* Stake & Count Summary */}
      <div className="text-base text-text-2">
        <strong className="text-text font-semibold">{items.length}</strong>{' '}
        {items.length === 1 ? 'thing needs' : 'things need'} you today ·{' '}
        <strong className="text-text font-semibold">
          {formatMoney({ amount: totalStake.toFixed(2), currency: 'GBP' })}
        </strong>{' '}
        at stake
      </div>

      {/* Focus Card & Lists OR Empty State */}
      {items.length === 0 ? (
        <EmptyState
          title="You're all caught up."
          description="No pending actions need your attention today. Great job keeping receivables on track!"
        />
      ) : (
        <div className="space-y-8">
          {focusItem && (
            <FocusCard
              item={focusItem}
              totalCount={items.length}
              currentIndex={activeFocusIndex}
              onComplete={handleComplete}
              onReschedule={handleReschedule}
              onNext={() => setFocusIndex((prev) => (prev + 1) % items.length)}
              onPrev={() => setFocusIndex((prev) => (prev - 1 + items.length) % items.length)}
            />
          )}

          <UpNextList
            items={remainingItems}
            onComplete={handleComplete}
            onSelect={(idx) => setFocusIndex(idx)}
          />
        </div>
      )}

      {/* Upcoming Section */}
      {upcomingItems.length > 0 && <UpcomingList items={upcomingItems} />}
    </div>
  )
}
