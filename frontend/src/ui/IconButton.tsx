import React, { forwardRef } from 'react'
import { cn } from '../lib/cn'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string
  variant?: 'ghost' | 'secondary' | 'glass'
  size?: 'sm' | 'md' | 'lg'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, variant = 'ghost', size = 'md', type = 'button', disabled = false, children, ...props },
  ref
) {
  const sizeStyles = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
  }[size]

  const variantStyles = {
    ghost: 'text-text-2 hover:text-text hover:bg-bg-grouped active:bg-bg-grouped/80',
    secondary: 'bg-surface-solid text-text border border-hairline hover:bg-bg-grouped active:bg-bg-grouped/80 shadow-sm',
    glass: 'glass text-text border border-hairline hover:bg-surface-solid/80 active:bg-surface-solid/60',
  }[variant]

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center rounded-pill transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none',
        sizeStyles,
        variantStyles,
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
})
