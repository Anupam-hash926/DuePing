import { useSettings } from '../api/hooks/useQueries'

/**
 * Returns the configured default currency code (e.g. 'INR', 'USD', 'GBP'),
 * falling back to 'INR' until settings have loaded.
 */
export function useDefaultCurrency(): string {
  const { data } = useSettings()
  return data?.default_currency ?? 'INR'
}
