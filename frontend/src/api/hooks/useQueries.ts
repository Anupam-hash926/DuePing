import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../client'
import { queryKeys } from '../queryClient'
import type {
  InvoiceSummaryRead,
  InvoiceRead,
  ClientRead,
  ClientSummaryRead,
  ActionCenterRead,
  CollectionReportRead,
  AuditEventRead,
  NotificationRead,
  SimulatedDateRead,
  SettingsRead,
  HandlerFailureRead,
} from '../types'

export function useInvoices(filters?: { status?: string; client_id?: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.client_id) params.set('client_id', filters.client_id)
  if (filters?.limit) params.set('limit', String(filters.limit))
  if (filters?.offset) params.set('offset', String(filters.offset))
  const queryStr = params.toString() ? `?${params.toString()}` : ''

  return useQuery({
    queryKey: queryKeys.invoices(filters),
    queryFn: () => apiClient.get<InvoiceSummaryRead[]>(`/invoices${queryStr}`),
  })
}

export function useInvoice(id?: string) {
  return useQuery({
    queryKey: queryKeys.invoice(id ?? ''),
    queryFn: () => apiClient.get<InvoiceRead>(`/invoices/${id}`),
    enabled: Boolean(id),
  })
}

export function useClients() {
  return useQuery({
    queryKey: queryKeys.clients(),
    queryFn: () => apiClient.get<ClientRead[]>('/clients'),
  })
}

export function useClient(id?: string) {
  return useQuery({
    queryKey: queryKeys.client(id ?? ''),
    queryFn: () => apiClient.get<ClientSummaryRead>(`/clients/${id}`),
    enabled: Boolean(id),
  })
}

export function useActionCenter(strategy?: string) {
  const queryStr = strategy ? `?strategy=${encodeURIComponent(strategy)}` : ''
  return useQuery({
    queryKey: queryKeys.actionCenter(strategy),
    queryFn: () => apiClient.get<ActionCenterRead>(`/action-center${queryStr}`),
  })
}

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard(),
    queryFn: () => apiClient.get<CollectionReportRead>('/reports/dashboard'),
  })
}

export function useAudit(invoiceId?: string) {
  const queryStr = invoiceId ? `?invoice_id=${encodeURIComponent(invoiceId)}` : ''
  return useQuery({
    queryKey: queryKeys.audit(invoiceId),
    queryFn: () => apiClient.get<AuditEventRead[]>(`/audit-log${queryStr}`),
  })
}

export function useNotifications(unreadOnly = false) {
  return useQuery({
    queryKey: queryKeys.notifications(unreadOnly),
    queryFn: () => apiClient.get<NotificationRead[]>(`/notifications?unread_only=${unreadOnly}`),
  })
}

export function useToday() {
  return useQuery({
    queryKey: queryKeys.today(),
    queryFn: () => apiClient.get<SimulatedDateRead>('/system/today'),
  })
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings(),
    queryFn: () => apiClient.get<SettingsRead>('/system/settings'),
  })
}

export function useFailures() {
  return useQuery({
    queryKey: queryKeys.failures(),
    queryFn: () => apiClient.get<HandlerFailureRead[]>('/system/failures'),
  })
}
