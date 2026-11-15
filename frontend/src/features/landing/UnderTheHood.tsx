import React from 'react'
import { ArrowRight, Layers, Shuffle, Bell, FileCode, Cpu, ShieldCheck } from 'lucide-react'

interface PatternItem {
  name: string
  purpose: string
  icon: React.ComponentType<{ className?: string }>
}

const PATTERNS: PatternItem[] = [
  { name: 'State Pattern', purpose: 'Enforces strictly valid command-driven lifecycle transitions without polling.', icon: Layers },
  { name: 'Strategy Pattern', purpose: 'Selects optimal recovery playbooks and ranks invoices by urgency or cash value.', icon: Shuffle },
  { name: 'Observer Pattern', purpose: 'Dispatches in-process domain events to decouple audits, tasks, and alerts.', icon: Bell },
  { name: 'Template Method', purpose: 'Assembles context-aware communication templates across escalation tones.', icon: FileCode },
  { name: 'Adapter + CoR', purpose: 'Parses multi-format invoice files through chained schema parsers.', icon: Cpu },
  { name: 'Facade + Repository', purpose: 'Provides a unified API surface and isolates aggregate roots from SQL storage.', icon: ShieldCheck },
]

export const UnderTheHood: React.FC = () => {
  return (
    <section className="py-20 px-4 sm:px-6 max-w-6xl mx-auto space-y-12">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-purple">Under The Hood</span>
        <h2 className="text-title-large text-text font-light">Engineered with OOAD Rigor</h2>
        <p className="text-sm text-text-2">
          DuePing models real business domain problems using battle-tested object-oriented design patterns.
        </p>
      </div>

      {/* 6 Design Pattern Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {PATTERNS.map((p) => {
          const Icon = p.icon
          return (
            <div
              key={p.name}
              className="bg-surface-solid rounded-card border border-hairline p-5 shadow-sm space-y-2.5"
            >
              <div className="flex items-center gap-2.5 text-tint">
                <Icon className="w-4 h-4" />
                <h3 className="text-sm font-semibold text-text">{p.name}</h3>
              </div>
              <p className="text-xs text-text-2 leading-relaxed">{p.purpose}</p>
            </div>
          )
        })}
      </div>

      {/* Minimal Event Flow Diagram */}
      <div className="bg-bg-grouped rounded-[24px] border border-hairline p-6 sm:p-8 space-y-4">
        <div className="text-xs uppercase font-semibold tracking-wider text-text-3 text-center sm:text-left">
          Synchronous Event Architecture
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs select-none">
          <div className="bg-surface-solid border border-hairline rounded-pill px-4 py-2 font-medium text-text shadow-sm w-full sm:w-auto text-center">
            Domain Event
          </div>

          <ArrowRight className="w-4 h-4 text-text-3 hidden sm:block flex-shrink-0" />
          <span className="sm:hidden text-text-3 text-xs">↓</span>

          <div className="bg-tint/10 border border-tint/20 rounded-pill px-4 py-2 font-semibold text-tint shadow-sm w-full sm:w-auto text-center">
            EventBus (Subject)
          </div>

          <ArrowRight className="w-4 h-4 text-text-3 hidden sm:block flex-shrink-0" />
          <span className="sm:hidden text-text-3 text-xs">↓</span>

          <div className="bg-surface-solid border border-hairline rounded-pill px-4 py-2 font-medium text-text shadow-sm w-full sm:w-auto text-center">
            Observers & Listeners
          </div>

          <ArrowRight className="w-4 h-4 text-text-3 hidden sm:block flex-shrink-0" />
          <span className="sm:hidden text-text-3 text-xs">↓</span>

          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <span className="bg-bg rounded-pill border border-hairline px-2.5 py-1 text-[11px] text-text-2">Next Actions</span>
            <span className="bg-bg rounded-pill border border-hairline px-2.5 py-1 text-[11px] text-text-2">Audit Log</span>
            <span className="bg-bg rounded-pill border border-hairline px-2.5 py-1 text-[11px] text-text-2">Notifications</span>
          </div>
        </div>
      </div>
    </section>
  )
}
