import { useState } from 'react'
import { Pause, Play, Clock } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}分${s}秒`
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function PauseControl() {
  const session = useGameStore((s) => s.session)
  const pauseGame = useGameStore((s) => s.pauseGame)
  const resumeGame = useGameStore((s) => s.resumeGame)
  const [reason, setReason] = useState('')
  const [showInput, setShowInput] = useState(false)

  if (!session) return null

  const isPlaying = session.status === 'playing'
  const isPaused = session.status === 'paused'

  const handlePause = () => {
    if (!reason.trim()) return
    pauseGame(reason.trim())
    setReason('')
    setShowInput(false)
  }

  const currentPause = session.pauseRecords.find((r) => r.resumedAt === null)

  return (
    <div className="card-cafe flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-cafe-brown" />
        <span className="text-sm font-medium text-cafe-brown">暂停控制</span>
      </div>

      {isPlaying && !showInput && (
        <button
          className="btn-secondary w-full flex items-center justify-center gap-1.5 text-sm py-2"
          onClick={() => setShowInput(true)}
        >
          <Pause className="w-4 h-4" />
          暂停游戏
        </button>
      )}

      {isPlaying && showInput && (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePause()}
            placeholder="请输入暂停原因..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-cafe-latte bg-cafe-cream/50 text-cafe-brown placeholder:text-cafe-brown/30 focus:outline-none focus:border-cafe-brown/40"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              className="btn-primary flex-1 text-xs py-1.5"
              onClick={handlePause}
              disabled={!reason.trim()}
            >
              确认暂停
            </button>
            <button
              className="btn-secondary flex-1 text-xs py-1.5"
              onClick={() => {
                setShowInput(false)
                setReason('')
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {isPaused && (
        <div className="flex flex-col gap-2">
          {currentPause && (
            <div className="text-xs text-risk-yellow bg-risk-yellow/10 rounded-lg px-3 py-2">
              暂停原因: {currentPause.reason}
            </div>
          )}
          <button
            className="btn-primary w-full flex items-center justify-center gap-1.5 text-sm py-2"
            onClick={resumeGame}
          >
            <Play className="w-4 h-4" />
            继续游戏
          </button>
        </div>
      )}

      {session.pauseRecords.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          <span className="text-xs text-cafe-brown/50">暂停记录</span>
          {session.pauseRecords.map((record) => (
            <div
              key={record.id}
              className="text-xs bg-cafe-cream/60 rounded-lg px-2.5 py-1.5 flex flex-col gap-0.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-cafe-brown/70">{formatTime(record.timestamp)}</span>
                {record.duration != null && (
                  <span className="text-cafe-brown/50">{formatDuration(record.duration)}</span>
                )}
              </div>
              <span className="text-cafe-brown/60 truncate">{record.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
