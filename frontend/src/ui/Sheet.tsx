import React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../lib/cn'
import { IconButton } from './IconButton'

export interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  trigger?: React.ReactNode
  className?: string
}

export const Sheet: React.FC<SheetProps> = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  trigger,
  className,
}) => {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>}
      <DialogPrimitive.Portal>
        {/* Backdrop overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Content: Bottom sheet on mobile, centered modal on md+ */}
        <DialogPrimitive.Content
          className={cn(
            'fixed z-50 glass border border-hairline shadow-float p-6 outline-none transition-all duration-300',
            // Mobile: Bottom sheet
            'bottom-0 left-0 right-0 rounded-t-sheet max-h-[90vh] overflow-y-auto',
            // Desktop: Centered dialog
            'md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg md:rounded-sheet',
            className
          )}
        >
          {/* Top handle bar for mobile */}
          <div className="w-10 h-1 bg-text-3/30 rounded-full mx-auto mb-4 md:hidden" aria-hidden="true" />

          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              {title && (
                <DialogPrimitive.Title className="text-xl font-semibold text-text tracking-tight">
                  {title}
                </DialogPrimitive.Title>
              )}
              {description && (
                <DialogPrimitive.Description className="text-sm text-text-2 mt-1">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton aria-label="Close dialog" size="sm" variant="ghost">
                <X className="w-4 h-4" />
              </IconButton>
            </DialogPrimitive.Close>
          </div>

          <div className="mt-2">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
