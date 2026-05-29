import { useStore } from '@/store'
import { Calendar, AlertTriangle } from 'lucide-react'

export default function TimeWindowSelector() {
  const timeWindow = useStore((s) => s.timeWindow)
  const setTimeWindow = useStore((s) => s.setTimeWindow)
  const logs = useStore((s) => s.logs)
  const addToast = useStore((s) => s.addToast)

  const logTimestamps = logs.map((l) => new Date(l.timestamp).getTime())
  const minLogTime = Math.min(...logTimestamps)
  const maxLogTime = Math.max(...logTimestamps)

  const windowStart = new Date(timeWindow.start).getTime()
  const windowEnd = new Date(timeWindow.end).getTime()

  const hasMismatch = windowStart > minLogTime || windowEnd < maxLogTime

  const handleStartChange = (val: string) => {
    const newStart = new Date(val).toISOString()
    if (new Date(newStart).getTime() > minLogTime && new Date(newStart).getTime() < minLogTime + 3600000) {
      addToast('时间窗口起始早于最早日志记录，可能遗漏数据', 'warning')
    }
    setTimeWindow({ start: newStart, end: timeWindow.end })
  }

  const handleEndChange = (val: string) => {
    const newEnd = new Date(val).toISOString()
    setTimeWindow({ start: timeWindow.start, end: newEnd })
  }

  const toLocalInput = (iso: string) => {
    const d = new Date(iso)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  return (
    <div className={`bg-[#141b22] rounded-lg border p-4 ${hasMismatch ? 'border-[#E74C3C]/50 animate-pulse-border' : 'border-[#1e2a36]'}`}>
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-3.5 h-3.5 text-[#00D9A6]" />
        <h3 className="text-xs font-semibold text-[#a0b3c6] uppercase tracking-wider">
          分析时间窗口
        </h3>
        {hasMismatch && (
          <div className="flex items-center gap-1 ml-auto">
            <AlertTriangle className="w-3 h-3 text-[#E74C3C] animate-pulse" />
            <span className="text-[10px] text-[#E74C3C]">窗口与数据范围不匹配</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-[10px] text-[#4a5f75] mb-1 block">起始时间</label>
          <input
            type="datetime-local"
            value={toLocalInput(timeWindow.start)}
            onChange={(e) => handleStartChange(e.target.value)}
            className="w-full bg-[#0a0e12] border border-[#1e2a36] rounded px-3 py-1.5 text-xs font-['JetBrains_Mono'] text-[#c8d6e5] focus:border-[#00D9A6] focus:outline-none transition-colors"
          />
        </div>
        <span className="text-[#4a5f75] mt-4">→</span>
        <div className="flex-1">
          <label className="text-[10px] text-[#4a5f75] mb-1 block">结束时间</label>
          <input
            type="datetime-local"
            value={toLocalInput(timeWindow.end)}
            onChange={(e) => handleEndChange(e.target.value)}
            className="w-full bg-[#0a0e12] border border-[#1e2a36] rounded px-3 py-1.5 text-xs font-['JetBrains_Mono'] text-[#c8d6e5] focus:border-[#00D9A6] focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-[#0a0e12] rounded-full overflow-hidden relative">
          <div
            className={`h-full rounded-full transition-all ${hasMismatch ? 'bg-[#E74C3C]' : 'bg-[#00D9A6]'}`}
            style={{
              width: `${Math.min(100, ((maxLogTime - minLogTime) / (windowEnd - windowStart)) * 100)}%`,
              marginLeft: `${Math.max(0, ((minLogTime - windowStart) / (windowEnd - windowStart)) * 100)}%`,
            }}
          />
        </div>
        <span className="text-[10px] text-[#6b7f94] font-['JetBrains_Mono'] shrink-0">
          数据覆盖 {logs.length} 条
        </span>
      </div>
    </div>
  )
}
