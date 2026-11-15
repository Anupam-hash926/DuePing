import React, { useState } from 'react'
import { useCreateClient } from '../../api/hooks/useMutations'
import { Sheet } from '../../ui/Sheet'
import { Button } from '../../ui/Button'
import { useToast } from '../../context/ToastContext'
import type { ClientRead } from '../../api/types'

interface AddClientSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClientCreated: (client: ClientRead) => void
}

export const AddClientSheet: React.FC<AddClientSheetProps> = ({
  open,
  onOpenChange,
  onClientCreated,
}) => {
  const { showSuccess, showError } = useToast()
  const createClientMutation = useCreateClient()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email) return
    try {
      const created = await createClientMutation.mutateAsync({
        name,
        email,
        phone: phone || null,
        company_name: company || null,
      })
      showSuccess(`Client ${created.name} created!`)
      onClientCreated(created)
      onOpenChange(false)
      setName('')
      setEmail('')
      setPhone('')
      setCompany('')
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add New Client"
      description="Quickly register a new client for this invoice."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            Client Name *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Acme Corp / Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-surface-solid border border-hairline rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-tint"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            Billing Email *
          </label>
          <input
            type="email"
            required
            placeholder="billing@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-surface-solid border border-hairline rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-tint"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            Phone Number (Optional)
          </label>
          <input
            type="tel"
            placeholder="+44 20 7946 0958"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-surface-solid border border-hairline rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-tint"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            Company Name (Optional)
          </label>
          <input
            type="text"
            placeholder="Acme Holdings Ltd"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="w-full bg-surface-solid border border-hairline rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-tint"
          />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="secondary"
            type="button"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            loading={createClientMutation.isPending}
          >
            Save Client
          </Button>
        </div>
      </form>
    </Sheet>
  )
}
