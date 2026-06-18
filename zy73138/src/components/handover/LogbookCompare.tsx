import { BookOpen, ArrowRight, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react'
import { useWaterQualityStore } from '@/store'
import { ALIGNMENT_STATUS_LABELS } from '@/types'
import type { AlignmentStatus } from '@/types'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/utils'

const alignmentIcons: Record<AlignmentStatus, React.ReactNode> = {
  aligned: <CheckCircle size={14} className="text-tide" />,
  misaligned: <AlertCircle size={14} className="text-rust" />,
  unchecked: <HelpCircle size={14} className="text-gray-400" />,
}

const alignmentBg: Record<AlignmentStatus, string> = {
  aligned: 'bg-tide/10 border-tide/30',
  misaligned: 'bg-rust/10 border-rust/30',
  unchecked: 'bg-gray-500/10 border-gray-500/30',
}

export default function LogbookCompare() {
  const logbooks = useWaterQualityStore((s) => s.logbooks)
  const records = useWaterQualityStore((s) => s.records)
  const handovers = useWaterQualityStore((s) => s.handovers)

  return (
    <div className="space-y-3">
      {logbooks.map((entry) => {
        const relatedRecords = entry.relatedRecordIds
          .map((rid) => records.find((r) => r.id === rid))
          .filter(Boolean)

        return (
          <div
            key={entry.id}
            className="flex items-stretch gap-0 rounded-lg border border-ocean-700 overflow-hidden"
          >
            <div className="flex-1 p-4 bg-ocean-800/40">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={14} className="text-sand" />
                <span className="text-xs text-sand font-sans">船上记录本条目</span>
              </div>
              <div className="text-foam font-mono text-sm mb-1">{entry.description}</div>
              <div className="flex gap-3 text-xs text-foam/50">
                <span>页码: {entry.page}</span>
                <span>{formatDateTime(entry.timestamp)}</span>
              </div>
            </div>

            <div className="flex items-center px-2 bg-ocean-900">
              {relatedRecords.length > 0 ? (
                <ArrowRight size={16} className="text-foam/30" />
              ) : (
                <span className="text-foam/20 text-xs">—</span>
              )}
            </div>

            <div className="flex-1 p-4 bg-ocean-800/20">
              <div className="text-xs text-tide/70 font-sans mb-2">系统记录</div>
              {relatedRecords.length === 0 ? (
                <div className="text-foam/30 text-sm">无关联系统记录</div>
              ) : (
                relatedRecords.map((record) => {
                  if (!record) return null
                  const handover = handovers.find((h) => h.recordId === record.id)
                  const status = handover?.alignmentStatus ?? 'unchecked'
                  return (
                    <div key={record.id} className="mb-2 last:mb-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-foam font-mono text-sm">{record.bottleNumber}</span>
                        <span className="text-foam/40 text-xs">{record.stationName}</span>
                        <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]', alignmentBg[status])}>
                          {alignmentIcons[status]}
                          {ALIGNMENT_STATUS_LABELS[status]}
                        </span>
                      </div>
                      <div className="text-foam/60 text-xs">
                        {record.parameter}={record.value}{record.unit} · 结论: {record.conclusion}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
