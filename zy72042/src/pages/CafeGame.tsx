import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Clock, Coins, ArrowLeft } from 'lucide-react'
import ResourceShelf from '@/components/cafe/ResourceShelf'
import OperationTable from '@/components/cafe/OperationTable'
import ScoreGauge from '@/components/cafe/ScoreGauge'
import RiskBar from '@/components/cafe/RiskBar'
import PauseControl from '@/components/cafe/PauseControl'
import ToastContainer from '@/components/feedback/ToastContainer'
import FailureDiagnosisModal from '@/components/feedback/FailureDiagnosis'
import FundCard from '@/components/cafe/FundCard'
import { useGameStore } from '@/stores/gameStore'
import { useLevelStore } from '@/stores/levelStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useGameTimer } from '@/hooks/useGameTimer'
import { diagnoseFailure } from '@/engine/failureDiagnoser'
import { LEVELS } from '@/data/levels'
import { FUND_ASSETS } from '@/data/funds'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function CafeGame() {
  const { levelId } = useParams<{ levelId: string }>()
  const navigate = useNavigate()
  const session = useGameStore((s) => s.session)
  const startGame = useGameStore((s) => s.startGame)
  const resetGame = useGameStore((s) => s.resetGame)
  const submitPortfolio = useGameStore((s) => s.submitPortfolio)
  const addFundToPortfolio = useGameStore((s) => s.addFundToPortfolio)
  const gameActions = useGameStore((s) => s.actions)
  const gameExceptions = useGameStore((s) => s.exceptions)
  const markLevelCompleted = useLevelStore((s) => s.markLevelCompleted)
  const saveSession = useHistoryStore((s) => s.saveSession)
  const { startTimer, stopTimer } = useGameTimer()

  const [showDiagnosis, setShowDiagnosis] = useState(false)
  const [activeFundId, setActiveFundId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = (event: { active: { id: string | number } }) => {
    setActiveFundId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveFundId(null)

    if (over && over.id === 'operation-table') {
      const fundId = String(active.id)
      addFundToPortfolio(fundId, 0.2)
    }
  }

  useEffect(() => {
    if (!session && levelId) {
      startGame(levelId)
      startTimer()
    }
    return () => {
      stopTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!session) return

    if (session.status === 'completed') {
      stopTimer()
      markLevelCompleted(session.levelId)
      saveSession({ ...session, actions: gameActions, exceptions: gameExceptions })
      navigate(`/summary/${session.id}`)
    }

    if (session.status === 'failed') {
      stopTimer()
      saveSession({ ...session, actions: gameActions, exceptions: gameExceptions })
      setShowDiagnosis(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status])

  const level = LEVELS.find((l) => l.id === session?.levelId)
  const activeFund = activeFundId ? FUND_ASSETS.find((f) => f.id === activeFundId) : null

  const handleRetry = () => {
    const lid = session?.levelId ?? levelId ?? ''
    resetGame()
    startGame(lid)
    startTimer()
    setShowDiagnosis(false)
  }

  const handleChangeLevel = () => {
    resetGame()
    navigate('/')
  }

  const diagnosis = session && level
    ? diagnoseFailure(session, level, gameActions)
    : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="pt-16 min-h-screen flex flex-col">
        <div className="bg-cafe-brown text-cafe-cream px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              className="flex items-center gap-1 text-sm opacity-80 hover:opacity-100 transition-opacity"
              onClick={() => { resetGame(); navigate('/') }}
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
            <span className="font-serif font-bold">{level?.name ?? '加载中...'}</span>
          </div>

          <div className="flex items-center gap-4">
            {session && (
              <>
                <div className="flex items-center gap-1.5 text-sm">
                  <Clock className="w-4 h-4" />
                  <span className="font-mono">{formatTime(session.remainingTime)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Coins className="w-4 h-4" />
                  <span>{session.remainingResources.toFixed(0)}</span>
                </div>
              </>
            )}
            <button
              className="btn-primary text-xs py-1.5 px-4"
              onClick={submitPortfolio}
              disabled={!session || session.status !== 'playing'}
            >
              提交组合
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <ResourceShelf />
          <div className="flex-1 p-4 overflow-y-auto">
            <OperationTable />
          </div>
          <div className="w-72 min-w-72 flex flex-col gap-4 p-4 overflow-y-auto">
            {session && level && (
              <>
                <ScoreGauge score={session.currentScore} targetScore={level.targetScore} />
                <RiskBar risk={session.currentRisk} riskLimit={level.riskLimit} />
              </>
            )}
            <PauseControl />
          </div>
        </div>

        <ToastContainer />

        {diagnosis && (
          <FailureDiagnosisModal
            diagnosis={diagnosis}
            onRetry={handleRetry}
            onChangeLevel={handleChangeLevel}
            onPause={() => setShowDiagnosis(false)}
            visible={showDiagnosis}
          />
        )}
      </div>

      <DragOverlay>
        {activeFund && (
          <div className="opacity-90 scale-105 shadow-2xl pointer-events-none">
            <FundCard fund={activeFund} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
