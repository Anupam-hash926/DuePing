import React from 'react'
import { cn } from '../lib/cn'

export interface LargeTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  subtitle?: React.ReactNode
  badge?: React.ReactNode
}

export const LargeTitle: React.FC<LargeTitleProps> = ({
  children,
  subtitle,
  badge,
  className,
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1 mb-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1
          className={cn(
            'text-3xl sm:text-4xl md:text-[42px] font-light tracking-tight text-text leading-tight',
            className
          )}
          {...props}
        >
          {children}
        </h1>
        {badge}
      </div>
      {subtitle && <p className="text-sm sm:text-base text-text-2 font-normal leading-relaxed">{subtitle}</p>}
    </div>
  )
}
