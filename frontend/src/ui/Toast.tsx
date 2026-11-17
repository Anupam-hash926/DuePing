import React from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '../lib/cn'

export interface ToastProps {
  id?: string
  type?: 'success' | 'error' | 'info'
  title: string
  message?: string
  action?: { label: string; onClick: () => void }
  onClose?: () => void
  className?: string
}

export const Toast: React.FC<ToastProps> = ({
  type = 'info',
  title,
  message,
  action,
  onClose,
  className,
}) => {
  const icon = {
    success: <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />,
    info: <Info className="w-4 h-4 text-tint flex-shrink-0" />,
  }[type]

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'glass rounded-sheet border border-hairline shadow-float p-3.5 sm:p-4 flex items-start gap-3 min-w-[280px] max-w-sm select-none',
        className
      )}
    >
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-text">{title}</div>
          {action && (
            <button
              type="button"
              onClick={() => {
                action.onClick()
                onClose?.()
              }}
              className="text-xs font-bold text-tint hover:underline focus-visible:outline-none"
            >
              {action.label}
            </button>
          )}
        </div>
        {message && <div className="text-xs text-text-2 mt-0.5 leading-relaxed">{message}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          className="text-text-3 hover:text-text rounded-full p-1 focus-visible:outline-none"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
