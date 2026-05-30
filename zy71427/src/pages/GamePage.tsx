import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGameStore } from '@/store/gameStore'
import RestaurantScene from '@/components/game/RestaurantScene'
import TimerBar from '@/components/ui/TimerBar'
import StatusPanel from '@/components/ui/StatusPanel'
import TaskPanel from '@/components/ui/TaskPanel'
import RiskDashboard from '@/components/ui/RiskDashboard'
import GameOverModal from '@/components/ui/GameOverModal'
import StartScreen from '@/components/ui/StartScreen'
import { ShieldAlert, Pause, Play } from 'lucide-react'

export default function GamePage() {
  const gameStarted = useGameStore(s => s.gameStarted)
  const gameOver = useGameStore(s => s.gameOver)
  const gamePaused = useGameStore(s => s.gamePaused)
  const selectedWaiterId = useGameStore(s => s.selectedWaiterId)
  const pauseGame = useGameStore(s => s.pauseGame)
  const resumeGame = useGameStore(s => s.resumeGame)
  const toggleRiskDashboard = useGameStore(s => s.toggleRiskDashboard)
  const tick = useGameStore(s => s.tick)

  useEffect(() => {
    if (!gameStarted || gameOver) return

    const TICK_INTERVAL = 16
    const intervalId = setInterval(() => {
      if (!gamePaused) {
        tick(TICK_INTERVAL)
      }
    }, TICK_INTERVAL)

    return () => {
      clearInterval(intervalId)
    }
  }, [gameStarted, gameOver, gamePaused, tick])

  return (
    <div className="w-full h-screen flex flex-col bg-[#0D0D1A] overflow-hidden">
      {!gameStarted && <StartScreen />}

      {gameStarted && <TimerBar />}

      <div className="flex-1 flex min-h-0">
        {gameStarted && <StatusPanel />}

        <div className="flex-1 relative min-h-0">
          <Canvas
            className="w-full h-full"
            gl={{ antialias: true }}
            dpr={[1, 2]}
          >
            <RestaurantScene />
          </Canvas>

          {gameStarted && (
            <button
              onClick={toggleRiskDashboard}
              className="absolute bottom-4 left-4 bg-[#1A1A2E]/80 hover:bg-[#1A1A2E] text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors border border-white/10"
            >
              <ShieldAlert className="w-4 h-4 text-[#F0A500]" />
              风险面板
            </button>
          )}

          {gameStarted && (
            <button
              onClick={gamePaused ? resumeGame : pauseGame}
              className="absolute bottom-4 right-4 bg-[#1A1A2E]/80 hover:bg-[#1A1A2E] text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors border border-white/10"
            >
              {gamePaused ? (
                <><Play className="w-4 h-4 text-green-400" /> 继续</>
              ) : (
                <><Pause className="w-4 h-4 text-amber-400" /> 暂停</>
              )}
            </button>
          )}

          {gameStarted && selectedWaiterId && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#F0A500] text-black px-4 py-2 rounded-lg text-sm font-bold shadow-lg animate-pulse">
              已选择服务员 {selectedWaiterId.toUpperCase()}，点击任务分配
            </div>
          )}

          {gameStarted && gamePaused && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="bg-[#1A1A2E] px-8 py-4 rounded-xl border border-white/10">
                <p className="text-white text-xl font-bold">已暂停</p>
              </div>
            </div>
          )}
        </div>

        {gameStarted && <TaskPanel />}
      </div>

      {gameStarted && <RiskDashboard />}
      {gameOver && <GameOverModal />}
    </div>
  )
}
