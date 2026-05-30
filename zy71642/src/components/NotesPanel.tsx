import { useState } from 'react'
import { useOrbitalStore, AnomalyType } from '@/store/useOrbitalStore'
import { X } from 'lucide-react'

const ANOMALY_TAGS: { label: string; type: AnomalyType; color: string }[] = [
  { label: '能级顺序错', type: 'energy_order_error', color: 'bg-red-500/20 text-red-400 border-red-500/40' },
  { label: '节点面遮挡', type: 'node_occlusion', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
  { label: '颜色误导', type: 'color_misleading', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' },
  { label: '自定义', type: 'custom', color: 'bg-gray-500/20 text-gray-400 border-gray-500/40' },
]

const BADGE_COLORS: Record<AnomalyType, string> = {
  energy_order_error: 'bg-red-500/20 text-red-400 border-red-500/40',
  node_occlusion: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  color_misleading: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  custom: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
}

const ANOMALY_LABELS: Record<AnomalyType, string> = {
  energy_order_error: '能级顺序错',
  node_occlusion: '节点面遮挡',
  color_misleading: '颜色误导',
  custom: '自定义',
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((v) => v.toString().padStart(2, '0'))
    .join(':')
}

export default function NotesPanel() {
  const notes = useOrbitalStore((s) => s.notes)
  const addNote = useOrbitalStore((s) => s.addNote)
  const removeNote = useOrbitalStore((s) => s.removeNote)
  const currentOrbitalId = useOrbitalStore((s) => s.currentOrbitalId)
  const addAnomaly = useOrbitalStore((s) => s.addAnomaly)

  const [content, setContent] = useState('')
  const [selectedTag, setSelectedTag] = useState<AnomalyType | null>(null)

  const handleAdd = () => {
    if (!content.trim()) return

    addNote({
      orbitalId: currentOrbitalId,
      content: content.trim(),
      anomalyTag: selectedTag ?? undefined,
    })

    if (selectedTag) {
      addAnomaly({
        type: selectedTag,
        description: content.trim(),
        orbitalId: currentOrbitalId,
        status: 'pending',
      })
    }

    setContent('')
    setSelectedTag(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3 bg-lab-panel rounded-lg border border-lab-border h-full">
      <div className="text-xs font-mono text-lab-muted uppercase tracking-wider">
        课堂备注
      </div>

      <div className="space-y-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入备注内容..."
          rows={3}
          className="w-full px-2 py-1.5 rounded bg-lab-surface border border-lab-border text-sm text-lab-text font-mono resize-none placeholder:text-lab-muted/50 focus:outline-none focus:border-lab-glow focus:shadow-glow-sm transition-all"
        />

        <div className="flex flex-wrap gap-1.5">
          {ANOMALY_TAGS.map((tag) => (
            <button
              key={tag.type}
              type="button"
              onClick={() =>
                setSelectedTag(selectedTag === tag.type ? null : tag.type)
              }
              className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                selectedTag === tag.type
                  ? tag.color
                  : 'bg-lab-surface text-lab-muted border-lab-border hover:border-lab-glow/30'
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!content.trim()}
          className="w-full h-7 rounded bg-lab-glow/20 text-lab-glow text-xs font-mono border border-lab-glow/40 hover:bg-lab-glow/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          添加备注
        </button>
      </div>

      <div className="h-px bg-lab-border" />

      <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
        {notes.map((note) => (
          <div
            key={note.id}
            className="group relative p-2 rounded bg-lab-surface/60 border border-lab-border hover:border-lab-glow/20 transition-all"
          >
            <div className="flex items-start justify-between gap-1.5">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-lab-text leading-relaxed break-words">
                  {note.content}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] font-mono text-lab-muted">
                    {formatTime(note.timestamp)}
                  </span>
                  <span className="text-[10px] font-mono text-lab-glow/60">
                    {note.orbitalId}
                  </span>
                  {note.anomalyTag && (
                    <span
                      className={`inline-flex px-1.5 py-px rounded text-[10px] font-mono border ${BADGE_COLORS[note.anomalyTag]}`}
                    >
                      {ANOMALY_LABELS[note.anomalyTag]}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeNote(note.id)}
                className="shrink-0 p-0.5 rounded text-lab-muted hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
        {notes.length === 0 && (
          <div className="text-[11px] text-lab-muted/50 text-center py-4 font-mono">
            暂无备注
          </div>
        )}
      </div>
    </div>
  )
}
