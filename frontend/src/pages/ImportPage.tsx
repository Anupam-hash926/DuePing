import React, { useState } from 'react'
import { apiClient } from '../api/client'
import { ImportResultRead } from '../api/types'
import { useToast } from '../context/ToastContext'

export const ImportPage: React.FC = () => {
  const { showSuccess, showError } = useToast()

  const [csvContent, setCsvContent] = useState<string>('')
  const [fileName, setFileName] = useState<string>('')
  const [importResult, setImportResult] = useState<ImportResultRead | null>(null)
  const [importing, setImporting] = useState<boolean>(false)

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
      showError('Please select or paste CSV content before importing.')
      return
    }

    setImporting(true)
    try {
      const res = await apiClient.post<ImportResultRead>('/import/invoices', {
        format: 'csv',
        content: csvContent,
      })
      setImportResult(res)
      showSuccess(`Import complete: ${res.imported} imported, ${res.rejected} rejected.`)
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Title & Description */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Import Invoices</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload batch invoice CSV files. The validation chain checks headers, duplicates, dates, and amounts.
        </p>
      </div>

      {/* Upload Box */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700">Select CSV File</label>
          <a
            href="/sample_invoices.csv"
            download="sample_invoices.csv"
            className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1"
          >
            📥 Download Sample CSV
          </a>
        </div>

        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-indigo-400 transition cursor-pointer relative bg-slate-50/50">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
          <div className="space-y-1">
            <span className="text-2xl">📄</span>
            <p className="text-xs font-semibold text-slate-700">
              {fileName ? fileName : 'Click to select CSV file, or drag and drop'}
            </p>
            <p className="text-[11px] text-slate-400">Standard CSV format with headers</p>
          </div>
        </div>

        {/* Text Area fallback / preview */}
        {csvContent && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">CSV Content Preview</label>
            <textarea
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              rows={6}
              className="w-full font-mono text-[11px] bg-slate-50 border border-slate-300 rounded-lg p-3 text-slate-800"
            />
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={handleImport}
            disabled={importing || !csvContent.trim()}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm disabled:opacity-50"
          >
            {importing ? 'Processing Import...' : 'Import Invoices'}
          </button>
        </div>
      </div>

      {/* Import Results */}
      {importResult && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">Import Summary</h2>
          <p className="text-xs font-medium text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
            {importResult.summary}
          </p>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-[10px] uppercase font-bold text-slate-500">Total Rows</p>
              <p className="text-lg font-black text-slate-900 mt-1">{importResult.processed}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-[10px] uppercase font-bold text-emerald-700">Successfully Imported</p>
              <p className="text-lg font-black text-emerald-800 mt-1">{importResult.imported}</p>
            </div>
            <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
              <p className="text-[10px] uppercase font-bold text-rose-700">Rejected</p>
              <p className="text-lg font-black text-rose-800 mt-1">{importResult.rejected}</p>
            </div>
          </div>

          {/* Row Errors Table */}
          {importResult.errors.length > 0 && (
            <div className="pt-2">
              <h3 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2">
                Validation Errors ({importResult.errors.length})
              </h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-2.5 w-24">Row #</th>
                      <th className="px-4 py-2.5">Error Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {importResult.errors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-rose-50/30">
                        <td className="px-4 py-2.5 font-bold text-slate-700">Row {err.row_number}</td>
                        <td className="px-4 py-2.5 text-rose-600 font-medium">
                          {err.messages.join('; ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* File Errors */}
          {importResult.file_errors.length > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
              <p className="font-bold">File-level Errors:</p>
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                {importResult.file_errors.map((fe, i) => (
                  <li key={i}>{fe}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

