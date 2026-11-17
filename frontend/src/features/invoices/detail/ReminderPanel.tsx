import React, { useState } from 'react'
import { Sparkles, Copy, Check, Send } from 'lucide-react'
import type { Channel, InvoiceRead, ReminderRead, ReminderTone } from '../../../api/types'
import { Button } from '../../../ui/Button'
import { SegmentedControl } from '../../../ui/SegmentedControl'
import { ChatBubble } from '../../../ui/ChatBubble'
import { GlassCard } from '../../../ui/GlassCard'
import { useGenerateReminder, useMarkReminderSent } from '../../../api/hooks/useMutations'
import { channelLabel, labelOrFallback, reminderToneLabel } from '../../../lib/labels'

export interface ReminderPanelProps {
  invoice: InvoiceRead
  initialReminder?: ReminderRead | null
}

export const ReminderPanel: React.FC<ReminderPanelProps> = ({
  invoice,
  initialReminder,
}) => {
  const [tone, setTone] = useState<ReminderTone>(initialReminder?.tone ?? 'POLITE')
  const [channel, setChannel] = useState<Channel>('EMAIL')
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
            onChange={(value) => setTone(value as ReminderTone)}
            options={[
              { value: 'POLITE', label: 'Polite' },
              { value: 'FIRM', label: 'Firm' },
              { value: 'FINAL', label: 'Final' },
            ]}
          />

          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as Channel)}
            className="h-8 px-2.5 text-xs bg-bg-grouped border border-hairline rounded-pill text-text outline-none focus:border-tint"
          >
            <option value="EMAIL">{labelOrFallback(channelLabel, 'EMAIL')}</option>
            <option value="PHONE">{labelOrFallback(channelLabel, 'PHONE')}</option>
            <option value="WHATSAPP">{labelOrFallback(channelLabel, 'WHATSAPP')}</option>
            <option value="MEETING">{labelOrFallback(channelLabel, 'MEETING')}</option>
            <option value="OTHER">{labelOrFallback(channelLabel, 'OTHER')}</option>
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
              <span className="font-semibold text-text">{labelOrFallback(reminderToneLabel, reminder.tone)} Tone</span>
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
              toneBadge={labelOrFallback(reminderToneLabel, reminder.tone)}
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
