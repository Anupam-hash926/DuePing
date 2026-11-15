import React from 'react'
import { Ring } from './Ring'
import { cn } from '../lib/cn'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 sm:p-12 max-w-md mx-auto',
        className
      )}
      {...props}
    >
      <div className="mb-4">
        {icon ?? <Ring size="lg" pulse={false} />}
      </div>
      <h3 className="text-lg font-medium text-text tracking-tight mb-1">{title}</h3>
      {description && <p className="text-sm text-text-2 mb-6 leading-relaxed">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  )
}
