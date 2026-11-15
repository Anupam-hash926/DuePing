import React from 'react'
import { Check } from 'lucide-react'
import { cn } from '../lib/cn'

export interface StepItem {
  id: string
  label: string
}

export interface StepperProps {
  steps: StepItem[]
  currentStepId: string
  className?: string
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStepId,
  className,
}) => {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId)

  return (
    <div className={cn('flex items-center w-full select-none', className)}>
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex
        const isLast = index === steps.length - 1

        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all',
                  isCompleted && 'bg-success text-white shadow-sm',
                  isCurrent && 'bg-tint text-white ring-4 ring-tint/20 shadow-sm',
                  !isCompleted && !isCurrent && 'bg-bg-grouped text-text-3 border border-hairline'
                )}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : index + 1}
              </div>
              <span
                className={cn(
                  'text-[11px] font-medium tracking-wide uppercase',
                  isCurrent ? 'text-tint font-semibold' : isCompleted ? 'text-text' : 'text-text-3'
                )}
              >
                {step.label}
              </span>
            </div>

            {!isLast && (
              <div
                className={cn(
                  'flex-1 h-[2px] mx-2 -mt-4 transition-colors',
                  index < currentIndex ? 'bg-success' : 'bg-hairline'
                )}
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
