import { deepDiff, friendlyKey, formatValue } from '../utils/diff'

interface DiffViewerProps {
  before: Record<string, unknown> | null | undefined
  after: Record<string, unknown> | null | undefined
  compact?: boolean
}

export default function DiffViewer({ before, after, compact = false }: DiffViewerProps) {
  const chunks = deepDiff(before, after)
  const displayChunks = compact ? chunks.filter((c) => c.changed) : chunks

  if (displayChunks.length === 0) {
    return <p className="text-sm text-warm-400">暂无字段变更</p>
  }

  return (
    <div className="space-y-1">
      {displayChunks.map((chunk) => (
        <div
          key={chunk.key}
          className={`grid grid-cols-3 gap-2 text-sm py-1.5 border-b border-warm-100 last:border-b-0 ${
            chunk.changed ? 'bg-warm-50/60' : ''
          }`}
        >
          <div className="text-warm-500 font-medium pl-2">
            {friendlyKey(chunk.key)}
          </div>
          <div
            className={`text-warm-600 line-through decoration-danger-400/60 ${
              chunk.changed ? 'text-danger-600' : 'text-warm-500'
            }`}
          >
            <span className="text-xs opacity-60">📕 </span>
            {formatValue(chunk.before)}
          </div>
          <div
            className={`font-medium ${
              chunk.changed ? 'text-success-700 bg-success-50/50 rounded' : 'text-warm-700'
            }`}
          >
            <span className="text-xs opacity-60">📗 </span>
            {formatValue(chunk.after)}
          </div>
        </div>
      ))}
    </div>
  )
}
