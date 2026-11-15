import React from 'react'
import { cn } from '../lib/cn'

export interface RingProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'hero'
  pulse?: boolean
  color?: string
}

export const Ring: React.FC<RingProps> = ({
  size = 'md',
  pulse = true,
  color = '#007AFF',
  className,
  ...props
}) => {
  const sizeMap = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    hero: 'w-32 h-32 sm:w-48 sm:h-48',
  }[size]

  return (
    <div
      className={cn('relative inline-flex items-center justify-center flex-shrink-0', sizeMap, className)}
      {...props}
    >
      {/* Outer animated ping ring */}
      {pulse && (
        <span
          className="absolute inset-0 rounded-full animate-ping opacity-25"
          style={{ backgroundColor: color }}
        />
      )}
      {/* Middle static ring */}
      <span
        className="absolute inset-1.5 rounded-full border border-current opacity-40"
        style={{ color }}
      />
      {/* Center solid core */}
      <span
        className="relative w-2.5 h-2.5 rounded-full shadow-sm"
        style={{ backgroundColor: color }}
      />
    </div>
  )
}
