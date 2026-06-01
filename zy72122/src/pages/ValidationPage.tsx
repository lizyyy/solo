import { useState } from 'react'
import { useStore } from '@/store/useStore'
import ValidationTable from '@/components/ValidationTable'
import ReviewPanel from '@/components/ReviewPanel'
import { formatTimestamp, statusLabel } from '@/utils/helpers'
import { ShieldCheck, AlertTriangle, Filter } from 'lucide-react'

export default function ValidationPage() {
  const records = useStore((s) => s.records)
  const validationResults = useStore((s) => s.validationResults)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'passed' | 'needs_review' | 'legacy_amended'>('all')

  const passedCount = records.filter((r) => r.status === 'passed').length
  const reviewCount = records.filter((r) => r.status === 'needs_review').length
  const legacyCount = records.filter((r) => r.status === 'legacy_amended').length
  const errorCount = validationResults.filter((v) => v.status === 'error').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">校验与异常</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            自动校验方向符号、单位、时间间隔；检测采样缺口和超阈值记录
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-green-400" />
            <span className="text-xs text-slate-400">已通过</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-green-400">{passedCount}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <span className="text-xs text-slate-400">需确认</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-yellow-400">{reviewCount}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-slate-400">旧口径</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-blue-400">{legacyCount}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-xs text-slate-400">超阈值</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-red-400">{errorCount}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-slate-500" />
        <span className="text-xs text-slate-500">筛选：</span>
        {(['all', 'passed', 'needs_review', 'legacy_amended'] as const).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1 text-xs transition-all ${
                filter === f
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {f === 'all' ? '全部' : statusLabel(f)}
            </button>
          )
        )}
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 p-5">
        <ValidationTable />
      </div>

      {reviewCount > 0 && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
          <h3 className="mb-2 text-sm font-medium text-yellow-400">
            需人工确认的记录
          </h3>
          <div className="space-y-2">
            {records
              .filter((r) => r.status === 'needs_review')
              .map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-yellow-500/20 bg-slate-800/50 px-4 py-2"
                >
                  <div className="text-xs text-slate-400">
                    <span className="font-mono">
                      {formatTimestamp(r.timestamp)}
                    </span>
                    <span className="mx-2">·</span>
                    <span>
                      力={r.force.toFixed(1)} {r.forceUnit}
                    </span>
                    <span className="mx-2">·</span>
                    <span>
                      位移={r.displacement.toFixed(1)} {r.displacementUnit}
                    </span>
                  </div>
                  <button
                    onClick={() => setReviewId(r.id)}
                    className="rounded-lg bg-yellow-500/20 px-3 py-1 text-xs text-yellow-400 transition-all hover:bg-yellow-500/30"
                  >
                    确认
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {reviewId && (
        <ReviewPanel
          recordId={reviewId}
          onClose={() => setReviewId(null)}
        />
      )}
    </div>
  )
}
