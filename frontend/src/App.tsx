import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import { Navbar } from './components/Navbar'
import { ActionCenterPage } from './pages/ActionCenterPage'
import { DashboardPage } from './pages/DashboardPage'
import { InvoicesPage } from './pages/InvoicesPage'
import { NewInvoicePage } from './pages/NewInvoicePage'
import { InvoiceDetailPage } from './pages/InvoiceDetailPage'
import { ClientsPage } from './pages/ClientsPage'
import { ImportPage } from './pages/ImportPage'
import { AuditPage } from './pages/AuditPage'

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
          <Navbar />
          <main className="flex-1 pb-16">
            <Routes>
              <Route path="/" element={<ActionCenterPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/invoices/new" element={<NewInvoicePage />} />
              <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/clients/:id" element={<ClientsPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
            DuePing v2.0 • Resolution-First Collections & Accounts Receivable Architecture
          </footer>
        </div>
      </BrowserRouter>
    </ToastProvider>
  )
}

export default App
