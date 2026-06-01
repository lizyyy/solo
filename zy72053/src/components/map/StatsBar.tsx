import { useStats } from '@/hooks/useDerivedData'
import { MapPin, AlertTriangle, ShieldAlert, Swords } from 'lucide-react'

const cards = [
  { key: 'total' as const, label: '总点位', color: '#00C9A7', icon: MapPin },
  { key: 'anomaly' as const, label: '异常', color: '#EAB308', icon: AlertTriangle },
  { key: 'exception' as const, label: '例外', color: '#F97316', icon: ShieldAlert },
  { key: 'conflict' as const, label: '冲突', color: '#EF4444', icon: Swords },
]

export default function StatsBar() {
  const stats = useStats()

  return (
    <div className="flex gap-3 px-4 py-3">
      {cards.map((c) => {
        const Icon = c.icon
        const isException = c.key === 'exception'
        return (
          <div
            key={c.key}
            className={`relative flex flex-1 items-center gap-3 rounded-lg border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-sm ${
              isException ? 'animate-pulse border-orange-500/50' : ''
            }`}
            style={{ borderLeftColor: c.color, borderLeftWidth: 3 }}
          >
            <Icon size={18} style={{ color: c.color }} />
            <div>
              <div className="text-xs text-gray-400">{c.label}</div>
              <div className="text-2xl font-bold text-white">{stats[c.key]}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
