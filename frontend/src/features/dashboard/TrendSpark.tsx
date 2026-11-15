import React from 'react'
import type { TrendPointRead } from '../../api/types'
import { formatMoney } from '../../lib/format'

interface TrendSparkProps {
  points: TrendPointRead[]
}

export const TrendSpark: React.FC<TrendSparkProps> = ({ points }) => {
  if (points.length === 0) return null

  const height = 140
  const width = 480
  const paddingX = 24
  const paddingY = 24

  const values = points.map((p) => parseFloat(p.collected.amount || '0'))
  const maxVal = Math.max(...values, 100)
  const minVal = Math.min(...values, 0)
  const range = maxVal - minVal || 1

  const coords = points.map((p, i) => {
    const x = paddingX + (i / Math.max(1, points.length - 1)) * (width - 2 * paddingX)
    const val = parseFloat(p.collected.amount || '0')
    const y = height - paddingY - ((val - minVal) / range) * (height - 2 * paddingY)
    return { x, y, month: p.month, val, formatted: formatMoney(p.collected) }
  })

  // Line path
  const linePath = coords.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`
  }, '')

  // Area path (closed at baseline)
  const baselineY = height - paddingY
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${baselineY} L ${coords[0].x} ${baselineY} Z`

  const lastPoint = coords[coords.length - 1]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-3 px-1">
          Collection Trend (6 Months)
        </h3>
        {lastPoint && (
          <span className="text-xs font-semibold text-tint">
            Latest: {lastPoint.formatted}
          </span>
        )}
      </div>

      <div className="w-full bg-surface-solid rounded-[24px] border border-hairline p-4 overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-36 overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#007AFF" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#007AFF" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Baseline */}
          <line
            x1={paddingX}
            y1={baselineY}
            x2={width - paddingX}
            y2={baselineY}
            stroke="var(--hairline)"
            strokeWidth="1"
          />

          {/* Area fill */}
          <path d={areaPath} fill="url(#trendGradient)" />

          {/* Smooth line */}
          <path
            d={linePath}
            fill="none"
            stroke="#007AFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* End dot */}
          {lastPoint && (
            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r="4.5"
              fill="#007AFF"
              stroke="var(--surface-solid)"
              strokeWidth="2"
            />
          )}

          {/* Month labels */}
          {coords.map((pt, i) => (
            <text
              key={i}
              x={pt.x}
              y={height - 6}
              textAnchor="middle"
              className="fill-text-3 text-[10px] font-sans"
            >
              {pt.month}
            </text>
          ))}
        </svg>
      </div>
    </div>
  )
}
