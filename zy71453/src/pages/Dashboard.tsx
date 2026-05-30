import WarehouseScene from '../components/scene/WarehouseScene'
import SidePanel from '../components/panel/SidePanel'
import { useStore } from '../store/useStore'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

export default function Dashboard() {
  const replayProgress = useStore((s) => s.replayProgress)
  const setReplayProgress = useStore((s) => s.setReplayProgress)
  const [playing, setPlaying] = useState(false)

  const tick = useCallback(() => {
    setReplayProgress(Math.min(1, replayProgress + 0.005))
  }, [replayProgress, setReplayProgress])

  useEffect(() => {
    if (!playing || replayProgress >= 1) return
    const id = setInterval(tick, 50)
    return () => clearInterval(id)
  }, [playing, replayProgress, tick])

  useEffect(() => {
    if (replayProgress >= 1) setPlaying(false)
  }, [replayProgress])

  const anomalies = useStore((s) => s.anomalies)
  const pendingCount = anomalies.filter((a) => a.status === 'pending').length

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0e1a]">
      <div className="flex-1 relative">
        <WarehouseScene />

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0a0e1a] via-[#0a0e1a]/80 to-transparent px-6 pb-4 pt-12">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (replayProgress >= 1) setReplayProgress(0)
                setPlaying(!playing)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#00f0ff]/30 text-[#00f0ff] text-xs hover:bg-[#00f0ff]/10 transition-colors"
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {playing ? '暂停' : '回放'}
            </button>
            <button
              onClick={() => {
                setPlaying(false)
                setReplayProgress(0)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-gray-600 text-gray-400 text-xs hover:text-gray-200 hover:border-gray-400 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              重置
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.005}
              value={replayProgress}
              onChange={(e) => {
                setPlaying(false)
                setReplayProgress(parseFloat(e.target.value))
              }}
              className="flex-1 accent-[#00f0ff] h-1"
            />
            <span className="text-xs text-gray-400 font-mono w-12 text-right">
              {Math.round(replayProgress * 100)}%
            </span>
          </div>
        </div>

        <div className="absolute top-4 left-4 space-y-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#111827]/90 border border-gray-800 text-xs">
            <div className="h-2 w-2 rounded-full bg-[#00f0ff] animate-pulse" />
            <span className="text-gray-300">轨迹云实时监控</span>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#111827]/90 border border-[#ff8c00]/30 text-xs">
              <div className="h-2 w-2 rounded-full bg-[#ff8c00]" />
              <span className="text-[#ff8c00]">{pendingCount} 项待确认异常</span>
            </div>
          )}
        </div>

        <div className="absolute top-4 right-4">
          <div className="flex gap-3 px-3 py-1.5 rounded bg-[#111827]/90 border border-gray-800 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-4 rounded-full bg-[#00f0ff]" />
              <span className="text-gray-400">正常</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-4 rounded-full bg-[#a855f7]" />
              <span className="text-gray-400">补录</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-4 rounded-full bg-[#6b7280]" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #6b7280 0, #6b7280 3px, transparent 3px, transparent 5px)' }} />
              <span className="text-gray-400">撤回</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-4 rounded-full bg-[#f59e0b]/60" />
              <span className="text-gray-400">重复</span>
            </div>
          </div>
        </div>
      </div>

      <SidePanel />
    </div>
  )
}
