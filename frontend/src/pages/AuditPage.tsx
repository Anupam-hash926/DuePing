import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../api/client'
import { AuditEventRead } from '../api/types'
import { useToast } from '../context/ToastContext'
import { formatDateTime } from '../lib/format'

export const AuditPage: React.FC = () => {
  const { showError } = useToast()

  const [events, setEvents] = useState<AuditEventRead[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [searchTerm, setSearchTerm] = useState<string>('')

  const loadAudit = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<AuditEventRead[]>('/audit-log')
      setEvents(res)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    loadAudit()

    const handleRefresh = () => loadAudit()
    window.addEventListener('dueping:refresh', handleRefresh)
    return () => window.removeEventListener('dueping:refresh', handleRefresh)
  }, [loadAudit])

  const filtered = events.filter((ev) => {
    const term = searchTerm.toLowerCase()
    return (
      ev.event_type.toLowerCase().includes(term) ||
      ev.description.toLowerCase().includes(term) ||
      (ev.invoice_id && ev.invoice_id.toLowerCase().includes(term))
    )
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Audit Log</h1>
          <p className="text-sm text-slate-500 mt-1">
            Complete immutable ledger of all domain events emitted across invoices and clients.
          </p>
        </div>

        <div className="w-72">
          <input
            type="text"
            placeholder="Filter audit events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3 w-44">Timestamp</th>
                <th className="px-4 py-3 w-48">Event Type</th>
                <th className="px-4 py-3 w-44">Invoice Link</th>
                <th className="px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && events.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400">
                    Loading audit trail...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400">
                    No audit events match your filter.
                  </td>
                </tr>
              ) : (
                filtered.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {formatDateTime(ev.occurred_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {ev.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {ev.invoice_id ? (
                        <Link
                          to={`/invoices/${ev.invoice_id}`}
                          className="text-indigo-600 hover:underline font-semibold"
                        >
                          Invoice Detail →
                        </Link>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-800 font-medium">{ev.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

