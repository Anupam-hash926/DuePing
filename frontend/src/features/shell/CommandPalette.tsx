import React, { useEffect } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router-dom'
import { Search, Calendar, FileText, Users, Play, RotateCcw, LayoutDashboard, Upload, CreditCard } from 'lucide-react'
import { useInvoices, useClients } from '../../api/hooks/useQueries'
import { useRunDailyCheck, useResetDemo } from '../../api/hooks/useMutations'

export interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onOpenChange }) => {
  const navigate = useNavigate()
  const { data: invoices } = useInvoices({ limit: 50 })
  const { data: clients } = useClients()
  const dailyCheck = useRunDailyCheck()
  const resetDemo = useResetDemo()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, onOpenChange])

  if (!open) return null

  const handleSelect = (callback: () => void) => {
    callback()
    onOpenChange(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/40 backdrop-blur-sm">
      <div
        className="fixed inset-0 -z-10"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div className="w-full max-w-xl glass rounded-card border border-hairline shadow-float overflow-hidden">
        <Command label="Global Command Palette" className="w-full">
          <div className="flex items-center px-4 border-b border-hairline">
            <Search className="w-4 h-4 text-text-3 mr-2" />
            <Command.Input
              placeholder="Type an invoice, client, or command..."
              className="w-full h-12 bg-transparent text-sm text-text placeholder-text-3 outline-none"
              autoFocus
            />
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2 text-sm">
            <Command.Empty className="py-6 text-center text-xs text-text-3">
              No matching results.
            </Command.Empty>

            <Command.Group heading="Navigation" className="text-xs font-semibold text-text-3 uppercase px-2 py-1.5">
              <Command.Item
                onSelect={() => handleSelect(() => navigate('/app'))}
                className="flex items-center gap-2.5 px-3 py-2 rounded-input text-text hover:bg-bg-grouped cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-tint" />
                <span>Today (Action Centre)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect(() => navigate('/app/dashboard'))}
                className="flex items-center gap-2.5 px-3 py-2 rounded-input text-text hover:bg-bg-grouped cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4 text-purple" />
                <span>Overview & Dashboard</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect(() => navigate('/app/invoices'))}
                className="flex items-center gap-2.5 px-3 py-2 rounded-input text-text hover:bg-bg-grouped cursor-pointer"
              >
                <FileText className="w-4 h-4 text-teal" />
                <span>Invoices List</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect(() => navigate('/app/clients'))}
                className="flex items-center gap-2.5 px-3 py-2 rounded-input text-text hover:bg-bg-grouped cursor-pointer"
              >
                <Users className="w-4 h-4 text-success" />
                <span>Clients & Reliability</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect(() => navigate('/app/import'))}
                className="flex items-center gap-2.5 px-3 py-2 rounded-input text-text hover:bg-bg-grouped cursor-pointer"
              >
                <Upload className="w-4 h-4 text-text-2" />
                <span>Import Invoices (CSV / JSON)</span>
              </Command.Item>
            </Command.Group>

            {invoices && invoices.length > 0 && (
              <Command.Group heading="Invoices" className="text-xs font-semibold text-text-3 uppercase px-2 py-1.5 mt-2">
                {invoices.slice(0, 5).map((inv) => (
                  <Command.Item
                    key={inv.id}
                    value={`Open invoice ${inv.invoice_number} ${inv.client?.name ?? ''}`}
                    onSelect={() => handleSelect(() => navigate(`/app/invoices/${inv.id}`))}
                    className="flex items-center justify-between px-3 py-2 rounded-input text-text hover:bg-bg-grouped cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-text-3" />
                      <span className="font-medium">Open invoice {inv.invoice_number}</span>
                      <span className="text-text-2">· {inv.client?.name}</span>
                    </div>
                    <span className="text-xs font-medium text-text-2">{inv.total.amount} {inv.total.currency}</span>
                  </Command.Item>
                ))}
                {invoices.filter((inv) => inv.status !== 'PAID').slice(0, 3).map((inv) => (
                  <Command.Item
                    key={`pay-${inv.id}`}
                    value={`Record payment on ${inv.invoice_number} ${inv.client?.name ?? ''}`}
                    onSelect={() => handleSelect(() => navigate(`/app/invoices/${inv.id}?record_payment=1`))}
                    className="flex items-center justify-between px-3 py-2 rounded-input text-text hover:bg-bg-grouped cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-success" />
                      <span className="font-medium">Record payment on {inv.invoice_number}</span>
                      <span className="text-text-2">· {inv.client?.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-tint">Record</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {clients && clients.length > 0 && (
              <Command.Group heading="Clients" className="text-xs font-semibold text-text-3 uppercase px-2 py-1.5 mt-2">
                {clients.slice(0, 5).map((c) => (
                  <Command.Item
                    key={c.id}
                    onSelect={() => handleSelect(() => navigate(`/app/clients/${c.id}`))}
                    className="flex items-center justify-between px-3 py-2 rounded-input text-text hover:bg-bg-grouped cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-text-3" />
                      <span>{c.name}</span>
                    </div>
                    <span className="text-xs text-text-3">{c.reliability_score}% reliability</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Actions" className="text-xs font-semibold text-text-3 uppercase px-2 py-1.5 mt-2">
              <Command.Item
                onSelect={() => handleSelect(() => dailyCheck.mutate())}
                className="flex items-center gap-2.5 px-3 py-2 rounded-input text-text hover:bg-bg-grouped cursor-pointer"
              >
                <Play className="w-4 h-4 text-warning" />
                <span>Run Daily Check</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect(() => resetDemo.mutate())}
                className="flex items-center gap-2.5 px-3 py-2 rounded-input text-danger hover:bg-bg-grouped cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-danger" />
                <span>Reset Demo State</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
