import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, RotateCcw } from 'lucide-react'
import { useGameStore } from '@/store/gameStore'
import { getEventSummary, exportEvents } from '@/engine/eventLog'
import EventTimeline from '@/components/EventTimeline'
import EvidencePanel from '@/components/EvidencePanel'
import type { GameEvent } from '@/types/game'

export default function Replay() {
  const navigate = useNavigate()
  const events = useGameStore((s) => s.events)
  const score = useGameStore((s) => s.score)
  const combo = useGameStore((s) => s.maxCombo)
  const totalRounds = useGameStore((s) => s.totalRounds)
  const resetGame = useGameStore((s) => s.resetGame)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null

  const correctCount = events.filter((e) => e.feedback.type === 'correct').length
  const wrongCount = events.filter((e) => e.feedback.type === 'wrong').length
  const timeoutCount = events.filter((e) => e.feedback.type === 'timeout').length
  const accuracy = events.length > 0 ? ((correctCount / events.length) * 100).toFixed(1) : '0'

  const handleExportAll = () => {
    const blob = new Blob([exportEvents(events)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `game-log-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleRestart = () => {
    resetGame()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-bg-deep relative">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 font-body text-white/60 hover:text-primary-orange transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            返回主页
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportAll}
              className="btn-magic btn-magic-purple !px-4 !py-2 !text-sm flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              导出全部日志
            </button>
            <button
              onClick={handleRestart}
              className="btn-magic btn-magic-orange !px-4 !py-2 !text-sm flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              再来一局
            </button>
          </div>
        </div>

        <div className="card-magic mb-6">
          <h2 className="font-display text-2xl text-primary-orange mb-4">成绩单</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-bg-surface/50 rounded-xl p-4 text-center">
              <div className="font-display text-3xl text-primary-orange">{score}</div>
              <div className="font-body text-xs text-white/50 mt-1">总分</div>
            </div>
            <div className="bg-bg-surface/50 rounded-xl p-4 text-center">
              <div className="font-display text-3xl text-primary-purple">{combo}x</div>
              <div className="font-body text-xs text-white/50 mt-1">最高连击</div>
            </div>
            <div className="bg-bg-surface/50 rounded-xl p-4 text-center">
              <div className="font-display text-3xl text-success">{accuracy}%</div>
              <div className="font-body text-xs text-white/50 mt-1">正确率</div>
            </div>
            <div className="bg-bg-surface/50 rounded-xl p-4 text-center">
              <div className="font-display text-3xl text-danger">{wrongCount}</div>
              <div className="font-body text-xs text-white/50 mt-1">错误</div>
            </div>
            <div className="bg-bg-surface/50 rounded-xl p-4 text-center">
              <div className="font-display text-3xl text-yellow-400">{timeoutCount}</div>
              <div className="font-body text-xs text-white/50 mt-1">超时</div>
            </div>
          </div>
        </div>

        <div className="card-magic mb-6">
          <h3 className="font-display text-lg text-primary-purple mb-3">事件时间线</h3>
          <p className="font-body text-xs text-white/40 mb-3">
            点击圆点查看详细证据链（手势数据 / 音阶判定 / 节拍同步）
          </p>
          {events.length > 0 ? (
            <EventTimeline
              events={events}
              selectedEventId={selectedEventId}
              onSelectEvent={setSelectedEventId}
            />
          ) : (
            <div className="font-body text-white/30 text-center py-8">
              暂无事件记录
            </div>
          )}
        </div>

        {events.length > 0 && (
          <div className="card-magic">
            <h3 className="font-display text-lg text-primary-orange mb-3">事件摘要</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {events.map((event: GameEvent) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEventId(event.id)}
                  className={`w-full text-left px-4 py-2 rounded-lg font-body text-sm transition-colors ${
                    selectedEventId === event.id
                      ? 'bg-primary-orange/20 text-primary-orange'
                      : 'bg-bg-surface/30 text-white/60 hover:bg-bg-surface/50'
                  }`}
                >
                  {getEventSummary(event)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <EvidencePanel event={selectedEvent} />
    </div>
  )
}
