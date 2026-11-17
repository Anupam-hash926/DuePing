import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Check, BellRing } from 'lucide-react'
import type { ActionCenterItemRead } from '../../api/types'
import { GlassCard } from '../../ui/GlassCard'
import { Button } from '../../ui/Button'
import { TextButton } from '../../ui/TextButton'
import { Sheet } from '../../ui/Sheet'
import { formatMoney } from '../../lib/format'
import { labelOrFallback, priorityLabel } from '../../lib/labels'

interface FocusCardProps {
  item: ActionCenterItemRead
  totalCount: number
  currentIndex: number
  onComplete: (invoiceId: string, actionId: string) => Promise<void>
  onReschedule: (invoiceId: string, actionId: string, newDate: string) => Promise<void>
  onNext: () => void
  onPrev: () => void
}

export const FocusCard: React.FC<FocusCardProps> = ({
  item,
  totalCount,
  currentIndex,
  onComplete,
  onReschedule,
  onNext,
  onPrev,
}) => {
  const navigate = useNavigate()
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [completing, setCompleting] = useState(false)

  const handleDone = useCallback(async () => {
    setCompleting(true)
    try {
      await onComplete(item.invoice_id, item.action.id)
    } finally {
      setCompleting(false)
    }
  }, [item, onComplete])

  const handleOpenInvoice = useCallback(() => {
    navigate(`/app/invoices/${item.invoice_id}`)
  }, [navigate, item.invoice_id])

  const handleOpenReminder = useCallback(() => {
    navigate(`/app/invoices/${item.invoice_id}?tab=reminder`)
  }, [navigate, item.invoice_id])

  // Keyboard navigation: D = done, R = reschedule, Enter = open, ArrowRight / ArrowLeft
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return
      }
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        handleDone()
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        setRescheduleOpen(true)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleOpenInvoice()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        onNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onPrev()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleDone, handleOpenInvoice, onNext, onPrev])

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rescheduleDate) return
    await onReschedule(item.invoice_id, item.action.id, rescheduleDate)
    setRescheduleOpen(false)
    setRescheduleDate('')
  }

  const priorityColor =
    item.action.priority === 'CRITICAL'
      ? 'bg-fill-red'
      : item.action.priority === 'HIGH'
      ? 'bg-fill-amber'
      : 'bg-tint'

  const showReminder = item.action.source === 'OVERDUE' || item.action.source === 'PROMISE_MISSED'

  // Deduplicate chips: filter out facts already rendered as structured chips
  const extraTokens = (item.reason ? item.reason.split(' · ') : [])
    .map((t) => t.trim())
    .filter((t) => {
      const lower = t.toLowerCase()
      if (lower.includes('priority')) return false
      if (lower.includes('overdue')) return false
      if (lower.includes('outstanding')) return false
      return true
    })

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={item.action.id}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          <GlassCard className="rounded-[28px] p-6 sm:p-8 space-y-6">
            {/* Header: Invoice #, Client Name, Counter */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <TextButton
                  onClick={handleOpenInvoice}
                  className="text-base font-semibold text-tint hover:underline"
                >
                  {item.invoice_number}
                </TextButton>
                <span className="text-text-3 font-normal">·</span>
                <span className="text-base font-semibold text-text">{item.client_name}</span>
              </div>
              <div className="text-sm font-medium text-text-3">
                {currentIndex + 1} of {totalCount}
              </div>
            </div>

            {/* Action Sentence in large 28-34px light weight */}
            <h2 className="text-[28px] sm:text-[34px] leading-tight font-light text-text tracking-tight">
              {item.action.description}
            </h2>

            {/* Structured Facts Strip: Priority -> Overdue -> Outstanding -> Reliability -> Suggested Tone */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {/* 1. Priority dot + label */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-bg-grouped border border-hairline text-text">
                <span className={`w-2 h-2 rounded-full ${priorityColor}`} />
                <span>{labelOrFallback(priorityLabel, item.action.priority)} priority</span>
              </span>

              {/* 2. Days overdue (live) */}
              {item.days_overdue > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-fill-red/10 border border-fill-red/20 text-fill-red">
                  {item.days_overdue} days overdue
                </span>
              )}

              {/* 3. Outstanding */}
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-bg-grouped border border-hairline text-text">
                Outstanding {formatMoney(item.outstanding)}
              </span>

              {/* 4. Client reliability & other unique facts from reason */}
              {extraTokens.map((token, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-normal bg-bg-grouped border border-hairline text-text-2"
                >
                  {token}
                </span>
              ))}

              {/* 5. Suggested tone */}
              {item.suggested_tone && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-tint/10 border border-tint/20 text-tint">
                  Suggested: {item.suggested_tone}
                </span>
              )}
            </div>

            {/* Actions: Primary Done pill + secondary text buttons */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-hairline">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleDone}
                  loading={completing}
                  className="rounded-full px-6"
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  Done
                </Button>
                <TextButton onClick={() => setRescheduleOpen(true)}>
                  Reschedule
                </TextButton>
                {showReminder && (
                  <TextButton onClick={handleOpenReminder}>
                    <BellRing className="w-3.5 h-3.5 mr-1 inline" />
                    Reminder
                  </TextButton>
                )}
              </div>

              <TextButton onClick={handleOpenInvoice}>
                Open invoice <ArrowRight className="w-3.5 h-3.5 ml-1 inline" />
              </TextButton>
            </div>
          </GlassCard>
        </motion.div>
      </AnimatePresence>

      {/* Reschedule Sheet */}
      <Sheet
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        title="Reschedule Action"
        description={`Set a new due date for action on invoice ${item.invoice_number}`}
      >
        <form onSubmit={handleRescheduleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              New Due Date
            </label>
            <input
              type="date"
              required
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="w-full bg-surface-solid border border-hairline rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-tint"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setRescheduleOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Reschedule
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  )
}
