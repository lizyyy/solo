import { useEffect, useState } from 'react'
import { Play, Pause, RotateCcw, Square, Settings, History } from 'lucide-react'
import { useActivityStore } from '@/store'
import { cn, formatTime } from '@/utils'
import type { ActivityStatus } from '@/types'

const STATUS_LABELS: Record<ActivityStatus, string> = {
  idle: '未开始',
  running: '进行中',
  paused: '已暂停',
  settled: '已结算',
}

export default function ActivityConsole({ onOpenReport, onOpenReplay }: {
  onOpenReport: () => void
  onOpenReplay: () => void
}) {
  const {
    currentActivity,
    startActivity,
    pauseActivity,
    resumeActivity,
    settleActivity,
    restartActivity,
    startTimeEpoch,
    pausedAccumulatedSeconds,
  } = useActivityStore()

  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!currentActivity) {
      setElapsed(0)
      return
    }
    if (currentActivity.status === 'settled') {
      setElapsed(currentActivity.totalElapsedSeconds)
      return
    }
    if (currentActivity.status === 'paused') {
      setElapsed(currentActivity.totalElapsedSeconds)
      return
    }
    if (currentActivity.status === 'idle') {
      setElapsed(0)
      return
    }
  }, [currentActivity])

  useEffect(() => {
    if (currentActivity?.status !== 'running' || !startTimeEpoch) return
    const interval = setInterval(() => {
      setElapsed(pausedAccumulatedSeconds + Math.floor((Date.now() - startTimeEpoch) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [currentActivity?.status, startTimeEpoch, pausedAccumulatedSeconds])

  const status = currentActivity?.status || 'idle'
  const statusColor = {
    idle: 'text-gray-400',
    running: 'text-emerald-400',
    paused: 'text-amber-400',
    settled: 'text-blue-400',
  }[status]

  return (
    <div className="bg-[#16213e] rounded-xl p-6 border border-[#0f3460] shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            多面体矿山探险
          </h2>
          <div className="flex items-center gap-3 text-sm">
            <span className={cn('font-medium', statusColor)}>
              ● {STATUS_LABELS[status]}
            </span>
            {currentActivity && (
              <span className="text-gray-400 font-mono text-xs">
                活动ID: {currentActivity.id.slice(0, 8)}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-5xl font-mono text-[#f0a500] tracking-wider">
            {formatTime(elapsed)}
          </div>
          <div className="text-xs text-gray-500 mt-1">活动累计时间</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {status === 'idle' && (
          <button
            onClick={startActivity}
            className="flex items-center gap-2 bg-[#f0a500] hover:bg-[#f5b624] text-[#1a1a2e] px-6 py-3 rounded-lg font-semibold transition-all duration-200 hover:scale-105 shadow-lg"
          >
            <Play size={18} fill="#1a1a2e" />
            开始新活动
          </button>
        )}

        {status === 'running' && (
          <>
            <button
              onClick={pauseActivity}
              className="flex items-center gap-2 border-2 border-amber-500 text-amber-400 hover:bg-amber-500/10 px-6 py-3 rounded-lg font-semibold transition-all"
            >
              <Pause size={18} />
              暂停
            </button>
            <button
              onClick={settleActivity}
              className="flex items-center gap-2 bg-[#f0a500] hover:bg-[#f5b624] text-[#1a1a2e] px-6 py-3 rounded-lg font-semibold transition-all duration-200 hover:scale-105"
            >
              <Square size={18} fill="#1a1a2e" />
              结算
            </button>
          </>
        )}

        {status === 'paused' && (
          <>
            <button
              onClick={resumeActivity}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-semibold transition-all"
            >
              <Play size={18} fill="white" />
              继续
            </button>
            <button
              onClick={settleActivity}
              className="flex items-center gap-2 bg-[#f0a500] hover:bg-[#f5b624] text-[#1a1a2e] px-6 py-3 rounded-lg font-semibold transition-all"
            >
              <Square size={18} fill="#1a1a2e" />
              结算
            </button>
          </>
        )}

        {status === 'settled' && (
          <button
            onClick={restartActivity}
            className="flex items-center gap-2 border-2 border-red-500 text-red-400 hover:bg-red-500/10 px-6 py-3 rounded-lg font-semibold transition-all"
          >
            <RotateCcw size={18} />
            重开新活动
          </button>
        )}

        {status !== 'idle' && status !== 'settled' && (
          <button
            onClick={restartActivity}
            className="flex items-center gap-2 border-2 border-gray-600 text-gray-400 hover:bg-gray-600/20 px-4 py-3 rounded-lg font-medium transition-all ml-auto"
          >
            <RotateCcw size={16} />
            重开
          </button>
        )}

        <div className="flex gap-2 ml-auto">
          <button
            onClick={onOpenReplay}
            disabled={status === 'idle'}
            className="flex items-center gap-2 border border-gray-600 text-gray-400 hover:bg-gray-600/20 px-4 py-3 rounded-lg font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <History size={16} />
            回放
          </button>
          <button
            onClick={onOpenReport}
            disabled={status === 'idle'}
            className="flex items-center gap-2 border border-gray-600 text-gray-400 hover:bg-gray-600/20 px-4 py-3 rounded-lg font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Settings size={16} />
            复盘
          </button>
        </div>
      </div>

      {currentActivity?.pausedAt && currentActivity.status !== 'settled' && (
        <div className="mt-4 p-3 bg-amber-900/30 border border-amber-700/50 rounded-lg text-sm text-amber-300">
          ⚠️ 最近一次暂停时间：{new Date(currentActivity.pausedAt).toLocaleTimeString()}
          （回放时会完整保留此暂停记录）
        </div>
      )}
    </div>
  )
}
