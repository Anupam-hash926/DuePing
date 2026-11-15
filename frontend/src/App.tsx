import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './api/queryClient'
import { ToastProvider } from './context/ToastContext'
import { AppShell } from './features/shell/AppShell'
import { ActionCenterPage } from './pages/ActionCenterPage'
import { DashboardPage } from './pages/DashboardPage'
import { InvoicesPage } from './pages/InvoicesPage'
import { NewInvoicePage } from './pages/NewInvoicePage'
import { InvoiceDetailPage } from './features/invoices/detail/InvoiceDetailPage'
import { ClientsPage } from './pages/ClientsPage'
import { ImportPage } from './pages/ImportPage'
import { AuditPage } from './pages/AuditPage'
import { DevUIPage } from './pages/DevUIPage'
import { LandingPage } from './features/landing/LandingPage'

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
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
