import React from 'react'
import { AlertCircle, Ban } from 'lucide-react'
import { Stepper } from '../../../ui/Stepper'

export interface StatusStepperProps {
  status: string
}

export const StatusStepper: React.FC<StatusStepperProps> = ({ status }) => {
  const steps = [
    { id: 'DRAFT', label: 'Draft' },
    { id: 'SENT', label: 'Sent' },
    { id: 'PARTIALLY_PAID', label: 'Partial' },
    { id: 'PAID', label: 'Settled' },
  ]

  const isSpecial = status === 'DISPUTED' || status === 'WRITTEN_OFF'

  return (
    <div className="bg-surface-solid rounded-card border border-hairline p-5 shadow-sm space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-text-3">Lifecycle Progress</div>

      <Stepper steps={steps} currentStepId={status} />

      {isSpecial && (
        <div
          className={`flex items-center gap-2.5 p-3 rounded-input text-xs font-medium border ${
            status === 'DISPUTED'
              ? 'bg-warning/10 border-warning/20 text-warning'
              : 'bg-danger/10 border-danger/20 text-danger'
          }`}
        >
          {status === 'DISPUTED' ? (
            <>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Commercial dispute raised. Collections paused until resolution.</span>
            </>
          ) : (
            <>
              <Ban className="w-4 h-4 flex-shrink-0" />
              <span>Invoice has been written off as bad debt.</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
