import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ChevronRight, AlertCircle, Clock } from 'lucide-react'
import { useInvoices, useClients } from '../../api/hooks/useQueries'
import { LargeTitle } from '../../ui/LargeTitle'
import { SearchField } from '../../ui/SearchField'
import { Button } from '../../ui/Button'
import { Badge } from '../../ui/Badge'
import { GroupedList } from '../../ui/GroupedList'
import { ListRow } from '../../ui/ListRow'
import { EmptyState } from '../../ui/EmptyState'
import { Skeleton } from '../../ui/Skeleton'
import { formatMoney, formatDate } from '../../lib/format'
import { invoiceStatusLabel, labelOrFallback, plural } from '../../lib/labels'

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
  { value: 'PAID', label: 'Paid' },
  { value: 'DISPUTED', label: 'Disputed' },
  { value: 'WRITTEN_OFF', label: 'Written Off' },
]

export const InvoicesPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)

  const { data: invoices, isLoading } = useInvoices({
    status: statusFilter || undefined,
    client_id: clientFilter || undefined,
  })
  const { data: clients } = useClients()

  const filteredInvoices = useMemo(() => {
    if (!invoices) return []
    return invoices.filter((inv) => {
      if (overdueOnly && inv.days_overdue <= 0) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesNum = inv.invoice_number.toLowerCase().includes(q)
        const matchesClient = inv.client.name.toLowerCase().includes(q)
        if (!matchesNum && !matchesClient) return false
      }
      return true
    })
  }, [invoices, overdueOnly, searchQuery])

  if (isLoading && !invoices) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full rounded-full" />
        <Skeleton className="h-64 rounded-[28px]" variant="rectangular" />
      </div>
    )
  }

  const getStatusVariant = (status: string): 'neutral' | 'tint' | 'success' | 'warning' | 'danger' | 'purple' | 'teal' => {
    switch (status) {
      case 'PAID':
        return 'success'
      case 'PARTIALLY_PAID':
      case 'SENT':
        return 'tint'
      case 'DISPUTED':
        return 'danger'
      case 'WRITTEN_OFF':
        return 'neutral'
      default:
        return 'warning'
    }
  }

  const getRowAccent = (inv: { status: string; days_overdue: number }) => {
    if (inv.status === 'DISPUTED') {
      return 'border-l-2 border-l-warning'
    }
    if (inv.days_overdue > 0 && inv.status !== 'PAID') {
      return 'border-l-2 border-l-danger'
    }
    return 'border-l-2 border-l-transparent'
  }

  return (
    <div className="space-y-6">
      {/* Header with Title and + New Button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <LargeTitle
          title="Invoices"
          subtitle="Browse, search, and manage accounts receivable across lifecycle stages."
        />
        <Button
          variant="primary"
          size="md"
          className="rounded-full px-5"
          onClick={() => navigate('/app/invoices/new')}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Invoice
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        <SearchField
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by invoice number or client name..."
        />

        {/* Filter chips strip */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                statusFilter === s.value
                  ? 'bg-tint text-white shadow-sm'
                  : 'bg-surface-solid border border-hairline text-text-2 hover:text-text hover:bg-bg-grouped'
              }`}
            >
              {s.label}
            </button>
          ))}

          {/* Overdue filter pill */}
          <button
            onClick={() => setOverdueOnly(!overdueOnly)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              overdueOnly
                ? 'bg-fill-red text-white shadow-sm'
                : 'bg-surface-solid border border-hairline text-text-2 hover:text-text hover:bg-bg-grouped'
            }`}
          >
            Overdue Only
          </button>

          {/* Client Filter */}
          {clients && clients.length > 0 && (
            <select
              aria-label="Filter invoices by client"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="bg-surface-solid border border-hairline rounded-full px-3 py-1.5 text-xs text-text-2 focus:outline-none focus:ring-2 focus:ring-tint ml-auto"
            >
              <option value="">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Invoice Inset List */}
      {filteredInvoices.length === 0 ? (
        <EmptyState
          title="No invoices found."
          description="Try adjusting your filters or search keywords, or create a new invoice."
        />
      ) : (
        <GroupedList>
          {filteredInvoices.map((inv) => (
            <ListRow
              key={inv.id}
              className={getRowAccent(inv)}
              onClick={() => navigate(`/app/invoices/${inv.id}`)}
              title={
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-text text-sm">
                    {inv.invoice_number}
                  </span>
                  <span className="text-text-3 font-normal">·</span>
                  <span className="text-sm text-text-2">{inv.client.name}</span>
                </div>
              }
              subtitle={
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-3 pt-0.5">
                  <span>Due {formatDate(inv.due_date)}</span>
                  {inv.days_overdue > 0 && (
                    <span className="font-semibold text-fill-red">
                      {inv.days_overdue}d overdue
                    </span>
                  )}
                  {inv.open_blocker_count > 0 && (
                    <span className="inline-flex items-center gap-1 text-fill-amber">
                      <AlertCircle className="w-3 h-3" />
                      {plural(inv.open_blocker_count, 'blocker')}
                    </span>
                  )}
                  {inv.pending_action_count > 0 && (
                    <span className="inline-flex items-center gap-1 text-text-3">
                      <Clock className="w-3 h-3" />
                      {plural(inv.pending_action_count, 'action')}
                    </span>
                  )}
                </div>
              }
              trailing={
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-text">
                      {formatMoney(inv.outstanding)}
                    </div>
                    <div className="text-xs text-text-3">
                      of {formatMoney(inv.total)}
                    </div>
                  </div>
                  <Badge variant={getStatusVariant(inv.status)} size="sm">
                    {labelOrFallback(invoiceStatusLabel, inv.status)}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-text-3" />
                </div>
              }
            />
          ))}
        </GroupedList>
      )}
    </div>
  )
}
