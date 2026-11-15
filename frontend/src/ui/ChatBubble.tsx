import React from 'react'
import { cn } from '../lib/cn'

export interface ChatBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  sender?: 'me' | 'client'
  message: string
  timestamp?: string
  senderName?: string
  toneBadge?: string
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  sender = 'me',
  message,
  timestamp,
  senderName,
  toneBadge,
  className,
  ...props
}) => {
  const isMe = sender === 'me'

  return (
    <div
      className={cn(
        'flex flex-col gap-1 max-w-[85%] sm:max-w-md',
        isMe ? 'ml-auto items-end' : 'mr-auto items-start',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2 px-1 text-[11px] text-text-3 font-medium">
        {senderName && <span>{senderName}</span>}
        {toneBadge && (
          <span className="px-1.5 py-0.2 rounded-pill bg-bg-grouped text-text-2 uppercase text-[10px] tracking-wider border border-hairline">
            {toneBadge}
          </span>
        )}
      </div>

      <div
        className={cn(
          'px-4 py-2.5 text-sm leading-relaxed shadow-sm break-words',
          isMe
            ? 'bg-tint text-white rounded-[18px] rounded-br-[4px]'
            : 'bg-surface-solid border border-hairline text-text rounded-[18px] rounded-bl-[4px]'
        )}
      >
        {message}
      </div>

      {timestamp && (
        <span className="text-[10px] text-text-3 px-1">{timestamp}</span>
      )}
    </div>
  )
}
