import React, { createContext, useContext, useState, useCallback } from 'react'
import { Toast as ToastBanner } from '../ui/Toast'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

interface ToastContextType {
  toasts: Toast[]
  showSuccess: (message: string) => void
  showError: (message: string) => void
  showInfo: (message: string) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  const showSuccess = useCallback((msg: string) => addToast('success', msg), [addToast])
  const showError = useCallback((msg: string) => addToast('error', msg), [addToast])
  const showInfo = useCallback((msg: string) => addToast('info', msg), [addToast])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, showSuccess, showError, showInfo, removeToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastBanner
              id={toast.id}
              type={toast.type}
              title={toast.type === 'error' ? 'Error' : toast.type === 'success' ? 'Success' : 'Notice'}
              message={toast.message}
              onClose={() => removeToast(toast.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

