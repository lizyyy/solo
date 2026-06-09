import { Link } from 'react-router-dom'
import { X, History, ArrowRight, User } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { BoundaryStatus } from '@/types'
import { cn } from '@/lib/utils'

const statusStyles: Record<BoundaryStatus, string> = {
  pending_review: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  reviewed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
}

const statusLabels: Record<BoundaryStatus, string> = {
  pending_review: '待复核',
  reviewed: '已复核',
  resolved: '已解决',
}

const nextActionStyles: Record<string, string> = {
  '找数据复核人': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  '找竞赛教练唐老师': 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
}

export default function TracePanel() {
  const tracePanelOpen = useStore(s => s.tracePanelOpen)
  const selectedAnomalyId = useStore(s => s.selectedAnomalyId)
  const boundaryRecords = useStore(s => s.boundaryRecords)
  const anomalyPoints = useStore(s => s.anomalyPoints)
  const selectAnomaly = useStore(s => s.selectAnomaly)

  if (!tracePanelOpen || !selectedAnomalyId) return null

  const record = boundaryRecords.find(r => r.id === selectedAnomalyId)
  if (!record) return null

  const anomalyPoint = anomalyPoints.find(ap => ap.recordId === selectedAnomalyId)

  return (
    <div className="fixed right-0 top-0 z-50 flex h-full w-[360px] animate-slide-in flex-col gap-4 overflow-y-auto bg-indigo-900 border-l border-indigo-700/50 p-5 text-gray-200 shadow-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold font-serif text-amber-400">溯源信息 · 同一份记录</h3>
          <p className="text-xs text-indigo-400/60 mt-0.5">第 {record.rowIndex + 1} 行 · {record.columnName} / {record.denominatorColumnName}</p>
        </div>
        <button onClick={() => selectAnomaly(null)}><X className="h-5 w-5 text-indigo-400 hover:text-white" /></button>
      </div>

      <div className="rounded-lg border border-indigo-800/50 bg-indigo-950/60 p-3 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-indigo-400/60">状态</span>
          <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs border', statusStyles[record.status])}>{statusLabels[record.status]}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-indigo-400/60">原始值</span>
          <span className="font-mono bg-indigo-900/70 rounded px-2 py-0.5 text-indigo-200">{record.originalValue === '' ? '(空字符串)' : record.originalValue}</span>
          {record.status === 'resolved' && (
            <>
              <span className="text-green-400/80">→ 改后值</span>
              <span className="font-mono bg-green-500/10 border border-green-500/30 rounded px-2 py-0.5 text-green-300">{record.correctedValue || '(空)'}</span>
            </>
          )}
        </div>
        {record.status === 'resolved' && record.resolvedReason && (
          <p className="text-xs text-green-300/80 pt-1 border-t border-indigo-800/40">处理原因：{record.resolvedReason}</p>
        )}
        {(record.reviewedBy || record.resolvedBy) && (
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            {record.reviewedBy && (
              <span className="flex items-center gap-1 text-blue-300"><User className="w-3 h-3" />复核：{record.reviewedBy}@{record.reviewedAt}</span>
            )}
            {record.resolvedBy && (
              <span className="flex items-center gap-1 text-green-300"><User className="w-3 h-3" />解决：{record.resolvedBy}@{record.resolvedAt}</span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <p className="mb-1 text-xs text-indigo-400/60">为什么被留下（原始说法）</p>
          <p className="text-indigo-100 leading-relaxed">{record.reason}</p>
        </div>
        <div>
          <p className="mb-1 text-xs text-indigo-400/60">还缺什么材料</p>
          <p className="text-indigo-100 leading-relaxed">{record.missingMaterial}</p>
        </div>
        <div>
          <p className="mb-1 text-xs text-indigo-400/60">下一步</p>
          <span className={cn('inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium', nextActionStyles[record.nextAction])}>
            <ArrowRight className="w-3 h-3" />{record.nextAction}
          </span>
        </div>
      </div>

      {record.history.length > 0 && (
        <div className="rounded-lg border border-indigo-800/50 bg-indigo-950/60 p-3">
          <p className="text-xs text-indigo-400/60 mb-2 flex items-center gap-1"><History className="w-3 h-3" /> 处理历史（全部步骤）</p>
          <ol className="space-y-2 relative pl-1">
            {record.history.map((h, i) => (
              <li key={i} className="text-[11px] flex items-start gap-2">
                <span className="text-indigo-500/50 mt-0.5 shrink-0">{i + 1}.</span>
                <div className="flex-1 space-y-0.5">
                  <div className="flex flex-wrap gap-1.5">
                    <span className={cn('shrink-0 rounded px-1.5 py-0.5 border',
                      h.action === '创建' ? 'bg-indigo-800/40 text-indigo-300 border-indigo-700/40' :
                      h.action === '复核' ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' :
                      'bg-green-500/15 text-green-300 border-green-500/30')}>{h.action}</span>
                    <span className="text-indigo-300/80">{h.role}</span>
                    <span className="text-indigo-500/50 shrink-0 ml-auto">{h.timestamp}</span>
                  </div>
                  <p className="text-indigo-200/90 leading-snug">{h.description}</p>
                  {h.from !== undefined && h.to !== undefined && (
                    <p className="text-[10px] text-indigo-400/50">字段 {h.field}：{h.from} → {h.to}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-auto space-y-2 border-t border-indigo-700 pt-4">
        <Link to="/" onClick={() => selectAnomaly(null)} className="block rounded-md bg-indigo-800 px-3 py-2 text-center text-sm text-gray-300 hover:bg-indigo-700 hover:text-white">
          → 边界值说明（数据导入页）
        </Link>
        {anomalyPoint?.linkedWeightId && (
          <Link to="/weights" onClick={() => selectAnomaly(null)} className="block rounded-md bg-indigo-800 px-3 py-2 text-center text-sm text-gray-300 hover:bg-indigo-700 hover:text-white">
            → 评分权重表
          </Link>
        )}
        {record.status !== 'resolved' && (
          <Link to="/report" onClick={() => selectAnomaly(null)} className="block rounded-md bg-amber-600/70 px-3 py-2 text-center text-sm text-white hover:bg-amber-600">
            → 回到降维报告（仍未归入正常）
          </Link>
        )}
      </div>
    </div>
  )
}
