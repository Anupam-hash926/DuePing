import React from 'react'

interface StripCard {
  meta: string
  status: string
  color: string
}

const STRIP_CARDS: StripCard[] = [
  { meta: 'Blocker · missing PO', status: 'PO number pending internal sign-off', color: '#FF9500' },
  { meta: 'Promise · missed 12 Nov', status: 'Wire did not arrive by cutoff', color: '#FF3B30' },
  { meta: 'Reminder · firm', status: 'Second notice referencing missing PO', color: '#007AFF' },
  { meta: 'Paid · on time', status: 'Full ₹75,000 settled via bank transfer', color: '#34C759' },
  { meta: 'Dispute · milestone', status: 'Deliverable sign-off in progress', color: '#5856D6' },
  { meta: 'Follow-up · call', status: 'Spoke with CFO; approved payout', color: '#5AC8FA' },
]

export const SplitWordStatement: React.FC = () => {
  return (
    <section className="py-24 space-y-16 overflow-hidden">
      {/* Giant Stacked Lando Typography */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center sm:text-left space-y-2 select-none">
        <h2 className="text-4xl sm:text-6xl md:text-8xl font-extralight tracking-tight text-text leading-none">
          Every <span className="font-semibold text-text">invoice.</span>
        </h2>
        <h2 className="text-4xl sm:text-6xl md:text-8xl font-extralight tracking-tight text-text leading-none">
          One <span className="font-semibold bg-gradient-to-r from-teal to-tint bg-clip-text text-transparent">next step.</span>
        </h2>
      </div>

      {/* Horizontal Caption Strip (scrollable on mobile, flex on desktop) */}
      <div
        className="w-full overflow-x-auto no-scrollbar px-4 sm:px-6"
        tabIndex={0}
        role="region"
        aria-label="Workflow examples strip"
      >
        <div className="flex gap-4 min-w-max pb-4 mx-auto max-w-6xl">
          {STRIP_CARDS.map((card, idx) => (
            <div
              key={idx}
              className="bg-surface-solid rounded-card border border-hairline p-4 w-64 shadow-sm flex flex-col justify-between gap-3 flex-shrink-0"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: card.color }} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-3">
                  {card.meta}
                </span>
              </div>
              <p className="text-xs text-text font-medium leading-snug">{card.status}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
