import React, { forwardRef } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../lib/cn'

export interface TextButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  withChevron?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export const TextButton = forwardRef<HTMLButtonElement, TextButtonProps>(function TextButton(
  { children, className, withChevron = false, size = 'md', type = 'button', disabled = false, ...props },
  ref
) {
  const sizeStyles = {
    sm: 'text-xs gap-0.5',
    md: 'text-sm gap-1',
    lg: 'text-base gap-1.5',
  }[size]

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex items-center text-tint font-normal hover:opacity-80 active:opacity-60 transition-opacity focus-visible:outline-none disabled:opacity-40 disabled:pointer-events-none group select-none',
        sizeStyles,
        className
      )}
      {...props}
    >
      <span>{children}</span>
      {withChevron && (
        <ChevronRight
          className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      )}
    </button>
  )
})
