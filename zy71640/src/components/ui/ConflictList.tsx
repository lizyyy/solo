import { AlertTriangle, AlertCircle, Info, Check } from 'lucide-react'
import { useExhibitionStore } from '@/store/useExhibitionStore'
import { CONFLICT_TYPE_LABELS } from '@/types'
import type { ConflictType, ConflictSeverity, Conflict } from '@/types'

const SEVERITY_CONFIG: Record<ConflictSeverity, { icon: React.ElementType; color: string }> = {
  critical: { icon: AlertTriangle, color: 'text-red-400' },
  warning: { icon: AlertCircle, color: 'text-amber-400' },
  info: { icon: Info, color: 'text-blue-400' },
}

const CONFLICT_TYPES: (ConflictType | 'all')[] = ['all', 'overlap', 'light_obstruction', 'path_backflow', 'safety_violation']

function groupByType(conflicts: Conflict[]): Record<ConflictType, Conflict[]> {
  const groups: Record<ConflictType, Conflict[]> = {
    overlap: [],
    light_obstruction: [],
    path_backflow: [],
    safety_violation: [],
  }
  for (const c of conflicts) {
    if (!c.resolvedAt) {
      groups[c.type].push(c)
    }
  }
  return groups
}

function ConflictItem({ conflict }: { conflict: Conflict }) {
  const selectObject = useExhibitionStore((s) => s.selectObject)
  const resolveConflict = useExhibitionStore((s) => s.resolveConflict)
  const artworks = useExhibitionStore((s) => s.artworks)
  const lights = useExhibitionStore((s) => s.lights)
  const paths = useExhibitionStore((s) => s.paths)

  const config = SEVERITY_CONFIG[conflict.severity]
  const Icon = config.icon

  const handleSelect = () => {
    const firstId = conflict.affectedIds[0]
    if (artworks.find((a) => a.id === firstId)) {
      selectObject(firstId, 'artwork')
    } else if (lights.find((l) => l.id === firstId)) {
      selectObject(firstId, 'light')
    } else if (paths.find((p) => p.id === firstId)) {
      selectObject(firstId, 'path')
    }
  }

  return (
    <div className="group flex items-start gap-2 rounded bg-[#16213e] px-2 py-1.5">
      <Icon size={14} className={`mt-0.5 shrink-0 ${config.color}`} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-zinc-200">{conflict.description}</p>
        <p className="mt-0.5 text-[10px] text-zinc-500">
          影响: {conflict.affectedIds.map((id) => id.slice(-4)).join(', ')}
        </p>
      </div>
      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={handleSelect}
          className="rounded px-1.5 py-0.5 text-[10px] text-blue-400 hover:bg-blue-400/10"
        >
          定位
        </button>
        <button
          onClick={() => resolveConflict(conflict.id)}
          className="rounded px-1.5 py-0.5 text-[10px] text-green-400 hover:bg-green-400/10"
        >
          <Check size={12} />
        </button>
      </div>
    </div>
  )
}

export default function ConflictList() {
  const conflictFilter = useExhibitionStore((s) => s.conflictFilter)
  const setConflictFilter = useExhibitionStore((s) => s.setConflictFilter)
  const getFilteredConflicts = useExhibitionStore((s) => s.getFilteredConflicts)

  const filtered = getFilteredConflicts()
  const unresolvedCount = filtered.filter((c) => !c.resolvedAt).length
  const grouped = groupByType(filtered)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-700/50 px-3 py-2">
        <span className="text-xs font-medium text-zinc-300">
          冲突 <span className="text-zinc-500">({unresolvedCount} 未解决)</span>
        </span>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-zinc-700/50 px-2 py-1.5">
        {CONFLICT_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setConflictFilter(type)}
            className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
              conflictFilter === type
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200'
            }`}
          >
            {type === 'all' ? '全部' : CONFLICT_TYPE_LABELS[type]}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {conflictFilter === 'all' ? (
          (Object.entries(grouped) as [ConflictType, Conflict[]][]).map(([type, items]) =>
            items.length > 0 ? (
              <div key={type} className="mb-3">
                <h5 className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  {CONFLICT_TYPE_LABELS[type]} ({items.length})
                </h5>
                <div className="space-y-1">
                  {items.map((c) => (
                    <ConflictItem key={c.id} conflict={c} />
                  ))}
                </div>
              </div>
            ) : null
          )
        ) : (
          <div className="space-y-1">
            {grouped[conflictFilter].map((c) => (
              <ConflictItem key={c.id} conflict={c} />
            ))}
          </div>
        )}
        {unresolvedCount === 0 && (
          <div className="py-8 text-center text-xs text-zinc-500">暂无冲突</div>
        )}
      </div>
    </div>
  )
}
