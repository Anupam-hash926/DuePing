import React, { useState } from 'react'
import { Plus, File } from 'lucide-react'
import type { InvoiceRead, DocumentRead } from '../../../api/types'
import { GroupedList } from '../../../ui/GroupedList'
import { ListRow } from '../../../ui/ListRow'
import { Button } from '../../../ui/Button'
import { Sheet } from '../../../ui/Sheet'
import { Badge } from '../../../ui/Badge'
import { formatDate } from '../../../lib/format'
import { useAttachDocument } from '../../../api/hooks/useMutations'

export interface DocumentsPanelProps {
  invoice: InvoiceRead
}

export const DocumentsPanel: React.FC<DocumentsPanelProps> = ({ invoice }) => {
  const attachDoc = useAttachDocument(invoice.id)
  const allowed = new Set(invoice.allowed_operations)

  const [modalOpen, setModalOpen] = useState(false)
  const [docType, setDocType] = useState('PURCHASE_ORDER')
  const [fileName, setFileName] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFileName(file.name)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fileName.trim()) return
    await attachDoc.mutateAsync({
      document_type: docType,
      file_name: fileName.trim(),
      file_path: `/files/${fileName.trim()}`,
    })
    setModalOpen(false)
    setFileName('')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-3">
          Supporting Documents ({invoice.documents.length})
        </h3>
        {allowed.has('attach_document') && (
          <Button size="sm" variant="secondary" onClick={() => setModalOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1 text-tint" />
            Attach Document
          </Button>
        )}
      </div>

      {invoice.documents.length === 0 ? (
        <div className="p-8 text-center bg-surface-solid rounded-card border border-hairline text-text-3 text-xs">
          No supporting documents attached.
        </div>
      ) : (
        <GroupedList>
          {invoice.documents.map((d: DocumentRead) => (
            <ListRow
              key={d.id}
              leading={<File className="w-5 h-5 text-text-2 flex-shrink-0" />}
              title={
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text">{d.file_name}</span>
                  <Badge variant="neutral" size="sm">
                    {d.document_type.replace('_', ' ')}
                  </Badge>
                </div>
              }
              subtitle={<span className="text-text-3">Attached on {formatDate(d.uploaded_at)}</span>}
            />
          ))}
        </GroupedList>
      )}

      {/* Attach Document Modal */}
      <Sheet
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Attach Supporting Document"
        description="Stores document metadata linked to this invoice aggregate (metadata only)."
      >
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-medium text-text-2 block mb-1">Document Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full h-10 px-3 bg-bg-grouped border border-hairline rounded-input text-text text-sm outline-none focus:border-tint"
            >
              <option value="PURCHASE_ORDER">Purchase Order (PO)</option>
              <option value="CONTRACT">Signed Contract / SOW</option>
              <option value="DELIVERY_CHALLAN">Delivery Proof / Receipt</option>
              <option value="TIMESHEET">Approved Timesheet</option>
              <option value="INVOICE_COPY">Signed Invoice Copy</option>
              <option value="DISPUTE_EVIDENCE">Dispute Resolution Evidence</option>
              <option value="OTHER">Other Verification Document</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-text-2 block mb-1">Select File (reads filename only)</label>
            <input
              type="file"
              onChange={handleFileChange}
              className="w-full text-xs text-text-2 file:mr-3 file:py-2 file:px-3 file:rounded-pill file:border-0 file:text-xs file:font-medium file:bg-bg-grouped file:text-text hover:file:opacity-80 cursor-pointer"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-2 block mb-1">File Name</label>
            <input
              type="text"
              required
              placeholder="e.g. PO_Acme_2026.pdf"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full h-10 px-3 bg-bg-grouped border border-hairline rounded-input text-text text-sm outline-none focus:border-tint"
            />
          </div>

          <Button type="submit" variant="primary" loading={attachDoc.isPending} className="w-full mt-2">
            Save Document Metadata
          </Button>
        </form>
      </Sheet>
    </div>
  )
}
