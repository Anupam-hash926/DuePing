import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import { apiClient } from '../api/client'
import { CollectionReportRead } from '../api/types'
import { StatusBadge } from '../components/Badges'
import { useToast } from '../context/ToastContext'
import { formatMoney } from '../lib/format'

export const DashboardPage: React.FC = () => {
  const { showError } = useToast()
  const [report, setReport] = useState<CollectionReportRead | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const data = await apiClient.get<CollectionReportRead>('/reports/dashboard')
      setReport(data)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()

    const handleRefresh = () => loadDashboard()
    window.addEventListener('dueping:refresh', handleRefresh)
    return () => window.removeEventListener('dueping:refresh', handleRefresh)
  }, [])

  if (loading && !report) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="p-8 text-center text-slate-500 text-sm">Loading Dashboard...</div>
      </div>
    )
  }

  if (!report) return null

  // Prepare Aging data for Recharts
  const agingChartData = report.aging.map((row) => ({
    name: row.label,
    amount: parseFloat(row.amount.amount),
    count: row.count,
  }))

  // Prepare Trend data for Recharts
  const trendChartData = report.collection_trend.map((point) => ({
    month: point.month,
    collected: parseFloat(point.collected.amount),
  }))

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Collection Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          High-level overview of outstanding balances, aging exposure, debtor concentrations, and trend.
        </p>
      </div>

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Outstanding</p>
          <p className="mt-2 text-xl font-black text-slate-900">
            {formatMoney(report.total_outstanding)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">{report.active_count} active invoices</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Total Overdue</p>
          <p className="mt-2 text-xl font-black text-rose-600">
            {formatMoney(report.total_overdue)}
          </p>
          <p className="mt-1 text-[11px] text-rose-500">{report.overdue_count} overdue invoices</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overdue Invoices</p>
          <p className="mt-2 text-xl font-black text-slate-900">{report.overdue_count}</p>
          <p className="mt-1 text-[11px] text-slate-400">
            {report.active_count > 0
              ? `${Math.round((report.overdue_count / report.active_count) * 100)}% of active`
              : '0%'}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Broken Promises</p>
          <p className="mt-2 text-xl font-black text-amber-700">{report.broken_promises}</p>
          <p className="mt-1 text-[11px] text-slate-400">{report.kept_promises} kept</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Promise Keep Rate</p>
          <p className="mt-2 text-xl font-black text-indigo-600">
            {report.promise_keep_rate !== null ? `${report.promise_keep_rate}%` : 'N/A'}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Across all clients</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Collected This Month</p>
          <p className="mt-2 text-xl font-black text-emerald-700">
            {formatMoney(report.collected_this_month)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Current calendar month</p>
        </div>
      </div>

      {/* Charts Section: Aging and Collection Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aging Bar Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 mb-1">Aging Schedule (Outstanding by Bucket)</h2>
          <p className="text-xs text-slate-500 mb-4">Distribution of unpaid active receivables across aging intervals.</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(val: number) => [`₹${val.toLocaleString()}`, 'Amount']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Collection Trend Line Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 mb-1">Collection Trend (Last 6 Months)</h2>
          <p className="text-xs text-slate-500 mb-4">Total cash receipts collected per calendar month.</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(val: number) => [`₹${val.toLocaleString()}`, 'Collected']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Line
                  type="monotone"
                  dataKey="collected"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Status Counts, Open Blockers, Top Debtors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Counts */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 mb-3">Invoice Statuses</h2>
          <div className="space-y-2">
            {Object.entries(report.status_counts).map(([statusKey, count]) => (
              <div key={statusKey} className="flex items-center justify-between py-1.5 border-b border-slate-50 text-xs">
                <StatusBadge status={statusKey} />
                <span className="font-bold text-slate-700">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Open Blockers by Type */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 mb-3">Open Blockers by Type</h2>
          <div className="space-y-2">
            {Object.entries(report.open_blockers_by_type).map(([blockerType, count]) => (
              <div key={blockerType} className="flex items-center justify-between py-1.5 border-b border-slate-50 text-xs">
                <span className="font-medium text-slate-700">{blockerType.replace(/_/g, ' ')}</span>
                <span className={`px-2 py-0.5 rounded font-bold ${count > 0 ? 'bg-rose-100 text-rose-800' : 'text-slate-400'}`}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Debtors Table */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 mb-3">Top Debtors</h2>
          {report.top_debtors.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No outstanding balances</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {report.top_debtors.map((debtor) => (
                <div key={debtor.client_id} className="py-2.5 flex items-center justify-between text-xs">
                  <Link
                    to={`/clients/${debtor.client_id}`}
                    className="font-semibold text-indigo-600 hover:underline"
                  >
                    {debtor.name}
                  </Link>
                  <span className="font-black text-slate-900">{formatMoney(debtor.outstanding)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

