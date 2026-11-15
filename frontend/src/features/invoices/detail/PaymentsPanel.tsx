import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import type { InvoiceRead, PaymentRead } from '../../../api/types'
import { GroupedList } from '../../../ui/GroupedList'
import { ListRow } from '../../../ui/ListRow'
import { Button } from '../../../ui/Button'
import { Sheet } from '../../../ui/Sheet'
import { MoneyText } from '../../../ui/MoneyText'
import { formatDate } from '../../../lib/format'
import { useRecordPayment } from '../../../api/hooks/useMutations'

export interface PaymentsPanelProps {
  invoice: InvoiceRead
  modalOpen: boolean
  onModalChange: (open: boolean) => void
}

export const PaymentsPanel: React.FC<PaymentsPanelProps> = ({
  invoice,
  modalOpen,
  onModalChange,
}) => {
  const recordPayment = useRecordPayment(invoice.id)
  const allowed = new Set(invoice.allowed_operations)

  const [amount, setAmount] = useState(invoice.outstanding.amount)
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0])
  const [method, setMethod] = useState('BANK_TRANSFER')
  const [refNum, setRefNum] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) return
    await recordPayment.mutateAsync({
      amount,
      payment_date: paymentDate,
      method,
      reference_number: refNum || undefined,
    })
    onModalChange(false)
    setRefNum('')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-3">
          Payments ({invoice.payments.length})
        </h3>
        {allowed.has('record_payment') && (
          <Button size="sm" variant="secondary" onClick={() => onModalChange(true)}>
            <Plus className="w-3.5 h-3.5 mr-1 text-success" />
            Record Payment
          </Button>
        )}
      </div>

      {invoice.payments.length === 0 ? (
        <div className="p-8 text-center bg-surface-solid rounded-card border border-hairline text-text-3 text-xs">
          No payments recorded yet.
        </div>
      ) : (
        <GroupedList>
          {invoice.payments.map((p: PaymentRead) => (
            <ListRow
              key={p.id}
              title={<MoneyText amount={p.amount.amount} currency={p.amount.currency} />}
              subtitle={`${p.method.replace('_', ' ')}${p.reference_number ? ` · Ref: ${p.reference_number}` : ''}`}
              trailing={<span className="text-text-2">{formatDate(p.payment_date)}</span>}
            />
          ))}
        </GroupedList>
      )}

      {/* Record Payment Sheet */}
      <Sheet
        open={modalOpen}
        onOpenChange={onModalChange}
        title="Record Payment"
        description={`Remaining balance: ${invoice.outstanding.amount} ${invoice.outstanding.currency}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-medium text-text-2 block mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full h-10 px-3 bg-bg-grouped border border-hairline rounded-input text-text text-sm outline-none focus:border-tint"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-2 block mb-1">Payment Date</label>
            <input
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full h-10 px-3 bg-bg-grouped border border-hairline rounded-input text-text text-sm outline-none focus:border-tint"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-2 block mb-1">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full h-10 px-3 bg-bg-grouped border border-hairline rounded-input text-text text-sm outline-none focus:border-tint"
            >
              <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Credit / Debit Card</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CASH">Cash</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-text-2 block mb-1">Reference / UTR Number (Optional)</label>
            <input
              type="text"
              placeholder="e.g. UTR12345678"
              value={refNum}
              onChange={(e) => setRefNum(e.target.value)}
              className="w-full h-10 px-3 bg-bg-grouped border border-hairline rounded-input text-text text-sm outline-none focus:border-tint"
            />
          </div>

          <Button type="submit" variant="primary" loading={recordPayment.isPending} className="w-full mt-2">
            Confirm Payment
          </Button>
        </form>
      </Sheet>
    </div>
  )
}
