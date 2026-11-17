import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { isReducedMotion, springPresets } from '../lib/motion'

export interface ProgressRingProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number // 0 to 100
  score?: number // Alias for value
  size?: 'sm' | 'md' | 'lg' | number
  strokeWidth?: number
  color?: string
  label?: React.ReactNode
  ariaLabel?: string
}

export function getReliabilityColor(score: number): string {
  if (score >= 80) return 'var(--fill-green)'
  if (score >= 50) return 'var(--fill-amber)'
  return 'var(--fill-red)'
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  score,
  size = 'md',
  strokeWidth = 3.5,
  color,
  label,
  ariaLabel,
  className,
  ...props
}) => {
  const pixelSize = typeof size === 'number'
    ? size
    : { sm: 24, md: 40, lg: 64 }[size] ?? 40

  const rawScore = score ?? value ?? 0
  const clamped = Math.max(0, Math.min(100, Math.round(rawScore)))
  const effectiveColor = color ?? getReliabilityColor(clamped)
  const defaultAriaLabel = ariaLabel ?? `Reliability score: ${clamped}%`

  const center = pixelSize / 2
  const radius = Math.max(0, (pixelSize - strokeWidth) / 2)
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (clamped / 100) * circumference

  const reduced = isReducedMotion()

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={defaultAriaLabel}
      className={cn('relative inline-flex items-center justify-center flex-shrink-0 select-none', className)}
      style={{ width: pixelSize, height: pixelSize }}
      {...props}
    >
      <svg
        width={pixelSize}
        height={pixelSize}
        className="-rotate-90 origin-center"
      >
        {/* Background Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-hairline opacity-40"
        />
        {/* Animated Progress Arc */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={effectiveColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={reduced ? { duration: 0 } : springPresets.gentle}
        />
      </svg>

      {/* Optional Center Label */}
      {label && (
        <span
          className="absolute inset-0 flex items-center justify-center font-semibold text-text"
          style={{ fontSize: pixelSize <= 32 ? '9px' : pixelSize <= 48 ? '11px' : '14px' }}
        >
          {label}
        </span>
      )}
    </div>
  )
}
