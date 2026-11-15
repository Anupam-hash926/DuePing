import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../ui/Button'
import { SegmentedControl } from '../ui/SegmentedControl'
import { Stat } from '../ui/Stat'
import { formatMoney, formatDate, formatDateTime } from '../lib/format'
import * as motion from '../lib/motion'

describe('Button', () => {
  it('renders correctly and handles click', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click Me</Button>)

    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('disables interactions when disabled is true', () => {
    const handleClick = vi.fn()
    render(<Button disabled onClick={handleClick}>Disabled</Button>)

    const button = screen.getByRole('button', { name: /disabled/i })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('shows loading spinner and disables clicks when loading is true', () => {
    const handleClick = vi.fn()
    render(<Button loading onClick={handleClick}>Save Changes</Button>)

    const button = screen.getByRole('button', { name: /save changes/i })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })
})

describe('SegmentedControl', () => {
  const options = [
    { value: 'tab1', label: 'Tab 1' },
    { value: 'tab2', label: 'Tab 2' },
    { value: 'tab3', label: 'Tab 3' },
  ]

  it('renders tablist and tabs with correct accessibility attributes', () => {
    render(<SegmentedControl value="tab1" onChange={vi.fn()} options={options} />)

    const tablist = screen.getByRole('tablist')
    expect(tablist).toBeInTheDocument()

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onChange when clicking a tab', () => {
    const handleChange = vi.fn()
    render(<SegmentedControl value="tab1" onChange={handleChange} options={options} />)

    const tabs = screen.getAllByRole('tab')
    fireEvent.click(tabs[1])
    expect(handleChange).toHaveBeenCalledWith('tab2')
  })

  it('supports arrow key navigation (ArrowRight, ArrowLeft, Home, End)', () => {
    const handleChange = vi.fn()
    render(<SegmentedControl value="tab1" onChange={handleChange} options={options} />)

    const tabs = screen.getAllByRole('tab')
    // Arrow Right from 1st tab
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' })
    expect(handleChange).toHaveBeenCalledWith('tab2')

    // Arrow Left from 1st tab loops to last tab
    fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' })
    expect(handleChange).toHaveBeenCalledWith('tab3')

    // Home goes to first tab
    fireEvent.keyDown(tabs[2], { key: 'Home' })
    expect(handleChange).toHaveBeenCalledWith('tab1')

    // End goes to last tab
    fireEvent.keyDown(tabs[0], { key: 'End' })
    expect(handleChange).toHaveBeenCalledWith('tab3')
  })
})

describe('Stat & useCountUp', () => {
  it('renders label and static value', () => {
    render(<Stat label="Open Actions" value="12" />)
    expect(screen.getByText('Open Actions')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('renders money values using formatMoney', () => {
    render(<Stat label="Revenue" value={50000} isMoney currency="INR" />)
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    // Should format with ₹
    expect(screen.getByText(/₹/)).toBeInTheDocument()
  })

  it('handles reduced motion path instantaneously', () => {
    const spy = vi.spyOn(motion, 'isReducedMotion').mockReturnValue(true)
    render(<Stat label="Target" value={100} />)
    expect(screen.getByText('100')).toBeInTheDocument()
    spy.mockRestore()
  })
})

describe('format utilities', () => {
  it('formats monetary amounts with correct symbol and code', () => {
    expect(formatMoney(null)).toBe('—')
    expect(formatMoney(undefined)).toBe('—')
    expect(formatMoney(0, 'INR')).toBe('₹0.00')
    expect(formatMoney(15000, 'INR')).toBe('₹15,000.00')
    expect(formatMoney({ amount: '2500.50', currency: 'USD' })).toBe('USD 2,500.50')
    expect(formatMoney('invalid')).toBe('—')
  })

  it('formats ISO dates correctly into readable UK English dates', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('2026-03-01')).toBe('1 Mar 2026')
    expect(formatDate('2026-11-15')).toBe('15 Nov 2026')
  })

  it('formats datetimes correctly', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime('2026-03-01T14:30:00Z')).toMatch(/1 Mar 2026/)
  })
})
