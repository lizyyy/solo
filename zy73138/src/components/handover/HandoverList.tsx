import { Link } from 'react-router-dom'
import { ClipboardCheck, CheckCircle } from 'lucide-react'
import { useWaterQualityStore } from '@/store'
import { ALIGNMENT_STATUS_LABELS, HANDOVER_STATUS_LABELS } from '@/types'
import type { AlignmentStatus, HandoverStatus } from '@/types'
import { cn } from '@/lib/utils'

const alignmentColors: Record<AlignmentStatus, string> = {
  aligned: 'bg-tide/20 text-tide border-tide/30',
  misaligned: 'bg-rust/20 text-rust border-rust/30',
  unchecked: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

const handoverColors: Record<HandoverStatus, string> = {
  pending: 'bg-rust/20 text-rust border-rust/30',
  confirmed: 'bg-sand/20 text-sand border-sand/30',
  completed: 'bg-tide/20 text-tide border-tide/30',
}

const rowBorderColors: Record<HandoverStatus, string> = {
  completed: 'border-l-tide',
  pending: 'border-l-rust',
  confirmed: 'border-l-sand',
}

export default function HandoverList() {
  const handovers = useWaterQualityStore((s) => s.handovers)
  const records = useWaterQualityStore((s) => s.records)
  const updateHandoverItem = useWaterQualityStore((s) => s.updateHandoverItem)
  const completeHandover = useWaterQualityStore((s) => s.completeHandover)

  const getRecord = (recordId: string) => records.find((r) => r.id === recordId)

  const handleAlignmentCheck = (itemId: string, current: AlignmentStatus) => {
    const next: AlignmentStatus = current === 'unchecked' ? 'aligned' : current === 'aligned' ? 'misaligned' : 'aligned'
    const handover = handovers.find((h) => h.id === itemId)
    updateHandoverItem(itemId, next, handover?.handoverStatus ?? 'pending')
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ocean-700 text-foam/60">
            <th className="px-4 py-3 text-left font-sans">采样瓶编号</th>
            <th className="px-4 py-3 text-left font-sans">站点</th>
            <th className="px-4 py-3 text-left font-sans">记录本页码</th>
            <th className="px-4 py-3 text-left font-sans">对齐状态</th>
            <th className="px-4 py-3 text-left font-sans">交接状态</th>
            <th className="px-4 py-3 text-left font-sans">操作</th>
          </tr>
        </thead>
        <tbody>
          {handovers.map((item) => {
            const record = getRecord(item.recordId)
            if (!record) return null
            return (
              <tr
                key={item.id}
                className={cn(
                  'border-b border-ocean-700/50 border-l-4 transition-colors hover:bg-ocean-800/50',
                  rowBorderColors[item.handoverStatus]
                )}
              >
                <td className="px-4 py-3 font-mono text-foam">
                  <Link to={`/record/${item.recordId}`} className="hover:text-tide transition-colors">
                    {record.bottleNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foam/80">{record.stationName}</td>
                <td className="px-4 py-3 font-mono text-foam/70">{record.logbookPage}</td>
                <td className="px-4 py-3">
                  <span className={cn('inline-block rounded border px-2 py-0.5 text-xs font-sans', alignmentColors[item.alignmentStatus])}>
                    {ALIGNMENT_STATUS_LABELS[item.alignmentStatus]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('inline-block rounded border px-2 py-0.5 text-xs font-sans', handoverColors[item.handoverStatus])}>
                    {HANDOVER_STATUS_LABELS[item.handoverStatus]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAlignmentCheck(item.id, item.alignmentStatus)}
                      className="flex items-center gap-1 rounded bg-ocean-700 px-2 py-1 text-xs text-foam/80 transition-colors hover:bg-ocean-600 hover:text-foam"
                    >
                      <ClipboardCheck size={12} />
                      核对
                    </button>
                    {item.handoverStatus !== 'completed' && (
                      <button
                        onClick={() => completeHandover(item.id)}
                        className="flex items-center gap-1 rounded bg-tide/20 px-2 py-1 text-xs text-tide transition-colors hover:bg-tide/30"
                      >
                        <CheckCircle size={12} />
                        确认交接
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
