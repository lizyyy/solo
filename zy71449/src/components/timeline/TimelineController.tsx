import { useCubeStore } from '@/store/useCubeStore'
import { Clock, Anchor } from 'lucide-react'

export default function TimelineController() {
  const parameters = useCubeStore(s => s.parameters)
  const timeSlicePosition = useCubeStore(s => s.timeSlicePosition)
  const setTimeSlice = useCubeStore(s => s.setTimeSlice)
  const typhoonPathPoints = useCubeStore(s => s.typhoonPathPoints)

  const filteredPaths = typhoonPathPoints.filter(p => p.typhoonId === parameters.typhoonId)
  const timeStart = parameters.timeRange[0]
  const timeEnd = parameters.timeRange[1]
  const timeSpan = timeEnd - timeStart || 1

  const keyPoints = filteredPaths.filter((_, i) => i % 5 === 0).map(p => ({
    timestamp: new Date(p.timestamp).getTime(),
    label: new Date(p.timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
    windSpeed: p.windSpeed,
  }))

  const formatDate = (ms: number) =>
    new Date(ms).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit' })

  const sliceTime = timeSlicePosition !== null
    ? timeStart + (timeSlicePosition / 100) * timeSpan
    : null

  return (
    <div className="bg-[#0A1422] border-t border-[#1B3054] px-4 py-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[#00D4FF] flex-shrink-0">
          <Clock size={14} />
          <span className="text-xs font-medium">时间轴</span>
        </div>

        <div className="flex-1 relative">
          <div className="h-8 relative">
            <div className="absolute inset-x-0 top-3 h-1 bg-[#1B3054] rounded-full" />

            {keyPoints.map((kp, i) => {
              const pos = ((kp.timestamp - timeStart) / timeSpan) * 100
              const intensity = kp.windSpeed / 200
              return (
                <div
                  key={i}
                  className="absolute top-2.5 -translate-x-1/2 group"
                  style={{ left: `${pos}%` }}
                >
                  <div
                    className="w-2 h-2 rounded-full cursor-pointer transition-transform hover:scale-150"
                    style={{
                      background: `rgba(0, 212, 255, ${0.3 + intensity * 0.7})`,
                      boxShadow: `0 0 ${4 + intensity * 6}px rgba(0, 212, 255, ${intensity * 0.5})`,
                    }}
                  />
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-[#5A6E8A] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    {kp.label}
                  </div>
                </div>
              )
            })}

            {timeSlicePosition !== null && (
              <div
                className="absolute top-0 h-8 w-0.5 bg-[#00D4FF]/60 -translate-x-1/2 transition-all"
                style={{ left: `${timeSlicePosition}%` }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3">
                  <Anchor size={12} className="text-[#00D4FF]" />
                </div>
              </div>
            )}

            <input
              type="range"
              min={0}
              max={100}
              step={0.5}
              value={timeSlicePosition ?? 50}
              onChange={e => setTimeSlice(Number(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
          </div>
        </div>

        <div className="flex-shrink-0 text-right min-w-[140px]">
          <div className="text-[10px] text-[#5A6E8A]">
            {formatDate(timeStart)} — {formatDate(timeEnd)}
          </div>
          {sliceTime !== null && (
            <div className="text-xs text-[#00D4FF] font-mono">
              切片: {formatDate(sliceTime)}
            </div>
          )}
        </div>

        <button
          onClick={() => setTimeSlice(timeSlicePosition === null ? 50 : null)}
          className={`text-xs px-2 py-1 rounded transition-all flex-shrink-0 ${
            timeSlicePosition !== null
              ? 'bg-[#00D4FF]/15 text-[#00D4FF] border border-[#00D4FF]/40'
              : 'bg-[#0D1B2E] text-[#5A6E8A] border border-[#1B3054]'
          }`}
        >
          {timeSlicePosition !== null ? '关闭' : '切片'}
        </button>
      </div>
    </div>
  )
}
