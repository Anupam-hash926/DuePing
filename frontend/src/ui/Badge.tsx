import React from 'react'
import { cn } from '../lib/cn'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'tint' | 'success' | 'warning' | 'danger' | 'purple' | 'teal'
  size?: 'sm' | 'md'
  dot?: boolean
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'neutral',
  size = 'md',
  dot = false,
  ...props
}) => {
  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 font-medium tracking-wide',
    md: 'text-xs px-2.5 py-1 font-medium',
  }[size]

  const variantStyles = {
    neutral: 'bg-bg-grouped text-text-2 border border-hairline',
    tint: 'bg-tint/10 text-tint border border-tint/20',
    success: 'bg-success/10 text-success border border-success/20',
    warning: 'bg-warning/10 text-warning border border-warning/20',
    danger: 'bg-danger/10 text-danger border border-danger/20',
    purple: 'bg-purple/10 text-purple border border-purple/20',
    teal: 'bg-teal/10 text-teal border border-teal/20',
  }[variant]

  const dotColor = {
    neutral: 'bg-text-3',
    tint: 'bg-tint',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    purple: 'bg-purple',
    teal: 'bg-teal',
  }[variant]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill select-none uppercase tracking-wider',
        sizeStyles,
        variantStyles,
        className
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColor)} aria-hidden="true" />}
      <span>{children}</span>
    </span>
  )
}
