import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import StatusIndicator from '@/components/StatusIndicator'
import GameControls from '@/components/GameControls'
import LevelSelector from '@/components/LevelSelector'
import BarrageCanvas from '@/components/BarrageCanvas'
import PlayerRecord from '@/components/PlayerRecord'
import { formatDuration } from '@/utils/timeUtils'
import type { LevelParams } from '@/types'

export default function Console() {
  const navigate = useNavigate()
  const {
    sessions,
    currentSessionId,
    availableLevels,
    startGame,
    pauseGame,
    resumeGame,
    restartGame,
    endGame,
    addPlayerChoice,
    getCurrentSession,
  } = useGameStore()

  const [selectedLevel, setSelectedLevel] = useState<LevelParams | null>(null)
  const [elapsed, setElapsed] = useState('00:00')
  const [endedDialog, setEndedDialog] = useState(false)

  const currentSession = getCurrentSession()

  useEffect(() => {
    if (!currentSession || currentSession.status !== 'playing') return
    const timer = setInterval(() => {
      if (!currentSession.startedAt) return
      const now = Date.now()
      const total = now - currentSession.startedAt - currentSession.totalPausedDuration
      setElapsed(formatDuration(Math.max(0, total)))
    }, 200)
    return () => clearInterval(timer)
  }, [currentSession])

  useEffect(() => {
    if (currentSession?.status === 'ended' && !endedDialog) {
      setEndedDialog(true)
    }
  }, [currentSession?.status, endedDialog])

  const handleStart = useCallback(() => {
    if (!selectedLevel) return
    startGame(selectedLevel)
  }, [selectedLevel, startGame])

  const handlePause = useCallback(() => { pauseGame() }, [pauseGame])
  const handleResume = useCallback(() => { resumeGame() }, [resumeGame])
  const handleRestart = useCallback(() => {
    restartGame()
    setElapsed('00:00')
  }, [restartGame])

  const handleEnd = useCallback(() => {
    endGame('手动结束')
  }, [endGame])

  const handleNoteHit = useCallback((noteId: string, action: 'hit' | 'miss' | 'wrong') => {
    const scoreMap = { hit: 100 + Math.floor(Math.random() * 80), miss: 0, wrong: -(10 + Math.floor(Math.random() * 20)) }
    addPlayerChoice(noteId, action, scoreMap[action])
  }, [addPlayerChoice])

  const handleGoSettlement = () => {
    setEndedDialog(false)
    navigate('/settlement')
  }

  const status = currentSession?.status || 'idle'
  const currentRound = currentSession?.currentRound || 0
  const choices = currentSession?.playerChoices || []
  const speedMul = currentSession?.levelParams.speedMultiplier || selectedLevel?.speedMultiplier || 1

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusIndicator status={status} />
          {currentSession && (
            <span className="text-xs text-gray-500">
              {currentSession.levelParams.name} | 来源: {currentSession.source} | 录入: {new Date(currentSession.createdAt).toLocaleString('zh-CN')}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <LevelSelector
            levels={availableLevels}
            selectedId={selectedLevel?.id || null}
            onSelect={setSelectedLevel}
            disabled={status === 'playing' || status === 'paused'}
          />
          <GameControls
            status={status}
            currentRound={currentRound}
            elapsed={elapsed}
            onStart={handleStart}
            onPause={handlePause}
            onResume={handleResume}
            onRestart={handleRestart}
            onEnd={handleEnd}
          />
        </div>

        <div className="lg:col-span-3 space-y-4">
          <BarrageCanvas
            status={status}
            speedMultiplier={speedMul}
            onNoteHit={handleNoteHit}
          />
          <PlayerRecord choices={choices} />
        </div>
      </div>

      {endedDialog && currentSession?.status === 'ended' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#12163a] border border-purple-800/60 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h2 className="text-lg font-bold text-purple-300 mb-2">游戏结束</h2>
            <p className="text-sm text-gray-400 mb-1">结束原因：{currentSession.endReason}</p>
            <p className="text-sm text-gray-400 mb-4">
              回合数：<span className="text-cyan-400 font-bold">{currentSession.currentRound}</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setEndedDialog(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-700/60 hover:bg-gray-600/60 text-gray-300 text-sm font-medium transition-all"
              >
                留在操控台
              </button>
              <button
                onClick={handleGoSettlement}
                className="flex-1 px-4 py-2 rounded-lg bg-purple-600/80 hover:bg-purple-500/80 text-white text-sm font-medium transition-all shadow-[0_0_12px_rgba(139,92,246,0.3)]"
              >
                查看结算
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
