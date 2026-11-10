import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client'
import { ClientRead, ProjectRead, InvoiceRead } from '../api/types'
import { useToast } from '../context/ToastContext'

export const NewInvoicePage: React.FC = () => {
  const navigate = useNavigate()
  const { showSuccess, showError } = useToast()

  const [clients, setClients] = useState<ClientRead[]>([])
  const [projects, setProjects] = useState<ProjectRead[]>([])
  const [submitting, setSubmitting] = useState<boolean>(false)

  // Form State
  const [clientId, setClientId] = useState<string>('')
  const [projectId, setProjectId] = useState<string>('')
  const [totalAmount, setTotalAmount] = useState<string>('')
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toISOString().split('T')[0]
  })
  const [invoiceNumber, setInvoiceNumber] = useState<string>('')

  // Inline Client Modal
  const [showAddClient, setShowAddClient] = useState<boolean>(false)
  const [newClientName, setNewClientName] = useState<string>('')
  const [newClientEmail, setNewClientEmail] = useState<string>('')
  const [newClientPhone, setNewClientPhone] = useState<string>('')
  const [newClientCompany, setNewClientCompany] = useState<string>('')

  const loadClients = async () => {
    try {
      const res = await apiClient.get<ClientRead[]>('/clients')
      setClients(res)
      if (res.length > 0 && !clientId) {
        setClientId(res[0].id)
      }
    } catch (err: unknown) {
      console.error(err)
    }
  }

  const loadProjects = async (cId: string) => {
    if (!cId) {
      setProjects([])
      return
    }
    try {
      const res = await apiClient.get<ProjectRead[]>(`/projects?client_id=${cId}`)
      setProjects(res)
    } catch (err: unknown) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadClients()
  }, [])

  useEffect(() => {
    if (clientId) {
      loadProjects(clientId)
    }
  }, [clientId])

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClientName || !newClientEmail) return
    try {
      const created = await apiClient.post<ClientRead>('/clients', {
        name: newClientName,
        email: newClientEmail,
        phone: newClientPhone || null,
        company_name: newClientCompany || null,
      })
      showSuccess(`Client ${created.name} created!`)
      setShowAddClient(false)
      setNewClientName('')
      setNewClientEmail('')
      setNewClientPhone('')
      setNewClientCompany('')
      await loadClients()
      setClientId(created.id)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || !totalAmount || !issueDate || !dueDate) {
      showError('Please fill in all required fields.')
      return
    }

    setSubmitting(true)
    try {
      const invoice = await apiClient.post<InvoiceRead>('/invoices', {
        client_id: clientId,
        project_id: projectId || null,
        total_amount: totalAmount,
        issue_date: issueDate,
        due_date: dueDate,
        invoice_number: invoiceNumber.trim() ? invoiceNumber.trim() : null,
      })
      showSuccess(`Draft invoice ${invoice.invoice_number} created!`)
      navigate(`/invoices/${invoice.id}`)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Create New Invoice</h1>
        <p className="text-sm text-slate-500 mt-1">
          Draft an invoice aggregate. Invoices start in DRAFT status and can be edited before sending.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6 text-xs">
          {/* Client select & Add client */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="client-select" className="font-bold text-slate-700">
                Client <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowAddClient(true)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                + Add Client Inline
              </button>
            </div>
            <select
              id="client-select"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 font-medium"
              required
            >
              <option value="">Select a client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company_name ? `(${c.company_name})` : ''} — Score: {c.reliability_score}%
                </option>
              ))}
            </select>
          </div>

          {/* Optional Project */}
          {projects.length > 0 && (
            <div>
              <label htmlFor="project-select" className="block font-bold text-slate-700 mb-1.5">
                Project (Optional)
              </label>
              <select
                id="project-select"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 font-medium"
              >
                <option value="">None (Standalone Invoice)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_name} ({p.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Total Amount & Invoice Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Total Amount <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 50000.00"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Custom Invoice Number (Optional)
              </label>
              <input
                type="text"
                placeholder="Auto-generated if left empty"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Issue Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Due Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800"
                required
              />
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate('/invoices')}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Draft Invoice'}
            </button>
          </div>
        </form>
      </div>

      {/* Add Client Modal */}
      {showAddClient && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Add New Client</h2>
            <form onSubmit={handleCreateClient} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. john@example.com"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={newClientCompany}
                  onChange={(e) => setNewClientCompany(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  placeholder="e.g. +91 98765 43210"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddClient(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold"
                >
                  Save Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

