import { BookOpen, Database } from 'lucide-react'
import type { ConflictRecord, ConflictResolution } from '@/types'

interface EvidencePanelProps {
  conflict: ConflictRecord
}

const RESOLUTION_BADGES: Record<ConflictResolution, { label: string; className: string }> = {
  pending: { label: '待处理', className: 'bg-yellow-100 text-yellow-700' },
  accepted_notebook: { label: '采纳错题本', className: 'bg-green-100 text-green-700' },
  accepted_import: { label: '采纳导入', className: 'bg-blue-100 text-blue-700' },
  manual: { label: '手动处理', className: 'bg-purple-100 text-purple-700' },
}

export default function EvidencePanel({ conflict }: EvidencePanelProps) {
  const badge = RESOLUTION_BADGES[conflict.resolution]

  return (
    <div className="card-cafe grid grid-cols-2 gap-4">
      <div className="rounded-xl bg-cafe-latte/40 p-3">
        <div className="flex items-center gap-2 text-cafe-brown font-medium text-sm mb-3">
          <BookOpen className="w-4 h-4" />
          <span>错题本记录</span>
        </div>
        <div className="rounded-lg bg-cafe-latte px-3 py-2 text-sm">
          <div className="text-xs text-cafe-brown/50 mb-1">{conflict.field}</div>
          <div className="text-cafe-brown underline decoration-red-400 decoration-2 underline-offset-2">
            {conflict.notebookValue}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-blue-50/40 p-3">
        <div className="flex items-center gap-2 text-blue-700 font-medium text-sm mb-3">
          <Database className="w-4 h-4" />
          <span>导入数据</span>
        </div>
        <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm">
          <div className="text-xs text-blue-400 mb-1">{conflict.field}</div>
          <div className="text-blue-700 underline decoration-red-400 decoration-2 underline-offset-2">
            {conflict.importedValue}
          </div>
        </div>
      </div>

      {conflict.suggestion && (
        <div className="col-span-2 rounded-lg bg-blue-50/60 border border-blue-100 px-3 py-2 text-sm text-blue-700">
          💡 {conflict.suggestion}
        </div>
      )}

      <div className="col-span-2 flex items-center justify-between">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
          {badge.label}
        </span>
        <span className="text-xs text-cafe-brown/40">
          检测于 {new Date(conflict.detectedAt).toLocaleString()}
        </span>
      </div>
    </div>
  )
}
