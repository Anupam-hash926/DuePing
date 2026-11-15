import React, { useState } from 'react'
import { Calendar, Play, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Popover } from '../../ui/Popover'
import { Button } from '../../ui/Button'
import { useToday, useFailures } from '../../api/hooks/useQueries'
import { useSetSimulatedDate, useRunDailyCheck, useResetDemo } from '../../api/hooks/useMutations'

export const DemoPopover: React.FC = () => {
  const { data: todayData } = useToday()
  const { data: failures } = useFailures()
  const setDate = useSetSimulatedDate()
  const dailyCheck = useRunDailyCheck()
  const resetDemo = useResetDemo()

  const [dateInput, setDateInput] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSetDate = async () => {
    if (!dateInput) return
    await setDate.mutateAsync({ date: dateInput })
    setSuccessMsg(`Simulated date set to ${dateInput}`)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  const handleClearDate = async () => {
    await setDate.mutateAsync({ date: null })
    setDateInput('')
    setSuccessMsg('Reset to real clock date')
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  const handleDailyCheck = async () => {
    const res = await dailyCheck.mutateAsync()
    setSuccessMsg(`Checked ${res.invoices_checked} invoices: ${res.newly_overdue} newly overdue, ${res.promises_missed} missed promises`)
    setTimeout(() => setSuccessMsg(null), 4000)
  }

  const handleResetDemo = async () => {
    await resetDemo.mutateAsync()
    setConfirmReset(false)
    setSuccessMsg('Demo data successfully re-seeded!')
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  return (
    <Popover
      trigger={
        <Button variant="secondary" size="sm" className="h-8 gap-1.5 px-3">
          <Calendar className="w-3.5 h-3.5 text-tint" />
          <span className="text-xs font-medium">Demo</span>
          {failures && failures.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-danger animate-pulse" aria-label="System failures reported" />
          )}
        </Button>
      }
      align="end"
      className="w-80 p-4 space-y-4"
    >
      <div className="flex items-center justify-between border-b border-hairline pb-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-text">Demo & Clock Controls</span>
        {todayData?.simulated && (
          <span className="text-[10px] bg-warning/15 text-warning font-semibold px-2 py-0.5 rounded-pill uppercase">
            Simulated
          </span>
        )}
      </div>

      {successMsg && (
        <div className="p-2.5 rounded-input bg-success/10 border border-success/20 text-success text-xs flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {failures && failures.length > 0 && (
        <div className="p-2.5 rounded-input bg-danger/10 border border-danger/20 text-danger text-xs flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{failures.length} event handler failure(s) logged</span>
        </div>
      )}

      {/* Date Controls */}
      <div className="space-y-2">
        <label className="text-xs text-text-2 font-medium">Current Date: {todayData?.today ?? 'Loading...'}</label>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="flex-1 h-8 px-2.5 text-xs bg-bg-grouped border border-hairline rounded-input text-text outline-none focus:border-tint"
          />
          <Button size="sm" onClick={handleSetDate} loading={setDate.isPending} disabled={!dateInput}>
            Set
          </Button>
        </div>
        {todayData?.simulated && (
          <Button variant="ghost" size="sm" onClick={handleClearDate} className="text-xs h-7 px-1 text-tint">
            Reset to real date
          </Button>
        )}
      </div>

      <div className="pt-2 border-t border-hairline space-y-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleDailyCheck}
          loading={dailyCheck.isPending}
          className="w-full justify-start text-xs h-8"
        >
          <Play className="w-3.5 h-3.5 mr-2 text-tint" />
          Run Daily Check
        </Button>

        {confirmReset ? (
          <div className="p-2.5 rounded-input bg-danger/10 border border-danger/20 space-y-2">
            <p className="text-[11px] text-danger font-medium leading-tight">
              Reset database to initial demo state?
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="danger" onClick={handleResetDemo} loading={resetDemo.isPending} className="h-7 text-xs flex-1">
                Yes, Reset
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setConfirmReset(false)} className="h-7 text-xs flex-1">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmReset(true)}
            className="w-full justify-start text-xs h-8 text-text-2 hover:text-danger"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-2" />
            Reset Demo Data
          </Button>
        )}
      </div>
    </Popover>
  )
}
