import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertOctagon, ArrowRight } from 'lucide-react'
import { Badge } from '../../ui/Badge'
import { ChatBubble } from '../../ui/ChatBubble'
import { SegmentedControl } from '../../ui/SegmentedControl'
import { Meter } from '../../ui/Meter'
import { MoneyText } from '../../ui/MoneyText'

const BEATS = [
  {
    id: 1,
    title: 'Find the cause.',
    caption: 'Late payment is a symptom. The blocker is the cause.',
    details: 'Instead of linear time nagging, DuePing structures the exact administrative or operational friction halting payment.',
  },
  {
    id: 2,
    title: 'Get the next move.',
    caption: 'Playbooks generate recovery actions automatically.',
    details: 'When a blocker is raised, the resolution playbook assigns concrete, targeted steps directly to the responsible person.',
  },
  {
    id: 3,
    title: 'Hold the promise.',
    caption: 'Empirical reliability scores track broken commitments.',
    details: 'When clients promise payout dates, DuePing verifies them on daily checks. Breached promises dynamically penalize credit reliability.',
  },
  {
    id: 4,
    title: 'Say the right thing.',
    caption: 'Adaptive reminder copy calibrated to urgency.',
    details: 'Dynamic reminders reference the exact blocker and promise timelines, escalating appropriately from polite to firm or final notice.',
  },
]

export const PinnedStory: React.FC = () => {
  const [activeBeat, setActiveBeat] = useState(0)
  const [tone, setTone] = useState('FIRM')

  const beat = BEATS[activeBeat]

  return (
    <section id="story" className="py-24 px-4 sm:px-6 max-w-6xl mx-auto space-y-12">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-tint">Resolution-First Architecture</span>
        <h2 className="text-title-large text-text font-light">How DuePing Works</h2>
        <p className="text-sm text-text-2">
          Step through the four-stage recovery pipeline from root cause discovery to successful collection.
        </p>
      </div>

      {/* Beat selector buttons */}
      <div className="flex justify-center gap-2 flex-wrap">
        {BEATS.map((b, idx) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setActiveBeat(idx)}
            className={`px-4 py-2 rounded-pill text-xs font-medium transition-all ${
              activeBeat === idx
                ? 'bg-tint text-white shadow-sm'
                : 'bg-surface-solid text-text-2 border border-hairline hover:bg-bg-grouped'
            }`}
          >
            {b.id}. {b.title}
          </button>
        ))}
      </div>

      {/* Interactive Story Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-surface-solid rounded-sheet border border-hairline p-6 sm:p-10 shadow-float">
        {/* Left Column: Narrative */}
        <div className="space-y-4">
          <span className="text-xs uppercase font-semibold tracking-wider text-text-3">Beat 0{beat.id} / 04</span>
          <h3 className="text-3xl sm:text-4xl font-light tracking-tight text-text leading-tight">
            {beat.title}
          </h3>
          <p className="text-base text-text font-medium leading-snug">{beat.caption}</p>
          <p className="text-sm text-text-2 leading-relaxed">{beat.details}</p>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              disabled={activeBeat === 0}
              onClick={() => setActiveBeat((prev) => Math.max(0, prev - 1))}
              className="px-3 py-1.5 text-xs rounded-pill border border-hairline disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={activeBeat === BEATS.length - 1}
              onClick={() => setActiveBeat((prev) => Math.min(BEATS.length - 1, prev + 1))}
              className="px-3 py-1.5 text-xs rounded-pill bg-bg-grouped font-medium disabled:opacity-40 inline-flex items-center gap-1"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Column: Animated UI Mock Per Beat */}
        <div className="glass rounded-card border border-hairline p-6 min-h-[320px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {activeBeat === 0 && (
              <motion.div
                key="beat-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between border-b border-hairline pb-2">
                  <span className="text-xs font-semibold text-text">Invoice INV-OL-07</span>
                  <MoneyText amount="45000" currency="INR" />
                </div>
                <div className="space-y-2">
                  <span className="text-[11px] text-text-3 uppercase tracking-wider block">Identified Blockers</span>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="warning" dot>Missing PO</Badge>
                    <Badge variant="danger" dot>Awaiting Approval</Badge>
                    <Badge variant="neutral" dot>Disputed Amount</Badge>
                  </div>
                </div>
                <p className="text-xs text-text-2 pt-2">
                  The client has not paid because procurement never issued the purchase order code.
                </p>
              </motion.div>
            )}

            {activeBeat === 1 && (
              <motion.div
                key="beat-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-xs text-tint font-semibold">
                  <AlertOctagon className="w-4 h-4 text-warning" />
                  <span>Missing PO Resolution Playbook</span>
                </div>
                <div className="p-4 bg-bg-grouped rounded-card border border-hairline space-y-2">
                  <div className="text-xs uppercase tracking-wider text-text-3 font-semibold">Next Action Assigned</div>
                  <div className="text-sm font-medium text-text">
                    Ask client procurement to issue PO number; follow up with billing dept before wire cutoff.
                  </div>
                  <div className="text-xs text-text-2">Priority: High · Assigned to: Account Manager</div>
                </div>
              </motion.div>
            )}

            {activeBeat === 2 && (
              <motion.div
                key="beat-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between border-b border-hairline pb-2">
                  <span className="text-xs font-semibold text-text">Client Reliability Audit</span>
                  <Badge variant="danger" dot>Promise Missed</Badge>
                </div>
                <div className="space-y-2">
                  <Meter value={50} label="Empirical Reliability Score" valueLabel="50%" variant="danger" />
                  <p className="text-xs text-text-2 pt-2">
                    Promised payment date of 12 Nov expired without incoming transfer. Risk rating updated to Medium.
                  </p>
                </div>
              </motion.div>
            )}

            {activeBeat === 3 && (
              <motion.div
                key="beat-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between border-b border-hairline pb-2">
                  <span className="text-xs font-semibold text-text">Tone Calibration</span>
                  <SegmentedControl
                    size="sm"
                    value={tone}
                    onChange={setTone}
                    options={[
                      { value: 'POLITE', label: 'Polite' },
                      { value: 'FIRM', label: 'Firm' },
                      { value: 'FINAL', label: 'Final' },
                    ]}
                  />
                </div>
                <ChatBubble
                  sender="me"
                  toneBadge={tone}
                  message={
                    tone === 'POLITE'
                      ? 'Gentle reminder that invoice INV-OL-07 was due yesterday. Could you let us know if PO approval has completed?'
                      : tone === 'FIRM'
                      ? 'Following up on invoice INV-OL-07 (₹45,000). The promised date of 12 Nov has lapsed. Please share the UTR reference today.'
                      : 'FINAL NOTICE: Outstanding invoice INV-OL-07 is 14 days overdue following broken payment commitments. Account will escalate to legal review on Monday.'
                  }
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
