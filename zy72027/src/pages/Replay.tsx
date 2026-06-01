import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import RoundTimeline from '@/components/RoundTimeline'
import { formatTimestamp } from '@/utils/timeUtils'
import type { GameSession, PlayerChoice } from '@/types'

const NOTE_COLORS: Record<string, string> = {
  do: '#8b5cf6',
  re: '#06d6a0',
  mi: '#3b82f6',
  fa: '#f59e0b',
  sol: '#ef4444',
  la: '#ec4899',
  si: '#14b8a6',
}

const LANE_COUNT = 7
const JUDGE_LINE_OFFSET = 60

export default function Replay() {
  const navigate = useNavigate()
  const { sessions, currentSessionId } = useGameStore()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(currentSessionId)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentReplayRound, setCurrentReplayRound] = useState(0)
  const [replayProgress, setReplayProgress] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const replayStartRef = useRef<number>(0)
  const replayOffsetRef = useRef<number>(0)

  const endedSessions = useMemo(() => sessions.filter(s => s.status === 'ended'), [sessions])
  const activeSession = useMemo(() => {
    if (selectedSessionId) return sessions.find(s => s.id === selectedSessionId) || null
    const current = sessions.find(s => s.id === currentSessionId)
    return current?.status === 'ended' ? current : endedSessions[0] || null
  }, [selectedSessionId, sessions, currentSessionId, endedSessions])

  const sortedChoices = useMemo(() => {
    if (!activeSession) return []
    return [...activeSession.playerChoices].sort((a, b) => a.timestamp - b.timestamp)
  }, [activeSession])

  const totalDuration = useMemo(() => {
    if (!activeSession || !activeSession.startedAt || !activeSession.endedAt) return 0
    return activeSession.endedAt - activeSession.startedAt - activeSession.totalPausedDuration
  }, [activeSession])

  const handleJumpToRound = useCallback((round: number) => {
    if (!activeSession) return
    const firstInRound = activeSession.playerChoices.find(c => c.roundIndex === round)
    if (!firstInRound || !activeSession.startedAt) return
    const offset = firstInRound.timestamp - activeSession.startedAt - activeSession.totalPausedDuration
    replayOffsetRef.current = offset
    setCurrentReplayRound(round)
    setReplayProgress(totalDuration > 0 ? offset / totalDuration : 0)
  }, [activeSession, totalDuration])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !activeSession || !activeSession.startedAt) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = (time: number) => {
      const w = canvas.width / window.devicePixelRatio
      const h = canvas.height / window.devicePixelRatio
      ctx.clearRect(0, 0, w, h)

      const laneWidth = w / LANE_COUNT
      const judgeY = h - JUDGE_LINE_OFFSET

      for (let i = 0; i < LANE_COUNT; i++) {
        const x = i * laneWidth
        ctx.fillStyle = i % 2 === 0 ? 'rgba(139,92,246,0.03)' : 'rgba(6,214,160,0.03)'
        ctx.fillRect(x, 0, laneWidth, h)
      }

      ctx.strokeStyle = 'rgba(139,92,246,0.4)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, judgeY)
      ctx.lineTo(w, judgeY)
      ctx.stroke()

      let currentOffset = replayOffsetRef.current
      if (isPlaying) {
        if (!replayStartRef.current) replayStartRef.current = time
        currentOffset += (time - replayStartRef.current)
      }

      const currentTime = (activeSession.startedAt || 0) + currentOffset + activeSession.totalPausedDuration

      for (const choice of sortedChoices) {
        const noteTime = choice.timestamp
        const relTime = (noteTime - currentTime) / 1000
        if (relTime < -1 || relTime > 3) continue

        const lane = Math.abs(hashCode(choice.noteId)) % LANE_COUNT
        const laneX = lane * laneWidth + laneWidth / 2
        const noteY = judgeY - relTime * 150

        const color = NOTE_COLORS[choice.action === 'hit' ? 'do' : choice.action === 'wrong' ? 'fa' : 'sol'] || '#8b5cf6'

        ctx.save()
        if (Math.abs(noteY - judgeY) < 30) {
          ctx.shadowColor = color
          ctx.shadowBlur = 16
        }
        ctx.fillStyle = Math.abs(noteY - judgeY) < 30 ? color : color + 'aa'
        ctx.beginPath()
        ctx.ellipse(laneX, noteY, 22, 16, 0, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = 'rgba(255,255,255,0.8)'
        ctx.font = 'bold 10px "Orbitron", monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const actionLabel = choice.action === 'hit' ? '✓' : choice.action === 'wrong' ? '✗' : '○'
        ctx.fillText(actionLabel, laneX, noteY)
        ctx.restore()
      }

      if (isPlaying && totalDuration > 0) {
        const progress = currentOffset / totalDuration
        setReplayProgress(Math.min(1, Math.max(0, progress)))

        const currentChoice = sortedChoices.filter(c => c.timestamp <= currentTime).pop()
        if (currentChoice) {
          setCurrentReplayRound(currentChoice.roundIndex)
        }

        if (currentOffset >= totalDuration) {
          setIsPlaying(false)
        }
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [activeSession, sortedChoices, isPlaying, totalDuration])

  const handlePlayPause = () => {
    if (isPlaying) {
      replayOffsetRef.current += performance.now() - replayStartRef.current
      setIsPlaying(false)
    } else {
      replayStartRef.current = 0
      setIsPlaying(true)
    }
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeSession || totalDuration <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    const offset = ratio * totalDuration
    replayOffsetRef.current = offset
    replayStartRef.current = 0
    setReplayProgress(ratio)
  }

  if (endedSessions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <p className="text-lg text-gray-500">暂无可回放的游戏</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 rounded-lg bg-purple-600/60 hover:bg-purple-500/60 text-white text-sm font-medium">
            前往操控台
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-bold text-purple-300">回放</h2>
        <div className="flex gap-1">
          {endedSessions.map(s => (
            <button
              key={s.id}
              onClick={() => { setSelectedSessionId(s.id); setIsPlaying(false); replayOffsetRef.current = 0; setReplayProgress(0); setCurrentReplayRound(0); }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                activeSession?.id === s.id
                  ? 'bg-purple-600/40 text-purple-300 border border-purple-500/60'
                  : 'bg-gray-800/40 text-gray-500 hover:text-gray-300 border border-transparent'
              }`}
            >
              {s.levelParams.name}
            </button>
          ))}
        </div>
      </div>

      {activeSession && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3 space-y-3">
            <div className="relative rounded-xl overflow-hidden border border-purple-900/40 bg-[#080b1f]">
              <canvas ref={canvasRef} className="w-full" style={{ height: '420px' }} />
            </div>

            <div className="bg-[#12163a]/80 rounded-xl border border-purple-900/40 p-3">
              <div className="flex items-center gap-3">
                <button onClick={handlePlayPause} className="px-4 py-1.5 rounded-lg bg-purple-600/60 hover:bg-purple-500/60 text-white text-sm font-medium transition-all">
                  {isPlaying ? '暂停' : '播放'}
                </button>
                <div className="flex-1 h-2 bg-gray-800 rounded-full cursor-pointer" onClick={handleProgressClick}>
                  <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${replayProgress * 100}%` }} />
                </div>
                <span className="text-xs text-gray-500 font-mono">{Math.round(replayProgress * 100)}%</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <RoundTimeline
              choices={activeSession.playerChoices}
              currentRound={currentReplayRound}
              onJumpToRound={(round) => { handleJumpToRound(round); if (isPlaying) { replayOffsetRef.current += performance.now() - replayStartRef.current; replayStartRef.current = 0; } }}
            />

            {activeSession.notes.length > 0 && (
              <div className="bg-[#12163a]/80 rounded-xl border border-purple-900/40 p-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-300">本局备注</h3>
                {activeSession.notes.map(note => (
                  <div key={note.id} className="text-xs text-gray-400">
                    <span className="text-purple-400">R{note.roundIndex}</span> — {note.content}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function hashCode(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i)
    hash |= 0
  }
  return hash
}
