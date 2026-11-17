import React from 'react'
import { Link } from 'react-router-dom'
import { PingMark } from '../../ui/PingMark'
import { Button } from '../../ui/Button'
import { Loader } from './Loader'
import { Hero } from './Hero'
import { PinnedStory } from './PinnedStory'
import { Tiles } from './Tiles'
import { SplitWordStatement } from './SplitWordStatement'
import { UnderTheHood } from './UnderTheHood'
import { Closing } from './Closing'
import { Footer } from './Footer'

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans selection:bg-tint/20 selection:text-tint">
      {/* Session Loader Moment */}
      <Loader onComplete={() => {}} />

      {/* Frosted Minimal Landing Top Bar */}
      <header className="sticky top-0 z-30 w-full glass hairline-b select-none">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <PingMark size="sm" pulse={false} />
            <span className="font-semibold tracking-tight text-text group-hover:opacity-80 transition-opacity">
              DuePing
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/app">
              <Button size="sm" variant="secondary" className="h-8 text-xs px-3">
                Open App
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Sections */}
      <main className="flex-1 w-full space-y-8">
        <Hero />
        <PinnedStory />
        <Tiles />
        <SplitWordStatement />
        <UnderTheHood />
        <Closing />
      </main>

      <Footer />
    </div>
  )
}

export default LandingPage
