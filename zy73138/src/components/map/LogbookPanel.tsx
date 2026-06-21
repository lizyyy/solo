import { useMemo } from 'react'
import { useWaterQualityStore } from '@/store'
import { formatDateTime, getSourceTypeColor } from '@/utils'
import { SOURCE_TYPE_LABELS, REVIEW_STATUS_LABELS } from '@/types'
import { X, BookOpen, Database, AlertTriangle, ChevronRight, Info } from 'lucide-react'

export default function LogbookPanel() {
  const selectedRecordId = useWaterQualityStore((s) => s.selectedRecordId)
  const setSelectedRecord = useWaterQualityStore((s) => s.setSelectedRecord)
  const records = useWaterQualityStore((s) => s.records)
  const allLogbooks = useWaterQualityStore((s) => s.logbooks)
  const allDataSources = useWaterQualityStore((s) => s.dataSources)
  const allReviews = useWaterQualityStore((s) => s.reviews)

  const record = useMemo(
    () => (selectedRecordId ? records.find((r) => r.id === selectedRecordId) : undefined),
    [records, selectedRecordId]
  )
  const logbooks = useMemo(
    () => (selectedRecordId ? allLogbooks.filter((lb) => lb.relatedRecordIds.includes(selectedRecordId)) : []),
    [allLogbooks, selectedRecordId]
  )
  const dataSources = useMemo(
    () => (selectedRecordId ? allDataSources.filter((ds) => ds.recordId === selectedRecordId) : []),
    [allDataSources, selectedRecordId]
  )
  const review = useMemo(
    () => (selectedRecordId ? allReviews.find((r) => r.recordId === selectedRecordId) : undefined),
    [allReviews, selectedRecordId]
  )

  if (!selectedRecordId) {
    return (
      <div className="absolute right-0 top-0 z-[1000] flex h-full w-80 flex-col border-l border-tide/10 bg-ocean-900/60 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-tide/10 px-4 py-3">
          <h3 className="font-serif text-sm font-semibold text-tide/60">记录详情</h3>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Info size={28} className="text-foam/20" />
          <div>
            <p className="text-sm text-foam/50">尚未选中采样点</p>
            <p className="mt-1 text-xs text-foam/30">
              点击地图上的任意采样点，即可查看船上记录本来源、复核标记与后补说明
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!record) {
    return (
      <div className="animate-slide-in-right absolute right-0 top-0 z-[1000] flex h-full w-80 flex-col border-l border-rust/30 bg-ocean-900/95 backdrop-blur-md overflow-y-auto">
        <div className="flex items-center justify-between border-b border-rust/20 px-4 py-3">
          <h3 className="font-serif text-sm font-semibold text-rust">记录详情</h3>
          <button
            onClick={() => setSelectedRecord(null)}
            className="rounded p-1 text-foam/60 transition-colors hover:bg-ocean-800 hover:text-foam"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <AlertTriangle size={28} className="text-rust/50" />
          <div>
            <p className="text-sm text-rust">记录数据缺失</p>
            <p className="mt-1 font-mono text-xs text-foam/50">{selectedRecordId}</p>
            <p className="mt-2 text-xs text-foam/40">
              该 ID 未在采样记录中找到，可能来源于已删除或未同步的条目，请与交接人核对原始船上记录本。
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-slide-in-right absolute right-0 top-0 z-[1000] flex h-full w-80 flex-col border-l border-tide/20 bg-ocean-900/95 backdrop-blur-md overflow-y-auto">
      <div className="flex items-center justify-between border-b border-tide/20 px-4 py-3">
        <h3 className="font-serif text-sm font-semibold text-tide">记录详情</h3>
        <button
          onClick={() => setSelectedRecord(null)}
          className="rounded p-1 text-foam/60 transition-colors hover:bg-ocean-800 hover:text-foam"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-tide">{record.id}</span>
            {record.isAnomaly && (
              <span className="flex items-center gap-1 rounded bg-rust/20 px-2 py-0.5 text-xs text-rust">
                <AlertTriangle size={10} />
                异常
              </span>
            )}
          </div>
          <div className="text-sm text-foam/70">{record.stationName}</div>
          <div className="font-mono text-sm text-foam">
            {record.parameter} = {record.value}{record.unit}
            <span className="ml-2 text-xs text-foam/50">阈值 {record.threshold}{record.unit}</span>
          </div>
          <div className="text-sm text-foam/80">结论：{record.conclusion}</div>
          <div className="text-xs text-foam/50">采样时间：{formatDateTime(record.sampleTime)}</div>
          <div className="text-xs text-foam/40">
            记录编号：{record.bottleNumber} · 经纬度 {record.latitude.toFixed(4)}, {record.longitude.toFixed(4)}
          </div>
        </div>

        {review && (
          <div className="rounded-lg border border-sand/30 bg-sand/5 p-3">
            <div className="mb-1 flex items-center gap-2">
              <AlertTriangle size={12} className="text-sand" />
              <span className="text-xs font-semibold text-sand">复核标记</span>
              <span className={`ml-auto rounded border px-1.5 py-0.5 text-[10px] ${
                review.reviewStatus === 'pending'
                  ? 'border-rust/40 bg-rust/10 text-rust'
                  : review.reviewStatus === 'confirmed'
                  ? 'border-sand/40 bg-sand/10 text-sand'
                  : 'border-tide/40 bg-tide/10 text-tide'
              }`}>
                {REVIEW_STATUS_LABELS[review.reviewStatus]}
              </span>
            </div>
            <div className="mb-1 text-xs text-foam/70 leading-relaxed">{review.reviewReason}</div>
            {review.relatedRecordId && (
              <a
                href={`/record/${record.id}`}
                className="text-[11px] text-foam/50 hover:text-foam/70 transition-colors"
              >
                关联记录：{review.relatedRecordId} → 详情页查看完整对比
              </a>
            )}
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center gap-2">
            <BookOpen size={14} className="text-tide" />
            <span className="text-xs font-semibold text-foam/80">记录本页</span>
            <span className="ml-auto text-[10px] text-foam/40">
              {record.logbookPage}
            </span>
          </div>
          {logbooks.length === 0 ? (
            <div className="rounded border border-ocean-700/40 bg-ocean-800/30 p-2 text-xs text-foam/40">
              未找到对应记录本条目 · 交接时请核对原始记录
            </div>
          ) : (
            <div className="space-y-2">
              {logbooks.map((lb) => (
                <div key={lb.id} className="rounded border border-ocean-700 bg-ocean-800/50 p-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-tide/10 px-1.5 py-0.5 font-mono text-xs text-tide">
                      {lb.page}
                    </span>
                    <span className="text-xs text-foam/50">
                      {formatDateTime(lb.timestamp)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-foam/70 leading-relaxed">{lb.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <Database size={14} className="text-tide" />
            <span className="text-xs font-semibold text-foam/80">数据来源</span>
            <span className="ml-auto text-[10px] text-foam/40">
              共 {dataSources.length} 条
            </span>
          </div>
          {dataSources.length === 0 ? (
            <div className="rounded border border-ocean-700/40 bg-ocean-800/30 p-2 text-xs text-foam/40">
              未找到处理过程记录 · 交接时请确认来源
            </div>
          ) : (
            <div className="space-y-2">
              {dataSources.map((ds) => {
                const isLate = ds.sourceType === 'late_attachment'
                const isSupplementary = ds.sourceType === 'supplementary_note'
                const isExport = ds.sourceType === 'latest_export'
                return (
                  <div
                    key={ds.id}
                    className={`rounded border p-2 ${
                      isLate
                        ? 'border-l-2 border-l-sand border-ocean-700 bg-ocean-800/60'
                        : isSupplementary
                        ? 'border-dashed border-ocean-700/60 bg-ocean-800/40'
                        : isExport
                        ? 'border-rust/30 bg-rust/5'
                        : 'border-ocean-700 bg-ocean-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] ${getSourceTypeColor(ds.sourceType)}`}>
                        {SOURCE_TYPE_LABELS[ds.sourceType]}
                      </span>
                      <span className="text-xs text-foam/50">{ds.operator}</span>
                      {ds.attachmentUrl && (
                        <span className="text-[10px] text-sand/80">含附件</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-foam/70 leading-relaxed">{ds.description}</div>
                    <div className="mt-1 text-[10px] text-foam/40 font-mono">
                      {formatDateTime(ds.timestamp)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-tide/20 p-3">
        <a
          href={`/record/${record.id}`}
          className="flex items-center justify-center gap-1 rounded-lg bg-tide/10 py-2 text-xs font-medium text-tide transition-colors hover:bg-tide/20"
        >
          查看完整记录
          <ChevronRight size={14} />
        </a>
      </div>
    </div>
  )
}
