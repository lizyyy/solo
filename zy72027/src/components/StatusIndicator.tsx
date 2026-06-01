import type { GameStatus } from '@/types'

const STATUS_CONFIG: Record<GameStatus, { label: string; color: string; glow: string; pulse: boolean }> = {
  idle: { label: '待机', color: 'bg-gray-500', glow: '', pulse: false },
  playing: { label: '进行中', color: 'bg-emerald-400', glow: 'shadow-[0_0_8px_rgba(52,211,153,0.6)]', pulse: true },
  paused: { label: '已暂停', color: 'bg-amber-400', glow: 'shadow-[0_0_8px_rgba(251,191,36,0.6)]', pulse: true },
  ended: { label: '已结束', color: 'bg-red-400', glow: 'shadow-[0_0_6px_rgba(248,113,113,0.4)]', pulse: false },
}

interface Props {
  status: GameStatus
}

export default function StatusIndicator({ status }: Props) {
  const config = STATUS_CONFIG[status]
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${config.color} ${config.glow} ${config.pulse ? 'animate-pulse' : ''}`} />
      <span className="text-sm font-medium text-gray-300">{config.label}</span>
    </div>
  )
}
