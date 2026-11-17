import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useActionCenter, useInvoices } from '../../api/hooks/useQueries'
import { useCompleteAnyAction, useReopenAnyAction, useRescheduleAnyAction, useResetDemo } from '../../api/hooks/useMutations'
import { LargeTitle } from '../../ui/LargeTitle'
import { SegmentedControl } from '../../ui/SegmentedControl'
import { EmptyState } from '../../ui/EmptyState'
import { Skeleton } from '../../ui/Skeleton'
import { Button } from '../../ui/Button'
import { useToast } from '../../context/ToastContext'
import { FocusCard } from './FocusCard'
import { UpNextList } from './UpNextList'
import { UpcomingList } from './UpcomingList'
import { formatDate, formatMoney } from '../../lib/format'
import type { ActionCenterItemRead } from '../../api/types'
import { useDefaultCurrency } from '../../lib/useCurrency'

export const ActionCenterPage: React.FC = () => {
  const navigate = useNavigate()
  const { showSuccess, showError, showCustom } = useToast()
  const defaultCurrency = useDefaultCurrency()
  const [selectedStrategy, setSelectedStrategy] = useState<string>('')
  const [focusIndex, setFocusIndex] = useState<number>(0)

  const { data, isLoading } = useActionCenter(selectedStrategy || undefined)
  const { data: allInvoices } = useInvoices()

  const completeMutation = useCompleteAnyAction()
  const reopenMutation = useReopenAnyAction()
  const rescheduleMutation = useRescheduleAnyAction()
  const resetDemo = useResetDemo()

  const currentStrategy = selectedStrategy || data?.strategy || 'risk_weighted'
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
      showCustom({
        type: 'success',
        title: 'Marked done',
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await reopenMutation.mutateAsync({ invoiceId, actionId })
              showSuccess('Action restored')
            } catch (err: unknown) {
              showError(err instanceof Error ? err.message : String(err))
            }
          },
        },
      })
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

  const strategyShortLabels: Record<string, string> = {
    risk_weighted: 'Risk',
    risk: 'Risk',
    amount_first: 'Amount',
    amount: 'Amount',
    oldest_first: 'Oldest',
    overdue: 'Oldest',
  }

  const isRecommended = (key: string) => key === 'risk_weighted' || key === 'risk'

  const strategyOptions = (data?.strategies ?? [
    { key: 'risk_weighted', label: 'Risk-weighted' },
    { key: 'amount_first', label: 'Largest amount' },
    { key: 'oldest_first', label: 'Most overdue' },
  ]).map((s) => ({
    value: s.key,
    label: (
      <span className="flex items-center gap-1.5 justify-center">
        <span>{strategyShortLabels[s.key] ?? (s.key.includes('risk') ? 'Risk' : s.key.includes('amount') ? 'Amount' : 'Oldest')}</span>
        {isRecommended(s.key) && <span className="w-1.5 h-1.5 rounded-full bg-tint" title="Recommended" />}
      </span>
    ),
    title: s.label + (isRecommended(s.key) ? ' (Recommended)' : ''),
    ariaLabel: s.label + (isRecommended(s.key) ? ' (Recommended)' : ''),
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
          ariaLabel="Sort ranking strategies"
          value={currentStrategy}
          onChange={(val) => {
            setSelectedStrategy(val)
            setFocusIndex(0)
          }}
          options={strategyOptions}
          className="w-full"
        />
        <div className="text-[11px] text-text-3 font-medium flex items-center gap-1.5 mt-2 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-tint" />
          <span>Recommended: Risk-weighted ranking</span>
        </div>
      </div>

      {/* Stake & Count Summary */}
      <div className="text-base text-text-2">
        <strong className="text-text font-semibold">{items.length}</strong>{' '}
        {items.length === 1 ? 'thing needs' : 'things need'} you today ·{' '}
        <strong className="text-text font-semibold">
          {formatMoney({ amount: totalStake.toFixed(2), currency: items[0]?.outstanding?.currency || defaultCurrency })}
        </strong>{' '}
        at stake
      </div>

      {/* Focus Card & Lists OR Empty State */}
      {items.length === 0 ? (
        allInvoices && allInvoices.length === 0 ? (
          <div className="glass rounded-card border border-hairline p-6 sm:p-8 space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-text">Get started with DuePing</h3>
              <p className="text-sm text-text-2">
                Start collecting payments on time in three simple steps, or populate the workspace with canonical demo data.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-surface rounded-sheet border border-hairline p-4 space-y-3">
                <div className="w-8 h-8 rounded-full bg-tint/10 flex items-center justify-center text-tint font-bold text-sm">
                  1
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-text">Add a client</div>
                  <div className="text-xs text-text-3">Define client payment terms, contacts, and tracking history.</div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => navigate('/app/clients')}>
                  Add client <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>

              <div className="bg-surface rounded-sheet border border-hairline p-4 space-y-3">
                <div className="w-8 h-8 rounded-full bg-tint/10 flex items-center justify-center text-tint font-bold text-sm">
                  2
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-text">Create an invoice</div>
                  <div className="text-xs text-text-3">Draft an invoice with line items, due dates, and amount.</div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => navigate('/app/invoices/new')}>
                  New invoice <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>

              <div className="bg-surface rounded-sheet border border-hairline p-4 space-y-3">
                <div className="w-8 h-8 rounded-full bg-tint/10 flex items-center justify-center text-tint font-bold text-sm">
                  3
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-text">Send and track</div>
                  <div className="text-xs text-text-3">Move to Sent to trigger automatic due tracking and playbooks.</div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => navigate('/app/invoices')}>
                  View invoices <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>

            <div className="pt-2 border-t border-hairline flex flex-wrap items-center justify-between gap-4">
              <span className="text-xs text-text-3">Want to explore with realistic accounts receivable?</span>
              <Button
                variant="primary"
                size="sm"
                onClick={() => resetDemo.mutate()}
                loading={resetDemo.isPending}
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                Load demo data
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState
            title="You're all caught up."
            description="No pending actions need your attention today. Great job keeping receivables on track!"
          />
        )
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
