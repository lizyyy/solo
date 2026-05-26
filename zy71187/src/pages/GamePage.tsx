import { useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { getLevelById } from '@/data/levels'
import { useGameStore } from '@/stores/gameStore'
import { calculateScore } from '@/utils/scoring'
import StudioScene from '@/components/game/StudioScene'
import InspectionPanel from '@/components/game/InspectionPanel'
import ResultPage from '@/components/result/ResultPage'
import type { GameHistory } from '@/types'

export default function GamePage() {
  const { levelId } = useParams<{ levelId: string }>()
  const navigate = useNavigate()
  const timerRef = useRef<number | null>(null)

  const {
    currentLevel,
    phase,
    timeRemaining,
    totalTime,
    matchedAccessories,
    markedDamages,
    depositCalculations,
    identifiedRedHerrings,
    markedNormalWears,
    actionHistory,
    lastScoreResult,
    selectedEquipmentId,
    startLevel,
    pause,
    resume,
    tick,
    submit,
    matchAccessory,
    unmatchAccessory,
    markDamage,
    unmarkDamage,
    calculateDeposit,
    identifyRedHerring,
    markNormalWear,
    setSelectedEquipment,
    reset,
    goToMenu,
    setScoreResult,
    saveHistory,
  } = useGameStore()

  useEffect(() => {
    if (levelId) {
      const level = getLevelById(levelId)
      if (level) {
        startLevel(levelId)
      } else {
        navigate('/')
      }
    }
  }, [levelId, startLevel, navigate])

  useEffect(() => {
    if (phase === 'playing') {
      timerRef.current = window.setInterval(() => {
        tick()
      }, 1000)
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [phase, tick])

  useEffect(() => {
    if (phase === 'playing' && timeRemaining <= 0 && currentLevel) {
      handleSubmit()
    }
  }, [timeRemaining, phase, currentLevel])

  const handleSubmit = useCallback(() => {
    if (!currentLevel) return

    const result = calculateScore(
      currentLevel,
      matchedAccessories,
      markedDamages,
      depositCalculations,
      markedNormalWears,
      identifiedRedHerrings,
      timeRemaining,
      totalTime,
    )

    setScoreResult(result)
    submit()

    const historyEntry: GameHistory = {
      levelId: currentLevel.id,
      levelName: currentLevel.name,
      score: result.score,
      passed: result.passed,
      failures: result.failures,
      timestamp: Date.now(),
    }
    saveHistory(historyEntry)
  }, [
    currentLevel,
    matchedAccessories,
    markedDamages,
    depositCalculations,
    timeRemaining,
    totalTime,
    setScoreResult,
    submit,
    saveHistory,
  ])

  const handlePause = useCallback(() => {
    pause()
  }, [pause])

  const handleResume = useCallback(() => {
    resume()
  }, [resume])

  const handleReset = useCallback(() => {
    reset()
  }, [reset])

  const handleGoHome = useCallback(() => {
    goToMenu()
    navigate('/')
  }, [goToMenu, navigate])

  const handleRetry = useCallback(() => {
    if (levelId) {
      startLevel(levelId)
    }
  }, [levelId, startLevel])

  const handleMatchAccessory = useCallback(
    (accId: string, eqId: string) => {
      matchAccessory(accId, eqId)
    },
    [matchAccessory],
  )

  const handleUnmatchAccessory = useCallback(
    (accId: string) => {
      unmatchAccessory(accId)
    },
    [unmatchAccessory],
  )

  const handleMarkDamage = useCallback(
    (eqId: string, dmgId: string) => {
      markDamage(eqId, dmgId)
    },
    [markDamage],
  )

  const handleUnmarkDamage = useCallback(
    (eqId: string) => {
      unmarkDamage(eqId)
    },
    [unmarkDamage],
  )

  const handleCalculateDeposit = useCallback(
    (eqId: string, amount: number) => {
      calculateDeposit(eqId, amount)
    },
    [calculateDeposit],
  )

  const handleIdentifyRedHerring = useCallback(
    (id: string) => {
      identifyRedHerring(id)
    },
    [identifyRedHerring],
  )

  const handleMarkNormalWear = useCallback(
    (id: string) => {
      markNormalWear(id)
    },
    [markNormalWear],
  )

  const handleSelectEquipment = useCallback(
    (id: string | null) => {
      setSelectedEquipment(id)
    },
    [setSelectedEquipment],
  )

  if (!currentLevel) {
    return (
      <div className="min-h-screen bg-[#1a2332] flex items-center justify-center text-white">
        加载中...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1a2332]">
      <AnimatePresence mode="wait">
        {phase === 'result' && lastScoreResult ? (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ResultPage
              level={currentLevel}
              scoreResult={lastScoreResult}
              actions={actionHistory}
              matchedAccessories={matchedAccessories}
              markedDamages={markedDamages}
              depositCalculations={depositCalculations}
              onRetry={handleRetry}
              onGoHome={handleGoHome}
            />
          </motion.div>
        ) : (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative h-screen"
          >
            <div className="absolute inset-0">
              <StudioScene
                level={currentLevel}
                selectedEquipmentId={selectedEquipmentId}
                onSelectEquipment={handleSelectEquipment}
                identifiedRedHerrings={identifiedRedHerrings}
                onIdentifyRedHerring={handleIdentifyRedHerring}
              />
            </div>
            <InspectionPanel
              level={currentLevel}
              matchedAccessories={matchedAccessories}
              markedDamages={markedDamages}
              depositCalculations={depositCalculations}
              selectedEquipmentId={selectedEquipmentId}
              identifiedRedHerrings={identifiedRedHerrings}
              markedNormalWears={markedNormalWears}
              timeRemaining={timeRemaining}
              phase={phase === 'playing' || phase === 'paused' ? phase : 'playing'}
              onMatchAccessory={handleMatchAccessory}
              onUnmatchAccessory={handleUnmatchAccessory}
              onMarkDamage={handleMarkDamage}
              onUnmarkDamage={handleUnmarkDamage}
              onCalculateDeposit={handleCalculateDeposit}
              onSelectEquipment={handleSelectEquipment}
              onIdentifyRedHerring={handleIdentifyRedHerring}
              onMarkNormalWear={handleMarkNormalWear}
              onPause={handlePause}
              onResume={handleResume}
              onReset={handleReset}
              onSubmit={handleSubmit}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
