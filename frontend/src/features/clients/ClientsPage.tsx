import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { useClients } from '../../api/hooks/useQueries'
import { useCreateClient } from '../../api/hooks/useMutations'
import { LargeTitle } from '../../ui/LargeTitle'
import { Button } from '../../ui/Button'
import { GroupedList } from '../../ui/GroupedList'
import { ListRow } from '../../ui/ListRow'
import { ProgressRing, getReliabilityColor } from '../../ui/ProgressRing'
import { Badge } from '../../ui/Badge'
import { Sheet } from '../../ui/Sheet'
import { Skeleton } from '../../ui/Skeleton'
import { EmptyState } from '../../ui/EmptyState'
import { useToast } from '../../context/ToastContext'
import { ClientSheet } from './ClientSheet'

export const ClientsPage: React.FC = () => {
  const { showSuccess, showError } = useToast()
  const { data: clients, isLoading } = useClients()
  const createMutation = useCreateClient()

  // Selected client for side sheet
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Add Client sheet
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newCompany, setNewCompany] = useState('')

  const handleRowClick = (id: string) => {
    setSelectedClientId(id)
    setSheetOpen(true)
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName || !newEmail) return
    try {
      const created = await createMutation.mutateAsync({
        name: newName,
        email: newEmail,
        phone: newPhone || null,
        company_name: newCompany || null,
      })
      showSuccess(`Client ${created.name} registered`)
      setAddOpen(false)
      setNewName('')
      setNewEmail('')
      setNewPhone('')
      setNewCompany('')
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  if (isLoading && !clients) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-[28px]" variant="rectangular" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <LargeTitle
          title="Clients"
          subtitle="Customer reliability scores, payment behavior, risk levels, and invoices."
        />
        <Button
          variant="primary"
          size="md"
          className="rounded-full px-5"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Client
        </Button>
      </div>

      {clients?.length === 0 ? (
        <EmptyState
          title="No clients registered yet."
          description="Add your first customer to begin tracking invoices and reliability scores."
        />
      ) : (
        <GroupedList>
          {clients?.map((client) => {
            const scoreColor = getReliabilityColor(client.reliability_score)

            const riskVariant =
              client.risk_level === 'HIGH'
                ? 'danger'
                : client.risk_level === 'MEDIUM'
                ? 'warning'
                : 'success'

            return (
              <ListRow
                key={client.id}
                onClick={() => handleRowClick(client.id)}
                leading={
                  <div className="flex items-center justify-center">
                    <ProgressRing
                      size="sm"
                      value={client.reliability_score}
                      color={scoreColor}
                      ariaLabel={`Reliability ${client.reliability_score} out of 100`}
                    />
                  </div>
                }
                title={
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text text-sm">
                      {client.name}
                    </span>
                    {client.company_name && (
                      <span className="text-xs text-text-3 font-normal">
                        ({client.company_name})
                      </span>
                    )}
                  </div>
                }
                subtitle={
                  <span className="text-xs text-text-3">
                    {client.email} · Score: {client.reliability_score}/100
                  </span>
                }
                trailing={
                  <div className="flex items-center gap-3">
                    <Badge variant={riskVariant} size="sm">
                      {client.risk_level}
                    </Badge>
                  </div>
                }
              />
            )
          })}
        </GroupedList>
      )}

      {/* Side Sheet for Client Details */}
      <ClientSheet
        clientId={selectedClientId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      {/* Add Client Sheet */}
      <Sheet
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add New Client"
        description="Register a new customer profile."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-medium text-text-3 mb-1">
              Client Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Corp / Alex Taylor"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-surface-solid border border-hairline rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-tint"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-3 mb-1">
              Billing Email *
            </label>
            <input
              type="email"
              required
              placeholder="billing@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full bg-surface-solid border border-hairline rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-tint"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-3 mb-1">
              Phone (Optional)
            </label>
            <input
              type="tel"
              placeholder="+44 20 7946 0958"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="w-full bg-surface-solid border border-hairline rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-tint"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-3 mb-1">
              Company Name (Optional)
            </label>
            <input
              type="text"
              placeholder="Acme Holdings Ltd"
              value={newCompany}
              onChange={(e) => setNewCompany(e.target.value)}
              className="w-full bg-surface-solid border border-hairline rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-tint"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={createMutation.isPending}
            >
              Save Client
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  )
}
