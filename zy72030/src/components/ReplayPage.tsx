import { useState, useEffect, useMemo } from 'react'
import { X, Play, Pause, SkipBack, SkipForward, ArrowLeft, Circle, CircleDot } from 'lucide-react'
import { useActivityStore } from '@/store'
import { cn, formatDateTime, formatTime } from '@/utils'
import {
  FAILURE_REASON_LABELS,
  SOURCE_LABELS,
  RESULT_LABELS,
} from '@/types'
import type { ExplorerRecord, PauseEvent } from '@/types'

interface TimelineEvent {
  id: string
  type: 'record' | 'pause' | 'resume'
  timestamp: string
  record?: ExplorerRecord
  pauseEvent?: PauseEvent
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function ReplayPage({ open, onClose }: Props) {
  const { currentActivity, records } = useActivityStore()
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  const timeline = useMemo<TimelineEvent[]>(() => {
    if (!currentActivity) return []
    const events: TimelineEvent[] = []

    records.forEach((r) => {
      events.push({
        id: `rec-${r.id}`,
        type: 'record',
        timestamp: r.processedAt,
        record: r,
      })
    })

    currentActivity.pauseEvents.forEach((pe, idx) => {
      events.push({
        id: `pause-${idx}`,
        type: pe.type,
        timestamp: pe.timestamp,
        pauseEvent: pe,
      })
    })

    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    return events
  }, [currentActivity, records])

  useEffect(() => {
    if (!isPlaying || currentIndex >= timeline.length - 1) {
      setIsPlaying(false)
      return
    }
    const delay = 1500 / playbackSpeed
    const timer = setTimeout(() => {
      setCurrentIndex((prev) => prev + 1)
    }, delay)
    return () => clearTimeout(timer)
  }, [isPlaying, currentIndex, timeline.length, playbackSpeed])

  useEffect(() => {
    setCurrentIndex(-1)
    setIsPlaying(false)
  }, [open])

  if (!open || !currentActivity) return null

  const currentEvent = currentIndex >= 0 ? timeline[currentIndex] : null
  const hasStarted = currentIndex >= 0

  const jumpTo = (idx: number) => {
    setCurrentIndex(idx)
    setIsPlaying(false)
  }

  const handlePlayPause = () => {
    if (currentIndex >= timeline.length - 1) {
      setCurrentIndex(-1)
      setIsPlaying(true)
    } else {
      setIsPlaying(!isPlaying)
    }
  }

  const handlePrev = () => {
    setIsPlaying(false)
    setCurrentIndex((prev) => Math.max(-1, prev - 1))
  }

  const handleNext = () => {
    setIsPlaying(false)
    setCurrentIndex((prev) => Math.min(timeline.length - 1, prev + 1))
  }

  const handleRestart = () => {
    setCurrentIndex(-1)
    setIsPlaying(false)
  }

  const getResultColor = (result: string) => {
    switch (result) {
      case 'success':
        return 'bg-emerald-500'
      case 'failure':
        return 'bg-red-500'
      case 'pending_review':
        return 'bg-amber-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="fixed inset-0 bg-[#1a1a2e] z-40 overflow-hidden">
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#0f3460] bg-[#16213e]">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            返回控制台
          </button>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            活动回放
          </h2>
          <div className="flex items-center gap-2 bg-[#0f3460] rounded-lg p-1 border border-[#0f3460]">
            {[0.5, 1, 2].map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={cn(
                  'px-3 py-1 rounded text-xs transition-colors',
                  playbackSpeed === speed
                    ? 'bg-[#f0a500] text-[#1a1a2e] font-medium'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/2 border-r border-[#0f3460] p-6 overflow-y-auto">
            <div className="relative pl-8">
              <div className="absolute left-[7px] top-0 bottom-0 w-0.5 bg-[#0f3460]" />

              {timeline.map((event, idx) => {
                const isActive = idx === currentIndex
                const isPast = idx < currentIndex

                return (
                  <div
                    key={event.id}
                    onClick={() => jumpTo(idx)}
                    className={cn(
                      'relative mb-4 p-4 rounded-lg border cursor-pointer transition-all',
                      isActive
                        ? 'bg-[#0f3460] border-[#f0a500] scale-[1.02]'
                        : isPast
                        ? 'bg-[#16213e] border-[#0f3460] opacity-60'
                        : 'bg-[#16213e] border-[#0f3460] hover:border-[#0f3460]'
                    )}
                  >
                    <div
                      className={cn(
                        'absolute -left-8 w-4 h-4 rounded-full border-2',
                        event.type === 'pause' || event.type === 'resume'
                          ? 'bg-[#16213e] border-amber-500'
                          : event.record?.result === 'success'
                          ? 'bg-emerald-500 border-emerald-400'
                          : event.record?.result === 'failure'
                          ? 'bg-red-500 border-red-400'
                          : 'bg-amber-500 border-amber-400',
                        isActive && 'ring-2 ring-[#f0a500] ring-offset-2 ring-offset-[#1a1a2e]'
                      )}
                    >
                      {(event.type === 'pause' || event.type === 'resume') && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {event.type === 'pause' ? (
                            <Pause size={8} className="text-amber-400" />
                          ) : (
                            <Play size={8} className="text-emerald-400" />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      {event.type === 'record' && event.record ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-[#f0a500] font-mono">
                              #{event.record.sequenceNumber}
                            </span>
                            <span
                              className={cn(
                                'w-2 h-2 rounded-full',
                                getResultColor(event.record.result)
                              )}
                            />
                            <span className="text-sm text-white">
                              {event.record.polyhedronType}
                            </span>
                          </div>
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded border',
                              event.record.source === 'realtime'
                                ? 'bg-blue-900/60 text-blue-300 border-blue-700'
                                : event.record.source === 'group_supplement'
                                ? 'bg-purple-900/60 text-purple-300 border-purple-700'
                                : 'bg-orange-900/60 text-orange-300 border-orange-700'
                            )}
                          >
                            {SOURCE_LABELS[event.record.source]}
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            {event.type === 'pause' ? (
                              <Pause size={14} className="text-amber-400" />
                            ) : (
                              <Play size={14} className="text-emerald-400" />
                            )}
                            <span className="text-sm font-medium text-amber-400">
                              {event.type === 'pause' ? '活动暂停' : '活动继续'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 font-mono">系统事件</span>
                        </>
                      )}
                    </div>

                    {event.type === 'record' && event.record && (
                      <>
                        <div className="text-sm text-gray-300 mb-2">
                          得分 <span className="text-yellow-400 font-mono">{event.record.score}</span>
                          {' · '}
                          耗时 <span className="text-blue-400 font-mono">{event.record.timeCostSeconds}s</span>
                          {' · '}
                          <span
                            className={cn(
                              event.record.result === 'success'
                                ? 'text-emerald-400'
                                : event.record.result === 'failure'
                                ? 'text-red-400'
                                : 'text-amber-400'
                            )}
                          >
                            {RESULT_LABELS[event.record.result]}
                          </span>
                        </div>
                        {event.record.failureDetail && (
                          <div className="p-2 bg-red-900/20 rounded text-xs text-red-300 border border-red-900/30">
                            {event.record.failureDetail}
                          </div>
                        )}
                        {event.record.rawNote && (
                          <div className="mt-2 text-xs text-gray-500 italic">
                            备注：{event.record.rawNote}
                          </div>
                        )}
                      </>
                    )}

                    <div className="mt-2 text-xs text-gray-600 font-mono">
                      {formatDateTime(event.timestamp)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="w-1/2 p-6 flex flex-col">
            <div className="flex-1 flex items-center justify-center">
              {!hasStarted ? (
                <div className="text-center text-gray-500">
                  <Circle size={64} className="mx-auto mb-4 opacity-30" />
                  <p className="text-lg">点击播放按钮开始回放</p>
                  <p className="text-sm mt-2">或点击左侧时间轴上的任意事件跳转</p>
                </div>
              ) : currentEvent ? (
                <div className="w-full">
                  {currentEvent.type === 'record' && currentEvent.record ? (
                    <div className="bg-[#16213e] rounded-2xl border border-[#0f3460] p-8">
                      <div className="flex items-center justify-center gap-3 mb-6">
                        <span className="text-6xl font-bold text-[#f0a500] font-mono">
                          #{currentEvent.record.sequenceNumber}
                        </span>
                        <div
                          className={cn(
                            'w-4 h-4 rounded-full',
                            getResultColor(currentEvent.record.result)
                          )}
                        />
                      </div>

                      <h3 className="text-3xl font-bold text-white text-center mb-6" style={{ fontFamily: '"Noto Serif SC", serif' }}>
                        {currentEvent.record.polyhedronType}
                      </h3>

                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-[#0f3460] rounded-xl p-4 text-center">
                          <div className="text-3xl font-bold text-yellow-400 font-mono mb-1">
                            {currentEvent.record.score}
                          </div>
                          <div className="text-xs text-gray-400">得分</div>
                        </div>
                        <div className="bg-[#0f3460] rounded-xl p-4 text-center">
                          <div className="text-3xl font-bold text-blue-400 font-mono mb-1">
                            {currentEvent.record.timeCostSeconds}s
                          </div>
                          <div className="text-xs text-gray-400">耗时</div>
                        </div>
                      </div>

                      <div className="text-center mb-4">
                        <span
                          className={cn(
                            'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                            currentEvent.record.result === 'success'
                              ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700'
                              : currentEvent.record.result === 'failure'
                              ? 'bg-red-900/50 text-red-400 border border-red-700'
                              : 'bg-amber-900/50 text-amber-400 border border-amber-700'
                          )}
                        >
                          <CircleDot size={14} />
                          {RESULT_LABELS[currentEvent.record.result]}
                        </span>
                      </div>

                      {currentEvent.record.failureReason && (
                        <div className="mb-4 p-3 bg-red-900/30 border border-red-800/50 rounded-lg">
                          <div className="text-sm text-red-300 font-medium mb-1">
                            {FAILURE_REASON_LABELS[currentEvent.record.failureReason]}
                          </div>
                          <div className="text-sm text-red-300/80">
                            {currentEvent.record.failureDetail}
                          </div>
                        </div>
                      )}

                      {currentEvent.record.rawNote && (
                        <div className="p-3 bg-[#0f3460] rounded-lg text-sm text-gray-400 italic">
                          原始备注：{currentEvent.record.rawNote}
                        </div>
                      )}

                      <div className="mt-4 flex justify-between text-xs text-gray-500 font-mono">
                        <span>
                          来源：
                          {SOURCE_LABELS[currentEvent.record.source]}
                        </span>
                        <span>{formatDateTime(currentEvent.timestamp)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#16213e] rounded-2xl border border-amber-700/50 p-8">
                      <div className="flex items-center justify-center mb-6">
                        <div className="p-4 bg-amber-900/30 rounded-full">
                          {currentEvent.type === 'pause' ? (
                            <Pause size={48} className="text-amber-400" />
                          ) : (
                            <Play size={48} className="text-emerald-400" />
                          )}
                        </div>
                      </div>
                      <h3 className="text-2xl font-bold text-amber-400 text-center mb-4" style={{ fontFamily: '"Noto Serif SC", serif' }}>
                        {currentEvent.type === 'pause' ? '活动暂停' : '活动继续'}
                      </h3>
                      <p className="text-center text-gray-400 text-sm">
                        {currentEvent.type === 'pause'
                          ? '计时已冻结，此暂停事件在回放中完整保留，不会被自动清洗。'
                          : '计时恢复，活动继续进行。'}
                      </p>
                      <div className="mt-6 text-center text-xs text-gray-500 font-mono">
                        {formatDateTime(currentEvent.timestamp)}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="mt-6 pt-6 border-t border-[#0f3460]">
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handleRestart}
                  className="p-3 text-gray-400 hover:text-white transition-colors"
                  title="从头开始"
                >
                  <SkipBack size={20} />
                </button>
                <button
                  onClick={handlePrev}
                  disabled={currentIndex < 0}
                  className="p-3 text-gray-400 hover:text-white transition-colors disabled:opacity-30"
                  title="上一个"
                >
                  <SkipBack size={24} />
                </button>
                <button
                  onClick={handlePlayPause}
                  className="p-5 bg-[#f0a500] hover:bg-[#f5b624] text-[#1a1a2e] rounded-full transition-colors"
                >
                  {isPlaying ? <Pause size={28} fill="#1a1a2e" /> : <Play size={28} fill="#1a1a2e" />}
                </button>
                <button
                  onClick={handleNext}
                  disabled={currentIndex >= timeline.length - 1}
                  className="p-3 text-gray-400 hover:text-white transition-colors disabled:opacity-30"
                  title="下一个"
                >
                  <SkipForward size={24} />
                </button>
                <button
                  onClick={() => jumpTo(timeline.length - 1)}
                  className="p-3 text-gray-400 hover:text-white transition-colors"
                  title="跳到结尾"
                >
                  <SkipForward size={20} />
                </button>
              </div>

              <div className="mt-4">
                <div className="h-1.5 bg-[#0f3460] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#f0a500] transition-all duration-200"
                    style={{
                      width: `${timeline.length > 0 ? ((currentIndex + 1) / timeline.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>{formatTime(0)}</span>
                  <span>
                    {currentIndex + 1} / {timeline.length} 事件
                  </span>
                  <span>{formatTime(currentActivity.totalElapsedSeconds)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
