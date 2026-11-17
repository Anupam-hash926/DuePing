import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  CreditCard,
  Send,
  AlertOctagon,
  Calendar,
  FileText,
  Clock,
  CheckCircle2,
  Activity,
} from 'lucide-react'
import { useAudit } from '../../api/hooks/useQueries'
import { LargeTitle } from '../../ui/LargeTitle'
import { SearchField } from '../../ui/SearchField'
import { GroupedList } from '../../ui/GroupedList'
import { ListRow } from '../../ui/ListRow'
import { EmptyState } from '../../ui/EmptyState'
import { Skeleton } from '../../ui/Skeleton'
import { formatDate } from '../../lib/format'
import { labelForEventType } from '../../lib/labels'
import type { AuditEventRead } from '../../api/types'

const getEventIcon = (eventType: string) => {
  const type = eventType.toLowerCase()
  if (type.includes('payment')) return <CreditCard className="w-4 h-4 text-fill-green" />
  if (type.includes('send') || type.includes('sent')) return <Send className="w-4 h-4 text-tint" />
  if (type.includes('blocker')) return <AlertOctagon className="w-4 h-4 text-fill-amber" />
  if (type.includes('promise')) return <Calendar className="w-4 h-4 text-tint" />
  if (type.includes('document')) return <FileText className="w-4 h-4 text-text-3" />
  if (type.includes('complete')) return <CheckCircle2 className="w-4 h-4 text-fill-green" />
  if (type.includes('action')) return <Clock className="w-4 h-4 text-text-2" />
  return <Activity className="w-4 h-4 text-text-3" />
}

export const AuditPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const { data: events, isLoading } = useAudit()

  // Filter events
  const filteredEvents = useMemo(() => {
    if (!events) return []
    if (!searchQuery.trim()) return events
    const q = searchQuery.toLowerCase()
    return events.filter((ev) => {
      const matchesDesc = ev.description.toLowerCase().includes(q)
      const matchesType = ev.event_type.toLowerCase().includes(q)
      const matchesInv = ev.invoice_id?.toLowerCase().includes(q)
      return matchesDesc || matchesType || matchesInv
    })
  }, [events, searchQuery])

  // Group events by date (day)
  const groupedByDay = useMemo(() => {
    const groups: Record<string, AuditEventRead[]> = {}
    for (const ev of filteredEvents) {
      const day = ev.occurred_at.split('T')[0]
      if (!groups[day]) groups[day] = []
      groups[day].push(ev)
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filteredEvents])

  if (isLoading && !events) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full rounded-full" />
        <Skeleton className="h-64 rounded-[28px]" variant="rectangular" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <LargeTitle
        title="Audit Log"
        subtitle="Complete, immutable record of all activity, transactions, and invoice state changes."
      />

      <SearchField
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Filter by invoice ID, event type, or keywords..."
      />

      {groupedByDay.length === 0 ? (
        <EmptyState
          title="No audit events found."
          description="Try broadening your search term or filter parameters."
        />
      ) : (
        <div className="space-y-8">
          {groupedByDay.map(([day, dayEvents]) => (
            <div key={day} className="space-y-3">
              {/* Sticky day header */}
              <div className="sticky top-16 z-10 py-1 bg-bg-grouped/80 backdrop-blur-md">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-3 px-1">
                  {formatDate(day)}
                </span>
              </div>

              <GroupedList>
                {dayEvents.map((ev) => {
                  const timeStr = new Date(ev.occurred_at).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })

                  return (
                    <ListRow
                      key={ev.id}
                      leading={
                        <div className="flex items-center justify-center w-6 h-6">
                          {getEventIcon(ev.event_type)}
                        </div>
                      }
                      title={
                        <span className="text-sm font-medium text-text">
                          {ev.description}
                        </span>
                      }
                      subtitle={
                        <div className="flex items-center gap-2 text-xs text-text-3">
                          <span className="font-medium text-[11px] text-text-2">
                            {labelForEventType(ev.event_type)}
                          </span>
                          {ev.invoice_id && (
                            <>
                              <span>·</span>
                              <Link
                                to={`/app/invoices/${ev.invoice_id}`}
                                className="text-tint hover:underline font-mono"
                              >
                                {ev.invoice_id.slice(0, 8)}...
                              </Link>
                            </>
                          )}
                        </div>
                      }
                      trailing={
                        <span className="font-mono text-xs text-text-3">
                          {timeStr}
                        </span>
                      }
                    />
                  )
                })}
              </GroupedList>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
