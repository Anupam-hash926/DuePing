import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '../../ui/Button'
import { useResetDemo } from '../../api/hooks/useMutations'

export const Closing: React.FC = () => {
  const resetDemo = useResetDemo()
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleReset = async () => {
    try {
      await resetDemo.mutateAsync()
      setStatusMsg({ type: 'success', text: 'Demo seed data successfully loaded!' })
    } catch {
      setStatusMsg({ type: 'error', text: 'Demo reset is disabled on this server.' })
    }
  }

  return (
    <section className="py-24 px-4 sm:px-6 text-center max-w-4xl mx-auto space-y-8 select-none">
      <h2 className="text-4xl sm:text-6xl md:text-7xl font-extralight tracking-tight text-text leading-tight">
        Always follow up.
      </h2>

      <p className="text-base sm:text-lg text-text-2 max-w-lg mx-auto">
        Empower your accounting workflow with automated root cause resolution.
      </p>

      <div className="flex items-center justify-center gap-4 flex-wrap pt-2">
        <Link to="/app">
          <Button size="lg" variant="primary" className="shadow-float">
            Open the app
          </Button>
        </Link>
        <Button
          size="lg"
          variant="secondary"
          onClick={handleReset}
          loading={resetDemo.isPending}
        >
          <RotateCcw className="w-4 h-4 mr-2 text-tint" />
          Load demo data
        </Button>
      </div>

      {statusMsg && (
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-pill text-xs font-medium border ${
            statusMsg.type === 'success'
              ? 'bg-success/10 border-success/20 text-success'
              : 'bg-danger/10 border-danger/20 text-danger'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}
    </section>
  )
}
