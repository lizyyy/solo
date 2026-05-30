import { useState } from 'react'
import { useOrbitalStore, AnomalyType, AnomalyItem } from '@/store/useOrbitalStore'
import { Check, X, Trash2, AlertTriangle, Eye, Palette, Tag } from 'lucide-react'

const TYPE_CONFIG: Record<AnomalyType, { label: string; icon: React.ReactNode; color: string }> = {
  energy_order_error: {
    label: '能级顺序错',
    icon: <AlertTriangle size={12} />,
    color: 'text-red-400',
  },
  node_occlusion: {
    label: '节点面遮挡',
    icon: <Eye size={12} />,
    color: 'text-amber-400',
  },
  color_misleading: {
    label: '颜色误导',
    icon: <Palette size={12} />,
    color: 'text-yellow-400',
  },
  custom: {
    label: '自定义',
    icon: <Tag size={12} />,
    color: 'text-gray-400',
  },
}

const STATUS_BADGES: Record<AnomalyItem['status'], { label: string; color: string }> = {
  pending: { label: '待处理', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' },
  resolved: { label: '已处理', color: 'bg-green-500/20 text-green-400 border-green-500/40' },
  dismissed: { label: '已忽略', color: 'bg-gray-500/20 text-gray-400 border-gray-500/40' },
}

type FilterTab = 'all' | 'pending' | 'resolved' | 'dismissed'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待处理' },
  { key: 'resolved', label: '已处理' },
  { key: 'dismissed', label: '已忽略' },
]

function formatTime(ts: number): string {
  const d = new Date(ts)
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((v) => v.toString().padStart(2, '0'))
    .join(':')
}

export default function AnomalyPanel() {
  const anomalyQueue = useOrbitalStore((s) => s.anomalyQueue)
  const updateAnomalyStatus = useOrbitalStore((s) => s.updateAnomalyStatus)
  const removeAnomaly = useOrbitalStore((s) => s.removeAnomaly)

  const [filter, setFilter] = useState<FilterTab>('all')

  const filtered =
    filter === 'all'
      ? anomalyQueue
      : anomalyQueue.filter((a) => a.status === filter)

  const pendingCount = anomalyQueue.filter((a) => a.status === 'pending').length

  return (
    <div className="flex flex-col gap-3 p-3 bg-lab-panel rounded-lg border border-lab-border h-full">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-lab-muted uppercase tracking-wider">
          待处理队列
        </span>
        {pendingCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-mono border border-yellow-500/40">
            {pendingCount}
          </span>
        )}
      </div>

      <div className="flex gap-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
              filter === tab.key
                ? 'bg-lab-glow/20 text-lab-glow border border-lab-glow/40'
                : 'bg-lab-surface text-lab-muted border border-lab-border hover:border-lab-glow/30'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="h-px bg-lab-border" />

      <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
        {filtered.map((item) => {
          const typeConf = TYPE_CONFIG[item.type]
          const statusConf = STATUS_BADGES[item.status]

          return (
            <div
              key={item.id}
              className="group p-2 rounded bg-lab-surface/60 border border-lab-border hover:border-lab-glow/20 transition-all"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`flex items-center gap-0.5 ${typeConf.color}`}>
                      {typeConf.icon}
                      <span className="text-[11px] font-mono">{typeConf.label}</span>
                    </span>
                    <span
                      className={`inline-flex px-1.5 py-px rounded text-[10px] font-mono border ${statusConf.color}`}
                    >
                      {statusConf.label}
                    </span>
                  </div>
                  <p className="text-xs text-lab-text leading-relaxed break-words">
                    {item.description}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-mono text-lab-muted">
                      {formatTime(item.timestamp)}
                    </span>
                    <span className="text-[10px] font-mono text-lab-glow/60">
                      {item.orbitalId}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => updateAnomalyStatus(item.id, 'resolved')}
                        className="p-1 rounded text-lab-muted hover:text-green-400 hover:bg-green-500/10 transition-all cursor-pointer"
                        title="标记已处理"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateAnomalyStatus(item.id, 'dismissed')}
                        className="p-1 rounded text-lab-muted hover:text-gray-400 hover:bg-gray-500/10 transition-all cursor-pointer"
                        title="标记已忽略"
                      >
                        <X size={12} />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAnomaly(item.id)}
                    className="p-1 rounded text-lab-muted hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                    title="删除"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-[11px] text-lab-muted/50 text-center py-4 font-mono">
            暂无异常记录
          </div>
        )}
      </div>
    </div>
  )
}
