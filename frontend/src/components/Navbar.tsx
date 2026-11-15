import React, { useEffect, useState, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { apiClient } from '../api/client'
import { NotificationRead, SimulatedDateRead, DailyCheckSummaryRead } from '../api/types'
import { useToast } from '../context/ToastContext'
import { formatDate, formatDateTime } from '../lib/format'

export const Navbar: React.FC = () => {
  const location = useLocation()
  const { showSuccess, showError } = useToast()

  const [dateInfo, setDateInfo] = useState<SimulatedDateRead | null>(null)
  const [inputDate, setInputDate] = useState<string>('')
  const [notifications, setNotifications] = useState<NotificationRead[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [showBellDropdown, setShowBellDropdown] = useState<boolean>(false)
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false)
  const [runningCheck, setRunningCheck] = useState<boolean>(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchToday = async () => {
    try {
      const res = await apiClient.get<SimulatedDateRead>('/system/today')
      setDateInfo(res)
      setInputDate(res.today)
    } catch (e: unknown) {
      console.error(e)
    }
  }

  const fetchNotifications = async () => {
    try {
      const list = await apiClient.get<NotificationRead[]>('/notifications')
      setNotifications(list)
      setUnreadCount(list.filter((n) => !n.is_read).length)
    } catch (e: unknown) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchToday()
    fetchNotifications()

    // Listen for custom trigger to refresh topbar state
    const handleRefresh = () => {
      fetchToday()
      fetchNotifications()
    }
    window.addEventListener('dueping:refresh', handleRefresh)
    return () => window.removeEventListener('dueping:refresh', handleRefresh)
  }, [])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowBellDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSetSimulatedDate = async () => {
    if (!inputDate) return
    try {
      const res = await apiClient.put<SimulatedDateRead>('/system/today', { date: inputDate })
      setDateInfo(res)
      showSuccess(`Simulated date set to ${formatDate(res.today)}`)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleUseRealDate = async () => {
    try {
      const res = await apiClient.put<SimulatedDateRead>('/system/today', { date: null })
      setDateInfo(res)
      setInputDate(res.today)
      showSuccess(`Returned to real date: ${formatDate(res.today)}`)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleRunDailyCheck = async () => {
    setRunningCheck(true)
    try {
      const summary = await apiClient.post<DailyCheckSummaryRead>('/system/daily-check')
      showSuccess(
        `Daily check completed: ${summary.invoices_checked} invoices checked, ${summary.promises_missed} promises missed, ${summary.newly_overdue} newly overdue.`
      )
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunningCheck(false)
    }
  }

  const handleOpenBell = async () => {
    const nextState = !showBellDropdown
    setShowBellDropdown(nextState)
    if (nextState && unreadCount > 0) {
      try {
        await apiClient.post('/notifications/read')
        setUnreadCount(0)
        fetchNotifications()
      } catch (err: unknown) {
        console.error(err)
      }
    }
  }

  const handleResetDemoData = async () => {
    try {
      await apiClient.post('/system/reset-demo')
      setShowResetConfirm(false)
      showSuccess('Demo data reset successfully!')
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  const navLinks = [
    { to: '/', label: 'Action Centre' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/invoices', label: 'Invoices' },
    { to: '/clients', label: 'Clients' },
    { to: '/import', label: 'Import' },
    { to: '/audit', label: 'Audit' },
  ]

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Nav links */}
            <div className="flex items-center space-x-8">
              <Link to="/" className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-black flex items-center justify-center text-lg shadow-sm">
                  DP
                </span>
                <span className="text-xl font-bold tracking-tight text-slate-900">
                  Due<span className="text-indigo-600">Ping</span>
                </span>
              </Link>
              <nav className="flex space-x-1">
                {navLinks.map((link) => {
                  const isActive =
                    link.to === '/'
                      ? location.pathname === '/'
                      : location.pathname.startsWith(link.to)
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-slate-100 text-indigo-700 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      {link.label}
                    </Link>
                  )
                })}
              </nav>
            </div>

            {/* Right Controls: Date, Daily check, Bell, Reset */}
            <div className="flex items-center space-x-4">
              {/* Demo Date Control */}
              <div className="flex items-center bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-xs">
                <span className="mr-2 font-medium text-slate-700 flex items-center gap-1">
                  📅 {formatDate(dateInfo?.today)}
                  {dateInfo?.simulated && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold text-[10px]">
                      SIMULATED
                    </span>
                  )}
                </span>
                <input
                  type="date"
                  value={inputDate}
                  onChange={(e) => setInputDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-slate-800"
                />
                <button
                  onClick={handleSetSimulatedDate}
                  className="ml-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded text-xs"
                >
                  Set
                </button>
                {dateInfo?.simulated && (
                  <button
                    onClick={handleUseRealDate}
                    className="ml-1 px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-medium"
                  >
                    Reset Date
                  </button>
                )}
              </div>

              {/* Run Daily Check */}
              <button
                onClick={handleRunDailyCheck}
                disabled={runningCheck}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
              >
                <span>⚡</span>
                {runningCheck ? 'Running...' : 'Run Daily Check'}
              </button>

              {/* Notification Bell */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={handleOpenBell}
                  className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 relative"
                  title="Notifications"
                >
                  <span className="text-lg">🔔</span>
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-rose-600 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showBellDropdown && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden">
                    <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-700">Notifications</span>
                      <span className="text-[11px] text-slate-500">{notifications.length} total</span>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          No notifications yet
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`p-3 text-xs ${n.is_read ? 'bg-white' : 'bg-indigo-50/50'}`}
                          >
                            <p className="text-slate-800 font-medium">{n.message}</p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {formatDateTime(n.created_at)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Reset Demo Data Button */}
              <button
                onClick={() => setShowResetConfirm(true)}
                className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1 rounded hover:bg-rose-50 border border-rose-200"
              >
                Reset Demo
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Reset Demo Data?</h3>
            <p className="text-xs text-slate-600 mt-2">
              This will drop all current data and reseed the 13 historical demo invoices and 5 clients
              per Section 17.1.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleResetDemoData}
                className="px-3 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-md font-semibold"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

