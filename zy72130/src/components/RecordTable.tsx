import { useNavigate } from 'react-router-dom'
import { ChevronRight, Music, User, DollarSign, Percent } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { STATUS_LABELS, SOURCE_LABELS, type RevenueRecord } from '@/types'
import NoteEditor from './NoteEditor'

export default function RecordTable() {
  const { records, loading } = useStore()
  const navigate = useNavigate()

  if (loading && records.length === 0) {
    return (
      <div className="card text-center py-12">
        <div className="animate-pulse text-neon text-sm">加载中...</div>
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-muted text-sm">暂无记录，导入文件开始分账</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted font-mono">{records.length} 条记录</span>
      </div>

      <div className="space-y-2">
        {records.map((record) => (
          <RecordRow
            key={record.id}
            record={record}
            onClick={() => navigate(`/record/${record.id}`)}
          />
        ))}
      </div>
    </div>
  )
}

function RecordRow({ record, onClick }: { record: RevenueRecord; onClick: () => void }) {
  return (
    <div
      onClick={(e) => {
        const target = e.target as HTMLElement
        if (target.closest('[data-note-editor]')) return
        onClick()
      }}
      className="card group hover:border-neon/30 hover:shadow-neon-sm transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Music className="h-3.5 w-3.5 text-neon/60 shrink-0" />
              <span className="text-sm font-medium text-white truncate">{record.trackName}</span>
            </div>
            <span className={`badge-${record.status}`}>
              {STATUS_LABELS[record.status]}
            </span>
            <span className="text-xs text-muted/60 bg-surface-elevated px-1.5 py-0.5 rounded">
              {SOURCE_LABELS[record.source]}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{record.artist}</span>
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              <span className="font-mono text-gray-300">
                ¥{record.revenue.toLocaleString()}
              </span>
            </div>
            {record.shareRatio != null ? (
              <div className="flex items-center gap-1">
                <Percent className="h-3 w-3" />
                <span className="font-mono text-neon/80">
                  {(record.shareRatio * 100).toFixed(0)}%
                </span>
              </div>
            ) : (
              <span className="text-danger/60">比例缺失</span>
            )}
            {record.shareAmount != null && (
              <span className="font-mono text-gray-400">
                → ¥{record.shareAmount.toLocaleString()}
              </span>
            )}
          </div>

          {record.originalNote && (
            <div className="mt-1.5 text-xs text-muted/60 truncate" title={record.originalNote}>
              原始备注: {record.originalNote}
            </div>
          )}

          <div data-note-editor className="mt-1.5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted/50 shrink-0">备注:</span>
              <NoteEditor record={record} />
            </div>
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-surface-border group-hover:text-neon/60 transition-colors shrink-0" />
      </div>
    </div>
  )
}
