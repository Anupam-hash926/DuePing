import React, { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../lib/cn'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    type = 'button',
    ...props
  },
  ref
) {
  const baseStyles =
    'relative inline-flex items-center justify-center font-medium transition-all duration-150 rounded-pill focus-visible:outline-none select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40'

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 h-8 gap-1.5',
    md: 'text-sm px-4 py-2 h-10 gap-2',
    lg: 'text-base px-6 py-3 h-12 gap-2.5',
  }[size]

  const variantStyles = {
    primary: 'bg-tint text-white hover:opacity-90 active:opacity-100 shadow-sm',
    secondary: 'bg-surface-solid text-text border border-hairline hover:bg-bg-grouped active:bg-bg-grouped/80',
    danger: 'bg-danger text-white hover:opacity-90 active:opacity-100 shadow-sm',
    ghost: 'bg-transparent text-text hover:bg-bg-grouped/60 text-tint hover:text-tint',
  }[variant]

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(baseStyles, sizeStyles, variantStyles, className)}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin text-current" aria-hidden="true" />}
      <span className={cn('inline-flex items-center gap-1.5', loading && 'opacity-80')}>{children}</span>
    </button>
  )
})
