import React from 'react'
import { formatMoney } from '../lib/format'
import { cn } from '../lib/cn'

export interface MoneyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: string | number
  currency?: string
  splitDecimals?: boolean
}

export const MoneyText: React.FC<MoneyTextProps> = ({
  amount,
  currency = 'INR',
  splitDecimals = false,
  className,
  ...props
}) => {
  const formatted = formatMoney(typeof amount === 'number' ? amount.toFixed(2) : amount, currency)

  if (!splitDecimals || !formatted.includes('.')) {
    return (
      <span className={cn('font-medium tracking-tight', className)} {...props}>
        {formatted}
      </span>
    )
  }

  const [intPart, decPart] = formatted.split('.')

  return (
    <span className={cn('font-medium tracking-tight inline-flex items-baseline', className)} {...props}>
      <span>{intPart}</span>
      <span className="text-[0.75em] opacity-75">.{decPart}</span>
    </span>
  )
}
