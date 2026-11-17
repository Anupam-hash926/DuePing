import React from 'react'
import { AlertCircle, Ban } from 'lucide-react'
import { Stepper } from '../../../ui/Stepper'

export interface StatusStepperProps {
  status: string
  amountPaid?: number | string
}

export const StatusStepper: React.FC<StatusStepperProps> = ({ status, amountPaid = 0 }) => {
  const steps = [
    { id: 'DRAFT', label: 'Draft' },
    { id: 'SENT', label: 'Sent' },
    { id: 'PARTIALLY_PAID', label: 'Partial' },
    { id: 'PAID', label: 'Settled' },
  ]

  const numericPaid = typeof amountPaid === 'number' ? amountPaid : parseFloat(String(amountPaid || 0))
  const isSpecial = status === 'DISPUTED' || status === 'WRITTEN_OFF'
  // When disputed or written off, freeze on the happy path state prior to dispute/write-off
  const linearStepId = isSpecial
    ? numericPaid > 0
      ? 'PARTIALLY_PAID'
      : 'SENT'
    : status

  return (
    <div className="bg-surface-solid rounded-card border border-hairline p-5 shadow-sm space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-text-3">Lifecycle Progress</div>

      <Stepper steps={steps} currentStepId={linearStepId} />

      {isSpecial && (
        <div
          data-testid="status-stepper-branch"
          className={`flex items-center gap-2.5 p-3 rounded-input text-xs font-medium border ${
            status === 'DISPUTED'
              ? 'bg-warning/10 border-warning/20 text-warning'
              : 'bg-danger/10 border-danger/20 text-danger'
          }`}
        >
          {status === 'DISPUTED' ? (
            <>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong className="font-semibold">Dispute active: collection paused</strong> · Commercial dispute raised. Collections paused until resolution.
              </span>
            </>
          ) : (
            <>
              <Ban className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong className="font-semibold">Written off: bad debt recorded</strong> · Invoice has been written off as bad debt.
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
