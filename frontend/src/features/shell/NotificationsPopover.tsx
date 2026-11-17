import React from 'react'
import { Bell, Check } from 'lucide-react'
import { Popover } from '../../ui/Popover'
import { Button } from '../../ui/Button'
import { useNotifications } from '../../api/hooks/useQueries'
import { apiClient } from '../../api/client'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../api/queryClient'
import { formatDate } from '../../lib/format'

export const NotificationsPopover: React.FC = () => {
  const { data: notifications } = useNotifications(false)
  const qc = useQueryClient()
  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0

  const handleMarkAllRead = async () => {
    await apiClient.post('/notifications/read')
    qc.invalidateQueries({ queryKey: queryKeys.notifications(false) })
    qc.invalidateQueries({ queryKey: queryKeys.notifications(true) })
  }

  return (
    <Popover
      trigger={
        <button
          type="button"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          className="relative inline-flex items-center justify-center p-2 rounded-pill hover:bg-bg-grouped transition-colors"
        >
          <Bell className="w-4 h-4 text-text-2" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 w-2 h-2 rounded-full bg-tint ring-2 ring-surface-solid"
            />
          )}
        </button>
      }
      align="end"
      className="w-80 p-0 overflow-hidden"
    >
      <div className="flex items-center justify-between p-3.5 border-b border-hairline bg-surface-solid/50">
        <span className="text-xs font-semibold uppercase tracking-wider text-text">
          Notifications {unreadCount > 0 && `(${unreadCount})`}
        </span>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="h-6 text-xs px-2">
            <Check className="w-3 h-3 mr-1" />
            Mark all read
          </Button>
        )}
      </div>

      <div className="max-h-72 overflow-y-auto divide-y divide-hairline">
        {!notifications || notifications.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-3">No notifications</div>
        ) : (
          notifications.slice(0, 10).map((n) => (
            <div
              key={n.id}
              className={`p-3 text-xs transition-colors ${n.is_read ? 'opacity-60 bg-transparent' : 'bg-tint/5 font-medium'}`}
            >
              <div className="text-text leading-snug">{n.message}</div>
              <div className="text-[10px] text-text-3 mt-1">{formatDate(n.created_at)}</div>
            </div>
          ))
        )}
      </div>
    </Popover>
  )
}
