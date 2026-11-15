import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Calendar, LayoutDashboard, FileText, Users, MoreHorizontal, Upload, Shield } from 'lucide-react'
import { Sheet } from '../../ui/Sheet'
import { ListRow } from '../../ui/ListRow'
import { GroupedList } from '../../ui/GroupedList'

export const TabBar: React.FC = () => {
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const navItems = [
    { to: '/app', label: 'Today', icon: Calendar, exact: true },
    { to: '/app/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/app/invoices', label: 'Invoices', icon: FileText },
    { to: '/app/clients', label: 'Clients', icon: Users },
  ]

  const isMoreActive =
    location.pathname.startsWith('/app/import') || location.pathname.startsWith('/app/audit')

  return (
    <>
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass hairline-t pb-[env(safe-area-inset-bottom)] select-none"
      >
        <div className="flex items-center justify-around h-14 px-2">
          {navItems.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.to || location.pathname === '/'
              : location.pathname.startsWith(item.to)
            const Icon = item.icon

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-tint' : 'text-text-3 hover:text-text-2'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-[10px] font-medium transition-colors ${
              isMoreActive ? 'text-tint' : 'text-text-3 hover:text-text-2'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen} title="More Utilities">
        <GroupedList className="my-2">
          <Link to="/app/import" onClick={() => setMoreOpen(false)}>
            <ListRow
              leading={<Upload className="w-4 h-4 text-tint" />}
              title="Import Invoices"
              subtitle="Batch load invoices from CSV or JSON"
              withChevron
              interactive
            />
          </Link>
          <Link to="/app/audit" onClick={() => setMoreOpen(false)}>
            <ListRow
              leading={<Shield className="w-4 h-4 text-purple" />}
              title="Audit Log"
              subtitle="Traceable history of domain events"
              withChevron
              interactive
            />
          </Link>
        </GroupedList>
      </Sheet>
    </>
  )
}
