import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * 1000, // 15 seconds
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export const queryKeys = {
  invoices: (filters?: Record<string, unknown>) => ['invoices', filters ?? {}] as const,
  invoice: (id: string) => ['invoice', id] as const,
  clients: () => ['clients'] as const,
  client: (id: string) => ['client', id] as const,
  actionCenter: (strategy?: string) => ['action-center', strategy ?? 'DEFAULT'] as const,
  dashboard: () => ['dashboard'] as const,
  audit: (invoiceId?: string) => ['audit', invoiceId ?? 'all'] as const,
  notifications: (unreadOnly?: boolean) => ['notifications', unreadOnly ?? false] as const,
  today: () => ['today'] as const,
  settings: () => ['settings'] as const,
  failures: () => ['failures'] as const,
}

export function invalidateInvoiceDependencies(client: QueryClient, invoiceId?: string) {
  if (invoiceId) {
    client.invalidateQueries({ queryKey: queryKeys.invoice(invoiceId) })
  }
  client.invalidateQueries({ queryKey: ['invoices'] })
  client.invalidateQueries({ queryKey: ['action-center'] })
  client.invalidateQueries({ queryKey: ['dashboard'] })
  client.invalidateQueries({ queryKey: ['notifications'] })
  client.invalidateQueries({ queryKey: ['audit'] })
}

export function invalidateEverything(client: QueryClient) {
  client.invalidateQueries()
}
