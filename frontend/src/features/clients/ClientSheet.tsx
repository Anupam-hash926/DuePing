import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useClient } from '../../api/hooks/useQueries'
import { useUpdateClient } from '../../api/hooks/useMutations'
import { Sheet } from '../../ui/Sheet'
import { Button } from '../../ui/Button'
import { Badge } from '../../ui/Badge'
import { ProgressRing, getReliabilityColor } from '../../ui/ProgressRing'
import { GroupedList } from '../../ui/GroupedList'
import { ListRow } from '../../ui/ListRow'
import { Skeleton } from '../../ui/Skeleton'
import { useToast } from '../../context/ToastContext'
import { formatMoney, formatDate } from '../../lib/format'
import { invoiceStatusLabel, labelOrFallback, riskLevelLabel } from '../../lib/labels'

interface ClientSheetProps {
  clientId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ClientSheet: React.FC<ClientSheetProps> = ({ clientId, open, onOpenChange }) => {
  const { showSuccess, showError } = useToast()
  const { data: client, isLoading } = useClient(clientId ?? undefined)
  const updateMutation = useUpdateClient(clientId ?? '')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (client) {
      setName(client.name)
      setEmail(client.email)
      setPhone(client.phone || '')
      setCompanyName(client.company_name || '')
      setIsEditing(false)
    }
  }, [client])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) return
    try {
      await updateMutation.mutateAsync({
        name,
        email,
        phone: phone.trim() || null,
        company_name: companyName.trim() || null,
      })
      showSuccess('Client updated successfully')
      setIsEditing(false)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  const riskColor =
    client?.risk_level === 'HIGH'
      ? 'danger'
      : client?.risk_level === 'MEDIUM'
      ? 'warning'
      : 'success'

  const scoreColor = getReliabilityColor(client?.reliability_score ?? 100)

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={client?.name ?? 'Client Details'}
      description={client?.company_name ?? 'Client profile, reliability score, and invoice history'}
    >
      {isLoading || !client ? (
        <div className="space-y-4 py-4">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-6 py-2">
          {/* Reliability & Risk Score Tile */}
          <div className="bg-bg-grouped rounded-2xl p-4 border border-hairline flex items-center justify-between">
            <div className="flex items-center gap-4">
              <ProgressRing
                size="md"
                value={client.reliability_score}
                color={scoreColor}
                label={client.reliability_score}
                ariaLabel={`Reliability ${client.reliability_score} out of 100`}
              />
              <div>
                <div className="text-sm font-semibold text-text">Reliability Score</div>
                <div className="text-xs text-text-3">
                  Score {client.reliability_score}/100 · {client.promises_kept_count} kept, {client.promises_broken_count} broken
                </div>
              </div>
            </div>
            <Badge variant={riskColor} size="sm">
              {labelOrFallback(riskLevelLabel, client.risk_level)} Risk
            </Badge>
          </div>

          {/* Editable Contact Info */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
                Contact Details
              </span>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="text-xs font-semibold text-tint hover:underline"
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {isEditing ? (
              <form onSubmit={handleUpdate} className="space-y-3 bg-bg-grouped p-4 rounded-2xl border border-hairline">
                <div>
                  <label className="block text-xs font-medium text-text-3 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-surface-solid border border-hairline rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-tint"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-3 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-surface-solid border border-hairline rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-tint"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-3 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-surface-solid border border-hairline rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-tint"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-3 mb-1">Company</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-surface-solid border border-hairline rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-tint"
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button variant="primary" size="sm" type="submit" loading={updateMutation.isPending}>
                    Save Changes
                  </Button>
                </div>
              </form>
            ) : (
              <div className="bg-bg-grouped rounded-2xl p-4 border border-hairline space-y-2 text-sm">
                <div>
                  <span className="text-xs text-text-3">Email:</span>{' '}
                  <span className="font-medium text-text">{client.email}</span>
                </div>
                {client.phone && (
                  <div>
                    <span className="text-xs text-text-3">Phone:</span>{' '}
                    <span className="font-medium text-text">{client.phone}</span>
                  </div>
                )}
                {client.company_name && (
                  <div>
                    <span className="text-xs text-text-3">Company:</span>{' '}
                    <span className="font-medium text-text">{client.company_name}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Client's Invoices */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
              Invoices ({client.invoices?.length || 0})
            </span>
            {client.invoices?.length === 0 ? (
              <div className="p-4 text-center bg-bg-grouped rounded-2xl border border-hairline text-text-3 text-xs">
                No invoices for this client.
              </div>
            ) : (
              <GroupedList>
                {client.invoices?.map((inv) => (
                  <ListRow
                    key={inv.id}
                    title={
                      <Link
                        to={`/app/invoices/${inv.id}`}
                        onClick={() => onOpenChange(false)}
                        className="font-medium text-text hover:text-tint text-sm flex items-center gap-1"
                      >
                        {inv.invoice_number}
                        <ChevronRight className="w-3.5 h-3.5 text-text-3" />
                      </Link>
                    }
                    subtitle={
                      <span className="text-xs text-text-3">
                        Due {formatDate(inv.due_date)} · {labelOrFallback(invoiceStatusLabel, inv.status)}
                      </span>
                    }
                    trailing={
                      <span className="font-semibold text-text text-sm">
                        {formatMoney(inv.outstanding)}
                      </span>
                    }
                  />
                ))}
              </GroupedList>
            )}
          </div>
        </div>
      )}
    </Sheet>
  )
}
