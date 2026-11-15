import React, { useEffect, useState } from 'react'
import { isReducedMotion } from '../lib/motion'
import { formatMoney } from '../lib/format'
import { cn } from '../lib/cn'

export function useCountUp(endValue: number, duration: number = 800): number {
  const [current, setCurrent] = useState(() => (isReducedMotion() ? endValue : 0))

  useEffect(() => {
    if (isReducedMotion()) {
      setCurrent(endValue)
      return
    }

    let startTime: number | null = null
    const startValue = current

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const nextValue = startValue + (endValue - startValue) * eased
      setCurrent(nextValue)

      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        setCurrent(endValue)
      }
    }

    const frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [endValue, duration])

  return current
}

export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: number | string
  isMoney?: boolean
  currency?: string
  trend?: {
    value: number
    isPositiveGood?: boolean
    label?: string
  }
  description?: string
}

export const Stat: React.FC<StatProps> = ({
  label,
  value,
  isMoney = false,
  currency = 'INR',
  trend,
  description,
  className,
  ...props
}) => {
  const numericValue = typeof value === 'number' ? value : parseFloat(value) || 0
  const animatedValue = useCountUp(numericValue)

  const displayValue = isMoney
    ? formatMoney({ amount: animatedValue.toFixed(2), currency })
    : typeof value === 'number'
    ? Math.round(animatedValue).toLocaleString('en-IN')
    : value

  return (
    <div className={cn('flex flex-col gap-1', className)} {...props}>
      <span className="text-xs font-medium uppercase tracking-wider text-text-3">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-light tracking-tight text-text">
          {displayValue}
        </span>
        {trend && (
          <span
            className={cn(
              'text-xs font-medium px-1.5 py-0.5 rounded-pill',
              trend.value >= 0
                ? trend.isPositiveGood !== false
                  ? 'bg-success/10 text-success'
                  : 'bg-danger/10 text-danger'
                : trend.isPositiveGood !== false
                ? 'bg-danger/10 text-danger'
                : 'bg-success/10 text-success'
            )}
          >
            {trend.value >= 0 ? `+${trend.value}%` : `${trend.value}%`}
          </span>
        )}
      </div>
      {description && <span className="text-xs text-text-2 mt-0.5">{description}</span>}
    </div>
  )
}
