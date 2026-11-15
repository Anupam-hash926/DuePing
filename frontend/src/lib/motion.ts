import type { Transition } from 'framer-motion'

export const springPresets = {
  default: { type: 'spring', stiffness: 400, damping: 30 } as Transition,
  snappy: { type: 'spring', stiffness: 500, damping: 35 } as Transition,
  gentle: { type: 'spring', stiffness: 220, damping: 24 } as Transition,
  bouncy: { type: 'spring', stiffness: 350, damping: 18 } as Transition,
}

export function isReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
