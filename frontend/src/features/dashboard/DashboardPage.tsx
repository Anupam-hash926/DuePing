import React from 'react'
import { useDashboard } from '../../api/hooks/useQueries'
import { LargeTitle } from '../../ui/LargeTitle'
import { Skeleton } from '../../ui/Skeleton'
import { ProgressRing } from '../../ui/ProgressRing'
import { useCountUp } from '../../ui/Stat'
import { AgingBar } from './AgingBar'
import { TrendSpark } from './TrendSpark'
import { DebtorsList } from './DebtorsList'
import { formatMoney } from '../../lib/format'
import { useDefaultCurrency } from '../../lib/useCurrency'

const BigNumeral: React.FC<{
  label: string
  amount: number
  currency?: string
  meta?: string
  variant?: 'default' | 'danger' | 'success'
}> = ({ label, amount, currency, meta, variant = 'default' }) => {
  const defaultCurrency = useDefaultCurrency()
  const activeCurrency = currency || defaultCurrency
  const animated = useCountUp(amount)

  const colorClass =
    variant === 'danger'
      ? 'text-fill-red'
      : variant === 'success'
      ? 'text-fill-green'
      : 'text-text'

  const formatted = formatMoney({ amount: animated.toFixed(2), currency: activeCurrency })
  const parts = formatted.split('.')
  const whole = parts[0]
  const decimal = parts[1]

  return (
    <div className="bg-surface-solid rounded-[28px] border border-hairline p-6 sm:p-8 space-y-2 [container-type:inline-size]">
      <div className="text-xs font-semibold uppercase tracking-wider text-text-3">
        {label}
      </div>
      <div
        data-testid="big-numeral"
        className={`font-extralight tracking-tight whitespace-nowrap [font-variant-numeric:tabular-nums] ${colorClass}`}
        style={{ fontSize: 'clamp(1.75rem, 8cqi, 4.25rem)' }}
      >
        <span>{whole}</span>
        {decimal && <span className="text-[0.45em] opacity-75">.{decimal}</span>}
      </div>
      {meta && <div className="text-xs font-medium text-text-3">{meta}</div>}
    </div>
  )
}

export const DashboardPage: React.FC = () => {
  const { data: report, isLoading } = useDashboard()

  if (isLoading && !report) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-36 rounded-[28px]" variant="rectangular" />
          <Skeleton className="h-36 rounded-[28px]" variant="rectangular" />
          <Skeleton className="h-36 rounded-[28px]" variant="rectangular" />
        </div>
        <Skeleton className="h-64 rounded-[28px]" variant="rectangular" />
      </div>
    )
  }

  if (!report) return null

  const outstandingVal = parseFloat(report.total_outstanding.amount || '0')
  const overdueVal = parseFloat(report.total_overdue.amount || '0')
  const collectedVal = parseFloat(report.collected_this_month.amount || '0')
  const keepRate = report.promise_keep_rate ?? 0

  const blockerEntries = Object.entries(report.open_blockers_by_type || {})

  return (
    <div className="space-y-8">
      <div>
        <LargeTitle
          title="Overview"
          subtitle="Real-time collection health, aging distribution, and debtor risk."
        />
      </div>

      {/* 3 Big Numerals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BigNumeral
          label="Outstanding"
          amount={outstandingVal}
          currency={report.total_outstanding.currency}
          meta={`${report.active_count} active invoices`}
        />
        <BigNumeral
          label="Overdue"
          amount={overdueVal}
          currency={report.total_overdue.currency}
          meta={`${report.overdue_count} overdue invoices`}
          variant="danger"
        />
        <BigNumeral
          label="Collected this month"
          amount={collectedVal}
          currency={report.collected_this_month.currency}
          meta="Cash received in current calendar month"
          variant="success"
        />
      </div>

      {/* Grid: Aging & Collection Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <AgingBar aging={report.aging || []} />
        <div className="space-y-8">
          <TrendSpark points={report.collection_trend || []} />

          {/* Promises & Blockers Card */}
          <div className="bg-surface-solid rounded-[28px] border border-hairline p-6 space-y-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-3">
              Promises & Blockers
            </h3>

            {/* Promise Reliability Ring */}
            <div className="flex items-center gap-6">
              <ProgressRing
                size="lg"
                value={keepRate}
                color={keepRate >= 80 ? 'var(--fill-green)' : keepRate >= 50 ? 'var(--fill-amber)' : 'var(--fill-red)'}
                label={`${Math.round(keepRate)}%`}
                ariaLabel={`Promise keep rate ${Math.round(keepRate)} percent`}
              />
              <div>
                <div className="text-2xl font-light text-text">
                  {Math.round(keepRate)}% keep rate
                </div>
                <div className="text-xs text-text-3 mt-1">
                  {report.kept_promises} kept · {report.broken_promises} broken promises
                </div>
              </div>
            </div>

            {/* Open Blockers by Type */}
            {blockerEntries.length > 0 && (
              <div className="pt-4 border-t border-hairline">
                <div className="text-xs font-semibold text-text-3 mb-2.5">
                  Open Blockers by Type
                </div>
                <div className="flex flex-wrap gap-2">
                  {blockerEntries.map(([type, count]) => (
                    <span
                      key={type}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-fill-red/10 border border-fill-red/20 text-fill-red"
                    >
                      <span>{type}</span>
                      <strong className="font-semibold">({count})</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Debtors List */}
      <DebtorsList debtors={report.top_debtors || []} />
    </div>
  )
}
