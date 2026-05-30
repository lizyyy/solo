import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { LEVEL_CONFIGS } from '@/utils/constants'
import QuantumDice from '@/components/QuantumDice'
import ProbabilityBoardComponent from '@/components/ProbabilityBoard'
import SampleControl from '@/components/SampleControl'
import TaskCard from '@/components/TaskCard'
import FailurePanel from '@/components/FailurePanel'
import ReplayModal from '@/components/ReplayModal'

export default function Play() {
  const { levelId } = useParams<{ levelId: string }>()
  const navigate = useNavigate()

  const currentLevelId = useGameStore(s => s.currentLevelId)
  const diceState = useGameStore(s => s.diceState)
  const probabilityBoard = useGameStore(s => s.probabilityBoard)
  const sampleSize = useGameStore(s => s.sampleSize)
  const currentRecord = useGameStore(s => s.currentRecord)
  const failureFeedback = useGameStore(s => s.failureFeedback)
  const showFailurePanel = useGameStore(s => s.showFailurePanel)
  const showReplay = useGameStore(s => s.showReplay)

  const rollDice = useGameStore(s => s.rollDice)
  const measureDice = useGameStore(s => s.measureDice)
  const changeSampleSize = useGameStore(s => s.changeSampleSize)
  const resetSample = useGameStore(s => s.resetSample)
  const submitAnswer = useGameStore(s => s.submitAnswer)
  const enterLevel = useGameStore(s => s.enterLevel)
  const exitLevel = useGameStore(s => s.exitLevel)

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)

  const config = LEVEL_CONFIGS.find(l => l.id === levelId)

  useEffect(() => {
    if (levelId && (!currentLevelId || currentLevelId !== levelId)) {
      enterLevel(levelId)
    }
  }, [levelId, currentLevelId, enterLevel])

  useEffect(() => {
    setSelectedAnswer(null)
  }, [currentLevelId])

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-deep)' }}>
        <p style={{ color: 'var(--text-secondary)' }}>关卡不存在</p>
      </div>
    )
  }

  const handleBack = () => {
    exitLevel()
    navigate('/levels')
  }

  const handleReset = () => {
    enterLevel(levelId)
    setSelectedAnswer(null)
  }

  const handleSubmit = () => {
    if (selectedAnswer) {
      submitAnswer(selectedAnswer)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-grid noise-overlay" style={{ background: 'var(--bg-deep)' }}>
      <div className="relative z-10 min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="space-y-6">
              <div className="glow-border rounded-2xl p-8 flex items-center justify-center" style={{ background: 'var(--bg-card)', minHeight: '400px' }}>
                <QuantumDice
                  phase={diceState.phase}
                  collapsedValue={diceState.collapsedValue}
                  probabilities={diceState.probabilities}
                  onMeasure={measureDice}
                  disabled={currentRecord?.passed}
                />
              </div>
              <SampleControl
                sampleSize={sampleSize}
                onChangeSize={changeSampleSize}
                onRoll={rollDice}
                onReset={resetSample}
                disabled={currentRecord?.passed}
              />
            </div>

            <div className="space-y-6">
              <ProbabilityBoardComponent board={probabilityBoard} />
            </div>
          </div>

          <TaskCard
            config={config}
            attemptCount={currentRecord?.attemptCount || 0}
            selectedAnswer={selectedAnswer}
            onSelectAnswer={setSelectedAnswer}
            onSubmit={handleSubmit}
            onBack={handleBack}
            onReset={handleReset}
            passed={currentRecord?.passed || false}
            stars={currentRecord?.stars || 0}
          />
        </div>
      </div>

      {showFailurePanel && failureFeedback && (
        <FailurePanel feedback={failureFeedback} />
      )}

      {showReplay && <ReplayModal />}
    </div>
  )
}
