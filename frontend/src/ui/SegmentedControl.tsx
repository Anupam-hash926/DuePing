import React, { useRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { springPresets } from '../lib/motion'

export interface SegmentedOption<T extends string = string> {
  value: T
  label: React.ReactNode
  icon?: React.ReactNode
}

export interface SegmentedControlProps<T extends string = string> {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  className?: string
  name?: string
  size?: 'sm' | 'md'
}

export function SegmentedControl<T extends string = string>({
  value,
  onChange,
  options,
  className,
  name = 'segmented-control',
  size = 'md',
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (index + 1) % options.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (index - 1 + options.length) % options.length
    } else if (e.key === 'Home') {
      nextIndex = 0
    } else if (e.key === 'End') {
      nextIndex = options.length - 1
    }

    if (nextIndex !== -1) {
      e.preventDefault()
      onChange(options[nextIndex].value)
      const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      buttons?.[nextIndex]?.focus()
    }
  }

  const sizeClasses = {
    sm: 'p-0.5 text-xs h-8',
    md: 'p-1 text-sm h-10',
  }[size]

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={name}
      className={cn(
        'relative inline-flex items-center bg-bg-grouped rounded-pill border border-hairline select-none',
        sizeClasses,
        className
      )}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              'relative z-10 inline-flex items-center justify-center font-medium px-3.5 py-1 rounded-pill transition-colors focus-visible:outline-none gap-1.5',
              isSelected ? 'text-text' : 'text-text-2 hover:text-text'
            )}
          >
            {isSelected && (
              <motion.div
                layoutId={`segmented-indicator-${name}`}
                className="absolute inset-0 bg-surface-solid rounded-pill shadow-sm border border-hairline/80 z-[-1]"
                transition={springPresets.snappy}
              />
            )}
            {option.icon && <span className="opacity-80">{option.icon}</span>}
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
