import React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../lib/cn'

export interface TabItem {
  value: string
  label: React.ReactNode
  icon?: React.ReactNode
  content: React.ReactNode
}

export interface TabsProps {
  tabs: TabItem[]
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  className?: string
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultValue,
  value,
  onValueChange,
  className,
}) => {
  return (
    <TabsPrimitive.Root
      defaultValue={defaultValue ?? tabs[0]?.value}
      value={value}
      onValueChange={onValueChange}
      className={cn('w-full', className)}
    >
      <TabsPrimitive.List className="inline-flex items-center gap-1 bg-bg-grouped p-1 rounded-pill border border-hairline mb-4">
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.value}
            value={tab.value}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-pill text-xs font-medium text-text-2 transition-all data-[state=active]:bg-surface-solid data-[state=active]:text-text data-[state=active]:shadow-sm outline-none"
          >
            {tab.icon}
            <span>{tab.label}</span>
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      {tabs.map((tab) => (
        <TabsPrimitive.Content key={tab.value} value={tab.value} className="outline-none">
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  )
}
