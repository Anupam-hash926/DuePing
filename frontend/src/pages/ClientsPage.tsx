import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiClient } from '../api/client'
import { ClientRead, ClientSummaryRead } from '../api/types'
import { RiskBadge, StatusBadge } from '../components/Badges'
import { useToast } from '../context/ToastContext'
import { formatDate, formatMoney } from '../lib/format'

export const ClientsPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>()
  const { showSuccess, showError } = useToast()

  const [clients, setClients] = useState<ClientRead[]>([])
  const [clientDetail, setClientDetail] = useState<ClientSummaryRead | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // Edit Client Modal
  const [editing, setEditing] = useState<boolean>(false)
  const [editName, setEditName] = useState<string>('')
  const [editEmail, setEditEmail] = useState<string>('')
  const [editPhone, setEditPhone] = useState<string>('')
  const [editCompany, setEditCompany] = useState<string>('')

  const loadClients = async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ClientRead[]>('/clients')
      setClients(res)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const loadClientDetail = useCallback(async (clientId: string) => {
    setLoading(true)
    try {
      const res = await apiClient.get<ClientSummaryRead>(`/clients/${clientId}`)
      setClientDetail(res)
      setEditName(res.name)
      setEditEmail(res.email)
      setEditPhone(res.phone || '')
      setEditCompany(res.company_name || '')
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    if (id) {
      loadClientDetail(id)
    } else {
      loadClients()
    }

    const handleRefresh = () => {
      if (id) loadClientDetail(id)
      else loadClients()
    }
    window.addEventListener('dueping:refresh', handleRefresh)
    return () => window.removeEventListener('dueping:refresh', handleRefresh)
  }, [id, loadClientDetail])

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    try {
      await apiClient.put<ClientRead>(`/clients/${id}`, {
        name: editName,
        email: editEmail,
        phone: editPhone || null,
        company_name: editCompany || null,
      })
      showSuccess('Client details updated!')
      setEditing(false)
      loadClientDetail(id)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  // If Detail View
  if (id && clientDetail) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link to="/clients" className="hover:underline font-semibold text-indigo-600">
            ← All Clients
          </Link>
          <span>/</span>
          <span>{clientDetail.name}</span>
        </div>

        {/* Client Summary Header */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {clientDetail.name}
                </h1>
                <RiskBadge risk={clientDetail.risk_level} />
              </div>
              {clientDetail.company_name && (
                <p className="text-sm font-semibold text-slate-600 mt-1">
                  {clientDetail.company_name}
                </p>
              )}
              <div className="mt-2 text-xs text-slate-500 space-x-3">
                <span>✉ {clientDetail.email}</span>
                {clientDetail.phone && <span>📞 {clientDetail.phone}</span>}
              </div>
            </div>

            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs border border-slate-300"
            >
              Edit Contact Info
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-slate-500">Reliability Score</p>
              <p className="text-xl font-black text-indigo-600 mt-1">
                {clientDetail.reliability_score}%
              </p>
            </div>
            <div>
              <p className="text-slate-500">Total Outstanding</p>
              <p className="text-xl font-black text-rose-600 mt-1">
                {formatMoney(clientDetail.total_outstanding)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Promises Kept</p>
              <p className="text-xl font-black text-emerald-600 mt-1">
                {clientDetail.promises_kept_count}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Promises Broken</p>
              <p className="text-xl font-black text-amber-600 mt-1">
                {clientDetail.promises_broken_count}
              </p>
            </div>
          </div>
        </div>

        {/* Client's Invoices Table */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-4">Client Invoices</h2>
          {clientDetail.invoices.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 italic">No invoices found for this client.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Number</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Outstanding</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {clientDetail.invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-indigo-600">
                        <Link to={`/invoices/${inv.id}`} className="hover:underline">
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(inv.due_date)}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">{formatMoney(inv.total)}</td>
                      <td className="px-4 py-3 font-black text-slate-900">{formatMoney(inv.outstanding)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inv.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {editing && (
          <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Edit Client Info</h3>
              <form onSubmit={handleUpdateClient} className="mt-4 space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full border rounded-lg p-2"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full border rounded-lg p-2"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company</label>
                  <input
                    type="text"
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    className="w-full border rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full border rounded-lg p-2"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="px-3 py-1.5 text-slate-600 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 text-white rounded font-bold"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  // All Clients List View
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Clients</h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor debtor relationships, payment promises history, and behavioral reliability scores.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Reliability</th>
                <th className="px-4 py-3">Risk Level</th>
                <th className="px-4 py-3">Promises Kept / Broken</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && clients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Loading clients...
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No clients found.
                  </td>
                </tr>
              ) : (
                clients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap font-bold">
                      <Link
                        to={`/clients/${c.id}`}
                        className="text-indigo-600 hover:text-indigo-900 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700 font-medium">
                      {c.company_name || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      <div>{c.email}</div>
                      {c.phone && <div className="text-[11px] text-slate-400">{c.phone}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-black text-slate-900">
                      {c.reliability_score}%
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <RiskBadge risk={c.risk_level} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      <span className="text-emerald-700 font-bold">{c.promises_kept_count}</span> kept
                      {' / '}
                      <span className="text-rose-700 font-bold">{c.promises_broken_count}</span> missed
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

