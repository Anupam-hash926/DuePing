import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './api/queryClient'
import { ToastProvider } from './context/ToastContext'
import { AppShell } from './features/shell/AppShell'
import { Skeleton } from './ui/Skeleton'

// Route-level code splitting with React.lazy
const LandingPage = lazy(() =>
  import('./features/landing/LandingPage').then((m) => ({ default: m.LandingPage }))
)
const ActionCenterPage = lazy(() =>
  import('./features/action-center/ActionCenterPage').then((m) => ({ default: m.ActionCenterPage }))
)
const DashboardPage = lazy(() =>
  import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage }))
)
const InvoicesPage = lazy(() =>
  import('./features/invoices/InvoicesPage').then((m) => ({ default: m.InvoicesPage }))
)
const NewInvoicePage = lazy(() =>
  import('./features/invoices/NewInvoicePage').then((m) => ({ default: m.NewInvoicePage }))
)
const InvoiceDetailPage = lazy(() =>
  import('./features/invoices/detail/InvoiceDetailPage').then((m) => ({ default: m.InvoiceDetailPage }))
)
const ClientsPage = lazy(() =>
  import('./features/clients/ClientsPage').then((m) => ({ default: m.ClientsPage }))
)
const ImportPage = lazy(() =>
  import('./features/import/ImportPage').then((m) => ({ default: m.ImportPage }))
)
const AuditPage = lazy(() =>
  import('./features/audit/AuditPage').then((m) => ({ default: m.AuditPage }))
)
const DevUIPage = lazy(() =>
  import('./pages/DevUIPage').then((m) => ({ default: m.DevUIPage }))
)

const PageFallback: React.FC = () => (
  <div className="space-y-6 py-4 animate-fade-in">
    <Skeleton className="h-10 w-48" />
    <Skeleton className="h-28 w-full rounded-[24px]" variant="rectangular" />
    <Skeleton className="h-64 w-full rounded-[28px]" variant="rectangular" />
  </div>
)

const RedirectInvoice: React.FC = () => {
  const { id } = useParams()
  return <Navigate to={`/app/invoices/${id}`} replace />
}

const RedirectClient: React.FC = () => {
  const { id } = useParams()
  return <Navigate to={`/app/clients/${id}`} replace />
}

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              {/* App Shell Routes */}
              <Route path="/app" element={<AppShell />}>
                <Route index element={<ActionCenterPage />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="invoices" element={<InvoicesPage />} />
                <Route path="invoices/new" element={<NewInvoicePage />} />
                <Route path="invoices/:id" element={<InvoiceDetailPage />} />
                <Route path="clients" element={<ClientsPage />} />
                <Route path="clients/:id" element={<ClientsPage />} />
                <Route path="import" element={<ImportPage />} />
                <Route path="audit" element={<AuditPage />} />
              </Route>

              {/* Hidden Dev UI Page */}
              <Route path="/__ui" element={<DevUIPage />} />

              {/* Public Landing Page */}
              <Route path="/" element={<LandingPage />} />

              {/* Legacy route redirects to /app/... */}
              <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
              <Route path="/invoices" element={<Navigate to="/app/invoices" replace />} />
              <Route path="/invoices/new" element={<Navigate to="/app/invoices/new" replace />} />
              <Route path="/invoices/:id" element={<RedirectInvoice />} />
              <Route path="/clients" element={<Navigate to="/app/clients" replace />} />
              <Route path="/clients/:id" element={<RedirectClient />} />
              <Route path="/import" element={<Navigate to="/app/import" replace />} />
              <Route path="/audit" element={<Navigate to="/app/audit" replace />} />

              {/* Catch-all fallback */}
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
