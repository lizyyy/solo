import { Link } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import Scatter3D from '@/components/Scatter3D'
import VarianceChart from '@/components/VarianceChart'
import type { BoundaryStatus } from '@/types'
import { cn } from '@/lib/utils'

const statusStyles: Record<BoundaryStatus, string> = {
  pending_review: 'bg-amber-500/20 text-amber-400',
  reviewed: 'bg-blue-500/20 text-blue-400',
  resolved: 'bg-green-500/20 text-green-400',
}
const statusLabels: Record<BoundaryStatus, string> = {
  pending_review: '待复核',
  reviewed: '已复核',
  resolved: '已解决',
}

export default function ReportPage() {
  const svdResult = useStore(s => s.svdResult)
  const boundaryRecords = useStore(s => s.boundaryRecords)
  const rawData = useStore(s => s.rawData)
  const selectAnomaly = useStore(s => s.selectAnomaly)
  const selectedAnomalyId = useStore(s => s.selectedAnomalyId)
  const weights = useStore(s => s.weights)

  const unresolvedRecords = boundaryRecords.filter(r => r.status !== 'resolved')
  const pending = boundaryRecords.filter(r => r.status === 'pending_review').length
  const reviewed = boundaryRecords.filter(r => r.status === 'reviewed').length
  const resolved = boundaryRecords.filter(r => r.status === 'resolved').length

  if (!svdResult || !rawData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-indigo-950">
        <div className="text-center">
          <p className="mb-4 text-lg text-gray-300">尚未生成降维报告</p>
          <Link to="/" className="rounded-md bg-indigo-800 px-4 py-2 text-sm text-gray-200 hover:bg-indigo-700">去导入数据</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-indigo-950 p-6">
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-gray-100">奇异值降维报告</h1>
            <p className="mt-1 text-sm text-gray-400">课堂演示结果 · 点击异常点可溯源 · 异常记录仍保留原值/改后值/处理原因</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 text-amber-400">待复核 {pending}</div>
            <div className="flex items-center gap-1.5 rounded-md bg-blue-500/10 border border-blue-500/30 px-2.5 py-1 text-blue-400">已复核 {reviewed}</div>
            <div className="flex items-center gap-1.5 rounded-md bg-green-500/10 border border-green-500/30 px-2.5 py-1 text-green-400">已解决 {resolved}</div>
            <div className="text-indigo-400/60">{rawData.fileName} · 权重 {weights.filter(w => w.isComplete).length}/{weights.length}</div>
          </div>
        </div>
      </header>

      <div className="mb-6">
        <Scatter3D />
        {pending > 0 && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-300/90 flex items-start gap-2">
            <span className="font-bold">注意：</span>
            <span>图中琥珀色异常点为「分母为 0 却被填成空字符串」、尚未归入正常的数据。点击后可跳回边界值说明或评分权重表，不要在未复核情况下直接视为正常。</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VarianceChart />

        <div className="rounded-lg border border-indigo-800 bg-indigo-950 p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-300 flex items-center justify-between">
            <span>异常概览（仅展示未解决记录，解决后不再高亮显示）</span>
            <span className="text-[10px] text-indigo-400/60">共 {unresolvedRecords.length} 条</span>
          </h3>
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {unresolvedRecords.length === 0 && <p className="text-sm text-gray-500">暂无未解决的异常记录</p>}
            {unresolvedRecords.map(record => {
              const isSel = selectedAnomalyId === record.id
              return (
                <button
                  key={record.id}
                  onClick={() => selectAnomaly(record.id)}
                  className={cn('flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm border transition-colors',
                    isSel ? 'bg-amber-500/15 border-amber-500/50' : 'bg-indigo-900/60 border-transparent hover:bg-indigo-800/70 border-indigo-800/40')}
                >
                  <span className={cn('h-2 w-2 flex-shrink-0 rounded-full',
                    record.status === 'pending_review' ? 'bg-amber-500' : 'bg-blue-400')} />
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-200 truncate">第 {record.rowIndex + 1} 行 · {record.columnName} / {record.denominatorColumnName}</div>
                    <div className="text-[10px] text-indigo-400/60 truncate">原值：{record.originalValue === '' ? '(空字符串)' : record.originalValue} · 分母={record.denominatorValue}</div>
                  </div>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', statusStyles[record.status])}>
                    {statusLabels[record.status]}
                  </span>
                </button>
              )
            })}
          </div>
          {boundaryRecords.length > 0 && (
            <div className="mt-3 pt-3 border-t border-indigo-800/30 text-[10px] text-indigo-400/60 space-y-1">
              <p>历史记录（含已解决）：{boundaryRecords.length} 条</p>
              {boundaryRecords.filter(r => r.status === 'resolved').map(r => (
                <div key={r.id} className="rounded bg-indigo-900/40 px-2 py-1 text-indigo-300/70">
                  ✓ 第{r.rowIndex + 1}行 {r.columnName}：{r.originalValue === '' ? '(空)' : r.originalValue} → {r.correctedValue}（{r.resolvedReason}）
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
