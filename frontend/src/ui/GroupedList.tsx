import React from 'react'
import { cn } from '../lib/cn'

export interface GroupedListProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode
  footer?: React.ReactNode
}

export const GroupedList: React.FC<GroupedListProps> = ({
  header,
  footer,
  children,
  className,
  ...props
}) => {
  return (
    <div className={cn('w-full', className)} {...props}>
      {header && (
        <div className="px-4 pb-2 text-xs uppercase font-medium tracking-wider text-text-3">
          {header}
        </div>
      )}
      <div className="bg-surface-solid rounded-card border border-hairline overflow-hidden divide-y divide-hairline">
        {children}
      </div>
      {footer && (
        <div className="px-4 pt-2 text-xs text-text-3">
          {footer}
        </div>
      )}
    </div>
  )
}
