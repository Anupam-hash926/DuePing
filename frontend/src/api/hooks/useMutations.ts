import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import { invalidateInvoiceDependencies, invalidateEverything } from '../queryClient'
import type {
  InvoiceRead,
  PaymentCreate,
  BlockerCreate,
  BlockerPatch,
  PromiseCreate,
  FollowUpCreate,
  DocumentCreate,
  NextActionCreate,
  NextActionReschedule,
  InvoiceWriteOff,
  ReminderRead,
  ReminderSentCreate,
  DailyCheckSummaryRead,
  SimulatedDateRead,
  SimulatedDateUpdate,
  ImportResultRead,
  InvoiceCreate,
  ClientCreate,
  ClientRead,
  ClientUpdate,
  SuccessResponse,
} from '../types'

export function useRecordPayment(invoiceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PaymentCreate) => apiClient.post<InvoiceRead>(`/invoices/${invoiceId}/payments`, body),
    onSuccess: () => invalidateInvoiceDependencies(qc, invoiceId),
  })
}

export function useRaiseBlocker(invoiceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BlockerCreate) => apiClient.post<InvoiceRead>(`/invoices/${invoiceId}/blockers`, body),
    onSuccess: () => invalidateInvoiceDependencies(qc, invoiceId),
  })
}

export function useResolveBlocker(invoiceId: string, blockerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BlockerPatch) =>
      apiClient.post<InvoiceRead>(`/invoices/${invoiceId}/blockers/${blockerId}/resolve`, body),
    onSuccess: () => invalidateInvoiceDependencies(qc, invoiceId),
  })
}

export function useRecordPromise(invoiceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PromiseCreate) => apiClient.post<InvoiceRead>(`/invoices/${invoiceId}/promises`, body),
    onSuccess: () => invalidateInvoiceDependencies(qc, invoiceId),
  })
}

export function useLogFollowUp(invoiceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: FollowUpCreate) => apiClient.post<InvoiceRead>(`/invoices/${invoiceId}/follow-ups`, body),
    onSuccess: () => invalidateInvoiceDependencies(qc, invoiceId),
  })
}

export function useAttachDocument(invoiceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: DocumentCreate) =>
      apiClient.post<InvoiceRead>(`/invoices/${invoiceId}/documents`, body),
    onSuccess: () => invalidateInvoiceDependencies(qc, invoiceId),
  })
}

export function useCreateAction(invoiceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: NextActionCreate) => apiClient.post<InvoiceRead>(`/invoices/${invoiceId}/actions`, body),
    onSuccess: () => invalidateInvoiceDependencies(qc, invoiceId),
  })
}

export function useCompleteAction(invoiceId: string, actionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post<InvoiceRead>(`/invoices/${invoiceId}/actions/${actionId}/complete`),
    onSuccess: () => invalidateInvoiceDependencies(qc, invoiceId),
  })
}

export function useCompleteAnyAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ invoiceId, actionId }: { invoiceId: string; actionId: string }) =>
      apiClient.post<InvoiceRead>(`/invoices/${invoiceId}/actions/${actionId}/complete`),
    onSuccess: (_, vars) => invalidateInvoiceDependencies(qc, vars.invoiceId),
  })
}

export function useRescheduleAction(invoiceId: string, actionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: NextActionReschedule) =>
      apiClient.post<InvoiceRead>(`/invoices/${invoiceId}/actions/${actionId}/reschedule`, body),
    onSuccess: () => invalidateInvoiceDependencies(qc, invoiceId),
  })
}

export function useRescheduleAnyAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ invoiceId, actionId, newDate }: { invoiceId: string; actionId: string; newDate: string }) =>
      apiClient.post<InvoiceRead>(`/invoices/${invoiceId}/actions/${actionId}/reschedule`, { new_date: newDate }),
    onSuccess: (_, vars) => invalidateInvoiceDependencies(qc, vars.invoiceId),
  })
}

export function useSendInvoice(invoiceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post<InvoiceRead>(`/invoices/${invoiceId}/send`),
    onSuccess: () => invalidateInvoiceDependencies(qc, invoiceId),
  })
}

export function useWriteOff(invoiceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: InvoiceWriteOff) => apiClient.post<InvoiceRead>(`/invoices/${invoiceId}/write-off`, body),
    onSuccess: () => invalidateInvoiceDependencies(qc, invoiceId),
  })
}

export function useGenerateReminder(invoiceId: string) {
  return useMutation({
    mutationFn: ({ tone }: { tone: string }) =>
      apiClient.get<ReminderRead>(`/invoices/${invoiceId}/reminder?tone=${encodeURIComponent(tone)}`),
  })
}

export function useMarkReminderSent(invoiceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ReminderSentCreate) =>
      apiClient.post<InvoiceRead>(`/invoices/${invoiceId}/reminder/sent`, body),
    onSuccess: () => invalidateInvoiceDependencies(qc, invoiceId),
  })
}

export function useRunDailyCheck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post<DailyCheckSummaryRead>('/system/daily-check'),
    onSuccess: () => invalidateEverything(qc),
  })
}

export function useSetSimulatedDate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SimulatedDateUpdate) => apiClient.post<SimulatedDateRead>('/system/date', body),
    onSuccess: () => invalidateEverything(qc),
  })
}

export function useImportInvoices() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { format: string; content: string }) =>
      apiClient.post<ImportResultRead>('/import/invoices', body),
    onSuccess: () => invalidateEverything(qc),
  })
}

export function useCreateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: InvoiceCreate) => apiClient.post<InvoiceRead>('/invoices', body),
    onSuccess: (data) => invalidateInvoiceDependencies(qc, data.id),
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ClientCreate) => apiClient.post<ClientRead>('/clients', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateClient(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ClientUpdate) => apiClient.patch<ClientRead>(`/clients/${clientId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['client', clientId] })
    },
  })
}

export function useResetDemo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post<SuccessResponse>('/system/reset-demo'),
    onSuccess: () => invalidateEverything(qc),
  })
}
