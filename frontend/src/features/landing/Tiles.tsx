import React from 'react'
import { Link } from 'react-router-dom'
import { TextButton } from '../../ui/TextButton'
import { Badge } from '../../ui/Badge'
import { Ring } from '../../ui/Ring'
import { Meter } from '../../ui/Meter'
import { CheckCircle2, Upload } from 'lucide-react'

export const Tiles: React.FC = () => {
  return (
    <section className="py-20 px-4 sm:px-6 max-w-6xl mx-auto space-y-12">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-3">Comprehensive Coverage</span>
        <h2 className="text-title-large text-text font-light">Every Dimension of Receivables</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tile 1: Today / Action Center */}
        <div className="bg-bg-grouped rounded-[28px] border border-hairline p-8 flex flex-col justify-between hover:shadow-float hover:-translate-y-1 transition-all duration-300">
          <div className="space-y-3">
            <h3 className="text-2xl font-semibold tracking-tight text-text">Today</h3>
            <p className="text-sm text-text-2 leading-relaxed">
              Prioritized recovery queue dynamically ranking the most critical tasks.
            </p>
            <Link to="/app">
              <TextButton withChevron>Open Action Centre</TextButton>
            </Link>
          </div>

          <div className="mt-8 space-y-2">
            <div className="bg-surface-solid rounded-card border border-hairline p-4 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-danger" />
                <span className="text-xs font-medium text-text">Follow up with CEO on wire</span>
              </div>
              <Badge variant="danger" size="sm">Urgent</Badge>
            </div>
            <div className="bg-surface-solid rounded-card border border-hairline p-4 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-warning" />
                <span className="text-xs font-medium text-text">Verify purchase order code</span>
              </div>
              <Badge variant="warning" size="sm">High</Badge>
            </div>
          </div>
        </div>

        {/* Tile 2: Aging at a glance */}
        <div className="bg-bg-grouped rounded-[28px] border border-hairline p-8 flex flex-col justify-between hover:shadow-float hover:-translate-y-1 transition-all duration-300">
          <div className="space-y-3">
            <h3 className="text-2xl font-semibold tracking-tight text-text">Aging at a glance</h3>
            <p className="text-sm text-text-2 leading-relaxed">
              Standard 0-30, 31-60, 61-90 and 90+ day aging buckets computed without polling bugs.
            </p>
            <Link to="/app/dashboard">
              <TextButton withChevron>View Overview</TextButton>
            </Link>
          </div>

          <div className="mt-8 bg-surface-solid rounded-card border border-hairline p-5 shadow-sm space-y-3">
            <div className="flex justify-between text-xs text-text-2 font-medium">
              <span>Aging Breakdown</span>
              <span className="text-text font-semibold">₹1,75,000 total</span>
            </div>
            <div className="h-3.5 w-full rounded-pill overflow-hidden flex bg-bg-grouped border border-hairline">
              <div className="bg-success h-full w-[45%]" title="Current (0-30d)" />
              <div className="bg-warning h-full w-[30%]" title="31-60d" />
              <div className="bg-danger/80 h-full w-[15%]" title="61-90d" />
              <div className="bg-danger h-full w-[10%]" title="90+d" />
            </div>
            <div className="flex justify-between text-[11px] text-text-3 pt-1">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> 0-30d</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" /> 31-60d</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger" /> 60d+</span>
            </div>
          </div>
        </div>

        {/* Tile 3: Promise reliability */}
        <div className="bg-bg-grouped rounded-[28px] border border-hairline p-8 flex flex-col justify-between hover:shadow-float hover:-translate-y-1 transition-all duration-300">
          <div className="space-y-3">
            <h3 className="text-2xl font-semibold tracking-tight text-text">Promise reliability</h3>
            <p className="text-sm text-text-2 leading-relaxed">
              Know who actually pays when they say they will, derived from audited transaction histories.
            </p>
            <Link to="/app/clients">
              <TextButton withChevron>Explore Clients</TextButton>
            </Link>
          </div>

          <div className="mt-8 bg-surface-solid rounded-card border border-hairline p-5 shadow-sm flex items-center gap-6">
            <Ring size="lg" color="#34C759" pulse={false} />
            <div className="flex-1 space-y-1">
              <Meter value={88} label="Average Payer Reliability" valueLabel="88%" variant="success" />
              <div className="text-[11px] text-text-3">14 promises kept · 2 missed</div>
            </div>
          </div>
        </div>

        {/* Tile 4: Import in seconds */}
        <div className="bg-bg-grouped rounded-[28px] border border-hairline p-8 flex flex-col justify-between hover:shadow-float hover:-translate-y-1 transition-all duration-300">
          <div className="space-y-3">
            <h3 className="text-2xl font-semibold tracking-tight text-text">Import in seconds</h3>
            <p className="text-sm text-text-2 leading-relaxed">
              Batch ingest existing invoices from CSV or JSON with validation and row-level error reporting.
            </p>
            <Link to="/app/import">
              <TextButton withChevron>Start Import</TextButton>
            </Link>
          </div>

          <div className="mt-8 bg-surface-solid rounded-card border border-hairline p-5 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-tint/10 flex items-center justify-center text-tint">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-text">invoices_q4.csv</div>
                <div className="text-[11px] text-text-3">15 invoices parsed · 0 errors</div>
              </div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-success" />
          </div>
        </div>
      </div>
    </section>
  )
}
