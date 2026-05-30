import { Play, Trash2 } from 'lucide-react'
import type { Plan } from '@/types'
import { splToColorHex, formatDateTime } from '@/utils'

interface PlanCardProps {
  plan: Plan
  isSelected: boolean
  onSelect: () => void
  onLoad: () => void
  onDelete: () => void
}

export default function PlanCard({ plan, isSelected, onSelect, onLoad, onDelete }: PlanCardProps) {
  const getHeatmapStyle = () => {
    if (plan.snapshot.length === 0) return {}
    const stops = plan.snapshot
      .slice(0, 100)
      .map((s, i) => {
        const color = splToColorHex(s.splDB)
        const percent = ((i + 1) / plan.snapshot.length) * 100
        return `${color} ${percent}%`
      })
      .join(', ')
    return { background: `linear-gradient(to right, ${stops})` }
  }

  const heatmapBgClass = plan.snapshot.length === 0 ? 'bg-theater-border' : ''

  return (
    <div
      className={`glass-panel rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-glow group ${
        isSelected ? 'border-2 border-theater-accent' : 'border border-theater-border'
      }`}
      onClick={onSelect}
    >
      <div className={`relative h-24 overflow-hidden ${heatmapBgClass}`} style={getHeatmapStyle()}>
        <div className="absolute inset-0 bg-gradient-to-t from-theater-dark/60 to-transparent" />
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onLoad()
            }}
            className="p-1.5 bg-theater-accent/90 rounded-lg hover:bg-theater-accent transition-colors"
            title="加载方案"
          >
            <Play className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1.5 bg-theater-red/90 rounded-lg hover:bg-theater-red transition-colors"
            title="删除方案"
          >
            <Trash2 className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-2">
        <h3 className="font-display text-base text-white truncate">{plan.name}</h3>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="font-mono bg-theater-border/50 px-2 py-0.5 rounded">
            {plan.frequencyBand}
          </span>
          <span>{formatDateTime(plan.createdAt)}</span>
        </div>
        <div className="text-xs text-gray-500">
          备注: {plan.notes.length} 条
        </div>
      </div>
    </div>
  )
}
