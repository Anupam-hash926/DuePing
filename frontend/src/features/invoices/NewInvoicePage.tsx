import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { useClients } from '../../api/hooks/useQueries'
import { useCreateInvoice } from '../../api/hooks/useMutations'
import { LargeTitle } from '../../ui/LargeTitle'
import { Button } from '../../ui/Button'
import { useToast } from '../../context/ToastContext'
import { AddClientSheet } from './AddClientSheet'

export const NewInvoicePage: React.FC = () => {
  const navigate = useNavigate()
  const { showSuccess, showError } = useToast()

  const { data: clients, isLoading: clientsLoading } = useClients()
  const createInvoiceMutation = useCreateInvoice()

  // Form State
  const [clientId, setClientId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toISOString().split('T')[0]
  })
  const [addClientOpen, setAddClientOpen] = useState(false)

  useEffect(() => {
    if (clients && clients.length > 0 && !clientId) {
      setClientId(clients[0].id)
    }
  }, [clients, clientId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || !totalAmount || !issueDate || !dueDate) {
      showError('Please fill in all required fields.')
      return
    }

    try {
      const created = await createInvoiceMutation.mutateAsync({
        client_id: clientId,
        invoice_number: invoiceNumber.trim() || undefined,
        total_amount: parseFloat(totalAmount).toFixed(2),
        issue_date: issueDate,
        due_date: dueDate,
      })
      showSuccess(`Invoice ${created.invoice_number} created as DRAFT`)
      navigate(`/app/invoices/${created.id}`)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        to="/app/invoices"
        className="inline-flex items-center text-xs font-medium text-text-3 hover:text-text transition-colors gap-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Invoices</span>
      </Link>

      <LargeTitle
        title="New Invoice"
        subtitle="Create an invoice draft. You can review blockers, actions, and reminders before sending."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-surface-solid rounded-[24px] border border-hairline p-6 space-y-5">
          {/* Client Select with Add Client button */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-text">Client *</label>
              <button
                type="button"
                onClick={() => setAddClientOpen(true)}
                className="text-xs font-semibold text-tint hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add new client
              </button>
            </div>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              disabled={clientsLoading}
              className="w-full bg-bg-grouped border border-hairline rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-tint"
            >
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company_name ? `(${c.company_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Invoice Number (Optional) */}
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              Invoice Number (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. INV-2026-001 (auto-generated if blank)"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full bg-bg-grouped border border-hairline rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-tint"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              Total Amount (GBP) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full bg-bg-grouped border border-hairline rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-tint"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">
                Issue Date *
              </label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full bg-bg-grouped border border-hairline rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-tint"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">
                Due Date *
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-bg-grouped border border-hairline rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-tint"
              />
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="secondary"
            type="button"
            onClick={() => navigate('/app/invoices')}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            loading={createInvoiceMutation.isPending}
            className="rounded-full px-6"
          >
            Create Draft Invoice
          </Button>
        </div>
      </form>

      {/* Inline Add Client Sheet */}
      <AddClientSheet
        open={addClientOpen}
        onOpenChange={setAddClientOpen}
        onClientCreated={(client) => setClientId(client.id)}
      />
    </div>
  )
}
