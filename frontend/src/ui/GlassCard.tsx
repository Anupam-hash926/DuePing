import React from 'react'
import { cn } from '../lib/cn'

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  solid?: boolean
  padded?: boolean
  interactive?: boolean
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  { children, className, solid = false, padded = true, interactive = false, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-card border border-hairline transition-all duration-200',
        solid ? 'bg-surface-solid' : 'glass shadow-float',
        padded && 'p-5 sm:p-6',
        interactive && 'cursor-pointer hover:border-text-3/40 hover:-translate-y-0.5 active:translate-y-0',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})
