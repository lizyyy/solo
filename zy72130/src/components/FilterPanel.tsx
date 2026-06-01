import { Filter, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { STATUS_LABELS, SOURCE_LABELS, type RecordStatus, type RecordSource } from '@/types'

const statuses: (RecordStatus | '')[] = ['', 'smooth', 'needs_confirmation', 'old_standard']
const sources: (RecordSource | '')[] = ['', 'excel', 'audio', 'contract', 'chat_annotation']

export default function FilterPanel() {
  const { filter, setFilter } = useStore()

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-neon" />
          <span className="text-sm font-medium text-white">筛选</span>
        </div>
        {filter.status || filter.source ? (
          <button
            onClick={() => setFilter({ status: '', source: '' })}
            className="flex items-center gap-1 text-xs text-muted hover:text-danger transition-colors"
          >
            <X className="h-3 w-3" />
            清除
          </button>
        ) : null}
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-muted block mb-2">状态</label>
          <div className="flex flex-wrap gap-2">
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => setFilter({ status: s })}
                className={`px-3 py-1 rounded-lg text-xs transition-all duration-200 ${
                  filter.status === s
                    ? 'bg-neon/15 text-neon border border-neon/40 shadow-neon-sm'
                    : 'bg-surface-elevated text-muted border border-surface-border hover:text-gray-300'
                }`}
              >
                {s ? STATUS_LABELS[s] : '全部'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted block mb-2">来源</label>
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => (
              <button
                key={s}
                onClick={() => setFilter({ source: s })}
                className={`px-3 py-1 rounded-lg text-xs transition-all duration-200 ${
                  filter.source === s
                    ? 'bg-neon/15 text-neon border border-neon/40 shadow-neon-sm'
                    : 'bg-surface-elevated text-muted border border-surface-border hover:text-gray-300'
                }`}
              >
                {s ? SOURCE_LABELS[s] : '全部'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
