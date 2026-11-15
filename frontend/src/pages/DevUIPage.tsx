import React, { useState } from 'react'
import {
  Button, TextButton, IconButton, Badge, SegmentedControl, GroupedList, ListRow,
  GlassCard, Sheet, Popover, Tabs, Stat, Ring, Meter, Stepper, Skeleton,
  Toast, EmptyState, LargeTitle, SearchField, MoneyText, ChatBubble,
} from '../ui'
import { Sun, Moon, Bell, MessageSquare, Shield } from 'lucide-react'

export const DevUIPage: React.FC = () => {
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system')
  const [segValue, setSegValue] = useState('all')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [step, setStep] = useState('SENT')
  const [search, setSearch] = useState('')

  const handleThemeChange = (newTheme: 'system' | 'light' | 'dark') => {
    setTheme(newTheme)
    if (newTheme === 'system') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', newTheme)
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text p-6 md:p-12 transition-colors">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Header & Theme Switcher */}
        <div className="flex items-start justify-between flex-wrap gap-4 pb-6 border-b border-hairline">
          <LargeTitle
            subtitle="Interactive gallery of all UI primitives across light and dark tokens."
            badge={<Badge variant="purple">Dev Only</Badge>}
          >
            Design System QA
          </LargeTitle>

          <div className="flex items-center gap-2 bg-bg-grouped p-1 rounded-pill border border-hairline">
            <button
              type="button"
              onClick={() => handleThemeChange('light')}
              className={`p-2 rounded-full transition-colors ${theme === 'light' ? 'bg-surface-solid shadow-sm text-text' : 'text-text-3'}`}
              aria-label="Light theme"
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleThemeChange('dark')}
              className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'bg-surface-solid shadow-sm text-text' : 'text-text-3'}`}
              aria-label="Dark theme"
            >
              <Moon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleThemeChange('system')}
              className={`px-3 py-1 text-xs font-medium rounded-pill transition-colors ${theme === 'system' ? 'bg-surface-solid shadow-sm text-text' : 'text-text-3'}`}
            >
              Auto
            </button>
          </div>
        </div>

        {/* Section: Badges & Buttons */}
        <section className="space-y-4">
          <h2 className="text-xs uppercase font-semibold tracking-wider text-text-3">1. Badges & Buttons</h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral" dot>Neutral</Badge>
            <Badge variant="tint" dot>Active</Badge>
            <Badge variant="success" dot>Paid / Kept</Badge>
            <Badge variant="warning" dot>Disputed</Badge>
            <Badge variant="danger" dot>Overdue</Badge>
            <Badge variant="purple" dot>Playbook</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="ghost">Ghost</Button>
            <Button loading variant="primary">Loading</Button>
            <Button disabled variant="secondary">Disabled</Button>
            <TextButton withChevron>Learn more</TextButton>
            <IconButton aria-label="Notifications" variant="secondary"><Bell className="w-4 h-4" /></IconButton>
            <Popover
              trigger={<Button variant="secondary" size="sm">Open Popover</Button>}
            >
              <div className="text-xs text-text-2 space-y-1">
                <div className="font-semibold text-text">Popover Content</div>
                <div>Rendered inside frosted glass popover.</div>
              </div>
            </Popover>
          </div>
        </section>

        {/* Section: Navigation, Stepper, Tabs */}
        <section className="space-y-4">
          <h2 className="text-xs uppercase font-semibold tracking-wider text-text-3">2. Controls & Tabs</h2>
          <div className="space-y-6">
            <SegmentedControl
              value={segValue}
              onChange={setSegValue}
              options={[
                { value: 'all', label: 'All Invoices' },
                { value: 'actionable', label: 'Pending Action' },
                { value: 'overdue', label: 'Overdue' },
              ]}
            />
            <Tabs
              tabs={[
                { value: 'stepper', label: 'Status Stepper', content: (
                  <div className="p-6 bg-surface-solid rounded-card border border-hairline">
                    <Stepper
                      steps={[
                        { id: 'DRAFT', label: 'Draft' },
                        { id: 'SENT', label: 'Sent' },
                        { id: 'PARTIALLY_PAID', label: 'Partial' },
                        { id: 'PAID', label: 'Settled' },
                      ]}
                      currentStepId={step}
                    />
                    <div className="flex gap-2 mt-4">
                      {['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID'].map((s) => (
                        <Button key={s} size="sm" variant={s === step ? 'primary' : 'secondary'} onClick={() => setStep(s)}>
                          {s}
                        </Button>
                      ))}
                    </div>
                  </div>
                )},
                { value: 'empty', label: 'Empty State', content: (
                  <GlassCard>
                    <EmptyState
                      title="No Actions Pending"
                      description="All overdue invoices have active commitments or scheduled follow-ups."
                      action={<Button size="sm">Create New Invoice</Button>}
                    />
                  </GlassCard>
                )},
              ]}
            />
          </div>
        </section>

        {/* Section: Metrics & Progress */}
        <section className="space-y-4">
          <h2 className="text-xs uppercase font-semibold tracking-wider text-text-3">3. Metrics & Progress</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <GlassCard>
              <Stat label="Total Outstanding" value={142500} isMoney currency="INR" trend={{ value: 12.5 }} />
            </GlassCard>
            <GlassCard>
              <Stat label="Reliability Score" value={88} description="Based on 14 promises kept" />
            </GlassCard>
            <GlassCard>
              <div className="flex items-center gap-4">
                <Ring size="lg" color="#007AFF" />
                <div className="flex-1">
                  <Meter value={75} label="Target" valueLabel="75%" variant="gradient" />
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Section: Grouped Inset List & Toasts */}
        <section className="space-y-4">
          <h2 className="text-xs uppercase font-semibold tracking-wider text-text-3">4. List Views & Feedback</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GroupedList header="Recent Actions">
              <ListRow
                leading={<Shield className="w-5 h-5 text-tint" />}
                title="Obtain CEO Approval"
                subtitle="Invoice DP-2026-0001"
                trailing={<Badge variant="warning">High</Badge>}
                withChevron
                interactive
                onClick={() => setSheetOpen(true)}
              />
              <ListRow
                leading={<MessageSquare className="w-5 h-5 text-success" />}
                title="Follow up on Wire"
                subtitle="Promised by 2026-03-05"
                trailing={<MoneyText amount="50000" currency="INR" />}
                withChevron
                interactive
                onClick={() => setSheetOpen(true)}
              />
            </GroupedList>

            <div className="space-y-3">
              <Toast type="success" title="Payment Recorded" message="₹25,000 received via UPI" />
              <Toast type="error" title="Invoice Overdue" message="Payment overdue by 7 days" />
              <Toast type="info" title="System Check" message="All daily checks completed" />
            </div>
          </div>
        </section>

        {/* Section: Inputs & Chat Bubbles */}
        <section className="space-y-4">
          <h2 className="text-xs uppercase font-semibold tracking-wider text-text-3">5. Messaging & Inputs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <SearchField value={search} onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch('')} />
              <div className="flex gap-4">
                <Skeleton className="w-24 h-8" variant="pill" />
                <Skeleton className="flex-1 h-8" />
              </div>
            </div>
            <div className="p-4 bg-bg-grouped rounded-card border border-hairline space-y-3">
              <ChatBubble
                sender="me"
                senderName="Acme Finance"
                toneBadge="FIRM"
                message="Hi Rahul, following up on invoice INV-OL-07 (₹45,000). The PO number is still missing from your billing portal."
                timestamp="10:42 AM"
              />
              <ChatBubble
                sender="client"
                senderName="Rahul (Client)"
                message="Checking with procurement now, will revert today."
                timestamp="10:45 AM"
              />
            </div>
          </div>
        </section>

        {/* Sheet Demo */}
        <Sheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="Action Detail Sheet"
          description="Adaptive bottom sheet on mobile and centered dialog on desktop."
        >
          <div className="space-y-4 py-2">
            <p className="text-sm text-text-2">
              This modal uses Radix Dialog with iOS spring transitions and frosted glass styling.
            </p>
            <Button variant="primary" className="w-full" onClick={() => setSheetOpen(false)}>
              Confirm & Close
            </Button>
          </div>
        </Sheet>
      </div>
    </div>
  )
}
