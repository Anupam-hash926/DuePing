import { MoneyDTO } from '../api/types'

/**
 * Format monetary amounts with currency symbol / code.
 * Follows Money.format() specification: ₹ for INR, code for others.
 */
export function formatMoney(
  value: MoneyDTO | string | number | null | undefined,
  fallbackCurrency = 'INR'
): string {
  if (value === null || value === undefined) {
    return '—'
  }

  let amountStr = '0.00'
  let currency = fallbackCurrency

  if (typeof value === 'object' && 'amount' in value && 'currency' in value) {
    amountStr = value.amount
    currency = value.currency
  } else if (typeof value === 'number') {
    amountStr = value.toFixed(2)
  } else if (typeof value === 'string') {
    amountStr = value
  }

  const num = parseFloat(amountStr)
  if (isNaN(num)) {
    return '—'
  }

  const formattedNum = num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  if (currency === 'INR') {
    return `₹${formattedNum}`
  }
  return `${currency} ${formattedNum}`
}

/**
 * Format ISO date string (YYYY-MM-DD) into readable date.
 */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  try {
    // Treat date-only string as local date without UTC shifts
    const parts = dateStr.split('T')[0].split('-')
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1
      const day = parseInt(parts[2], 10)
      const d = new Date(year, month, day)
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).replace(/\bSept\b/g, 'Sep')
    }
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).replace(/\bSept\b/g, 'Sep')
  } catch {
    return dateStr
  }
}

/**
 * Format ISO datetime string into readable date and time.
 */
export function formatDateTime(dateTimeStr?: string | null): string {
  if (!dateTimeStr) return '—'
  try {
    const d = new Date(dateTimeStr)
    return d.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(/\bSept\b/g, 'Sep')
  } catch {
    return dateTimeStr
  }
}
