import React from 'react'
import { PingMark } from '../../ui/PingMark'

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-hairline py-10 px-4 sm:px-6 select-none bg-surface-solid">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-3">
        <div className="flex items-center gap-2">
          <PingMark size="sm" pulse={false} />
          <span className="font-medium text-text">DuePing</span>
          <span>— Resolution-First Payment Follow-up & Collections</span>
        </div>

        <div className="flex items-center gap-6">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text transition-colors"
          >
            GitHub
          </a>
          <span>•</span>
          <span>OOAD v2.0 Architecture</span>
        </div>
      </div>
    </footer>
  )
}
