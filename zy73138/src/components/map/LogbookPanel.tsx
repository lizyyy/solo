import { useMemo } from 'react'
import { useWaterQualityStore } from '@/store'
import { formatDateTime, getSourceTypeColor } from '@/utils'
import { SOURCE_TYPE_LABELS, REVIEW_STATUS_LABELS } from '@/types'
import { X, BookOpen, Database, AlertTriangle, ChevronRight } from 'lucide-react'

export default function LogbookPanel() {
  const selectedRecordId = useWaterQualityStore((s) => s.selectedRecordId)
  const setSelectedRecord = useWaterQualityStore((s) => s.setSelectedRecord)
  const records = useWaterQualityStore((s) => s.records)
  const allLogbooks = useWaterQualityStore((s) => s.logbooks)
  const allDataSources = useWaterQualityStore((s) => s.dataSources)
  const allReviews = useWaterQualityStore((s) => s.reviews)

  if (!selectedRecordId) return null

  const record = records.find((r) => r.id === selectedRecordId)
  if (!record) return null

  const logbooks = useMemo(
    () => allLogbooks.filter((lb) => lb.relatedRecordIds.includes(selectedRecordId)),
    [allLogbooks, selectedRecordId]
  )
  const dataSources = useMemo(
    () => allDataSources.filter((ds) => ds.recordId === selectedRecordId),
    [allDataSources, selectedRecordId]
  )
  const review = useMemo(
    () => allReviews.find((r) => r.recordId === selectedRecordId),
    [allReviews, selectedRecordId]
  )

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
        </div>

        {review && (
          <div className="rounded-lg border border-sand/30 bg-sand/5 p-3">
            <div className="mb-1 flex items-center gap-2">
              <AlertTriangle size={12} className="text-sand" />
              <span className="text-xs font-semibold text-sand">复核标记</span>
            </div>
            <div className="mb-1 text-xs text-foam/70">{review.reviewReason}</div>
            <div className="text-xs text-sand/80">状态：{REVIEW_STATUS_LABELS[review.reviewStatus]}</div>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center gap-2">
            <BookOpen size={14} className="text-tide" />
            <span className="text-xs font-semibold text-foam/80">记录本页</span>
          </div>
          {logbooks.length === 0 ? (
            <div className="text-xs text-foam/40">无关联记录本</div>
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
                  <div className="mt-1 text-xs text-foam/70">{lb.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <Database size={14} className="text-tide" />
            <span className="text-xs font-semibold text-foam/80">数据来源</span>
          </div>
          {dataSources.length === 0 ? (
            <div className="text-xs text-foam/40">无数据来源</div>
          ) : (
            <div className="space-y-2">
              {dataSources.map((ds) => (
                <div key={ds.id} className="rounded border border-ocean-700 bg-ocean-800/50 p-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded border px-1.5 py-0.5 text-xs ${getSourceTypeColor(ds.sourceType)}`}>
                      {SOURCE_TYPE_LABELS[ds.sourceType]}
                    </span>
                    <span className="text-xs text-foam/50">{ds.operator}</span>
                  </div>
                  <div className="mt-1 text-xs text-foam/70">{ds.description}</div>
                  <div className="mt-1 text-xs text-foam/40">
                    {formatDateTime(ds.timestamp)}
                  </div>
                </div>
              ))}
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
