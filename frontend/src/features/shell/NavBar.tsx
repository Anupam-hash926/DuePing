import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { PingMark } from '../../ui/PingMark'
import { IconButton } from '../../ui/IconButton'
import { SegmentedControl } from '../../ui/SegmentedControl'
import { NotificationsPopover } from './NotificationsPopover'
import { DemoPopover } from './DemoPopover'

export interface NavBarProps {
  onOpenCommandPalette: () => void
}

export const NavBar: React.FC<NavBarProps> = ({ onOpenCommandPalette }) => {
  const location = useLocation()
  const navigate = useNavigate()

  // Map route to active tab
  const getActiveTab = () => {
    const path = location.pathname
    if (path.startsWith('/app/dashboard')) return 'dashboard'
    if (path.startsWith('/app/invoices')) return 'invoices'
    if (path.startsWith('/app/clients')) return 'clients'
    return 'today'
  }

  const handleTabChange = (val: string) => {
    switch (val) {
      case 'today':
        navigate('/app')
        break
      case 'dashboard':
        navigate('/app/dashboard')
        break
      case 'invoices':
        navigate('/app/invoices')
        break
      case 'clients':
        navigate('/app/clients')
        break
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full glass hairline-b select-none">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <Link to="/app" className="flex items-center gap-2.5 group focus-visible:outline-none">
          <PingMark size="sm" pulse={false} />
          <span className="font-semibold tracking-tight text-base text-text group-hover:opacity-80 transition-opacity">
            DuePing
          </span>
        </Link>

        {/* Center: Desktop Segmented Control */}
        <nav className="hidden md:flex items-center" aria-label="Main Navigation">
          <SegmentedControl
            name="nav-tabs"
            size="sm"
            value={getActiveTab()}
            onChange={handleTabChange}
            options={[
              { value: 'today', label: 'Today' },
              { value: 'dashboard', label: 'Overview' },
              { value: 'invoices', label: 'Invoices' },
              { value: 'clients', label: 'Clients' },
            ]}
          />
        </nav>

        {/* Right actions: Search, Bell, Demo */}
        <div className="flex items-center gap-2">
          <IconButton
            aria-label="Search (⌘K)"
            variant="ghost"
            size="sm"
            onClick={onOpenCommandPalette}
            className="text-text-2 hover:text-text"
          >
            <Search className="w-4 h-4" />
          </IconButton>

          <NotificationsPopover />

          <DemoPopover />
        </div>
      </div>
    </header>
  )
}
