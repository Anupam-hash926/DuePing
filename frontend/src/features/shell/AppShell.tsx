import React, { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { NavBar } from './NavBar'
import { TabBar } from './TabBar'
import { CommandPalette } from './CommandPalette'
import { isReducedMotion } from '../../lib/motion'

export interface AppShellProps {
  children?: React.ReactNode
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const location = useLocation()
  const reducedMotion = isReducedMotion()

  return (
    <div className="min-h-screen bg-bg-grouped text-text flex flex-col font-sans transition-colors">
      {/* Skip to Content for Keyboard & Screen Reader Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-tint focus:text-white focus:rounded-full focus:shadow-float font-medium text-sm transition-all outline-none"
      >
        Skip to main content
      </a>

      <NavBar onOpenCommandPalette={() => setPaletteOpen(true)} />

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 w-full max-w-[1100px] mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 pb-24 md:pb-12 outline-none"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {children ?? <Outlet />}
          </motion.div>
        </AnimatePresence>
      </main>

      <TabBar />

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}
