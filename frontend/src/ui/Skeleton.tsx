import React from 'react'
import { cn } from '../lib/cn'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rectangular' | 'circular' | 'pill'
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rectangular',
  className,
  ...props
}) => {
  const shape = {
    rectangular: 'rounded-input',
    circular: 'rounded-full',
    pill: 'rounded-pill',
  }[variant]

  return (
    <div
      className={cn(
        'bg-bg-grouped animate-pulse border border-hairline/40 select-none motion-reduce:animate-none',
        shape,
        className
      )}
      aria-hidden="true"
      {...props}
    />
  )
}
