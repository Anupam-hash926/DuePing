import React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../lib/cn'

export interface ListRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  leading?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  trailing?: React.ReactNode
  onClick?: () => void
  interactive?: boolean
  withChevron?: boolean
}

export const ListRow: React.FC<ListRowProps> = ({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  interactive = !!onClick,
  withChevron = false,
  className,
  ...props
}) => {
  const isClickable = interactive || !!onClick

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      className={cn(
        'flex items-center justify-between px-4 py-3 min-h-[48px] gap-3 text-sm transition-colors select-none',
        isClickable && 'cursor-pointer hover:bg-bg-grouped/60 active:bg-bg-grouped focus-visible:outline-none',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {leading && <div className="flex-shrink-0 text-text-2">{leading}</div>}
        <div className="min-w-0 flex-1">
          <div className="font-medium text-text truncate">{title}</div>
          {subtitle && <div className="text-xs text-text-2 truncate">{subtitle}</div>}
        </div>
      </div>

      {(trailing || withChevron) && (
        <div className="flex items-center gap-2 flex-shrink-0 text-text-2">
          {trailing && <div className="text-xs sm:text-sm">{trailing}</div>}
          {withChevron && <ChevronRight className="w-4 h-4 text-text-3" aria-hidden="true" />}
        </div>
      )}
    </div>
  )
}
