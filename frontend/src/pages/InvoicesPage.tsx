import React, { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client'
import { InvoiceSummaryRead, ClientRead } from '../api/types'
import { StatusBadge } from '../components/Badges'
import { useToast } from '../context/ToastContext'
import { formatDate, formatMoney } from '../lib/format'

export const InvoicesPage: React.FC = () => {
  const navigate = useNavigate()
  const { showError } = useToast()

  const [invoices, setInvoices] = useState<InvoiceSummaryRead[]>([])
  const [clients, setClients] = useState<ClientRead[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [clientFilter, setClientFilter] = useState<string>('')
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)
      if (clientFilter) params.append('client_id', clientFilter)
      if (overdueOnly) params.append('overdue', 'true')
      if (searchQuery.trim()) params.append('q', searchQuery.trim())

      const res = await apiClient.get<InvoiceSummaryRead[]>(`/invoices?${params.toString()}`)
      setInvoices(res)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, clientFilter, overdueOnly, searchQuery, showError])

  const loadClients = async () => {
    try {
      const res = await apiClient.get<ClientRead[]>('/clients')
      setClients(res)
    } catch (err: unknown) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadClients()
  }, [])

  useEffect(() => {
    loadInvoices()

    const handleRefresh = () => loadInvoices()
    window.addEventListener('dueping:refresh', handleRefresh)
    return () => window.removeEventListener('dueping:refresh', handleRefresh)
  }, [loadInvoices])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Title & New Invoice button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse, search, and track all accounts receivable across states.
          </p>
        </div>
        <button
          onClick={() => navigate('/invoices/new')}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm flex items-center justify-center gap-1.5"
        >
          <span>+</span> New Invoice
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4 text-xs">
        {/* Search Input */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search invoice number or client name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Status Dropdown */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 font-medium"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="DISPUTED">Disputed</option>
            <option value="PAID">Paid</option>
            <option value="WRITTEN_OFF">Written Off</option>
          </select>
        </div>

        {/* Client Dropdown */}
        <div>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 font-medium"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.company_name ? `(${c.company_name})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Overdue Checkbox */}
        <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-semibold select-none">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
          />
          <span>Overdue only</span>
        </label>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Outstanding</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Open Blockers</th>
                <th className="px-4 py-3 text-center">Pending Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No invoices match the selected filters.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap font-bold">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="text-indigo-600 hover:text-indigo-900 hover:underline"
                      >
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-900">
                      <Link
                        to={`/clients/${inv.client.id}`}
                        className="hover:underline text-slate-900"
                      >
                        {inv.client.name}
                      </Link>
                      {inv.client.company_name && (
                        <span className="block text-[11px] text-slate-400 font-normal">
                          {inv.client.company_name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      <div>{formatDate(inv.due_date)}</div>
                      {inv.is_overdue && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          {inv.days_overdue}d overdue
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-700">
                      {formatMoney(inv.total)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-black text-slate-900">
                      {formatMoney(inv.outstanding)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      {inv.open_blocker_count > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                          {inv.open_blocker_count}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      {inv.pending_action_count > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                          {inv.pending_action_count}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
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

