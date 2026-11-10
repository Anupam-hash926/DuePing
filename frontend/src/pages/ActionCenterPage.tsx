import React, { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client'
import { ActionCenterRead, ActionCenterItemRead } from '../api/types'
import { PriorityBadge } from '../components/Badges'
import { useToast } from '../context/ToastContext'
import { formatDate, formatMoney } from '../lib/format'

export const ActionCenterPage: React.FC = () => {
  const navigate = useNavigate()
  const { showSuccess, showError } = useToast()

  const [data, setData] = useState<ActionCenterRead | null>(null)
  const [selectedStrategy, setSelectedStrategy] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [reschedulingId, setReschedulingId] = useState<string | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState<string>('')

  const loadActionCenter = useCallback(async (stratKey?: string) => {
    setLoading(true)
    try {
      const q = stratKey ? `?strategy=${stratKey}` : ''
      const res = await apiClient.get<ActionCenterRead>(`/action-center${q}`)
      setData(res)
      setSelectedStrategy(res.strategy)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    loadActionCenter(selectedStrategy)

    const handleRefresh = () => loadActionCenter(selectedStrategy)
    window.addEventListener('dueping:refresh', handleRefresh)
    return () => window.removeEventListener('dueping:refresh', handleRefresh)
  }, [loadActionCenter, selectedStrategy])

  const handleStrategyChange = (key: string) => {
    setSelectedStrategy(key)
    loadActionCenter(key)
  }

  const handleCompleteAction = async (invoiceId: string, actionId: string) => {
    try {
      await apiClient.post(`/invoices/${invoiceId}/actions/${actionId}/complete`)
      showSuccess('Action marked as completed')
      loadActionCenter(selectedStrategy)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleRescheduleAction = async (invoiceId: string, actionId: string) => {
    if (!rescheduleDate) return
    try {
      await apiClient.post(`/invoices/${invoiceId}/actions/${actionId}/reschedule`, {
        new_date: rescheduleDate,
      })
      showSuccess(`Action rescheduled to ${formatDate(rescheduleDate)}`)
      setReschedulingId(null)
      setRescheduleDate('')
      loadActionCenter(selectedStrategy)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="p-8 text-center text-slate-500 text-sm">Loading Action Centre...</div>
      </div>
    )
  }

  const renderCard = (item: ActionCenterItemRead, isUpcoming = false) => {
    const isOverdueOrMissed =
      item.action.source === 'OVERDUE' || item.action.source === 'PROMISE_MISSED'

    return (
      <div
        key={item.action.id}
        className={`bg-white rounded-xl border p-5 shadow-sm hover:shadow transition-shadow ${
          isUpcoming ? 'border-slate-200' : 'border-slate-300'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <PriorityBadge priority={item.action.priority} />
            <Link
              to={`/invoices/${item.invoice_id}`}
              className="text-sm font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              {item.invoice_number}
            </Link>
            <span className="text-slate-400">•</span>
            <span className="text-sm font-semibold text-slate-900">{item.client_name}</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-slate-900">
              {formatMoney(item.outstanding)}
            </span>
            <span className="text-xs text-slate-500 ml-1">due</span>
          </div>
        </div>

        <p className="mt-3 text-sm font-medium text-slate-800">{item.action.description}</p>

        <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 flex items-center gap-1.5">
          <span className="font-semibold text-slate-600">Why this action:</span>
          <span>{item.reason}</span>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 text-slate-500">
            <span>Due: <strong className="text-slate-700">{formatDate(item.action.due_date)}</strong></span>
            {item.days_overdue > 0 && (
              <span className="text-rose-600 font-semibold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                {item.days_overdue} days overdue
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {reschedulingId === item.action.id ? (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="border border-slate-300 rounded px-2 py-1 text-xs"
                />
                <button
                  onClick={() => handleRescheduleAction(item.invoice_id, item.action.id)}
                  className="px-2 py-1 bg-indigo-600 text-white font-medium rounded hover:bg-indigo-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setReschedulingId(null)}
                  className="px-2 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => handleCompleteAction(item.invoice_id, item.action.id)}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded shadow-sm"
                >
                  ✓ Done
                </button>
                <button
                  onClick={() => {
                    setReschedulingId(item.action.id)
                    setRescheduleDate(item.action.due_date)
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded border border-slate-200"
                >
                  Reschedule
                </button>
              </>
            )}

            {isOverdueOrMissed && (
              <button
                onClick={() => navigate(`/invoices/${item.invoice_id}?tab=reminder`)}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-medium rounded border border-amber-200 flex items-center gap-1"
              >
                ✉ Reminder
              </button>
            )}

            <button
              onClick={() => navigate(`/invoices/${item.invoice_id}`)}
              className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium rounded border border-slate-200"
            >
              Open Invoice →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header & Strategy selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Action Centre</h1>
          <p className="text-sm text-slate-500 mt-1">
            Prioritised operational follow-up tasks required to unblock and collect cash today.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="strategy-select" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
            Rank by:
          </label>
          <select
            id="strategy-select"
            value={selectedStrategy}
            onChange={(e) => handleStrategyChange(e.target.value)}
            className="bg-white border border-slate-300 text-slate-800 text-xs rounded-lg px-3 py-2 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {data?.strategies.map((strat) => (
              <option key={strat.key} value={strat.key}>
                {strat.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Due Today & Overdue Items */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span>Actionable Today</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-800 font-semibold">
              {data?.items.length ?? 0}
            </span>
          </h2>
        </div>

        {data?.items.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
            <span className="text-3xl">🎉</span>
            <h3 className="text-base font-semibold text-slate-800 mt-2">All caught up!</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              There are no pending actions due today or overdue. Check upcoming tasks below or run the daily check.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {data?.items.map((item) => renderCard(item, false))}
          </div>
        )}
      </div>

      {/* Upcoming Section (7 days) */}
      <div className="mt-10">
        <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span>Upcoming (Next 7 Days)</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 font-semibold">
            {data?.upcoming.length ?? 0}
          </span>
        </h2>

        {data?.upcoming.length === 0 ? (
          <div className="text-xs text-slate-400 italic bg-white p-4 rounded-lg border border-slate-200">
            No actions scheduled for the next 7 days.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 opacity-90">
            {data?.upcoming.map((item) => renderCard(item, true))}
          </div>
        )}
      </div>
    </div>
  )
}

