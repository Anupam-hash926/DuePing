import React from 'react'
import { cn } from '../lib/cn'

export interface MeterProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number // 0 to 100
  label?: string
  valueLabel?: string
  variant?: 'tint' | 'success' | 'warning' | 'danger' | 'gradient'
  size?: 'sm' | 'md'
}

export const Meter: React.FC<MeterProps> = ({
  value,
  label,
  valueLabel,
  variant = 'tint',
  size = 'md',
  className,
  ...props
}) => {
  const clamped = Math.max(0, Math.min(100, value))

  const height = size === 'sm' ? 'h-1.5' : 'h-2.5'

  const barStyles = {
    tint: 'bg-tint',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    gradient: 'bg-gradient-to-r from-teal via-tint to-purple',
  }[variant]

  return (
    <div className={cn('w-full flex flex-col gap-1.5', className)} {...props}>
      {(label || valueLabel) && (
        <div className="flex justify-between items-center text-xs">
          {label && <span className="font-medium text-text-2">{label}</span>}
          {valueLabel && <span className="text-text font-semibold">{valueLabel}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? (valueLabel ? `${valueLabel} (${clamped}%)` : `Progress: ${clamped}%`)}
        className={cn('w-full bg-bg-grouped rounded-full overflow-hidden border border-hairline', height)}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', barStyles)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
