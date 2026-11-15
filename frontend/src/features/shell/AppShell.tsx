import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { NavBar } from './NavBar'
import { TabBar } from './TabBar'
import { CommandPalette } from './CommandPalette'

export interface AppShellProps {
  children?: React.ReactNode
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [paletteOpen, setPaletteOpen] = useState(false)

  return (
    <div className="min-h-screen bg-bg-grouped text-text flex flex-col font-sans transition-colors">
      <NavBar onOpenCommandPalette={() => setPaletteOpen(true)} />

      <main className="flex-1 w-full max-w-[1100px] mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 pb-24 md:pb-12">
        {children ?? <Outlet />}
      </main>

      <TabBar />

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}
