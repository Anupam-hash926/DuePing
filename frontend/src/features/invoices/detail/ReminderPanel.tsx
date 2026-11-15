import React, { useState } from 'react'
import { Sparkles, Copy, Check, Send } from 'lucide-react'
import type { InvoiceRead, ReminderRead } from '../../../api/types'
import { Button } from '../../../ui/Button'
import { SegmentedControl } from '../../../ui/SegmentedControl'
import { ChatBubble } from '../../../ui/ChatBubble'
import { GlassCard } from '../../../ui/GlassCard'
import { useGenerateReminder, useMarkReminderSent } from '../../../api/hooks/useMutations'

export interface ReminderPanelProps {
  invoice: InvoiceRead
  initialReminder?: ReminderRead | null
}

export const ReminderPanel: React.FC<ReminderPanelProps> = ({
  invoice,
  initialReminder,
}) => {
  const [tone, setTone] = useState<string>(initialReminder?.tone ?? 'POLITE')
  const [channel, setChannel] = useState<string>('EMAIL')
  const [reminder, setReminder] = useState<ReminderRead | null>(initialReminder ?? null)
  const [copied, setCopied] = useState(false)

  const generateReminder = useGenerateReminder(invoice.id)
  const markSent = useMarkReminderSent(invoice.id)

  const handleGenerate = async () => {
    const res = await generateReminder.mutateAsync({ tone })
    setReminder(res)
  }

  const handleCopy = () => {
    if (!reminder) return
    navigator.clipboard.writeText(reminder.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleMarkSent = async () => {
    if (!reminder) return
    await markSent.mutateAsync({
      channel,
      tone: reminder.tone,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-3">
            Dynamic Reminder Generator
          </h3>
          <p className="text-xs text-text-2 mt-0.5">
            Crafts context-aware copy referencing blockers and commitment timelines.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <SegmentedControl
            size="sm"
            name="reminder-tone"
            value={tone}
            onChange={setTone}
            options={[
              { value: 'POLITE', label: 'Polite' },
              { value: 'FIRM', label: 'Firm' },
              { value: 'FINAL', label: 'Final' },
            ]}
          />

          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="h-8 px-2.5 text-xs bg-bg-grouped border border-hairline rounded-pill text-text outline-none focus:border-tint"
          >
            <option value="EMAIL">Email</option>
            <option value="SMS">SMS</option>
            <option value="WHATSAPP">WhatsApp</option>
          </select>

          <Button
            size="sm"
            variant="primary"
            onClick={handleGenerate}
            loading={generateReminder.isPending}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Generate
          </Button>
        </div>
      </div>

      {reminder ? (
        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <div className="text-xs">
              <span className="font-semibold text-text">{reminder.tone} Tone</span>
              <span className="text-text-3"> · Subject: {reminder.subject}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={handleCopy} className="h-7 text-xs">
                {copied ? <Check className="w-3.5 h-3.5 mr-1 text-success" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copied ? 'Copied' : 'Copy Text'}
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={handleMarkSent}
                loading={markSent.isPending}
                className="h-7 text-xs"
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                Mark as Sent
              </Button>
            </div>
          </div>

          <div className="py-2">
            <ChatBubble
              sender="me"
              senderName={invoice.client?.name ? `To: ${invoice.client.name}` : 'Reminder'}
              toneBadge={reminder.tone}
              message={reminder.body}
            />
          </div>
        </GlassCard>
      ) : (
        <div className="p-8 text-center bg-surface-solid rounded-card border border-hairline text-text-3 text-xs">
          Select tone and click Generate to produce context-aware follow-up copy.
        </div>
      )}
    </div>
  )
}
