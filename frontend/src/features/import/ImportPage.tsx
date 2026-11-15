import React, { useState } from 'react'
import { Download, UploadCloud, AlertCircle, CheckCircle2, FileText } from 'lucide-react'
import { useImportInvoices } from '../../api/hooks/useMutations'
import { LargeTitle } from '../../ui/LargeTitle'
import { Button } from '../../ui/Button'
import { GroupedList } from '../../ui/GroupedList'
import { ListRow } from '../../ui/ListRow'
import { useToast } from '../../context/ToastContext'
import type { ImportResultRead } from '../../api/types'

export const ImportPage: React.FC = () => {
  const { showSuccess, showError } = useToast()
  const importMutation = useImportInvoices()

  const [csvContent, setCsvContent] = useState('')
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<ImportResultRead | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setCsvContent(text)
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!csvContent.trim()) {
      showError('Please select or paste a CSV file to import.')
      return
    }

    try {
      const res = await importMutation.mutateAsync({
        format: 'csv',
        content: csvContent,
      })
      setResult(res)
      showSuccess(`Import finished: ${res.imported} imported, ${res.rejected} rejected`)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <LargeTitle
          title="Import Invoices"
          subtitle="Batch import invoices from CSV through the validation pipeline."
        />
        <a
          href="/sample_invoices.csv"
          download="sample_invoices.csv"
          className="inline-flex items-center text-xs font-semibold text-tint hover:underline gap-1.5"
        >
          <Download className="w-4 h-4" />
          <span>Download sample CSV</span>
        </a>
      </div>

      {/* Large Calm Drop Zone with thin dashed outline and ping icon */}
      <div className="relative border-2 border-dashed border-hairline hover:border-tint rounded-[28px] p-10 text-center transition-colors bg-surface-solid/50 flex flex-col items-center justify-center cursor-pointer group">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />

        {/* Signature Ping Icon */}
        <div className="w-14 h-14 rounded-full bg-tint/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
          <UploadCloud className="w-7 h-7 text-tint" />
        </div>

        <h3 className="text-base font-semibold text-text">
          {fileName ? fileName : 'Choose a CSV file or drop it here'}
        </h3>
        <p className="text-xs text-text-3 mt-1.5 max-w-sm">
          Supports invoice headers: invoice_number, client_name, total, issue_date, due_date
        </p>

        {fileName && (
          <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tint/10 text-tint text-xs font-medium">
            <FileText className="w-3.5 h-3.5" />
            <span>{fileName} loaded</span>
          </div>
        )}
      </div>

      {/* CSV Content Preview if loaded */}
      {csvContent && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
              CSV Preview
            </span>
            <Button
              variant="primary"
              size="md"
              onClick={handleImport}
              loading={importMutation.isPending}
              className="rounded-full px-6"
            >
              Start Import
            </Button>
          </div>
          <textarea
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
            rows={5}
            className="w-full bg-surface-solid border border-hairline rounded-2xl p-4 font-mono text-xs text-text focus:outline-none focus:ring-2 focus:ring-tint resize-none"
          />
        </div>
      )}

      {/* Results Section */}
      {result && (
        <div className="space-y-6 pt-4 border-t border-hairline">
          {/* Result Tiles */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface-solid rounded-[24px] border border-hairline p-5 text-center">
              <div className="text-xs font-semibold uppercase tracking-wider text-text-3">
                Processed
              </div>
              <div className="text-3xl font-light text-text mt-1">
                {result.processed}
              </div>
            </div>
            <div className="bg-surface-solid rounded-[24px] border border-hairline p-5 text-center">
              <div className="text-xs font-semibold uppercase tracking-wider text-text-3">
                Imported
              </div>
              <div className="text-3xl font-light text-fill-green mt-1">
                {result.imported}
              </div>
            </div>
            <div className="bg-surface-solid rounded-[24px] border border-hairline p-5 text-center">
              <div className="text-xs font-semibold uppercase tracking-wider text-text-3">
                Rejected
              </div>
              <div className="text-3xl font-light text-fill-red mt-1">
                {result.rejected}
              </div>
            </div>
          </div>

          {/* Row Errors */}
          {result.errors.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-3 px-1">
                Row Validation Errors ({result.errors.length})
              </h4>
              <GroupedList>
                {result.errors.map((err, idx) => (
                  <ListRow
                    key={idx}
                    leading={<AlertCircle className="w-4 h-4 text-fill-red" />}
                    title={
                      <span className="font-semibold text-text text-sm">
                        Row {err.row_number}
                      </span>
                    }
                    subtitle={
                      <span className="text-xs text-fill-red">
                        {err.messages.join(' · ')}
                      </span>
                    }
                  />
                ))}
              </GroupedList>
            </div>
          )}

          {result.errors.length === 0 && result.imported > 0 && (
            <div className="bg-surface-solid rounded-[24px] border border-hairline p-6 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-fill-green" />
              <div className="text-sm font-medium text-text">
                All {result.imported} rows imported successfully with zero errors!
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
